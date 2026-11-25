//! The Solver catalog: `catalog.rs`, the Rust module the Solver compiles in.
//!
//! The Solver's ABI is declared in content. `(solver …)` forms list what the Solver reads, and
//! `:export-rust` on a table exports every column of that table. qmc evaluates each declaration
//! against the checked catalog with `value::Values`, so the numbers are the doubles the
//! TypeScript reads, and renders one Rust item per declaration. Nothing in this module names a
//! table, a field, or a Rust static: those all come from the declarations.
//!
//! The forms:
//!
//! - `(axis NAME :of LIST… [:count C] [:names N] [:module M] [:index F] [:test F])`: an ordered
//!   set of ids that other declarations index by. `:count` writes its length, `:names` its ids,
//!   `:module` a `usize` constant per id, `:index` a `fn(&str) -> usize`, and `:test` a
//!   `fn(usize) -> bool` that is true for the first `count` indices.
//! - `(columns SOURCE [:over AXIS] (NAME [FIELD] [:default V] [:index AXIS] [:enum E]) …)`: one
//!   array per entry, with a value per row of SOURCE, or per id of AXIS. FIELD is a property path
//!   such as `gc.pauseMs`; without one, the row itself is the value. The element type follows
//!   the values: numbers, flags, or strings. `:index` writes a value's position in an axis, and
//!   `:enum` writes it as a variant of a Rust enum declared from the distinct values.
//! - `(matrix NAME SOURCE :field F :rows AXIS :cols AXIS :default V)`: a row per id of `:rows`,
//!   a column per id of `:cols`, read from a record keyed by the column ids.
//! - `(masks SOURCE :over AXIS :bits AXIS (NAME FIELD) …)` and `(mask NAME LIST :bits AXIS)`:
//!   `u128` bit sets of ids of the `:bits` axis.
//! - `(member NAME LIST :over AXIS [:type u8])`: whether each id of the axis is in LIST.
//! - `(pairs NAME SOURCE :over AXIS :join "-" :default V)`: a square matrix read from keys
//!   `a-b` or `b-a`; the diagonal and missing pairs take the default.
//!
//! Every scalar the catalog exports, a number, flag, string, or list of numbers or strings, is a
//! Rust constant too, unless a declaration writes an item of the same name.

use crate::data::Def;
use crate::diag::{Diagnostic, Sink};
use crate::lower::{Catalog, Name};
use crate::reader::{Kind, Sexp};
use crate::source::Span;
use crate::value::{js_number, keys_of, Values, V};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug)]
pub struct Clause {
    pub kind: ClauseKind,
    pub span: Span,
}

#[derive(Debug)]
pub enum ClauseKind {
    Axis {
        name: Name,
        of: Vec<Name>,
        count: Option<String>,
        names: Option<String>,
        module: Option<String>,
        index: Option<String>,
        test: Option<String>,
    },
    Columns {
        source: Name,
        over: Option<Name>,
        entries: Vec<Column>,
    },
    Matrix {
        name: String,
        source: Name,
        field: Vec<String>,
        rows: Name,
        cols: Name,
        default: Option<crate::data::Datum>,
    },
    Masks {
        source: Name,
        over: Name,
        bits: Name,
        entries: Vec<(String, Vec<String>, Span)>,
    },
    Mask {
        name: String,
        list: Name,
        bits: Name,
    },
    Member {
        name: String,
        list: Name,
        over: Name,
        byte: bool,
    },
    Pairs {
        name: String,
        source: Name,
        over: Name,
        join: String,
        default: Option<crate::data::Datum>,
    },
}

#[derive(Debug)]
pub struct Column {
    pub name: String,
    pub field: Vec<String>,
    pub default: Option<crate::data::Datum>,
    pub index: Option<Name>,
    pub enumeration: Option<String>,
    pub span: Span,
}

fn err(sink: &mut Sink, span: Span, message: impl Into<String>) {
    sink.push(Diagnostic::error("solver", span, message.into()));
}

fn name_of(sexp: &Sexp) -> Option<Name> {
    sexp.symbol().map(|s| Name {
        text: s.to_string(),
        span: sexp.span,
    })
}

/// Each keyword with its span and value.
type KeyMap<'a> = BTreeMap<String, (Span, Option<&'a Sexp>)>;

/// Positional items and `:key value` pairs. A key followed by another key or nothing is a flag.
fn split(items: &[Sexp]) -> (Vec<&Sexp>, KeyMap<'_>) {
    let mut positional = Vec::new();
    let mut keys = BTreeMap::new();
    let mut at = 0;
    while at < items.len() {
        if let Some(k) = items[at].keyword() {
            let value = items.get(at + 1).filter(|v| v.keyword().is_none());
            keys.insert(k.to_string(), (items[at].span, value));
            at += if value.is_some() { 2 } else { 1 };
        } else {
            positional.push(&items[at]);
            at += 1;
        }
    }
    (positional, keys)
}

/// `gc.pauseMs` to `["gc", "pauseMs"]`, each part spelled as a record key.
fn path(sexp: &Sexp) -> Option<Vec<String>> {
    let text = sexp.symbol()?;
    Some(text.split('.').map(crate::lower::camel).collect())
}

struct Keys<'a> {
    keys: KeyMap<'a>,
    allowed: &'a [&'a str],
    form: &'a str,
    span: Span,
}

impl<'a> Keys<'a> {
    fn new(
        keys: KeyMap<'a>,
        allowed: &'a [&'a str],
        form: &'a str,
        span: Span,
        sink: &mut Sink,
    ) -> Keys<'a> {
        for (key, (span, _)) in &keys {
            if !allowed.contains(&key.as_str()) {
                err(
                    sink,
                    *span,
                    format!("{form} has no `:{key}`; it takes :{}", allowed.join(", :")),
                );
            }
        }
        Keys {
            keys,
            allowed,
            form,
            span,
        }
    }

    fn value(&self, key: &str) -> Option<&'a Sexp> {
        debug_assert!(self.allowed.contains(&key));
        self.keys.get(key).and_then(|(_, v)| *v)
    }

    fn name(&self, key: &str, sink: &mut Sink) -> Option<Name> {
        let (span, value) = self.keys.get(key)?;
        match value.and_then(name_of) {
            Some(n) => Some(n),
            None => {
                err(sink, *span, format!("`:{key}` takes a name"));
                None
            }
        }
    }

    fn text(&self, key: &str, sink: &mut Sink) -> Option<String> {
        let (span, value) = self.keys.get(key)?;
        match value.map(|v| &v.kind) {
            Some(Kind::Symbol(s) | Kind::Str(s)) => Some(s.clone()),
            _ => {
                err(sink, *span, format!("`:{key}` takes a name"));
                None
            }
        }
    }

    fn required(&self, key: &str, sink: &mut Sink) -> Option<Name> {
        if !self.keys.contains_key(key) {
            err(sink, self.span, format!("{} needs `:{key}`", self.form));
            return None;
        }
        self.name(key, sink)
    }

    fn datum(&self, key: &str, sink: &mut Sink) -> Option<crate::data::Datum> {
        crate::data::datum(self.value(key)?, sink)
    }
}

/// Lowers `(solver clause …)`.
pub fn lower(form: &Sexp, sink: &mut Sink) -> Vec<Clause> {
    let mut out = Vec::new();
    for item in &form.list().unwrap()[1..] {
        let Some(items) = item.list() else {
            err(sink, item.span, "a solver clause is a list like (axis …)");
            continue;
        };
        let head = items.first().and_then(Sexp::symbol).unwrap_or("");
        let kind = match head {
            "axis" => axis(item, &items[1..], sink),
            "columns" => columns(item, &items[1..], sink),
            "matrix" => matrix(item, &items[1..], sink),
            "masks" => masks(item, &items[1..], sink),
            "mask" | "member" | "pairs" => small(head, item, &items[1..], sink),
            _ => {
                err(
                    sink,
                    item.span,
                    format!(
                        "`{head}` is not a solver clause; write axis, columns, matrix, masks, mask, member, or pairs"
                    ),
                );
                None
            }
        };
        if let Some(kind) = kind {
            out.push(Clause {
                kind,
                span: item.span,
            });
        }
    }
    out
}

fn axis(form: &Sexp, items: &[Sexp], sink: &mut Sink) -> Option<ClauseKind> {
    let (positional, keys) = split(items);
    let keys = Keys::new(
        keys,
        &["of", "count", "names", "module", "index", "test"],
        "an axis",
        form.span,
        sink,
    );
    let Some(name) = positional.first().and_then(|n| name_of(n)) else {
        err(sink, form.span, "write (axis NAME :of LIST …)");
        return None;
    };
    let of = match keys.value("of") {
        Some(Sexp {
            kind: Kind::List(items),
            ..
        }) => {
            let names: Vec<Name> = items.iter().filter_map(name_of).collect();
            if names.len() != items.len() || names.is_empty() {
                err(
                    sink,
                    form.span,
                    "`:of` names one or more values, like (request-kinds backend-kinds)",
                );
                return None;
            }
            names
        }
        Some(single) => name_of(single).into_iter().collect(),
        None => {
            err(sink, form.span, "an axis needs `:of LIST`");
            return None;
        }
    };
    Some(ClauseKind::Axis {
        name,
        of,
        count: keys.text("count", sink),
        names: keys.text("names", sink),
        module: keys.text("module", sink),
        index: keys.text("index", sink),
        test: keys.text("test", sink),
    })
}

fn columns(form: &Sexp, items: &[Sexp], sink: &mut Sink) -> Option<ClauseKind> {
    let (positional, keys) = split(items);
    let keys = Keys::new(keys, &["over"], "columns", form.span, sink);
    let Some(source) = positional.first().and_then(|n| name_of(n)) else {
        err(sink, form.span, "write (columns SOURCE (NAME FIELD) …)");
        return None;
    };
    let mut entries = Vec::new();
    for entry in &positional[1..] {
        let Some(parts) = entry.list() else {
            err(
                sink,
                entry.span,
                "a column is (NAME [FIELD] [:default V] …)",
            );
            continue;
        };
        let (pos, opts) = split(parts);
        let opts = Keys::new(
            opts,
            &["default", "index", "enum"],
            "a column",
            entry.span,
            sink,
        );
        let Some(name) = pos.first().and_then(|n| n.symbol()) else {
            err(sink, entry.span, "a column starts with its Rust name");
            continue;
        };
        let field = match pos.get(1) {
            Some(f) => match path(f) {
                Some(p) => p,
                None => {
                    err(sink, f.span, "a field is a name like speed or gc.pauseMs");
                    continue;
                }
            },
            None => Vec::new(),
        };
        entries.push(Column {
            name: name.to_string(),
            field,
            default: opts.datum("default", sink),
            index: opts.name("index", sink),
            enumeration: opts.text("enum", sink),
            span: entry.span,
        });
    }
    Some(ClauseKind::Columns {
        source,
        over: keys.name("over", sink),
        entries,
    })
}

fn matrix(form: &Sexp, items: &[Sexp], sink: &mut Sink) -> Option<ClauseKind> {
    let (positional, keys) = split(items);
    let keys = Keys::new(
        keys,
        &["field", "rows", "cols", "default"],
        "a matrix",
        form.span,
        sink,
    );
    let (Some(name), Some(source)) = (
        positional.first().and_then(|n| n.symbol()),
        positional.get(1).and_then(|n| name_of(n)),
    ) else {
        err(
            sink,
            form.span,
            "write (matrix NAME SOURCE :field F :rows A :cols B)",
        );
        return None;
    };
    let field = keys.value("field").and_then(path).unwrap_or_default();
    Some(ClauseKind::Matrix {
        name: name.to_string(),
        source,
        field,
        rows: keys.required("rows", sink)?,
        cols: keys.required("cols", sink)?,
        default: keys.datum("default", sink),
    })
}

fn masks(form: &Sexp, items: &[Sexp], sink: &mut Sink) -> Option<ClauseKind> {
    let (positional, keys) = split(items);
    let keys = Keys::new(keys, &["over", "bits"], "masks", form.span, sink);
    let Some(source) = positional.first().and_then(|n| name_of(n)) else {
        err(
            sink,
            form.span,
            "write (masks SOURCE :over A :bits B (NAME FIELD) …)",
        );
        return None;
    };
    let mut entries = Vec::new();
    for entry in &positional[1..] {
        match entry.list() {
            Some([name, field]) if name.symbol().is_some() && path(field).is_some() => {
                entries.push((
                    name.symbol().unwrap().to_string(),
                    path(field).unwrap(),
                    entry.span,
                ));
            }
            _ => err(sink, entry.span, "a mask is (NAME FIELD)"),
        }
    }
    Some(ClauseKind::Masks {
        source,
        over: keys.required("over", sink)?,
        bits: keys.required("bits", sink)?,
        entries,
    })
}

fn small(head: &str, form: &Sexp, items: &[Sexp], sink: &mut Sink) -> Option<ClauseKind> {
    let (positional, keys) = split(items);
    let allowed: &[&str] = match head {
        "mask" => &["bits"],
        "member" => &["over", "type"],
        _ => &["over", "join", "default"],
    };
    let keys = Keys::new(keys, allowed, head, form.span, sink);
    let (Some(name), Some(list)) = (
        positional.first().and_then(|n| n.symbol()),
        positional.get(1).and_then(|n| name_of(n)),
    ) else {
        err(sink, form.span, format!("write ({head} NAME SOURCE …)"));
        return None;
    };
    let name = name.to_string();
    Some(match head {
        "mask" => ClauseKind::Mask {
            name,
            list,
            bits: keys.required("bits", sink)?,
        },
        "member" => {
            let byte = match keys.text("type", sink).as_deref() {
                None | Some("bool") => false,
                Some("u8") => true,
                Some(other) => {
                    err(
                        sink,
                        form.span,
                        format!("a member is bool or u8, not `{other}`"),
                    );
                    return None;
                }
            };
            ClauseKind::Member {
                name,
                list,
                over: keys.required("over", sink)?,
                byte,
            }
        }
        _ => ClauseKind::Pairs {
            name,
            source: list,
            over: keys.required("over", sink)?,
            join: keys.text("join", sink).unwrap_or_else(|| "-".into()),
            default: keys.datum("default", sink),
        },
    })
}

/// An axis after evaluation.
struct Axis {
    ids: Vec<String>,
    /// The Rust name of its length, when the axis declares one.
    count: Option<String>,
}

impl Axis {
    fn len(&self) -> String {
        self.count
            .clone()
            .unwrap_or_else(|| self.ids.len().to_string())
    }
}

/// A number as the Rust catalog writes it: `1.0`, `0.25`, or `f64::INFINITY`.
fn num(n: f64) -> String {
    if n == f64::INFINITY {
        "f64::INFINITY".into()
    } else if n == f64::NEG_INFINITY {
        "f64::NEG_INFINITY".into()
    } else if n.fract() == 0.0 && n.abs() < 1e21 {
        format!("{}.0", js_number(n))
    } else {
        js_number(n)
    }
}

fn json(s: &str) -> String {
    let mut o = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            c if (c as u32) < 0x20 => o.push_str(&format!("\\u{:04x}", c as u32)),
            c => o.push(c),
        }
    }
    o.push('"');
    o
}

/// `connectionKB` to `CONNECTION_KB`, and an id such as `q-read` to `Q_READ`.
fn const_name(id: &str) -> String {
    let chars: Vec<char> = id.chars().collect();
    let mut o = String::new();
    for (i, c) in chars.iter().enumerate() {
        if i > 0
            && c.is_ascii_uppercase()
            && (chars[i - 1].is_ascii_lowercase() || chars[i - 1].is_ascii_digit())
        {
            o.push('_');
        }
        let c = c.to_ascii_uppercase();
        o.push(if c.is_ascii_alphanumeric() { c } else { '_' });
    }
    if o.starts_with(|c: char| c.is_ascii_digit()) {
        format!("_{o}")
    } else {
        o
    }
}

/// `write-behind` to `WriteBehind`, an enum variant.
fn variant(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        let next = chars.get(i + 1).copied().unwrap_or(' ');
        if (c == '-' || c == '_') && next.is_ascii_lowercase() {
            out.push(next.to_ascii_uppercase());
            i += 2;
        } else {
            out.push(if i == 0 { c.to_ascii_uppercase() } else { c });
            i += 1;
        }
    }
    out
}

fn join(items: impl IntoIterator<Item = String>) -> String {
    items.into_iter().collect::<Vec<_>>().join(", ")
}

/// The ids of a value: a list of strings, or the keys of a record.
fn ids_of(value: &V) -> Option<Vec<String>> {
    match value {
        V::Arr(items) => items
            .iter()
            .map(|i| match i {
                V::Str(s) => Some(s.clone()),
                _ => None,
            })
            .collect(),
        V::Obj(_) => Some(value.keys()),
        _ => None,
    }
}

fn walk<'v>(mut value: &'v V, path: &[String]) -> &'v V {
    for part in path {
        value = value.get(part);
    }
    value
}

/// Values with `??`: the default replaces `null` and a missing value.
fn or(value: &V, default: &Option<V>) -> V {
    match (value, default) {
        (V::Null | V::Undefined, Some(d)) => d.clone(),
        (v, _) => v.clone(),
    }
}

struct Writer<'a> {
    values: Values<'a>,
    catalog: &'a Catalog,
    axes: BTreeMap<String, Axis>,
    lines: Vec<String>,
    /// Every Rust item name written, with the declaration that wrote it.
    claimed: BTreeMap<String, Span>,
    sink: Sink,
}

impl<'a> Writer<'a> {
    fn claim(&mut self, name: &str, span: Span) -> bool {
        if let Some(first) = self.claimed.get(name) {
            self.sink.push(
                Diagnostic::error(
                    "solver",
                    span,
                    format!("the Solver catalog already has an item `{name}`"),
                )
                .note(*first, "first here"),
            );
            return false;
        }
        self.claimed.insert(name.to_string(), span);
        true
    }

    fn get(&mut self, name: &Name) -> Option<V> {
        match self.values.get(&name.text) {
            Ok(v) => Some(v),
            Err(e) => {
                err(&mut self.sink, name.span, e);
                None
            }
        }
    }

    fn axis(&mut self, name: &Name) -> Option<&Axis> {
        if !self.axes.contains_key(&name.text) {
            let known: Vec<&str> = self.axes.keys().map(String::as_str).collect();
            let d = crate::check::unknown("solver", name, "axis declared before this", &known);
            self.sink.push(d);
            return None;
        }
        self.axes.get(&name.text)
    }

    fn datum(&mut self, d: &Option<crate::data::Datum>) -> Option<Option<V>> {
        match d {
            None => Some(None),
            Some(d) => match self.values.datum(&d.kind) {
                Ok(v) => Some(Some(v)),
                Err(e) => {
                    err(&mut self.sink, d.span, e);
                    None
                }
            },
        }
    }

    fn push(&mut self, line: impl Into<String>) {
        self.lines.push(line.into());
    }

    /// The items of one array over a set of rows, all of one scalar type.
    fn scalars(
        &mut self,
        values: &[V],
        what: &str,
        span: Span,
    ) -> Option<(&'static str, Vec<String>)> {
        if values.iter().all(|v| matches!(v, V::Num(_))) {
            let items = values
                .iter()
                .map(|v| match v {
                    V::Num(n) => num(*n),
                    _ => unreachable!(),
                })
                .collect();
            return Some(("f64", items));
        }
        if values.iter().all(|v| matches!(v, V::Bool(_))) {
            let items = values
                .iter()
                .map(|v| match v {
                    V::Bool(b) => b.to_string(),
                    _ => unreachable!(),
                })
                .collect();
            return Some(("bool", items));
        }
        if values.iter().all(|v| matches!(v, V::Str(_))) {
            let items = values
                .iter()
                .map(|v| match v {
                    V::Str(s) => json(s),
                    _ => unreachable!(),
                })
                .collect();
            return Some(("&str", items));
        }
        let mut kinds: Vec<&str> = values.iter().map(V::describe).collect();
        kinds.sort();
        kinds.dedup();
        err(
            &mut self.sink,
            span,
            format!(
                "`{what}` mixes {}; a Solver array holds numbers, flags, or strings, so give it a :default",
                kinds.join(" and ")
            ),
        );
        None
    }

    fn clause(&mut self, clause: &Clause) {
        match &clause.kind {
            ClauseKind::Axis {
                name,
                of,
                count,
                names,
                module,
                index,
                test,
            } => {
                let mut ids = Vec::new();
                for list in of {
                    let Some(value) = self.get(list) else { return };
                    match ids_of(&value) {
                        Some(found) => ids.extend(found),
                        None => {
                            err(
                                &mut self.sink,
                                list.span,
                                format!(
                                    "`{}` is {}, not a list of ids or a record",
                                    list.text,
                                    value.describe()
                                ),
                            );
                            return;
                        }
                    }
                }
                let mut seen = BTreeSet::new();
                for id in &ids {
                    if !seen.insert(id) {
                        err(
                            &mut self.sink,
                            name.span,
                            format!("the axis `{}` lists `{id}` twice", name.text),
                        );
                    }
                }
                let n = ids.len();
                let axis = Axis {
                    ids: ids.clone(),
                    count: count.clone(),
                };
                let len = axis.len();
                if let Some(count) = count {
                    if self.claim(count, clause.span) {
                        self.push(format!("pub const {count}: usize = {n};"));
                    }
                }
                if let Some(names) = names {
                    if self.claim(names, clause.span) {
                        self.push(format!(
                            "pub static {names}: [&str; {len}] = [{}];",
                            join(ids.iter().map(|i| json(i)))
                        ));
                    }
                }
                if let Some(module) = module {
                    if self.claim(module, clause.span) {
                        self.push(format!("pub mod {module} {{"));
                        for (i, id) in ids.iter().enumerate() {
                            self.push(format!("    pub const {}: usize = {i};", const_name(id)));
                        }
                        self.push("}");
                    }
                }
                if let Some(index) = index {
                    if self.claim(index, clause.span) {
                        self.push(format!("pub fn {index}(name: &str) -> usize {{"));
                        self.push("    match name {");
                        for (i, id) in ids.iter().enumerate() {
                            self.push(format!("        {} => {i},", json(id)));
                        }
                        self.push("        _ => 0,");
                        self.push("    }");
                        self.push("}");
                    }
                }
                if let Some(test) = test {
                    if self.claim(test, clause.span) {
                        self.push(format!("pub fn {test}(index: usize) -> bool {{"));
                        self.push(format!("    index < {len}"));
                        self.push("}");
                    }
                }
                if self.axes.insert(name.text.clone(), axis).is_some() {
                    err(
                        &mut self.sink,
                        name.span,
                        format!("the axis `{}` is declared twice", name.text),
                    );
                }
            }
            ClauseKind::Columns {
                source,
                over,
                entries,
            } => {
                let Some(table) = self.get(source) else {
                    return;
                };
                let (rows, len): (Vec<V>, String) = match over {
                    Some(over) => {
                        let Some(axis) = self.axis(over) else { return };
                        let len = axis.len();
                        let rows = axis.ids.iter().map(|id| table.get(id).clone()).collect();
                        (rows, len)
                    }
                    None => {
                        let rows: Vec<V> = match &table {
                            V::Arr(items) => items.clone(),
                            V::Obj(_) => {
                                table.keys().iter().map(|k| table.get(k).clone()).collect()
                            }
                            other => {
                                err(
                                    &mut self.sink,
                                    source.span,
                                    format!("`{}` is {}, not rows", source.text, other.describe()),
                                );
                                return;
                            }
                        };
                        let len = rows.len().to_string();
                        (rows, len)
                    }
                };
                for column in entries {
                    self.column(column, &rows, &len);
                }
            }
            ClauseKind::Matrix {
                name,
                source,
                field,
                rows,
                cols,
                default,
            } => {
                let Some(table) = self.get(source) else {
                    return;
                };
                let Some(default) = self.datum(default) else {
                    return;
                };
                let Some(rows) = self.axis(rows).map(|a| (a.ids.clone(), a.len())) else {
                    return;
                };
                let Some(cols) = self.axis(cols).map(|a| (a.ids.clone(), a.len())) else {
                    return;
                };
                let fill = match &default {
                    Some(V::Num(n)) => num(*n),
                    _ => {
                        err(
                            &mut self.sink,
                            clause.span,
                            "a matrix needs a numeric :default",
                        );
                        return;
                    }
                };
                if !self.claim(name, clause.span) {
                    return;
                }
                let mut lines = vec![format!(
                    "pub static {name}: [[f64; {}]; {}] = [",
                    cols.1, rows.1
                )];
                for row in &rows.0 {
                    let record = walk(table.get(row), field);
                    let mut cells = vec![fill.clone(); cols.0.len()];
                    for key in record.keys() {
                        let Some(at) = cols.0.iter().position(|c| *c == key) else {
                            err(
                                &mut self.sink,
                                clause.span,
                                format!("`{row}` has `{key}`, which is not on the column axis"),
                            );
                            continue;
                        };
                        match record.get(&key) {
                            V::Num(n) => cells[at] = num(*n),
                            other => err(
                                &mut self.sink,
                                clause.span,
                                format!("`{row}.{key}` is {}, not a number", other.describe()),
                            ),
                        }
                    }
                    lines.push(format!("    [{}],", join(cells)));
                }
                lines.push("];".into());
                self.lines.extend(lines);
            }
            ClauseKind::Masks {
                source,
                over,
                bits,
                entries,
            } => {
                let Some(table) = self.get(source) else {
                    return;
                };
                let Some(rows) = self.axis(over).map(|a| (a.ids.clone(), a.len())) else {
                    return;
                };
                let Some(bits) = self.bits(bits) else { return };
                for (name, field, span) in entries {
                    if !self.claim(name, *span) {
                        continue;
                    }
                    let mut lines = vec![format!("pub static {name}: [u128; {}] = [", rows.1)];
                    for row in &rows.0 {
                        let Some(mask) = self.mask(walk(table.get(row), field), &bits, *span)
                        else {
                            return;
                        };
                        lines.push(format!("    {mask},"));
                    }
                    lines.push("];".into());
                    self.lines.extend(lines);
                }
            }
            ClauseKind::Mask { name, list, bits } => {
                let Some(value) = self.get(list) else { return };
                let Some(bits) = self.bits(bits) else { return };
                let Some(mask) = self.mask(&value, &bits, clause.span) else {
                    return;
                };
                if self.claim(name, clause.span) {
                    self.push(format!("pub static {name}: u128 = {mask};"));
                }
            }
            ClauseKind::Member {
                name,
                list,
                over,
                byte,
            } => {
                let Some(value) = self.get(list) else { return };
                let Some((ids, len)) = self.axis(over).map(|a| (a.ids.clone(), a.len())) else {
                    return;
                };
                let Some(members) = ids_of(&value) else {
                    err(
                        &mut self.sink,
                        list.span,
                        format!("`{}` is not a list of ids", list.text),
                    );
                    return;
                };
                for member in &members {
                    if !ids.contains(member) {
                        err(
                            &mut self.sink,
                            list.span,
                            format!("`{member}` is not on the axis `{}`", over.text),
                        );
                    }
                }
                let ty = if *byte { "u8" } else { "bool" };
                let items = ids.iter().map(|id| {
                    let found = members.contains(id);
                    if *byte {
                        u8::from(found).to_string()
                    } else {
                        found.to_string()
                    }
                });
                let line = format!("pub static {name}: [{ty}; {len}] = [{}];", join(items));
                if self.claim(name, clause.span) {
                    self.push(line);
                }
            }
            ClauseKind::Pairs {
                name,
                source,
                over,
                join: sep,
                default,
            } => {
                let Some(table) = self.get(source) else {
                    return;
                };
                let Some(default) = self.datum(default) else {
                    return;
                };
                let Some((ids, len)) = self.axis(over).map(|a| (a.ids.clone(), a.len())) else {
                    return;
                };
                let mut rows = Vec::new();
                for from in &ids {
                    let mut cells = Vec::new();
                    for to in &ids {
                        let value = if from == to {
                            V::Undefined
                        } else {
                            match table.get(&format!("{from}{sep}{to}")) {
                                V::Undefined => table.get(&format!("{to}{sep}{from}")).clone(),
                                v => v.clone(),
                            }
                        };
                        match or(&value, &default) {
                            V::Num(n) => cells.push(num(n)),
                            other => {
                                err(
                                    &mut self.sink,
                                    clause.span,
                                    format!(
                                        "the pair `{from}{sep}{to}` is {}, not a number",
                                        other.describe()
                                    ),
                                );
                                return;
                            }
                        }
                    }
                    rows.push(format!("[{}]", join(cells)));
                }
                if self.claim(name, clause.span) {
                    self.push(format!(
                        "pub static {name}: [[f64; {len}]; {len}] = [{}];",
                        join(rows)
                    ));
                }
            }
        }
    }

    fn bits(&mut self, bits: &Name) -> Option<Vec<String>> {
        let ids = self.axis(bits)?.ids.clone();
        if ids.len() > 128 {
            err(
                &mut self.sink,
                bits.span,
                format!(
                    "a mask is a u128, but the axis `{}` has {} ids",
                    bits.text,
                    ids.len()
                ),
            );
            return None;
        }
        Some(ids)
    }

    fn mask(&mut self, value: &V, bits: &[String], span: Span) -> Option<String> {
        let Some(ids) = ids_of(value).or_else(|| value.is_missing().then(Vec::new)) else {
            err(
                &mut self.sink,
                span,
                format!("a mask reads a list of ids, found {}", value.describe()),
            );
            return None;
        };
        let mut mask: u128 = 0;
        for id in ids {
            match bits.iter().position(|b| *b == id) {
                Some(i) => mask |= 1 << i,
                None => {
                    err(
                        &mut self.sink,
                        span,
                        format!("`{id}` is not on the mask's axis"),
                    );
                    return None;
                }
            }
        }
        Some(format!("0x{mask:x}"))
    }

    fn column(&mut self, column: &Column, rows: &[V], len: &str) {
        let Some(default) = self.datum(&column.default) else {
            return;
        };
        let values: Vec<V> = rows
            .iter()
            .map(|row| or(walk(row, &column.field), &default))
            .collect();
        let name = &column.name;
        if let Some(axis) = &column.index {
            let Some(ids) = self.axis(axis).map(|a| a.ids.clone()) else {
                return;
            };
            let mut items = Vec::new();
            for value in &values {
                match value {
                    V::Str(s) if ids.contains(s) => {
                        items.push(ids.iter().position(|i| i == s).unwrap().to_string())
                    }
                    other => {
                        err(
                            &mut self.sink,
                            column.span,
                            format!(
                                "`{name}` reads {other:?}, which is not on the axis `{}`",
                                axis.text
                            ),
                        );
                        return;
                    }
                }
            }
            if self.claim(name, column.span) {
                self.push(format!(
                    "pub static {name}: [usize; {len}] = [{}];",
                    join(items)
                ));
            }
            return;
        }
        if let Some(enumeration) = &column.enumeration {
            let mut variants: Vec<(String, String)> = Vec::new();
            let mut items = Vec::new();
            for value in &values {
                let V::Str(s) = value else {
                    err(
                        &mut self.sink,
                        column.span,
                        format!("`{name}` is an enum, but a row has {}", value.describe()),
                    );
                    return;
                };
                let v = variant(s);
                if !variants.iter().any(|(k, _)| k == s) {
                    variants.push((s.clone(), v.clone()));
                }
                items.push(format!("{enumeration}::{v}"));
            }
            if self.claim(enumeration, column.span) {
                self.push("#[derive(Clone, Copy, PartialEq, Eq, Debug)]");
                self.push(format!("pub enum {enumeration} {{"));
                for (_, v) in &variants {
                    self.push(format!("    {v},"));
                }
                self.push("}");
            }
            if self.claim(name, column.span) {
                self.push(format!(
                    "pub static {name}: [{enumeration}; {len}] = [{}];",
                    join(items)
                ));
            }
            return;
        }
        let Some((ty, items)) = self.scalars(&values, name, column.span) else {
            return;
        };
        if self.claim(name, column.span) {
            self.push(format!(
                "pub static {name}: [{ty}; {len}] = [{}];",
                join(items)
            ));
        }
    }

    /// Every column of an `:export-rust` table, named `TABLE_COLUMN`, with a module of its keys
    /// when it declares an id array and no typed id.
    fn table(&mut self, def: &Def) {
        let Some(table) = self.get(&def.name_as_export()) else {
            return;
        };
        let single = !matches!(table, V::Arr(_))
            && table
                .keys()
                .iter()
                .all(|k| !matches!(table.get(k), V::Obj(_)));
        let rows: Vec<V> = match &table {
            V::Arr(items) => items.clone(),
            _ if single => vec![table.clone()],
            _ => table.keys().iter().map(|k| table.get(k).clone()).collect(),
        };
        let module = if def.id_type.is_some() {
            None
        } else {
            def.ids
                .as_deref()
                .and_then(|ids| ids.strip_suffix("_IDS"))
                .map(str::to_ascii_lowercase)
        };
        if let Some(module) = module {
            if self.claim(&module, def.span) {
                self.push(format!("pub mod {module} {{"));
                for (i, id) in keys_of(&table, None).iter().enumerate() {
                    self.push(format!("    pub const {}: usize = {i};", const_name(id)));
                }
                self.push("}");
            }
        }
        let mut fields: Vec<String> = Vec::new();
        for row in &rows {
            for field in row.keys() {
                if !fields.contains(&field) {
                    fields.push(field);
                }
            }
        }
        // `check::solver_columns` guarantees every row has every column with one scalar type.
        for field in fields {
            if field == "name" && rows.iter().all(|r| matches!(r.get("name"), V::Str(_))) {
                continue;
            }
            let values: Vec<V> = rows.iter().map(|r| r.get(&field).clone()).collect();
            let column = format!("{}_{}", def.export, const_name(&field));
            if values
                .iter()
                .any(|v| matches!(v, V::Obj(_) | V::Arr(_) | V::Null | V::Undefined))
            {
                continue;
            }
            let Some((ty, items)) = self.scalars(&values, &column, def.span) else {
                continue;
            };
            if self.claim(&column, def.span) {
                self.push(format!(
                    "pub static {column}: [{ty}; {}] = [{}];",
                    rows.len(),
                    join(items)
                ));
            }
        }
    }

    /// Every scalar the catalog exports that no declaration already wrote.
    fn constants(&mut self) {
        let mut names: BTreeSet<String> = BTreeSet::new();
        for def in &self.catalog.defs {
            names.insert(def.export.clone());
            if let Some(ids) = &def.ids {
                names.insert(ids.clone());
            }
        }
        names.extend(crate::value::TYPED.iter().map(|n| n.to_string()));
        names.extend(crate::value::state_tuples(self.catalog));
        let mut count = 0;
        for name in names {
            let rust = name.as_str();
            if !rust
                .bytes()
                .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'_')
                || self.claimed.contains_key(rust)
            {
                continue;
            }
            let Ok(value) = self.values.get(rust) else {
                continue;
            };
            let line = match &value {
                V::Num(n) if n.is_finite() => format!("pub const {rust}: f64 = {};", num(*n)),
                V::Bool(b) => format!("pub const {rust}: bool = {b};"),
                V::Str(s) => format!("pub const {rust}: &str = {};", json(s)),
                V::Arr(items) if items.iter().all(|i| matches!(i, V::Num(_))) => format!(
                    "pub static {rust}: [f64; {}] = [{}];",
                    items.len(),
                    join(items.iter().map(|i| match i {
                        V::Num(n) => num(*n),
                        _ => unreachable!(),
                    }))
                ),
                V::Arr(items) if items.iter().all(|i| matches!(i, V::Str(_))) => format!(
                    "pub static {rust}: [&str; {}] = [{}];",
                    items.len(),
                    join(items.iter().map(|i| match i {
                        V::Str(s) => json(s),
                        _ => unreachable!(),
                    }))
                ),
                _ => continue,
            };
            self.push(line);
            count += 1;
        }
        self.push(format!("pub static SCALAR_COUNT: usize = {count};"));
    }
}

impl Def {
    fn name_as_export(&self) -> Name {
        Name {
            text: self.export.clone(),
            span: self.span,
        }
    }
}

/// The Solver catalog, or the diagnostics that stopped it.
pub fn render(catalog: &Catalog) -> Result<String, Vec<Diagnostic>> {
    let mut w = Writer {
        values: Values::new(catalog),
        catalog,
        axes: BTreeMap::new(),
        lines: Vec::new(),
        claimed: BTreeMap::new(),
        sink: Sink::default(),
    };
    for clause in &catalog.solver {
        w.clause(clause);
    }
    // A mask over an axis with a length constant states the limit to the Rust compiler too.
    let mut asserted = BTreeSet::new();
    for clause in &catalog.solver {
        let bits = match &clause.kind {
            ClauseKind::Masks { bits, .. } | ClauseKind::Mask { bits, .. } => bits,
            _ => continue,
        };
        if let Some(count) = w.axes.get(&bits.text).and_then(|a| a.count.clone()) {
            if asserted.insert(count.clone()) {
                w.lines
                    .push(format!("const _: () = assert!({count} <= 128);"));
            }
        }
    }
    w.push("");
    for def in catalog.defs.iter().filter(|d| d.solver) {
        w.table(def);
    }
    w.push("");
    w.constants();
    if w.sink.has_errors() {
        return Err(w.sink.sorted());
    }
    let stamp = &crate::sha256::hex(w.lines.join("\n").as_bytes())[..8];
    w.lines.push(String::new());
    w.lines
        .push(format!("pub const CATALOG_HASH: u32 = 0x{stamp};"));
    Ok(format!("{}\n", w.lines.join("\n")))
}

/// Whether the declarations ask for a Solver catalog at all.
pub fn wanted(catalog: &Catalog) -> bool {
    !catalog.solver.is_empty() || catalog.defs.iter().any(|d| d.solver)
}

#[cfg(test)]
mod tests {
    fn compile(body: &str) -> crate::Compiled {
        crate::compile(vec![("t.qm".into(), body.into())])
    }

    fn rust(body: &str) -> String {
        let c = compile(body);
        assert!(c.diagnostics.is_empty(), "{:?}", c.diagnostics);
        c.solver.expect("a Solver catalog")
    }

    fn errors(body: &str) -> Vec<String> {
        compile(body)
            .diagnostics
            .iter()
            .map(|d| d.message.clone())
            .collect()
    }

    const DATA: &str = "(table langs :key id :ids lang-ids [id speed] [php 0.15] [go 1])\n\
        (records apps :key id :ids app-ids\n\
          (a :lang \"php\" :gc (:pause 3) :kinds [\"x\"])\n\
          (b :lang \"go\" :gc null :kinds [\"x\" \"y\"]))\n\
        (def kinds [\"x\" \"y\" \"z\"])\n\
        (def calls (:a (:y 2)))\n\
        (def rtt (:p-q 7))\n\
        (def places [\"p\" \"q\"])\n\
        (def spare 3)\n";

    #[test]
    fn declarations_write_their_items_and_every_other_scalar() {
        let out = rust(&format!(
            "{DATA}(solver\n\
               (axis kind :of kinds :count NK :module kind)\n\
               (axis lang :of lang-ids :names LANG_IDS :index lang_index)\n\
               (axis app :of app-ids :count NA)\n\
               (columns apps :over app (APP_LANG lang :index lang) (APP_GC gc.pause :default -1))\n\
               (matrix CALLS calls :rows app :cols kind :default 0)\n\
               (masks apps :over app :bits kind (APP_KINDS kinds))\n\
               (member HEAVY kinds :over kind :type u8)\n\
               (axis place :of places)\n\
               (pairs RTT rtt :over place :default 0))\n"
        ));
        for line in [
            "pub const NK: usize = 3;",
            "pub mod kind {\n    pub const X: usize = 0;\n    pub const Y: usize = 1;\n    pub const Z: usize = 2;\n}",
            "pub static LANG_IDS: [&str; 2] = [\"php\", \"go\"];",
            "        \"go\" => 1,",
            "pub static APP_LANG: [usize; NA] = [0, 1];",
            "pub static APP_GC: [f64; NA] = [3.0, -1.0];",
            "pub static CALLS: [[f64; NK]; NA] = [\n    [0.0, 2.0, 0.0],\n    [0.0, 0.0, 0.0],\n];",
            "pub static APP_KINDS: [u128; NA] = [\n    0x1,\n    0x3,\n];",
            "pub static HEAVY: [u8; NK] = [1, 1, 1];",
            "pub static RTT: [[f64; 2]; 2] = [[0.0, 7.0], [7.0, 0.0]];",
            "const _: () = assert!(NK <= 128);",
            "pub const SPARE: f64 = 3.0;",
            "pub static APP_IDS: [&str; 2] = [\"a\", \"b\"];",
        ] {
            assert!(out.contains(line), "missing {line:?} in\n{out}");
        }
        // A declaration's name is not written again as a scalar.
        assert_eq!(out.matches("LANG_IDS").count(), 1, "{out}");
    }

    #[test]
    fn a_declaration_that_does_not_match_the_catalog_is_an_error() {
        let one = |clause: &str| {
            errors(&format!(
                "{DATA}(solver (axis kind :of kinds) (axis app :of app-ids) {clause})\n"
            ))
        };
        assert_eq!(
            one("(columns appz :over app (X lang))"),
            ["there is no value `APPZ`"]
        );
        assert_eq!(
            one("(columns apps :over app (X gc.pause))"),
            ["`X` mixes a number and nothing; a Solver array holds numbers, flags, or strings, so give it a :default"]
        );
        assert_eq!(
            one("(columns apps :over app (X lang :index kind))"),
            ["`X` reads Str(\"php\"), which is not on the axis `kind`"]
        );
        assert_eq!(
            one("(member X lang-ids :over kind)"),
            [
                "`go` is not on the axis `kind`",
                "`php` is not on the axis `kind`"
            ]
        );
        assert_eq!(
            one("(columns apps :over app (X lang)) (columns apps :over app (X lang))"),
            ["the Solver catalog already has an item `X`"]
        );
        assert_eq!(
            one("(columns apps :over aps (X lang))")[0],
            "there is no axis declared before this `aps`"
        );
        assert_eq!(
            one("(axis place :of (\"p\"))"),
            ["`:of` names one or more values, like (request-kinds backend-kinds)"]
        );
    }
}
