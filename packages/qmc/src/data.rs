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
pub struct TypeDef {
    pub name: Name,
    pub ty: String,
    pub span: Span,
}

#[derive(Debug)]
pub struct Def {
    pub name: Name,
    /// The SCREAM_CASE name the generated module exports.
    pub export: String,
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
    /// `(era NAME)`: an Era id, resolved to its index after every Era is known.
    Era(Name),
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
    let export = crate::lower::constant(&name.text);
    let mut def = Def {
        name,
        export,
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
        match k {
            "type" if value.symbol() == Some("const") => def.as_const = true,
            "type" => def.ty = type_expr(value, sink),
            "satisfies" => def.satisfies = type_expr(value, sink),
            "doc" => match &value.kind {
                Kind::Str(t) => def.doc = Some(t.clone()),
                _ => {
                    err(sink, value.span, ":doc takes a string");
                }
            },
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

/// Lowers `(table NAME [:key COLUMN] [header…] [row…] …)` to a def. Without `:key` the value is
/// an array of records; with it, a record keyed by that column.
pub fn lower_table(form: &Sexp, module: &str, sink: &mut Sink) -> Option<Def> {
    let items = &form.list().unwrap()[1..];
    let Some(name) = items.first().and_then(name_of) else {
        err(sink, form.span, "write (table NAME [header…] [row…] …)");
        return None;
    };
    let export = crate::lower::constant(&name.text);
    let mut ty = None;
    let mut satisfies = None;
    let mut doc = None;
    let mut key: Option<Name> = None;
    let mut keep_key = false;
    let mut rows: Vec<&Sexp> = Vec::new();
    let mut i = 1;
    while i < items.len() {
        let item = &items[i];
        if let Some(k) = item.keyword() {
            if k == "keep-key" {
                keep_key = true;
                i += 1;
                continue;
            }
            let Some(value) = items.get(i + 1) else {
                err(sink, item.span, format!("`:{k}` needs a value"));
                return None;
            };
            match k {
                "type" if value.symbol() == Some("const") => {}
                "type" => ty = type_expr(value, sink),
                "satisfies" => satisfies = type_expr(value, sink),
                "doc" => match &value.kind {
                    Kind::Str(t) => doc = Some(t.clone()),
                    _ => {
                        err(sink, value.span, ":doc takes a string");
                    }
                },
                "key" => key = name_of(value),
                _ => err(
                    sink,
                    item.span,
                    format!("a table has no `:{k}`; write :key, :type, :satisfies, or :doc"),
                ),
            }
            i += 2;
            continue;
        }
        if matches!(item.kind, Kind::Row(_)) {
            rows.push(item);
            i += 1;
            continue;
        }
        err(
            sink,
            item.span,
            format!("a table row is [value …], found {}", item.describe()),
        );
        return None;
    }
    let Some(header) = rows.first().and_then(|row| match &row.kind {
        Kind::Row(cells) => Some(cells.as_slice()),
        _ => None,
    }) else {
        err(sink, form.span, "a table needs a header row like [id name]");
        return None;
    };
    let mut columns: Vec<Name> = Vec::new();
    for cell in header {
        let Some(text) = cell.symbol().or(match &cell.kind {
            Kind::Str(s) => Some(s.as_str()),
            _ => None,
        }) else {
            err(sink, cell.span, "a column is a name or a string");
            return None;
        };
        let text = crate::lower::camel(text);
        if columns.iter().any(|column| column.text == text) {
            err(
                sink,
                cell.span,
                format!("the column `{text}` appears twice"),
            );
            return None;
        }
        columns.push(Name {
            text,
            span: cell.span,
        });
    }
    if columns.is_empty() {
        err(sink, form.span, "a table names at least one column");
        return None;
    }
    let key_at = key.as_ref().and_then(|key| {
        columns
            .iter()
            .position(|column| column.text == crate::lower::camel(&key.text))
    });
    if let Some(key) = key.as_ref() {
        if key_at.is_none() {
            err(
                sink,
                key.span,
                format!("`:key {}` is not a column of the table", key.text),
            );
            return None;
        }
    }
    let mut records: Vec<(String, Datum)> = Vec::new();
    let mut by_key: Vec<(String, Span)> = Vec::new();
    for row in &rows[1..] {
        let Kind::Row(cells) = &row.kind else {
            continue;
        };
        if cells.len() != columns.len() {
            err(
                sink,
                row.span,
                format!(
                    "the row has {} values but the header has {} columns",
                    cells.len(),
                    columns.len()
                ),
            );
            continue;
        }
        let mut entries = Vec::with_capacity(columns.len());
        for (index, (column, cell)) in columns.iter().zip(cells.iter()).enumerate() {
            if key_at == Some(index) && !keep_key {
                continue;
            }
            if cell.symbol() == Some("-") {
                continue;
            }
            entries.push(Entry::Pair(column.clone(), datum(cell, sink)?));
        }
        let record = Datum {
            kind: D::Record(entries),
            span: row.span,
        };
        if let Some(at) = key_at {
            let key_text = match &cells[at].kind {
                Kind::Str(s) | Kind::Symbol(s) if s != "-" => s.clone(),
                _ => {
                    err(sink, cells[at].span, "a `:key` value is a name or string");
                    continue;
                }
            };
            if let Some(first) = by_key.iter().find(|(k, _)| k == &key_text) {
                sink.push(
                    Diagnostic::error(
                        "bad-value",
                        cells[at].span,
                        format!("the key `{key_text}` appears twice"),
                    )
                    .note(first.1, "first here"),
                );
                continue;
            }
            by_key.push((key_text.clone(), cells[at].span));
            records.push((key_text, record));
        } else {
            records.push((String::new(), record));
        }
    }
    let value = if key_at.is_some() {
        D::Record(
            records
                .into_iter()
                .map(|(key, row)| {
                    Entry::Pair(
                        Name {
                            text: key,
                            span: row.span,
                        },
                        row,
                    )
                })
                .collect(),
        )
    } else {
        D::Array(records.into_iter().map(|(_, row)| (false, row)).collect())
    };
    let as_const = ty.is_none();
    Some(Def {
        name,
        export,
        module: module.to_string(),
        ty,
        as_const,
        satisfies,
        doc,
        value: Datum {
            kind: value,
            span: form.span,
        },
        span: form.span,
    })
}

/// Lowers `(constants PREFIX [:type T] [:satisfies T] (name value) …)`. Each entry is a
/// `def` whose export is `PREFIX_NAME`, so a family keeps its shared word in one place.
pub fn lower_constants(form: &Sexp, module: &str, sink: &mut Sink) -> Vec<Def> {
    let items = &form.list().unwrap()[1..];
    let Some(prefix) = items.first().and_then(name_of) else {
        err(sink, form.span, "write (constants PREFIX (name value) …)");
        return Vec::new();
    };
    let mut defaults: Vec<(String, Sexp)> = Vec::new();
    let mut at = 1;
    while let [key, value, ..] = &items[at..] {
        let Some(k) = key.keyword() else { break };
        if !matches!(k, "type" | "satisfies") {
            err(sink, key.span, format!("a constants group has no `:{k}`"));
            return Vec::new();
        }
        defaults.push((k.to_string(), value.clone()));
        at += 2;
    }
    if at == items.len() {
        err(
            sink,
            form.span,
            format!("`{}` has no constants", prefix.text),
        );
        return Vec::new();
    }
    let mut defs = Vec::new();
    for entry in &items[at..] {
        let Some(parts) = entry.list() else {
            err(sink, entry.span, "write (name value) for each constant");
            continue;
        };
        let Some(suffix) = parts.first().and_then(name_of) else {
            err(sink, entry.span, "write (name value) for each constant");
            continue;
        };
        let full = if suffix.text == prefix.text {
            prefix.text.clone()
        } else {
            format!("{}-{}", prefix.text, suffix.text)
        };
        let name = Sexp::new(Kind::Symbol(full), suffix.span);
        let mut form_items = vec![Sexp::new(Kind::Symbol("def".to_string()), entry.span), name];
        for (k, value) in &defaults {
            let written = parts
                .iter()
                .skip(1)
                .any(|p| p.keyword() == Some(k.as_str()));
            if !written {
                form_items.push(Sexp::new(Kind::Keyword(k.clone()), entry.span));
                form_items.push(value.clone());
            }
        }
        let mut target: Option<Name> = None;
        let mut bad = false;
        let mut rest = parts[1..].iter();
        while let Some(part) = rest.next() {
            if part.keyword() == Some("module") {
                if target.is_some() {
                    err(sink, part.span, "an entry has one `:module`");
                    bad = true;
                    break;
                }
                let Some(value) = rest.next() else {
                    err(sink, part.span, "`:module` takes a file stem");
                    bad = true;
                    break;
                };
                match &value.kind {
                    Kind::Str(text) | Kind::Symbol(text)
                        if !text.is_empty() && !text.contains(['.', '/', '\\']) =>
                    {
                        target = Some(Name {
                            text: text.clone(),
                            span: value.span,
                        });
                    }
                    _ => {
                        err(
                            sink,
                            value.span,
                            "`:module` takes a file stem such as `team`",
                        );
                        bad = true;
                        break;
                    }
                }
                continue;
            }
            form_items.push(part.clone());
        }
        if bad {
            continue;
        }
        let def_form = Sexp::new(Kind::List(form_items), entry.span);
        if let Some(mut def) = lower_def(&def_form, module, sink) {
            // A group always exports a SCREAM_CASE constant, even when the prefix is uppercase.
            def.export = crate::lower::scream(&def.name.text);
            if let Some(target) = target {
                def.module = target.text;
            }
            defs.push(def);
        }
    }
    defs
}

/// A TypeScript type expression. A string is raw TypeScript; a name is a type; a list is a generic
/// application. The lowercase forms are the content spelling of the common generic types.
pub fn type_expr(sexp: &Sexp, sink: &mut Sink) -> Option<String> {
    match &sexp.kind {
        Kind::Str(text) | Kind::Symbol(text) => Some(text.clone()),
        Kind::Num(n) => Some(n.to_string()),
        Kind::List(items) => {
            let Some(head) = items.first().and_then(Sexp::symbol) else {
                err(sink, sexp.span, "a type is a name, a string, or a list");
                return None;
            };
            let args: Option<Vec<String>> = items[1..]
                .iter()
                .map(|item| type_expr(item, sink))
                .collect();
            let args = args?;
            match (head, args.as_slice()) {
                ("array", [item]) => Some(format!("ReadonlyArray<{item}>")),
                ("record", [key, value]) => Some(format!("Record<{key}, {value}>")),
                ("partial", [item]) => Some(format!("Partial<{item}>")),
                ("readonly", [item]) => Some(format!("Readonly<{item}>")),
                ("union", []) => {
                    err(sink, sexp.span, "a union names at least one type");
                    None
                }
                ("union", items) => Some(items.join(" | ")),
                ("intersection", []) => {
                    err(sink, sexp.span, "an intersection names at least one type");
                    None
                }
                ("intersection", items) => Some(items.join(" & ")),
                (_, []) => {
                    err(
                        sink,
                        sexp.span,
                        "a generic type needs at least one argument",
                    );
                    None
                }
                (_, items) => Some(format!("{head}<{}>", items.join(", "))),
            }
        }
        Kind::Keyword(_) => {
            err(sink, sexp.span, "a type is a name, a string, or a list");
            None
        }
        Kind::Row(_) => {
            err(sink, sexp.span, "a type is a name, a string, or a list");
            None
        }
    }
}

/// Lowers `(type NAME expression)`: a content type name that expands wherever a `:type` or
/// `:satisfies` names it. It does not emit a TypeScript declaration.
pub fn lower_type(form: &Sexp, sink: &mut Sink) -> Option<TypeDef> {
    let items = &form.list().unwrap()[1..];
    let Some(name) = items.first().and_then(name_of) else {
        err(sink, form.span, "write (type NAME expression)");
        return None;
    };
    let Some(value) = items.get(1) else {
        err(sink, form.span, format!("`{}` has no type", name.text));
        return None;
    };
    if items.len() != 2 {
        err(sink, form.span, "a type has one expression");
        return None;
    }
    let ty = type_expr(value, sink)?;
    Some(TypeDef {
        name,
        ty,
        span: form.span,
    })
}

/// Resolves `(era NAME)` values to their index. The check pass reports an unknown Era before this
/// runs.
pub fn resolve_eras(catalog: &mut crate::lower::Catalog) {
    let eras: BTreeMap<String, usize> = catalog
        .eras
        .iter()
        .enumerate()
        .map(|(index, era)| (era.id.text.clone(), index))
        .collect();
    for def in &mut catalog.defs {
        resolve_datum_eras(&mut def.value, &eras);
    }
    for state in &mut catalog.states {
        for field in &mut state.fields {
            resolve_datum_eras(&mut field.default, &eras);
        }
    }
}

fn resolve_datum_eras(d: &mut Datum, eras: &BTreeMap<String, usize>) {
    match &mut d.kind {
        D::Era(name) => {
            if let Some(index) = eras.get(&name.text) {
                d.kind = D::Num(Ratio::int(*index as i128));
            }
        }
        D::Array(items) => {
            for (_, item) in items {
                resolve_datum_eras(item, eras);
            }
        }
        D::Record(entries) => {
            for entry in entries {
                match entry {
                    Entry::Pair(_, value) | Entry::Spread(value) => resolve_datum_eras(value, eras),
                }
            }
        }
        D::Neg(value) => resolve_datum_eras(value, eras),
        D::As(_, value) => resolve_datum_eras(value, eras),
        D::Op(_, values) => {
            for value in values {
                resolve_datum_eras(value, eras);
            }
        }
        _ => {}
    }
}

/// Reports every `(era NAME)` that names no declared Era.
pub fn check_eras(catalog: &crate::lower::Catalog) -> Sink {
    let mut sink = Sink::default();
    let known: Vec<&str> = catalog.eras.iter().map(|e| e.id.text.as_str()).collect();
    let check = |d: &Datum, sink: &mut Sink| {
        let mut refs = Vec::new();
        era_refs(d, &mut refs);
        for name in refs {
            if !known.contains(&name.text.as_str()) {
                let mut diagnostic = Diagnostic::error(
                    "unknown-era",
                    name.span,
                    format!("`{}` is not a declared Era", name.text),
                )
                .label("unknown Era");
                if !known.is_empty() {
                    diagnostic = diagnostic.help(format!("write one of: {}", known.join(", ")));
                }
                sink.push(diagnostic);
            }
        }
    };
    for def in &catalog.defs {
        check(&def.value, &mut sink);
    }
    for state in &catalog.states {
        for field in &state.fields {
            check(&field.default, &mut sink);
        }
    }
    sink
}

fn era_refs<'a>(d: &'a Datum, out: &mut Vec<&'a Name>) {
    match &d.kind {
        D::Era(name) => out.push(name),
        D::Array(items) => {
            for (_, item) in items {
                era_refs(item, out);
            }
        }
        D::Record(entries) => {
            for entry in entries {
                match entry {
                    Entry::Pair(_, value) | Entry::Spread(value) => era_refs(value, out),
                }
            }
        }
        D::Neg(value) | D::As(_, value) => era_refs(value, out),
        D::Op(_, values) => {
            for value in values {
                era_refs(value, out);
            }
        }
        _ => {}
    }
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
        "era" => match args {
            [value] => name_of(value).map(D::Era),
            _ => {
                err(sink, sexp.span, "write (era NAME)");
                None
            }
        },
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
            [ty, value] => Some(D::As(type_expr(ty, sink)?, Box::new(datum(value, sink)?))),
            _ => {
                err(sink, sexp.span, "write (as Type value)");
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
            values.insert(c.export.as_str(), ("constants", true));
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
            values.insert(def.export.as_str(), (def.module.as_str(), true));
        }
        for ty in &catalog.type_defs {
            types.insert(ty.name.text.as_str(), ("types", true));
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

/// Rewrites every reference to a def or const into the SCREAM_CASE name the generated module
/// exports, so content can write `db-engines` and the TypeScript still reads `DB_ENGINES`.
pub fn rewrite(catalog: &mut crate::lower::Catalog) {
    let mut names: BTreeMap<String, String> = BTreeMap::new();
    for def in &catalog.defs {
        names.insert(def.name.text.clone(), def.export.clone());
    }
    for constant in &catalog.consts {
        names.insert(constant.name.text.clone(), constant.export.clone());
    }
    for def in &mut catalog.defs {
        rewrite_datum(&mut def.value, &names);
    }
    for component in &mut catalog.components {
        rewrite_value(&mut component.name.value, &names);
        rewrite_value(&mut component.product.value, &names);
        rewrite_value(&mut component.blurb.value, &names);
        rewrite_value(&mut component.latency.value, &names);
    }
    for research in &mut catalog.research {
        rewrite_value(&mut research.name.value, &names);
        rewrite_value(&mut research.blurb.value, &names);
    }
    for era in &mut catalog.eras {
        rewrite_value(&mut era.name.value, &names);
        rewrite_value(&mut era.question.value, &names);
        rewrite_value(&mut era.arrivals.value, &names);
    }
    for incident in &mut catalog.incidents {
        rewrite_value(&mut incident.name.value, &names);
        rewrite_value(&mut incident.cause.value, &names);
        rewrite_value(&mut incident.prevention.value, &names);
        if let Some((_, value)) = &mut incident.surge {
            rewrite_value(&mut value.value, &names);
        }
    }
    for gate in &mut catalog.gates {
        if let crate::lower::GateLabel::Table(name) = &mut gate.what {
            name.text = crate::lower::constant(&name.text);
        }
        let values = match &mut gate.open {
            crate::lower::GateValues::Free(values) | crate::lower::GateValues::Locked(values) => {
                values
            }
        };
        for value in values {
            rewrite_datum(value, &names);
        }
    }
    for state in &mut catalog.states {
        for field in &mut state.fields {
            rewrite_datum(&mut field.default, &names);
            if let Some(name) = &mut field.values_name {
                name.text = crate::lower::constant(&name.text);
            }
            if let Some(crate::lower::GateLabel::Table(name)) = &mut field.label {
                name.text = crate::lower::constant(&name.text);
            }
        }
    }
}

fn rename(name: &mut crate::lower::Name, names: &BTreeMap<String, String>) {
    if let Some(export) = names.get(&name.text) {
        name.text = export.clone();
    }
}

fn rewrite_value(value: &mut crate::lower::Value, names: &BTreeMap<String, String>) {
    match value {
        crate::lower::Value::Const(name) => rename(name, names),
        crate::lower::Value::Ref(path) => {
            if let Some(first) = path.first_mut() {
                rename(first, names);
            }
        }
        _ => {}
    }
}

fn rewrite_datum(datum: &mut Datum, names: &BTreeMap<String, String>) {
    match &mut datum.kind {
        D::Ref(name) => rename(name, names),
        D::Member(base, _) => rename(base, names),
        D::Array(items) => {
            for (_, value) in items {
                rewrite_datum(value, names);
            }
        }
        D::Record(entries) => {
            for entry in entries {
                match entry {
                    Entry::Pair(_, value) | Entry::Spread(value) => rewrite_datum(value, names),
                }
            }
        }
        D::Neg(value) | D::As(_, value) => rewrite_datum(value, names),
        D::Op(_, values) => {
            for value in values {
                rewrite_datum(value, names);
            }
        }
        _ => {}
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
    let consts: BTreeSet<&str> = catalog.consts.iter().map(|c| c.export.as_str()).collect();
    let known: Vec<&str> = scope.values.keys().copied().collect();
    let known_types: Vec<&str> = scope.types.keys().copied().collect();
    for ty in &catalog.type_defs {
        for (word, is_value) in type_names(&ty.ty) {
            let found = if is_value {
                scope.value(&word, "types").is_some() || scope.ty(&word, "types").is_some()
            } else {
                scope.ty(&word, "types").is_some()
            };
            if !found {
                let name = Name {
                    text: word,
                    span: ty.span,
                };
                let mut d = crate::check::unknown("unknown-type", &name, "type", &known_types);
                if d.help.is_none() {
                    d = d.help("name it in (types \"../catalog/….ts\" …)");
                }
                sink.push(d);
            }
        }
    }
    for def in &catalog.defs {
        let n = def.export.as_str();
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
            if r.text == def.export {
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
        D::Era(name) => format!("(era {})", name.text),
    }
}

/// Defs in dependency order, with the catalog order as the tie-break. A group can move a def
/// into another module, so its position in the catalog no longer says which local values it may
/// read.
fn ordered(defs: Vec<&Def>) -> Vec<&Def> {
    let mut index = BTreeMap::new();
    for (at, def) in defs.iter().enumerate() {
        index.insert(def.export.as_str(), at);
    }
    let mut deps = vec![Vec::new(); defs.len()];
    let mut users = vec![Vec::new(); defs.len()];
    for (at, def) in defs.iter().enumerate() {
        let mut used = Vec::new();
        refs(&def.value, &mut used);
        let mut seen = BTreeSet::new();
        for name in used {
            if let Some(&dep) = index.get(name.text.as_str()) {
                if dep != at && seen.insert(dep) {
                    deps[at].push(dep);
                    users[dep].push(at);
                }
            }
        }
    }
    let mut left: Vec<usize> = deps.iter().map(Vec::len).collect();
    let mut ready: BTreeSet<usize> = left
        .iter()
        .enumerate()
        .filter(|(_, count)| **count == 0)
        .map(|(at, _)| at)
        .collect();
    let mut done = vec![false; defs.len()];
    let mut out = Vec::with_capacity(defs.len());
    while let Some(&at) = ready.iter().next() {
        ready.remove(&at);
        done[at] = true;
        out.push(defs[at]);
        for &user in &users[at] {
            left[user] -= 1;
            if left[user] == 0 {
                ready.insert(user);
            }
        }
    }
    // A cycle cannot be emitted in dependency order. Keep the rest in catalog order so the
    // diagnostic from the check pass, not a panic, decides what happens next.
    if out.len() != defs.len() {
        for (at, def) in defs.iter().enumerate() {
            if !done[at] {
                out.push(def);
            }
        }
    }
    out
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
    for def in ordered(catalog.defs.iter().filter(|d| d.module == module).collect()) {
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
        let head = format!("export const {}{ann} = ", def.export);
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
    fn a_table_turns_rows_into_a_keyed_record() {
        let c = compile(&[(
            "content/t.qm",
            "(table engines :key id\n  [id name]\n  [postgres \"PostgreSQL\"]\n  [mysql \"MySQL\"])\n",
        )]);
        assert_eq!(errors(&c), Vec::<&str>::new());
        let ts = output(&c, "t.ts");
        assert!(ts.contains("export const ENGINES = {"));
        assert!(ts.contains("postgres: {"));
        assert!(ts.contains("'PostgreSQL'"));
    }

    #[test]
    fn a_table_refuses_a_short_row_and_a_repeated_key() {
        let short = compile(&[(
            "content/t.qm",
            "(table engines :key id [id name] [postgres])\n",
        )]);
        assert_eq!(errors(&short), ["bad-value"]);
        let dash = compile(&[(
            "content/t.qm",
            "(table engines :key id [id name] [- \"PostgreSQL\"])\n",
        )]);
        assert_eq!(errors(&dash), ["bad-value"]);
        let twice = compile(&[(
            "content/t.qm",
            "(table engines :key id [id name] [postgres \"PostgreSQL\"] [postgres \"PostgreSQL\"])\n",
        )]);
        assert_eq!(errors(&twice), ["bad-value"]);
    }

    #[test]
    fn a_dash_leaves_a_column_out_of_one_record() {
        let c = compile(&[(
            "content/t.qm",
            "(table engines :key id\n  [id name cache]\n  [postgres \"PostgreSQL\" -]\n  [mysql \"MySQL\" 64])\n",
        )]);
        assert_eq!(errors(&c), Vec::<&str>::new());
        let ts = output(&c, "t.ts");
        assert!(ts.contains("postgres: { name: 'PostgreSQL' }"), "{ts}");
        assert!(ts.contains("mysql: { name: 'MySQL', cache: 64 }"), "{ts}");
    }

    #[test]
    fn a_constants_group_names_each_export_from_one_prefix() {
        let c = compile(&[(
            "content/t.qm",
            "(constants SCALE :type const\n  (targets [1 2])\n  (in :type \"number\" 0.6))\n(def USE SCALE_IN)\n",
        )]);
        assert_eq!(errors(&c), Vec::<&str>::new());
        let ts = output(&c, "t.ts");
        assert!(
            ts.contains("export const SCALE_TARGETS = [1, 2] as const"),
            "{ts}"
        );
        assert!(ts.contains("export const SCALE_IN: number = 0.6"), "{ts}");
        assert!(!ts.contains("SCALE_IN: number = 0.6 as const"), "{ts}");
        assert!(ts.contains("export const USE = SCALE_IN"), "{ts}");
        let base = compile(&[(
            "content/t.qm",
            "(constants regions (regions :type const [\"na\" \"eu\"]) (from-stage 5))\n",
        )]);
        assert_eq!(errors(&base), Vec::<&str>::new());
        let ts = output(&base, "t.ts");
        assert!(
            ts.contains("export const REGIONS = ['na', 'eu'] as const"),
            "{ts}"
        );
        assert!(ts.contains("export const REGIONS_FROM_STAGE = 5"), "{ts}");
    }

    #[test]
    fn a_constants_group_can_send_an_entry_to_another_module() {
        let c = compile(&[
            (
                "content/t.qm",
                "(constants auth (move-dh :module team 120) (check-ms :module t 0.02))\n",
            ),
            ("content/team.qm", "(def TEAM 1)\n"),
        ]);
        assert_eq!(errors(&c), Vec::<&str>::new());
        let t = output(&c, "t.ts");
        let team = output(&c, "team.ts");
        assert!(t.contains("export const AUTH_CHECK_MS = 0.02"), "{t}");
        assert!(!t.contains("AUTH_MOVE_DH"), "{t}");
        assert!(team.contains("export const AUTH_MOVE_DH = 120"), "{team}");
    }

    #[test]
    fn a_module_emits_a_local_value_before_the_constant_that_reads_it() {
        let c = compile(&[("content/t.qm", "(def LATE (+ EARLY 1))\n(def EARLY 1)\n")]);
        assert_eq!(errors(&c), Vec::<&str>::new());
        let ts = output(&c, "t.ts");
        let early = ts.find("export const EARLY = 1").unwrap();
        let late = ts.find("export const LATE = EARLY + 1").unwrap();
        assert!(early < late, "{ts}");
    }

    #[test]
    fn a_type_expression_and_a_named_type_reach_the_annotation() {
        let c = compile(&[(
            "content/t.qm",
            "(type Ids (array string))\n(type Counts (record string number))\n(def A :type Ids [\"x\"])\n(def B :type (array number) [1])\n(def C :satisfies (partial Counts) (:x 1))\n",
        )]);
        assert_eq!(errors(&c), Vec::<&str>::new());
        let ts = output(&c, "t.ts");
        assert!(
            ts.contains("import type { Ids, Counts } from './types.ts'"),
            "{ts}"
        );
        assert!(ts.contains("export const A: Ids = ['x']"), "{ts}");
        assert!(
            ts.contains("export const B: ReadonlyArray<number> = [1]"),
            "{ts}"
        );
        assert!(
            ts.contains("export const C = { x: 1 } satisfies Partial<Counts>"),
            "{ts}"
        );
        let types = output(&c, "types.ts");
        assert!(
            types.contains("export type Ids = ReadonlyArray<string>"),
            "{types}"
        );
        assert!(
            types.contains("export type Counts = Record<string, number>"),
            "{types}"
        );
    }

    #[test]
    fn an_era_value_becomes_its_index_and_an_unknown_era_is_an_error() {
        let era = "(kinds :request (page) :backend (q-read))\n(era garage :name \"Garage\" :slo 99% :incident-every none :max-severity 1 :market 100 :raise-at 50 :grant 10 :dilution 10% :growth 1% :apdex-target 90% :cost-index 1 :salary-index 1 :mix (:page 100%) :question \"q\" :arrivals \"a\")\n";
        let c = compile(&[("content/t.qm", &format!("{era}(def X (era garage))"))]);
        assert_eq!(errors(&c), Vec::<&str>::new());
        assert!(
            output(&c, "t.ts").contains("export const X = 0"),
            "{}",
            output(&c, "t.ts")
        );
        let bad = compile(&[("content/t.qm", &format!("{era}(def X (era nowhere))"))]);
        assert_eq!(errors(&bad), ["unknown-era"]);
    }

    #[test]
    fn a_module_owner_must_name_a_content_file() {
        let c = compile(&[(
            "content/t.qm",
            "(constants auth (check-ms :module nowhere 0.02))\n",
        )]);
        assert_eq!(errors(&c), ["unknown-module"]);
    }

    #[test]
    fn the_typed_exports_table_matches_the_typed_emitters() {
        let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../simulation/content");
        let inputs: Vec<(String, String)> = crate::qm_files(std::path::Path::new(dir))
            .unwrap()
            .iter()
            .map(|path| {
                (
                    path.display().to_string(),
                    std::fs::read_to_string(path).unwrap(),
                )
            })
            .collect();
        let c = crate::compile(inputs);
        assert_eq!(errors(&c), Vec::<&str>::new());
        let database = output(&c, "database.ts");
        assert!(database.contains("export const DB_ENGINES = {"));
        assert!(database.contains("export const SHARD_COUNTS = [1, 2, 4, 8] as const"));
        let constants = output(&c, "constants.ts");
        assert!(constants.contains("export const PREMIERE_SURGE = 4"));
        assert!(database.contains(
            "export const SHARD_KEY_VALUES = ['hash', 'range', 'tenant', 'region'] as const"
        ));
        assert!(database.contains("export const ShardKey = Schema.Literals(SHARD_KEY_VALUES)"));
        assert!(database.contains(
            "  shards: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),"
        ));
        let rule = output(&c, "database.rule.ts");
        assert!(rule.contains("export const setShards = fieldSetter("));
        assert!(rule.contains("    locked: 'database.shards',"));
        assert!(rule.contains("export const setTopology = fieldSetter("));
        assert!(rule.contains("    scope: 'all-of-type',"));
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
