//! Plain data: `(def NAME value)` for tables and numbers that need no form of their own.
//!
//! A value is a number, a string, `true`, `false`, `null`, `undefined`, `Infinity`, a name of
//! another value, a row `[a b c]` (an array), or a list:
//!
//! - `(:key value …)` or `(record "key" value …)`: a record
//! - `(... NAME)` inside a row or a record: spread another value
//! - `(ref NAME key 0)`: a property of another value
//! - `(+ a b)`, `(- a b)`, `(* a b)`, `(/ a b)`, `(- a)`: arithmetic, emitted as written so the
//!   generated code computes the same floating-point value the hand-written code did
//! - `(as "Type" value)`: a TypeScript type assertion
//!
//! `(def NAME :type "T" value)` annotates the declaration, `:type const` writes `as const`,
//! `:satisfies "T"` writes `satisfies T`, and `:doc "…"` writes a doc comment. A def lands in the
//! generated file named after its content file: `content/team.qm` writes `generated/team.ts`.
//! `(types "../catalog/team.ts" Hire Role)` names the TypeScript types the annotations use.

use crate::diag::{Diagnostic, Sink};
use crate::lower::Name;
use crate::num::{Dimension, Ratio};
use crate::reader::{Kind, Sexp};
use crate::source::Span;
use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write;

#[derive(Debug)]
pub struct Def {
    pub name: Name,
    /// The content file's stem, which names the generated file.
    pub module: String,
    pub ty: Option<String>,
    pub as_const: bool,
    pub satisfies: Option<String>,
    pub doc: Option<String>,
    pub value: Datum,
    pub span: Span,
}

/// `(types "../catalog/team.ts" Hire Role)`.
#[derive(Debug)]
pub struct Types {
    pub from: String,
    pub names: Vec<Name>,
}

#[derive(Clone, Debug)]
pub struct Datum {
    pub kind: D,
    pub span: Span,
}

#[derive(Clone, Debug)]
pub enum D {
    Num(Ratio),
    Str(String),
    Bool(bool),
    Null,
    Undefined,
    Inf,
    Ref(Name),
    /// `(ref NAME key 0)`.
    Member(Name, Vec<Key>),
    /// Items, each with whether it is spread.
    Array(Vec<(bool, Datum)>),
    Record(Vec<Entry>),
    Neg(Box<Datum>),
    /// `+ - * /` over two or more operands, folded from the left.
    Op(char, Vec<Datum>),
    As(String, Box<Datum>),
}

#[derive(Clone, Debug, PartialEq)]
pub enum Key {
    Name(String),
    Index(usize),
}

#[derive(Clone, Debug)]
pub enum Entry {
    Pair(Name, Datum),
    Spread(Datum),
}

/// The names each typed emitter exports, by generated file. A test compares this table with the
/// real output.
pub const TYPED_EXPORTS: &[(&str, &[&str])] = &[
    (
        "components",
        &[
            "COMPONENT_IDS",
            "ComponentId",
            "BuildGroup",
            "BUILD_GROUPS",
            "DockGroup",
            "DOCK_GROUPS",
            "DOCK_OF",
            "ComponentDef",
            "COMPONENTS",
            "TLS_TERMINATORS",
            "GLOBAL_COMPONENTS",
            "ZONE_SPANNING_COMPONENTS",
            "STANDBY_TYPES",
            "FLAT_CAPACITY",
            "GateValue",
            "GateDef",
            "GATES",
            "GateKey",
        ],
    ),
    (
        "eras",
        &[
            "EraDef",
            "SERIES_B_MIX",
            "SERIES_C_MIX",
            "TUNED_PRE_SEED_MIX",
            "TUNED_SEED_MIX",
            "TUNED_SERIES_A_MIX",
            "ERAS",
        ],
    ),
    (
        "incidents",
        &[
            "INCIDENT_IDS",
            "IncidentId",
            "FALLACY_IDS",
            "FallacyId",
            "FALLACY_INCIDENTS",
            "IncidentDef",
            "KIND_SURGE",
            "RUNTIME_INCIDENT_FAILURES",
            "CASCADES",
            "INCIDENTS",
        ],
    ),
    (
        "kinds",
        &[
            "REQUEST_KINDS",
            "RequestKind",
            "BACKEND_KINDS",
            "BackendKind",
            "DATA_KINDS",
            "DataKind",
        ],
    ),
    (
        "research",
        &[
            "RESEARCH_IDS",
            "ResearchId",
            "ResearchTrack",
            "RESEARCH_TRACKS",
            "ResearchDef",
            "RESEARCH_LIST",
            "RESEARCH_INSIGHT",
            "StudyShape",
            "STUDY_SHAPE_KINDS",
            "StudyShapeKind",
            "SHAPE",
            "BREADTH",
            "REGION_BREADTH",
            "FRAMEWORK_UNLOCKS",
        ],
    ),
];

/// TypeScript's own type names and keywords, which an annotation uses without an import.
const TS_TYPES: &[&str] = &[
    "Array",
    "Exclude",
    "Extract",
    "NonNullable",
    "Omit",
    "Partial",
    "Pick",
    "Readonly",
    "ReadonlyArray",
    "Record",
    "Required",
    "ReturnType",
    "any",
    "as",
    "bigint",
    "boolean",
    "const",
    "extends",
    "false",
    "in",
    "infer",
    "keyof",
    "never",
    "null",
    "number",
    "object",
    "readonly",
    "string",
    "symbol",
    "true",
    "typeof",
    "undefined",
    "unique",
    "unknown",
    "void",
];

fn err(sink: &mut Sink, span: Span, msg: impl Into<String>) {
    sink.push(Diagnostic::error("bad-value", span, msg.into()));
}

fn name_of(sexp: &Sexp) -> Option<Name> {
    sexp.symbol().map(|s| Name {
        text: s.to_string(),
        span: sexp.span,
    })
}

/// Lowers `(def NAME [:type T] [:satisfies T] [:doc "…"] value)`.
pub fn lower_def(form: &Sexp, module: &str, sink: &mut Sink) -> Option<Def> {
    let items = &form.list().unwrap()[1..];
    let Some(name) = items.first().and_then(name_of) else {
        err(sink, form.span, "write (def NAME value)");
        return None;
    };
    let mut def = Def {
        name,
        module: module.to_string(),
        ty: None,
        as_const: false,
        satisfies: None,
        doc: None,
        value: Datum {
            kind: D::Null,
            span: form.span,
        },
        span: form.span,
    };
    let mut rest = &items[1..];
    while let [key, value, tail @ ..] = rest {
        let Some(k) = key.keyword() else { break };
        let text = match &value.kind {
            Kind::Str(s) => Some(s.clone()),
            _ => None,
        };
        match (k, text) {
            ("type", _) if value.symbol() == Some("const") => def.as_const = true,
            ("type", Some(t)) => def.ty = Some(t),
            ("satisfies", Some(t)) => def.satisfies = Some(t),
            ("doc", Some(t)) => def.doc = Some(t),
            ("type" | "satisfies" | "doc", None) => {
                err(sink, value.span, format!(":{k} takes a string"));
            }
            _ => sink.push(
                Diagnostic::error("unknown-key", key.span, format!("a def has no `:{k}`"))
                    .help("a def takes :type, :satisfies, and :doc"),
            ),
        }
        rest = tail;
    }
    match rest {
        [value] => def.value = datum(value, sink)?,
        [] => {
            err(sink, form.span, format!("`{}` has no value", def.name.text));
            return None;
        }
        [_, extra, ..] => {
            err(
                sink,
                extra.span,
                "a def has one value; put the keys before it",
            );
            return None;
        }
    }
    Some(def)
}

/// Lowers `(types "path" Name …)`.
pub fn lower_types(form: &Sexp, sink: &mut Sink) -> Option<Types> {
    let items = &form.list().unwrap()[1..];
    let Some(Kind::Str(from)) = items.first().map(|i| &i.kind) else {
        err(
            sink,
            form.span,
            "write (types \"../catalog/file.ts\" Type …)",
        );
        return None;
    };
    let names: Vec<Name> = items[1..].iter().filter_map(name_of).collect();
    if names.len() + 1 != items.len() || names.is_empty() {
        err(
            sink,
            form.span,
            "(types …) names one or more types after the path",
        );
    }
    Some(Types {
        from: from.clone(),
        names,
    })
}

pub fn datum(sexp: &Sexp, sink: &mut Sink) -> Option<Datum> {
    let kind = match &sexp.kind {
        Kind::Num(n) => {
            if n.unit.dimension() == Dimension::Time {
                err(
                    sink,
                    sexp.span,
                    "a def value has no time unit; name the unit in the def instead",
                );
                return None;
            }
            D::Num(n.base())
        }
        Kind::Str(s) => D::Str(s.clone()),
        Kind::Symbol(s) => match s.as_str() {
            "true" => D::Bool(true),
            "false" => D::Bool(false),
            "null" => D::Null,
            "undefined" => D::Undefined,
            "Infinity" => D::Inf,
            _ => D::Ref(name_of(sexp).unwrap()),
        },
        Kind::Keyword(k) => {
            err(
                sink,
                sexp.span,
                format!("`:{k}` is a record key; write (:{k} value …)"),
            );
            return None;
        }
        Kind::Row(items) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                if let Some(target) = spread(item, sink) {
                    out.push((true, target?));
                } else {
                    out.push((false, datum(item, sink)?));
                }
            }
            D::Array(out)
        }
        Kind::List(items) => list(sexp, items, sink)?,
    };
    Some(Datum {
        kind,
        span: sexp.span,
    })
}

/// `Some` when `sexp` is `(... value)`.
fn spread(sexp: &Sexp, sink: &mut Sink) -> Option<Option<Datum>> {
    let items = sexp.list()?;
    if items.first()?.symbol()? != "..." {
        return None;
    }
    match items {
        [_, value] => Some(datum(value, sink)),
        _ => {
            err(sink, sexp.span, "write (... NAME)");
            Some(None)
        }
    }
}

fn list(sexp: &Sexp, items: &[Sexp], sink: &mut Sink) -> Option<D> {
    let Some(first) = items.first() else {
        err(
            sink,
            sexp.span,
            "an empty list is no value; write [] or (record)",
        );
        return None;
    };
    if first.keyword().is_some() {
        return record(items, sink).map(D::Record);
    }
    let head = first.symbol().unwrap_or("");
    let args = &items[1..];
    match head {
        "record" => record(args, sink).map(D::Record),
        "ref" => {
            let base = args.first().and_then(name_of);
            let Some(base) = base else {
                err(sink, sexp.span, "write (ref NAME key …)");
                return None;
            };
            let mut path = Vec::new();
            for part in &args[1..] {
                match &part.kind {
                    Kind::Symbol(s) | Kind::Str(s) => path.push(Key::Name(s.clone())),
                    Kind::Num(n) if n.value.is_int() && n.value.num >= 0 => {
                        path.push(Key::Index(n.value.num as usize))
                    }
                    _ => {
                        err(sink, part.span, "a path part is a name or an index");
                        return None;
                    }
                }
            }
            if path.is_empty() {
                err(sink, sexp.span, "(ref NAME) is just NAME");
                return None;
            }
            Some(D::Member(base, path))
        }
        "-" if args.len() == 1 => Some(D::Neg(Box::new(datum(&args[0], sink)?))),
        "+" | "-" | "*" | "/" => {
            if args.len() < 2 {
                err(
                    sink,
                    sexp.span,
                    format!("`{head}` takes two or more operands"),
                );
                return None;
            }
            let ops: Option<Vec<Datum>> = args.iter().map(|a| datum(a, sink)).collect();
            Some(D::Op(head.chars().next().unwrap(), ops?))
        }
        "as" => match args {
            [Sexp {
                kind: Kind::Str(ty),
                ..
            }, value] => Some(D::As(ty.clone(), Box::new(datum(value, sink)?))),
            _ => {
                err(sink, sexp.span, "write (as \"Type\" value)");
                None
            }
        },
        _ => {
            err(sink, first.span, format!("`{head}` is not a value form"));
            None
        }
    }
}

fn record(items: &[Sexp], sink: &mut Sink) -> Option<Vec<Entry>> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < items.len() {
        let item = &items[i];
        if let Some(target) = spread(item, sink) {
            out.push(Entry::Spread(target?));
            i += 1;
            continue;
        }
        let key = match &item.kind {
            Kind::Keyword(k) | Kind::Str(k) => Name {
                text: k.clone(),
                span: item.span,
            },
            _ => {
                err(
                    sink,
                    item.span,
                    format!(
                        "expected a record key like :name, found {}",
                        item.describe()
                    ),
                );
                return None;
            }
        };
        let Some(value) = items.get(i + 1) else {
            err(sink, item.span, format!("`{}` has no value", key.text));
            return None;
        };
        out.push(Entry::Pair(key, datum(value, sink)?));
        i += 2;
    }
    Some(out)
}

/// Every value name a datum reads, with its span.
pub fn refs<'a>(d: &'a Datum, out: &mut Vec<&'a Name>) {
    match &d.kind {
        D::Ref(n) | D::Member(n, _) => out.push(n),
        D::Array(items) => items.iter().for_each(|(_, v)| refs(v, out)),
        D::Record(entries) => entries.iter().for_each(|e| match e {
            Entry::Pair(_, v) | Entry::Spread(v) => refs(v, out),
        }),
        D::Neg(v) | D::As(_, v) => refs(v, out),
        D::Op(_, vs) => vs.iter().for_each(|v| refs(v, out)),
        _ => {}
    }
}

/// The identifiers a type annotation uses, with whether each follows `typeof` (a value).
pub fn type_names(ty: &str) -> Vec<(String, bool)> {
    let bytes = ty.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    let mut after_typeof = false;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\'' || c == b'"' || c == b'`' {
            i += 1;
            while i < bytes.len() && bytes[i] != c {
                i += 1;
            }
            i += 1;
            continue;
        }
        if c.is_ascii_alphabetic() || c == b'_' || c == b'$' {
            let start = i;
            while i < bytes.len()
                && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_' || bytes[i] == b'$')
            {
                i += 1;
            }
            let word = &ty[start..i];
            let before = ty[..start].trim_end();
            let after = ty[i..].trim_start();
            let qualified = before.ends_with('.') && !before.ends_with("...");
            let property = after.starts_with(':') || after.starts_with("?:");
            if word == "typeof" {
                after_typeof = true;
                continue;
            }
            if !qualified && !property && !TS_TYPES.contains(&word) {
                out.push((word.to_string(), after_typeof));
            }
            after_typeof = false;
            continue;
        }
        i += 1;
    }
    out
}

/// Where a name a generated module uses comes from.
#[derive(Clone, Debug, PartialEq)]
pub enum Origin {
    /// Declared in the same generated module.
    Local,
    /// Another generated module, such as `./kinds.ts`.
    Generated(String),
    /// A TypeScript module named by `(import …)` or `(types …)`.
    Path(String),
}

/// The names generated modules can use: defs, constants, typed exports, imports, and types.
pub struct Scope<'a> {
    pub values: BTreeMap<&'a str, (&'a str, bool)>,
    pub types: BTreeMap<&'a str, (&'a str, bool)>,
}

impl<'a> Scope<'a> {
    /// `(name, (module or path, generated?))` for every value and type.
    pub fn new(catalog: &'a crate::lower::Catalog) -> Scope<'a> {
        let mut values = BTreeMap::new();
        let mut types = BTreeMap::new();
        for (module, names) in TYPED_EXPORTS {
            for name in names.iter() {
                let starts_upper_word = name.chars().nth(1).is_some_and(|c| c.is_ascii_lowercase());
                let map = if starts_upper_word {
                    &mut types
                } else {
                    &mut values
                };
                map.insert(*name, (*module, true));
            }
        }
        for c in &catalog.consts {
            values.insert(c.name.text.as_str(), ("constants", true));
        }
        for import in &catalog.imports {
            for n in &import.names {
                values.insert(n.text.as_str(), (import.from.as_str(), false));
            }
        }
        for t in &catalog.types {
            for n in &t.names {
                types.insert(n.text.as_str(), (t.from.as_str(), false));
            }
        }
        for def in &catalog.defs {
            values.insert(def.name.text.as_str(), (def.module.as_str(), true));
        }
        Scope { values, types }
    }

    fn origin(entry: (&str, bool), module: &str) -> Origin {
        match entry {
            (m, true) if m == module => Origin::Local,
            (m, true) => Origin::Generated(format!("./{m}.ts")),
            (path, false) => Origin::Path(path.to_string()),
        }
    }

    pub fn value(&self, name: &str, module: &str) -> Option<Origin> {
        self.values.get(name).map(|e| Self::origin(*e, module))
    }

    pub fn ty(&self, name: &str, module: &str) -> Option<Origin> {
        self.types.get(name).map(|e| Self::origin(*e, module))
    }
}

/// Checks the defs: names are unique, references and types resolve, and record keys appear once.
pub fn check(catalog: &crate::lower::Catalog) -> Sink {
    let mut sink = Sink::default();
    let scope = Scope::new(catalog);
    let mut seen: BTreeMap<&str, &Name> = BTreeMap::new();
    let typed: BTreeSet<&str> = TYPED_EXPORTS
        .iter()
        .flat_map(|(_, n)| n.iter().copied())
        .collect();
    let consts: BTreeSet<&str> = catalog
        .consts
        .iter()
        .map(|c| c.name.text.as_str())
        .collect();
    let known: Vec<&str> = scope.values.keys().copied().collect();
    let known_types: Vec<&str> = scope.types.keys().copied().collect();
    for def in &catalog.defs {
        let n = def.name.text.as_str();
        if let Some(first) = seen.insert(n, &def.name) {
            sink.push(
                Diagnostic::error(
                    "duplicate",
                    def.name.span,
                    format!("the def `{n}` is defined twice"),
                )
                .label("second definition")
                .note(first.span, "first defined here"),
            );
        } else if typed.contains(n) || consts.contains(n) {
            sink.push(Diagnostic::error(
                "duplicate",
                def.name.span,
                format!("`{n}` is already declared by another form"),
            ));
        }
        let mut used = Vec::new();
        refs(&def.value, &mut used);
        for r in used {
            if r.text == def.name.text {
                sink.push(Diagnostic::error(
                    "self-reference",
                    r.span,
                    format!("`{}` reads itself", r.text),
                ));
            } else if scope.value(&r.text, &def.module).is_none() {
                let mut d = crate::check::unknown("unknown-name", r, "value", &known);
                if d.help.is_none() {
                    d = d.help("define it with (def …) or (const …), or name it in (import …)");
                }
                sink.push(d);
            }
        }
        for ty in [&def.ty, &def.satisfies].into_iter().flatten() {
            for (word, is_value) in type_names(ty) {
                let found = if is_value {
                    scope.value(&word, &def.module).is_some()
                        || scope.ty(&word, &def.module).is_some()
                } else {
                    scope.ty(&word, &def.module).is_some()
                };
                if !found {
                    let name = Name {
                        text: word,
                        span: def.span,
                    };
                    let mut d = crate::check::unknown("unknown-type", &name, "type", &known_types);
                    if d.help.is_none() {
                        d = d.help("name it in (types \"../catalog/….ts\" …)");
                    }
                    sink.push(d);
                }
            }
        }
        duplicate_keys(&def.value, &mut sink);
    }
    sink
}

fn duplicate_keys(d: &Datum, sink: &mut Sink) {
    match &d.kind {
        D::Record(entries) => {
            let mut seen: BTreeMap<&str, Span> = BTreeMap::new();
            for e in entries {
                match e {
                    Entry::Pair(k, v) => {
                        if let Some(first) = seen.insert(&k.text, k.span) {
                            sink.push(
                                Diagnostic::error(
                                    "duplicate-key",
                                    k.span,
                                    format!("the key `{}` appears twice in one record", k.text),
                                )
                                .note(first, "first here"),
                            );
                        }
                        duplicate_keys(v, sink);
                    }
                    Entry::Spread(v) => duplicate_keys(v, sink),
                }
            }
        }
        D::Array(items) => items.iter().for_each(|(_, v)| duplicate_keys(v, sink)),
        D::Neg(v) | D::As(_, v) => duplicate_keys(v, sink),
        D::Op(_, vs) => vs.iter().for_each(|v| duplicate_keys(v, sink)),
        _ => {}
    }
}

// ---------------------------------------------------------------------------------------------
// TypeScript

fn string(s: &str) -> String {
    let mut out = String::from("'");
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\'' => out.push_str("\\'"),
            '\n' => out.push_str("\\n"),
            c => out.push(c),
        }
    }
    out.push('\'');
    out
}

fn is_ident(s: &str) -> bool {
    let mut chars = s.chars();
    chars
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic() || c == '_' || c == '$')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
}

fn key(s: &str) -> String {
    if is_ident(s)
        || (!s.is_empty()
            && s.bytes().all(|b| b.is_ascii_digit())
            && (s == "0" || !s.starts_with('0')))
    {
        s.to_string()
    } else {
        string(s)
    }
}

fn prec(op: char) -> u8 {
    if op == '+' || op == '-' {
        1
    } else {
        2
    }
}

const WIDTH: usize = 100;

/// A datum as a TypeScript expression at nesting `depth`, starting at column `col`. A record or
/// array that does not fit in `WIDTH` columns puts one entry on each line.
pub fn ts(d: &Datum, depth: usize, col: usize) -> String {
    let flat = flat(d);
    if col + flat.len() <= WIDTH || !matches!(d.kind, D::Array(_) | D::Record(_) | D::As(..)) {
        return flat;
    }
    let pad = "  ".repeat(depth + 1);
    let close = "  ".repeat(depth);
    let inner = pad.len();
    match &d.kind {
        D::Array(items) => {
            let mut o = String::from("[\n");
            for (spread, v) in items {
                let dots = if *spread { "..." } else { "" };
                let _ = writeln!(o, "{pad}{dots}{},", ts(v, depth + 1, inner + dots.len()));
            }
            let _ = write!(o, "{close}]");
            o
        }
        D::Record(entries) => {
            let mut o = String::from("{\n");
            for e in entries {
                match e {
                    Entry::Pair(k, v) => {
                        let k = key(&k.text);
                        let _ = writeln!(o, "{pad}{k}: {},", ts(v, depth + 1, inner + k.len() + 2));
                    }
                    Entry::Spread(v) => {
                        let _ = writeln!(o, "{pad}...{},", ts(v, depth + 1, inner + 3));
                    }
                }
            }
            let _ = write!(o, "{close}}}");
            o
        }
        D::As(ty, v) => format!("{} as {ty}", ts(v, depth, col)),
        _ => unreachable!(),
    }
}

fn flat(d: &Datum) -> String {
    match &d.kind {
        D::Num(r) => r.decimal().expect("a literal is a finite decimal"),
        D::Str(s) => string(s),
        D::Bool(b) => b.to_string(),
        D::Null => "null".into(),
        D::Undefined => "undefined".into(),
        D::Inf => "Infinity".into(),
        D::Ref(n) => n.text.clone(),
        D::Member(n, path) => {
            let mut o = n.text.clone();
            for k in path {
                match k {
                    Key::Name(s) if is_ident(s) => {
                        let _ = write!(o, ".{s}");
                    }
                    Key::Name(s) => {
                        let _ = write!(o, "[{}]", string(s));
                    }
                    Key::Index(i) => {
                        let _ = write!(o, "[{i}]");
                    }
                }
            }
            o
        }
        D::Array(items) => {
            let parts: Vec<String> = items
                .iter()
                .map(|(s, v)| format!("{}{}", if *s { "..." } else { "" }, flat(v)))
                .collect();
            format!("[{}]", parts.join(", "))
        }
        D::Record(entries) if entries.is_empty() => "{}".into(),
        D::Record(entries) => {
            let parts: Vec<String> = entries
                .iter()
                .map(|e| match e {
                    Entry::Pair(k, v) => format!("{}: {}", key(&k.text), flat(v)),
                    Entry::Spread(v) => format!("...{}", flat(v)),
                })
                .collect();
            format!("{{ {} }}", parts.join(", "))
        }
        D::Neg(v) => match v.kind {
            D::Op(..) | D::Neg(_) | D::As(..) => format!("-({})", flat(v)),
            _ => format!("-{}", flat(v)),
        },
        D::Op(op, vs) => {
            let mut o = String::new();
            for (i, v) in vs.iter().enumerate() {
                if i > 0 {
                    let _ = write!(o, " {op} ");
                }
                let wrap = match &v.kind {
                    D::Op(inner, _) => {
                        prec(*inner) < prec(*op) || (i > 0 && prec(*inner) == prec(*op))
                    }
                    D::As(..) => true,
                    D::Num(r) => i > 0 && r.num < 0,
                    _ => false,
                };
                if wrap {
                    let _ = write!(o, "({})", flat(v));
                } else {
                    o.push_str(&flat(v));
                }
            }
            o
        }
        D::As(ty, v) => format!("{} as {ty}", flat(v)),
    }
}

/// The body of a generated module: its defs, in order, and the imports they need.
pub fn module(
    catalog: &crate::lower::Catalog,
    module: &str,
) -> (Vec<(Origin, String, bool)>, String) {
    let scope = Scope::new(catalog);
    let mut body = String::new();
    let mut needs: Vec<(Origin, String, bool)> = Vec::new();
    let mut add = |origin: Option<Origin>, name: &str, ty: bool| {
        if let Some(origin) = origin {
            if origin != Origin::Local && !needs.iter().any(|(o, n, _)| o == &origin && n == name) {
                needs.push((origin, name.to_string(), ty));
            }
        }
    };
    let mut last_block = true;
    for def in catalog.defs.iter().filter(|d| d.module == module) {
        let mut used = Vec::new();
        refs(&def.value, &mut used);
        for r in used {
            add(scope.value(&r.text, module), &r.text, false);
        }
        for ty in [&def.ty, &def.satisfies].into_iter().flatten() {
            for (word, is_value) in type_names(ty) {
                let origin = if is_value {
                    scope
                        .value(&word, module)
                        .or_else(|| scope.ty(&word, module))
                } else {
                    scope.ty(&word, module)
                };
                add(origin, &word, true);
            }
        }
        let start = body.len();
        if let Some(doc) = &def.doc {
            if doc.contains('\n') {
                let _ = writeln!(body, "/**");
                for line in doc.lines() {
                    let _ = writeln!(body, "{}", format!(" * {line}").trim_end());
                }
                let _ = writeln!(body, " */");
            } else {
                let _ = writeln!(body, "/** {doc} */");
            }
        }
        let ann = def
            .ty
            .as_ref()
            .map(|t| format!(": {t}"))
            .unwrap_or_default();
        let head = format!("export const {}{ann} = ", def.name.text);
        let mut line = format!("{head}{}", ts(&def.value, 0, head.len()));
        if def.as_const {
            line.push_str(" as const");
        }
        if let Some(s) = &def.satisfies {
            let _ = write!(line, " satisfies {s}");
        }
        let _ = writeln!(body, "{line}");
        // One-line defs sit together; a doc or a multi-line def gets a blank line around it.
        let block = body[start..].lines().count() > 1;
        if block || last_block {
            body.insert(start, '\n');
        }
        last_block = block;
    }
    // A name read as a value needs a value import even when a type also uses it.
    let values: BTreeSet<(Origin, String)> = needs
        .iter()
        .filter(|(_, _, ty)| !ty)
        .map(|(o, n, _)| (o.clone(), n.clone()))
        .collect();
    needs.retain(|(o, n, ty)| !ty || !values.contains(&(o.clone(), n.clone())));
    (needs, body)
}

impl PartialOrd for Origin {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}
impl Eq for Origin {}
impl Ord for Origin {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.path().cmp(other.path())
    }
}

impl Origin {
    pub fn path(&self) -> &str {
        match self {
            Origin::Local => "",
            Origin::Generated(p) | Origin::Path(p) => p,
        }
    }
}

/// Merges the `import` lines at the top of a generated file with the imports `extra` needs, so a
/// name is imported once. Lines keep their first-seen order; names keep theirs.
pub fn merge_imports(text: &str, extra: &[(Origin, String, bool)]) -> String {
    type Modules = Vec<(String, Vec<(String, bool)>)>;
    let mut modules: Modules = Vec::new();
    fn add(modules: &mut Modules, from: &str, name: &str, ty: bool) {
        let i = match modules.iter().position(|(m, _)| m == from) {
            Some(i) => i,
            None => {
                modules.push((from.to_string(), Vec::new()));
                modules.len() - 1
            }
        };
        let names = &mut modules[i].1;
        match names.iter_mut().find(|(n, _)| n == name) {
            Some(entry) => entry.1 &= ty,
            None => names.push((name.to_string(), ty)),
        }
    }
    let mut header = String::new();
    let mut rest = String::new();
    let mut in_header = true;
    for line in text.lines() {
        if in_header && line.starts_with("//") {
            let _ = writeln!(header, "{line}");
            continue;
        }
        if let Some(spec) = line.strip_prefix("import ") {
            let (all_types, spec) = match spec.strip_prefix("type ") {
                Some(s) => (true, s),
                None => (false, spec),
            };
            let (names, from) = spec.split_once(" from ").expect("one-line import");
            let from = from.trim_matches('\'');
            for n in names
                .trim_matches(|c| c == '{' || c == '}' || c == ' ')
                .split(',')
            {
                let n = n.trim();
                let (ty, n) = match n.strip_prefix("type ") {
                    Some(n) => (true, n),
                    None => (all_types, n),
                };
                add(&mut modules, from, n, ty);
            }
            continue;
        }
        in_header = false;
        let _ = writeln!(rest, "{line}");
    }
    for (origin, name, ty) in extra {
        // A name the file already imports from another module, such as a type the catalog
        // re-exports, keeps that import.
        let elsewhere = modules.iter().any(|(m, names)| {
            m != origin.path() && names.iter().any(|(n, t)| n == name && (*t || !ty))
        });
        if !elsewhere {
            add(&mut modules, origin.path(), name, *ty);
        }
    }
    let mut o = header;
    for (from, names) in &modules {
        if names.iter().all(|(_, t)| *t) {
            let list: Vec<&str> = names.iter().map(|(n, _)| n.as_str()).collect();
            let _ = writeln!(o, "import type {{ {} }} from '{from}'", list.join(", "));
        } else {
            let list: Vec<String> = names
                .iter()
                .map(|(n, t)| if *t { format!("type {n}") } else { n.clone() })
                .collect();
            let _ = writeln!(o, "import {{ {} }} from '{from}'", list.join(", "));
        }
    }
    o.push_str(&rest);
    o
}

#[cfg(test)]
mod tests {
    use crate::diag::Severity;

    fn compile(files: &[(&str, &str)]) -> crate::Compiled {
        crate::compile(
            files
                .iter()
                .map(|(n, t)| (n.to_string(), t.to_string()))
                .collect(),
        )
    }

    fn output<'a>(c: &'a crate::Compiled, name: &str) -> &'a str {
        let found = c.outputs.iter().find(|(n, _)| n == name);
        &found
            .unwrap_or_else(|| panic!("no {name}: {:?}", c.diagnostics))
            .1
    }

    fn errors(c: &crate::Compiled) -> Vec<&'static str> {
        c.diagnostics
            .iter()
            .filter(|d| d.severity == Severity::Error)
            .map(|d| d.code)
            .collect()
    }

    #[test]
    fn defs_emit_typescript_that_computes_what_was_written() {
        let c = compile(&[(
            "content/team.qm",
            r#"(types "../catalog/team.ts" Role)
               (def BASE 0.1)
               (def ZONES :type const ["a" "b"])
               (def ROLES :type "Record<string, Role>" :doc "Who works here."
                 (:sre (:salary (* (+ BASE 2) 3) :gap (- 10 (- 4 1)) :tag "it's")
                  "on-call" (:salary -5 :zones [(... ZONES) "c"])))"#,
        )]);
        assert_eq!(errors(&c), Vec::<&str>::new());
        let ts = output(&c, "team.ts");
        assert!(
            ts.contains("import type { Role } from '../catalog/team.ts'\n"),
            "{ts}"
        );
        assert!(
            ts.contains("export const ZONES = ['a', 'b'] as const\n"),
            "{ts}"
        );
        assert!(
            ts.contains("/** Who works here. */\nexport const ROLES: Record<string, Role> = {"),
            "{ts}"
        );
        assert!(ts.contains("salary: (BASE + 2) * 3"), "{ts}");
        assert!(ts.contains("gap: 10 - (4 - 1)"), "{ts}");
        assert!(ts.contains(r"tag: 'it\'s'"), "{ts}");
        assert!(
            ts.contains("'on-call': { salary: -5, zones: [...ZONES, 'c'] }"),
            "{ts}"
        );
    }

    #[test]
    fn a_def_in_a_typed_file_shares_its_imports() {
        let c = compile(&[
            ("content/kinds.qm", "(kinds :request (web) :backend (sql))"),
            (
                "content/eras.qm",
                r#"(def WEIGHTS :type "Record<RequestKind, number>" (:web 1))
                   (def FIRST (ref REQUEST_KINDS 0))"#,
            ),
        ]);
        assert_eq!(errors(&c), Vec::<&str>::new());
        let ts = output(&c, "eras.ts");
        assert_eq!(ts.matches("import type { RequestKind }").count(), 1, "{ts}");
        assert!(
            ts.contains("import type { RequestKind } from '../catalog/kinds.ts'\n"),
            "{ts}"
        );
        assert!(
            ts.contains("import { REQUEST_KINDS } from './kinds.ts'\n"),
            "{ts}"
        );
        assert!(
            ts.contains("export const FIRST = REQUEST_KINDS[0]\n"),
            "{ts}"
        );
    }

    #[test]
    fn contradictions_in_data_are_errors() {
        let c = compile(&[
            ("content/a.qm", "(def X 1) (def R (:a 1 :b 2 :a 3))"),
            (
                "content/b.qm",
                "(def X 2) (def Y (+ XX 1)) (def Z :type \"Hire\" 1) (def T 2ms)",
            ),
        ]);
        let mut codes = errors(&c);
        codes.sort();
        assert_eq!(
            codes,
            [
                "bad-value",
                "duplicate",
                "duplicate-key",
                "unknown-name",
                "unknown-type"
            ]
        );
        let unknown = c
            .diagnostics
            .iter()
            .find(|d| d.code == "unknown-name")
            .unwrap();
        assert_eq!(unknown.help.as_deref(), Some("did you mean `X`?"));
        assert!(c.outputs.is_empty());
    }

    #[test]
    fn the_typed_exports_table_matches_the_typed_emitters() {
        let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../simulation/content");
        let mut inputs = Vec::new();
        for entry in std::fs::read_dir(dir).unwrap() {
            let path = entry.unwrap().path();
            if path.extension().is_some_and(|x| x == "qm") {
                inputs.push((
                    path.display().to_string(),
                    std::fs::read_to_string(&path).unwrap(),
                ));
            }
        }
        inputs.sort();
        let c = crate::compile(inputs);
        assert_eq!(errors(&c), Vec::<&str>::new());
        let defs: std::collections::BTreeSet<String> = c
            .outputs
            .iter()
            .flat_map(|(_, t)| t.lines())
            .filter_map(|l| l.strip_prefix("export const "))
            .filter_map(|l| l.split([' ', ':']).next())
            .map(str::to_string)
            .collect();
        for (module, names) in super::TYPED_EXPORTS {
            let text = output(&c, &format!("{module}.ts"));
            let mut exported: Vec<&str> = text
                .lines()
                .filter_map(|l| {
                    let rest = l.strip_prefix("export ")?;
                    let rest = ["const ", "type ", "function ", "interface "]
                        .iter()
                        .find_map(|p| rest.strip_prefix(p))?;
                    rest.split([' ', ':', '<', '(', '=']).next()
                })
                .collect();
            // Defs merged into a typed file are not part of the typed emitter's exports.
            let typed: Vec<&str> = names.to_vec();
            exported.retain(|n| typed.contains(n) || !defs.contains(*n));
            assert_eq!(exported, typed, "{module}.ts");
        }
    }
}
