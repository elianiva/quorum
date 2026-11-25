//! A formatter for content files.
//!
//! It keeps the reader's syntax and the source spelling of atoms, then lays forms out by their
//! meaning: keyword fields go one per line and line up, and table rows line up by column. Columns
//! align from the left up to the first one wider than [`MAX_CELL`]; padding prose columns makes
//! every row harder to scan.

use crate::reader::{read, Kind, Sexp};
use crate::source::FileId;

const WIDTH: usize = 100;
const MAX_CELL: usize = 28;

/// Formats one content file. It refuses syntax the reader already rejects, and it refuses comments
/// inside a form, which have no place in the field layout yet.
pub fn format(text: &str) -> Result<String, String> {
    let (forms, sink) = read(FileId(0), text);
    if sink.has_errors() {
        return Err("cannot format a file with reader errors".into());
    }
    let comments = comments(text)?;
    for (start, _) in &comments {
        if forms
            .iter()
            .any(|form| *start > form.span.start as usize && *start < form.span.end as usize)
        {
            return Err("comments inside a form are not supported by the formatter".into());
        }
    }

    enum Item<'a> {
        Form(&'a Sexp),
        Comment(&'a str),
    }
    let mut items: Vec<(usize, Item)> = forms
        .iter()
        .map(|form| (form.span.start as usize, Item::Form(form)))
        .chain(
            comments
                .iter()
                .map(|(start, end)| (*start, Item::Comment(text[*start..*end].trim_end()))),
        )
        .collect();
    items.sort_by_key(|(start, _)| *start);

    let printer = Printer { src: text };
    let mut out = String::new();
    let mut previous_was_form = false;
    for (_, item) in items {
        match item {
            Item::Comment(comment) => {
                if previous_was_form {
                    out.push('\n');
                }
                out.push_str(comment);
                out.push('\n');
                previous_was_form = false;
            }
            Item::Form(form) => {
                if previous_was_form {
                    out.push('\n');
                }
                out.push_str(&printer.render(form, 0));
                out.push('\n');
                previous_was_form = true;
            }
        }
    }
    Ok(out)
}

/// The `;` comments in a file. Semicolons inside strings are not comments.
fn comments(text: &str) -> Result<Vec<(usize, usize)>, String> {
    let bytes = text.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'"' => {
                i += 1;
                while i < bytes.len() {
                    match bytes[i] {
                        b'\\' => i += 2,
                        b'"' => {
                            i += 1;
                            break;
                        }
                        _ => i += 1,
                    }
                }
            }
            b'#' if bytes.get(i + 1) == Some(&b';') => {
                return Err("`#;` forms are not supported by the formatter".into());
            }
            b';' => {
                let start = i;
                while i < bytes.len() && bytes[i] != b'\n' {
                    i += 1;
                }
                out.push((start, i));
            }
            _ => i += 1,
        }
    }
    Ok(out)
}

struct Printer<'a> {
    src: &'a str,
}

#[derive(Clone, Copy)]
struct Field<'a> {
    key: &'a Sexp,
    value: Option<&'a Sexp>,
}

impl Printer<'_> {
    fn text(&self, sexp: &Sexp) -> String {
        self.src[sexp.span.start as usize..sexp.span.end as usize].to_string()
    }

    fn length(&self, value: &str) -> usize {
        value.chars().count()
    }

    /// One line with no line breaks.
    fn compact(&self, sexp: &Sexp) -> String {
        match &sexp.kind {
            Kind::List(items) => {
                if let Some(prefix) = prefix(items) {
                    return format!("{prefix}{}", self.compact(&items[1]));
                }
                format!(
                    "({})",
                    items
                        .iter()
                        .map(|item| self.compact(item))
                        .collect::<Vec<_>>()
                        .join(" ")
                )
            }
            Kind::Row(items) => format!(
                "[{}]",
                items
                    .iter()
                    .map(|item| self.compact(item))
                    .collect::<Vec<_>>()
                    .join(" ")
            ),
            _ => self.text(sexp),
        }
    }

    fn render(&self, sexp: &Sexp, indent: usize) -> String {
        match &sexp.kind {
            Kind::List(items) => self.list(items, indent),
            Kind::Row(items) => self.row(items, indent),
            _ => self.text(sexp),
        }
    }

    /// A value stays on one line when it fits where it starts. Atoms always stay on one line,
    /// because a string or a number has no useful place to break.
    fn value(&self, sexp: &Sexp, column: usize) -> String {
        let flat = self.compact(sexp);
        if matches!(
            sexp.kind,
            Kind::Str(_) | Kind::Num(_) | Kind::Symbol(_) | Kind::Keyword(_)
        ) || column + self.length(&flat) <= WIDTH
        {
            return flat;
        }
        self.render(sexp, column)
    }

    fn list(&self, items: &[Sexp], indent: usize) -> String {
        if items.is_empty() {
            return "()".into();
        }
        if let Some(prefix) = prefix(items) {
            let flat = format!("{prefix}{}", self.compact(&items[1]));
            if indent + self.length(&flat) <= WIDTH {
                return flat;
            }
            return format!("{prefix}{}", self.render(&items[1], indent + 1));
        }
        if items[0].keyword().is_some() {
            return self.record(items, indent);
        }
        match items[0].symbol() {
            Some("def") => self.def(items, indent),
            Some("defmacro") => self.defmacro(items, indent),
            Some("const") => self.def(items, indent),
            Some("type") => self.type_def(items, indent),
            Some("constants") => self.constants(items, indent),
            Some("table") => self.table(items, indent),
            Some("records") => self.records(items, indent),
            Some("state") => self.state(items, indent),
            _ => self.form(items, indent),
        }
    }

    fn form(&self, items: &[Sexp], indent: usize) -> String {
        let (positional, fields) = split_fields(items, 1);
        if fields.is_empty() {
            let flat = self.compact(&Sexp {
                kind: Kind::List(items.to_vec()),
                span: items[0].span,
            });
            if indent + self.length(&flat) <= WIDTH {
                return flat;
            }
            return self.sequence(items, indent);
        }
        let mut out = self.open(items[0].symbol().unwrap_or(""), &positional);
        out.push_str(&self.pairs(&fields, indent + 2));
        out.push(')');
        out
    }

    fn open(&self, head: &str, positional: &[&Sexp]) -> String {
        let mut out = format!("({head}");
        for item in positional {
            out.push(' ');
            out.push_str(&self.compact(item));
        }
        out
    }

    fn pairs(&self, fields: &[Field], indent: usize) -> String {
        let width = fields
            .iter()
            .map(|field| self.length(&self.text(field.key)))
            .max()
            .unwrap_or(0);
        let mut out = String::new();
        for field in fields {
            let key = self.text(field.key);
            let pad = width - self.length(&key);
            out.push('\n');
            out.push_str(&" ".repeat(indent));
            out.push_str(&key);
            if let Some(value) = field.value {
                out.push_str(&" ".repeat(pad + 1));
                let column = indent + width + 1;
                out.push_str(&self.value(value, column));
            }
        }
        out
    }

    fn record(&self, items: &[Sexp], indent: usize) -> String {
        if !items.len().is_multiple_of(2) {
            return self.sequence(items, indent);
        }
        let fields: Vec<Field> = items
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| Field {
                key: &pair[0],
                value: Some(&pair[1]),
            })
            .collect();
        let width = fields
            .iter()
            .map(|field| self.length(&self.text(field.key)))
            .max()
            .unwrap_or(0);
        let mut out = String::from("(");
        for (at, field) in fields.iter().enumerate() {
            if at > 0 {
                out.push('\n');
                out.push_str(&" ".repeat(indent + 1));
            }
            let key = self.text(field.key);
            let pad = width - self.length(&key);
            out.push_str(&key);
            out.push_str(&" ".repeat(pad + 1));
            let column = indent + 1 + width + 1;
            out.push_str(&self.value(field.value.unwrap(), column));
        }
        out.push(')');
        out
    }

    fn sequence(&self, items: &[Sexp], indent: usize) -> String {
        if items.iter().all(|item| {
            matches!(
                item.kind,
                Kind::Symbol(_) | Kind::Keyword(_) | Kind::Str(_) | Kind::Num(_)
            )
        }) {
            let mut out = String::from("(");
            let mut column = indent + 1;
            for (at, item) in items.iter().enumerate() {
                let part = self.compact(item);
                if at > 0 && column + 1 + self.length(&part) > WIDTH {
                    out.push('\n');
                    out.push_str(&" ".repeat(indent + 1));
                    column = indent + 1;
                } else if at > 0 {
                    out.push(' ');
                    column += 1;
                }
                out.push_str(&part);
                column += self.length(&part);
            }
            out.push(')');
            return out;
        }
        let mut out = String::from("(");
        out.push_str(&self.compact(&items[0]));
        for item in &items[1..] {
            out.push('\n');
            out.push_str(&" ".repeat(indent + 2));
            out.push_str(&self.render(item, indent + 2));
        }
        out.push(')');
        out
    }

    fn row(&self, items: &[Sexp], indent: usize) -> String {
        if items.is_empty() {
            return "[]".into();
        }
        let flat = self.compact(&Sexp {
            kind: Kind::Row(items.to_vec()),
            span: items[0].span,
        });
        if indent + self.length(&flat) <= WIDTH {
            return flat;
        }
        let mut out = String::from("[");
        let mut column = indent + 1;
        for (at, item) in items.iter().enumerate() {
            let part = self.compact(item);
            if at > 0 && column + 1 + self.length(&part) > WIDTH {
                out.push('\n');
                out.push_str(&" ".repeat(indent + 1));
                column = indent + 1;
            } else if at > 0 {
                out.push(' ');
                column += 1;
            }
            out.push_str(&part);
            column += self.length(&part);
        }
        out.push(']');
        out
    }

    fn def(&self, items: &[Sexp], indent: usize) -> String {
        if items.len() < 2 {
            return self.sequence(items, indent);
        }
        let head = items[0].symbol().unwrap_or("def");
        let name = self.compact(&items[1]);
        let (fields, value) = attrs_and_value(&items[2..]);
        if fields.is_empty() {
            let flat = self.compact(&Sexp {
                kind: Kind::List(items.to_vec()),
                span: items[0].span,
            });
            if indent + self.length(&flat) <= WIDTH {
                return flat;
            }
            let mut out = format!("({head} {name}");
            for item in value {
                out.push('\n');
                out.push_str(&" ".repeat(indent + 2));
                out.push_str(&self.render(item, indent + 2));
            }
            out.push(')');
            return out;
        }
        let mut out = format!("({head} {name}");
        out.push_str(&self.pairs(&fields, indent + 2));
        for item in value {
            out.push('\n');
            out.push_str(&" ".repeat(indent + 2));
            out.push_str(&self.render(item, indent + 2));
        }
        out.push(')');
        out
    }

    fn type_def(&self, items: &[Sexp], indent: usize) -> String {
        let flat = self.compact(&Sexp {
            kind: Kind::List(items.to_vec()),
            span: items[0].span,
        });
        if indent + self.length(&flat) <= WIDTH {
            return flat;
        }
        let mut out = format!("(type {}", self.compact(&items[1]));
        for item in &items[2..] {
            out.push('\n');
            out.push_str(&" ".repeat(indent + 2));
            out.push_str(&self.render(item, indent + 2));
        }
        out.push(')');
        out
    }

    fn defmacro(&self, items: &[Sexp], indent: usize) -> String {
        if items.len() < 4 {
            return self.sequence(items, indent);
        }
        let flat = self.compact(&Sexp {
            kind: Kind::List(items.to_vec()),
            span: items[0].span,
        });
        if indent + self.length(&flat) <= WIDTH {
            return flat;
        }
        let mut out = format!(
            "(defmacro {} {}",
            self.compact(&items[1]),
            self.compact(&items[2])
        );
        for item in &items[3..] {
            out.push('\n');
            out.push_str(&" ".repeat(indent + 2));
            out.push_str(&self.render(item, indent + 2));
        }
        out.push(')');
        out
    }

    fn constants(&self, items: &[Sexp], indent: usize) -> String {
        if items.len() < 2 {
            return self.sequence(items, indent);
        }
        let mut out = format!("(constants {}", self.compact(&items[1]));
        let mut at = 2;
        let mut defaults = Vec::new();
        while at < items.len() && items[at].keyword().is_some() {
            if takes_value(items, at) {
                defaults.push(Field {
                    key: &items[at],
                    value: Some(&items[at + 1]),
                });
                at += 2;
            } else {
                defaults.push(Field {
                    key: &items[at],
                    value: None,
                });
                at += 1;
            }
        }
        if !defaults.is_empty() {
            out.push_str(&self.pairs(&defaults, indent + 2));
        }
        for entry in &items[at..] {
            out.push('\n');
            out.push_str(&" ".repeat(indent + 2));
            out.push_str(&self.entry(entry, indent + 2));
        }
        out.push(')');
        out
    }

    /// A constants entry is a name, optional fields, and a value. Its value can follow fields, so
    /// it does not use the generic form layout.
    fn entry(&self, sexp: &Sexp, indent: usize) -> String {
        let Some(items) = sexp.list() else {
            return self.render(sexp, indent);
        };
        let flat = self.compact(sexp);
        if indent + self.length(&flat) <= WIDTH || items.len() < 2 {
            return flat;
        }
        let (fields, value) = attrs_and_value(&items[1..]);
        let mut out = format!("({}", self.compact(&items[0]));
        if !fields.is_empty() {
            out.push_str(&self.pairs(&fields, indent + 2));
        }
        for item in value {
            out.push('\n');
            out.push_str(&" ".repeat(indent + 2));
            out.push_str(&self.render(item, indent + 2));
        }
        out.push(')');
        out
    }

    fn table(&self, items: &[Sexp], indent: usize) -> String {
        if items.len() < 2 {
            return self.sequence(items, indent);
        }
        let mut out = format!("(table {}", self.compact(&items[1]));
        let mut at = 2;
        let mut fields = Vec::new();
        while at < items.len() && items[at].keyword().is_some() {
            if takes_value(items, at) {
                fields.push(Field {
                    key: &items[at],
                    value: Some(&items[at + 1]),
                });
                at += 2;
            } else {
                fields.push(Field {
                    key: &items[at],
                    value: None,
                });
                at += 1;
            }
        }
        if !fields.is_empty() {
            out.push_str(&self.pairs(&fields, indent + 2));
        }
        let rows: Vec<&Sexp> = items[at..]
            .iter()
            .filter(|item| matches!(item.kind, Kind::Row(_)))
            .collect();
        if !rows.is_empty() {
            out.push('\n');
            out.push_str(&self.table_rows(&rows, indent + 2));
        }
        out.push(')');
        out
    }

    fn table_rows(&self, rows: &[&Sexp], indent: usize) -> String {
        let cells: Vec<Vec<&Sexp>> = rows
            .iter()
            .filter_map(|row| match &row.kind {
                Kind::Row(items) => Some(items.iter().collect()),
                _ => None,
            })
            .collect();
        let columns = cells.first().map(Vec::len).unwrap_or(0);
        let same_width = cells.iter().all(|row| row.len() == columns);
        let text: Vec<Vec<String>> = cells
            .iter()
            .map(|row| row.iter().map(|cell| self.compact(cell)).collect())
            .collect();
        let widths: Vec<usize> = (0..columns)
            .map(|column| {
                text.iter()
                    .filter_map(|row| row.get(column))
                    .map(|cell| self.length(cell))
                    .max()
                    .unwrap_or(0)
            })
            .collect();
        let aligned = widths
            .iter()
            .take_while(|width| **width <= MAX_CELL)
            .count();
        let numeric: Vec<bool> = (0..columns)
            .map(|column| {
                cells
                    .iter()
                    .skip(1)
                    .all(|row| matches!(row.get(column).map(|cell| &cell.kind), Some(Kind::Num(_))))
            })
            .collect();

        let mut out = String::new();
        for (at, row) in text.iter().enumerate() {
            if at > 0 {
                out.push('\n');
            }
            out.push_str(&" ".repeat(indent));
            out.push('[');
            for (column, cell) in row.iter().enumerate() {
                if column > 0 {
                    out.push_str("  ");
                }
                if !same_width || column >= aligned {
                    out.push_str(cell);
                } else if column + 1 == row.len() {
                    if at > 0 && numeric[column] {
                        let width = widths[column];
                        out.push_str(&format!("{cell:>width$}"));
                    } else {
                        out.push_str(cell);
                    }
                } else {
                    let width = widths[column];
                    if at > 0 && numeric[column] {
                        out.push_str(&format!("{cell:>width$}"));
                    } else {
                        out.push_str(&format!("{cell:<width$}"));
                    }
                }
            }
            out.push(']');
        }
        out
    }

    fn records(&self, items: &[Sexp], indent: usize) -> String {
        if items.len() < 2 {
            return self.sequence(items, indent);
        }
        let mut out = format!("(records {}", self.compact(&items[1]));
        let mut at = 2;
        let mut fields = Vec::new();
        while at < items.len() && items[at].keyword().is_some() {
            if takes_value(items, at) {
                fields.push(Field {
                    key: &items[at],
                    value: Some(&items[at + 1]),
                });
                at += 2;
            } else {
                fields.push(Field {
                    key: &items[at],
                    value: None,
                });
                at += 1;
            }
        }
        if !fields.is_empty() {
            out.push_str(&self.pairs(&fields, indent + 2));
        }
        for entry in &items[at..] {
            out.push('\n');
            out.push_str(&" ".repeat(indent + 2));
            out.push_str(&self.records_entry(entry, indent + 2));
        }
        out.push(')');
        out
    }

    /// A records entry is a key and keyword fields, laid out like the fields of a def.
    fn records_entry(&self, sexp: &Sexp, indent: usize) -> String {
        let Some(items) = sexp.list() else {
            return self.render(sexp, indent);
        };
        if items.is_empty() {
            return "()".into();
        }
        let mut out = format!("({}", self.compact(&items[0]));
        let rest = &items[1..];
        let pairs = rest
            .chunks(2)
            .all(|pair| pair.first().is_some_and(|k| k.keyword().is_some()));
        if !rest.is_empty() && pairs {
            let mut fields = Vec::new();
            for pair in rest.chunks(2) {
                if let [key, value] = pair {
                    fields.push(Field {
                        key,
                        value: Some(value),
                    });
                } else {
                    fields.push(Field {
                        key: &pair[0],
                        value: None,
                    });
                }
            }
            out.push_str(&self.pairs(&fields, indent + 2));
        } else {
            for item in rest {
                out.push('\n');
                out.push_str(&" ".repeat(indent + 2));
                out.push_str(&self.render(item, indent + 2));
            }
        }
        out.push(')');
        out
    }

    fn state(&self, items: &[Sexp], indent: usize) -> String {
        if items.len() < 2 {
            return self.sequence(items, indent);
        }
        let mut out = format!("(state {}", self.compact(&items[1]));
        for item in &items[2..] {
            out.push('\n');
            out.push_str(&" ".repeat(indent + 2));
            out.push_str(&self.render(item, indent + 2));
        }
        out.push(')');
        out
    }
}

fn prefix(items: &[Sexp]) -> Option<&'static str> {
    if items.len() != 2 {
        return None;
    }
    match items[0].symbol()? {
        "quote" => Some("'"),
        "quasiquote" => Some("`"),
        "unquote" => Some(","),
        "unquote-splicing" => Some(",@"),
        _ => None,
    }
}

/// Keywords that stand alone. A flag never takes the next item as its value, so the header of an
/// `:export-rust` table stays a row.
const FLAGS: &[&str] = &["array", "export-rust", "keep-key", "lock-all", "required"];

/// Whether the keyword at `at` takes the item after it as its value.
fn takes_value(items: &[Sexp], at: usize) -> bool {
    !items[at].keyword().is_some_and(|k| FLAGS.contains(&k))
        && at + 1 < items.len()
        && items[at + 1].keyword().is_none()
}

/// Positional arguments and `:key value` pairs. Keys also appear after a positional value in a
/// few forms, so this keeps the first appearance order and leaves the rest positional.
fn split_fields<'a>(items: &'a [Sexp], start: usize) -> (Vec<&'a Sexp>, Vec<Field<'a>>) {
    let mut positional = Vec::new();
    let mut fields = Vec::new();
    let mut at = start;
    while at < items.len() {
        if items[at].keyword().is_some() {
            if takes_value(items, at) {
                fields.push(Field {
                    key: &items[at],
                    value: Some(&items[at + 1]),
                });
                at += 2;
            } else {
                fields.push(Field {
                    key: &items[at],
                    value: None,
                });
                at += 1;
            }
        } else {
            positional.push(&items[at]);
            at += 1;
        }
    }
    (positional, fields)
}

fn attrs_and_value<'a>(items: &'a [Sexp]) -> (Vec<Field<'a>>, Vec<&'a Sexp>) {
    let mut fields = Vec::new();
    let mut at = 0;
    while at < items.len() && items[at].keyword().is_some() {
        if takes_value(items, at) {
            fields.push(Field {
                key: &items[at],
                value: Some(&items[at + 1]),
            });
            at += 2;
        } else {
            fields.push(Field {
                key: &items[at],
                value: None,
            });
            at += 1;
        }
    }
    (fields, items[at..].iter().collect())
}

#[cfg(test)]
mod tests {
    use super::format;

    #[test]
    fn fields_align_and_tables_keep_their_columns() {
        let text = r#"; Top.
(component app :code app :name "App" :blurb "x")

(table engines :key id :keep-key :type "T"
  [id name weight]
  [pg "PostgreSQL" 1]
  [my "MySQL" 10])
"#;
        let expected = r#"; Top.
(component app
  :code  app
  :name  "App"
  :blurb "x")

(table engines
  :key      id
  :keep-key
  :type     "T"
  [id  name          weight]
  [pg  "PostgreSQL"       1]
  [my  "MySQL"           10])
"#;
        assert_eq!(format(text).unwrap(), expected);
        assert_eq!(format(expected).unwrap(), expected);
    }

    #[test]
    fn a_record_lines_up_its_fields_and_a_macro_keeps_its_quote() {
        let text = "(def X :type \"T\" (:a 1 :bb 2))\n(defmacro framework (id name &key cost)\n  `(research ,(sym \"fw-\" id) :name ,name :cost ,cost))\n";
        let expected = "(def X\n  :type \"T\"\n  (:a  1\n   :bb 2))\n\n(defmacro framework (id name &key cost) `(research ,(sym \"fw-\" id) :name ,name :cost ,cost))\n";
        assert_eq!(format(text).unwrap(), expected);
    }

    #[test]
    fn comments_stay_before_their_forms() {
        let text = "; first\n; second\n(component app :code app)\n\n; after\n(def X 1)\n";
        let expected = "; first\n; second\n(component app\n  :code app)\n\n; after\n(def X 1)\n";
        assert_eq!(format(text).unwrap(), expected);
    }

    #[test]
    fn a_table_pads_its_short_columns() {
        let text = "(table t :key id [id text] [a \"one\" ] [b \"two\" ])\n";
        let out = format(text).unwrap();
        assert!(out.contains("[a   \"one\"]"), "{out}");
        assert!(out.contains("[b   \"two\"]"), "{out}");
    }

    #[test]
    fn a_flag_keeps_the_header_as_the_first_row() {
        let text = "(table t :export-rust [level cpu] [1 1] [32 2.5])\n";
        let expected =
            "(table t\n  :export-rust\n  [level  cpu]\n  [    1    1]\n  [   32  2.5])\n";
        assert_eq!(format(text).unwrap(), expected);
    }
}
