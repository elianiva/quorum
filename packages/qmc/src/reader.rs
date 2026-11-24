//! The reader: text to S-expressions with spans.
//!
//! Syntax: `( … )` lists, `[ … ]` rows, `:keyword`, `"string"`, symbols, numbers with an optional
//! unit (`2ms`, `44%`, `5_000`, `1.15x`), `'x` quote, `` `x `` quasiquote, `,x` unquote, `,@x`
//! splice, `;` line comments, and `#;` to comment out the next form.
//!
//! The reader recovers from errors: an unclosed list closes at the end of the file and a stray
//! closer is skipped, so one typo reports once and the rest of the file still reads.

use crate::diag::{Diagnostic, Sink};
use crate::num::{Number, Unit};
use crate::source::{FileId, Span};

#[derive(Clone, Debug, PartialEq)]
pub enum Kind {
    List(Vec<Sexp>),
    Row(Vec<Sexp>),
    Symbol(String),
    Keyword(String),
    Str(String),
    Num(Number),
}

#[derive(Clone, Debug, PartialEq)]
pub struct Sexp {
    pub kind: Kind,
    pub span: Span,
}

impl Sexp {
    pub fn new(kind: Kind, span: Span) -> Sexp {
        Sexp { kind, span }
    }

    pub fn symbol(&self) -> Option<&str> {
        match &self.kind {
            Kind::Symbol(s) => Some(s),
            _ => None,
        }
    }

    pub fn keyword(&self) -> Option<&str> {
        match &self.kind {
            Kind::Keyword(s) => Some(s),
            _ => None,
        }
    }

    pub fn list(&self) -> Option<&[Sexp]> {
        match &self.kind {
            Kind::List(items) => Some(items),
            _ => None,
        }
    }

    /// The head symbol of a list, such as `research` in `(research …)`.
    pub fn head(&self) -> Option<&str> {
        self.list()?.first()?.symbol()
    }

    pub fn describe(&self) -> &'static str {
        match self.kind {
            Kind::List(_) => "a list",
            Kind::Row(_) => "a row",
            Kind::Symbol(_) => "a symbol",
            Kind::Keyword(_) => "a keyword",
            Kind::Str(_) => "a string",
            Kind::Num(_) => "a number",
        }
    }
}

impl std::fmt::Display for Sexp {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let seq = |f: &mut std::fmt::Formatter<'_>, open: &str, items: &[Sexp], close: &str| {
            write!(f, "{open}")?;
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    write!(f, " ")?;
                }
                write!(f, "{item}")?;
            }
            write!(f, "{close}")
        };
        match &self.kind {
            Kind::List(items) => seq(f, "(", items, ")"),
            Kind::Row(items) => seq(f, "[", items, "]"),
            Kind::Symbol(s) => write!(f, "{s}"),
            Kind::Keyword(s) => write!(f, ":{s}"),
            Kind::Str(s) => write!(f, "{s:?}"),
            Kind::Num(n) => write!(f, "{n}"),
        }
    }
}

struct Reader<'a> {
    text: &'a str,
    bytes: &'a [u8],
    pos: usize,
    file: FileId,
    sink: Sink,
}

const DELIMITERS: &[u8] = b"()[]\";'`,";

pub fn read(file: FileId, text: &str) -> (Vec<Sexp>, Sink) {
    let mut reader = Reader {
        text,
        bytes: text.as_bytes(),
        pos: 0,
        file,
        sink: Sink::default(),
    };
    let mut forms = Vec::new();
    loop {
        reader.skip_trivia();
        if reader.pos >= reader.bytes.len() {
            break;
        }
        let c = reader.bytes[reader.pos];
        if c == b')' || c == b']' {
            let span = reader.span(reader.pos, reader.pos + 1);
            reader.sink.push(
                Diagnostic::error("unbalanced", span, format!("unexpected `{}`", c as char))
                    .label("nothing to close here"),
            );
            reader.pos += 1;
            continue;
        }
        if let Some(form) = reader.form() {
            forms.push(form);
        }
    }
    (forms, reader.sink)
}

impl Reader<'_> {
    fn span(&self, start: usize, end: usize) -> Span {
        Span::new(self.file, start, end)
    }

    fn skip_trivia(&mut self) {
        while self.pos < self.bytes.len() {
            match self.bytes[self.pos] {
                b' ' | b'\t' | b'\n' | b'\r' => self.pos += 1,
                b';' => {
                    while self.pos < self.bytes.len() && self.bytes[self.pos] != b'\n' {
                        self.pos += 1;
                    }
                }
                b'#' if self.bytes.get(self.pos + 1) == Some(&b';') => {
                    self.pos += 2;
                    self.skip_trivia();
                    let _ = self.form();
                }
                _ => break,
            }
        }
    }

    /// Reads one form. Returns `None` only at the end of the file or after a reported error.
    fn form(&mut self) -> Option<Sexp> {
        self.skip_trivia();
        let start = self.pos;
        let c = *self.bytes.get(self.pos)?;
        match c {
            b'(' => self.seq(b')', Kind::List),
            b'[' => self.seq(b']', Kind::Row),
            b'"' => self.string(),
            b'\'' | b'`' | b',' => {
                let mut name = match c {
                    b'\'' => "quote",
                    b'`' => "quasiquote",
                    _ => "unquote",
                };
                self.pos += 1;
                if c == b',' && self.bytes.get(self.pos) == Some(&b'@') {
                    name = "unquote-splicing";
                    self.pos += 1;
                }
                let head = Sexp::new(Kind::Symbol(name.into()), self.span(start, self.pos));
                match self.form() {
                    Some(inner) => {
                        let span = self.span(start, inner.span.end as usize);
                        Some(Sexp::new(Kind::List(vec![head, inner]), span))
                    }
                    None => {
                        self.sink.push(Diagnostic::error(
                            "expected-form",
                            head.span,
                            format!("`{name}` needs a form after it"),
                        ));
                        None
                    }
                }
            }
            _ => Some(self.atom()),
        }
    }

    fn seq(&mut self, close: u8, make: fn(Vec<Sexp>) -> Kind) -> Option<Sexp> {
        let start = self.pos;
        self.pos += 1;
        let mut items = Vec::new();
        loop {
            self.skip_trivia();
            match self.bytes.get(self.pos) {
                None => {
                    self.sink.push(
                        Diagnostic::error(
                            "unbalanced",
                            self.span(start, start + 1),
                            format!("this `{}` is never closed", self.bytes[start] as char),
                        )
                        .label("opened here")
                        .help(format!("add `{}`", close as char)),
                    );
                    return Some(Sexp::new(make(items), self.span(start, self.pos)));
                }
                Some(&c) if c == close => {
                    self.pos += 1;
                    return Some(Sexp::new(make(items), self.span(start, self.pos)));
                }
                Some(&c) if c == b')' || c == b']' => {
                    self.sink.push(
                        Diagnostic::error(
                            "unbalanced",
                            self.span(self.pos, self.pos + 1),
                            format!("expected `{}`, found `{}`", close as char, c as char),
                        )
                        .label("wrong closer")
                        .note(
                            self.span(start, start + 1),
                            "this is the opener it should close",
                        ),
                    );
                    // Treat it as the closer the opener wanted, so the rest of the file lines up.
                    self.pos += 1;
                    return Some(Sexp::new(make(items), self.span(start, self.pos)));
                }
                Some(_) => {
                    if let Some(item) = self.form() {
                        items.push(item);
                    }
                }
            }
        }
    }

    fn string(&mut self) -> Option<Sexp> {
        let start = self.pos;
        self.pos += 1;
        let mut value = String::new();
        loop {
            let Some(c) = self.text[self.pos..].chars().next() else {
                self.sink.push(
                    Diagnostic::error(
                        "unterminated-string",
                        self.span(start, start + 1),
                        "this string never ends",
                    )
                    .label("starts here"),
                );
                return Some(Sexp::new(Kind::Str(value), self.span(start, self.pos)));
            };
            self.pos += c.len_utf8();
            match c {
                '"' => return Some(Sexp::new(Kind::Str(value), self.span(start, self.pos))),
                '\\' => {
                    let escape_start = self.pos - 1;
                    let Some(e) = self.text[self.pos..].chars().next() else {
                        continue;
                    };
                    self.pos += e.len_utf8();
                    match e {
                        'n' => value.push('\n'),
                        't' => value.push('\t'),
                        '"' => value.push('"'),
                        '\\' => value.push('\\'),
                        // A backslash before a line break joins the lines and drops the indent.
                        '\n' => {
                            while matches!(self.bytes.get(self.pos), Some(b' ' | b'\t')) {
                                self.pos += 1;
                            }
                        }
                        other => self.sink.push(Diagnostic::error(
                            "bad-escape",
                            self.span(escape_start, self.pos),
                            format!("unknown escape `\\{other}`"),
                        )),
                    }
                }
                c => value.push(c),
            }
        }
    }

    fn atom(&mut self) -> Sexp {
        let start = self.pos;
        while let Some(&c) = self.bytes.get(self.pos) {
            if c.is_ascii_whitespace() || DELIMITERS.contains(&c) {
                break;
            }
            self.pos += 1;
        }
        let span = self.span(start, self.pos);
        let token = &self.text[start..self.pos];
        if let Some(name) = token.strip_prefix(':') {
            return Sexp::new(Kind::Keyword(name.into()), span);
        }
        let first = token.as_bytes()[0];
        let numeric = first.is_ascii_digit()
            || (matches!(first, b'-' | b'+')
                && token.as_bytes().get(1).is_some_and(u8::is_ascii_digit));
        if numeric {
            match Number::parse(token) {
                Ok(n) => return Sexp::new(Kind::Num(n), span),
                Err(why) => {
                    self.sink.push(Diagnostic::error(
                        "bad-number",
                        span,
                        format!("`{token}` is not a number: {why}"),
                    ));
                    return Sexp::new(Kind::Num(Number::int(0, Unit::None)), span);
                }
            }
        }
        Sexp::new(Kind::Symbol(token.into()), span)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::SourceMap;

    fn read_ok(text: &str) -> Vec<Sexp> {
        let (forms, sink) = read(FileId(0), text);
        assert!(sink.items.is_empty(), "{:?}", sink.items);
        forms
    }

    #[test]
    fn reads_nested_forms_and_round_trips() {
        let forms =
            read_ok("(research pooling :cost 400 :requires (a b) [x \"y z\"]) ; c\n#;(skipped) 'q");
        let shown: Vec<String> = forms.iter().map(ToString::to_string).collect();
        assert_eq!(
            shown,
            [
                "(research pooling :cost 400 :requires (a b) [x \"y z\"])",
                "(quote q)"
            ]
        );
    }

    #[test]
    fn spans_point_at_the_token() {
        let forms = read_ok("  (a :bc)");
        let items = forms[0].list().unwrap();
        assert_eq!((items[1].span.start, items[1].span.end), (5, 8));
        assert_eq!((forms[0].span.start, forms[0].span.end), (2, 9));
    }

    #[test]
    fn a_minus_sign_alone_is_a_symbol_and_before_a_digit_is_a_number() {
        let forms = read_ok("(- -3 ->)");
        let items = forms[0].list().unwrap();
        assert_eq!(items[0].symbol(), Some("-"));
        assert!(matches!(items[1].kind, Kind::Num(_)));
        assert_eq!(items[2].symbol(), Some("->"));
    }

    #[test]
    fn string_escapes_and_line_joins() {
        let forms = read_ok("\"a\\\"b\\n \\\n    c\"");
        assert_eq!(forms[0].kind, Kind::Str("a\"b\n c".into()));
    }

    #[test]
    fn recovers_from_a_wrong_closer_and_keeps_reading() {
        let mut sources = SourceMap::default();
        let file = sources.add("x.qm", "(a [b) (c)\n(d");
        let (forms, sink) = read(file, &sources.get(file).text.clone());
        let codes: Vec<&str> = sink.items.iter().map(|d| d.code).collect();
        assert_eq!(codes, ["unbalanced", "unbalanced", "unbalanced"]);
        // `(a [b)` closes the row early, then `(c)` is read inside `(a`, then `(d` and `(a` never close.
        assert_eq!(forms.len(), 1);
        assert!(sink.items[0]
            .render(&sources)
            .contains("expected `]`, found `)`"));
    }
}
