//! Macros: `defmacro` with quasiquote templates.
//!
//! ```lisp
//! (defmacro framework (id name &key (cost 20) (era 0) (requires ()))
//!   `(research ,(sym "fw-" id) :name ,name :track frameworks
//!      :cost ,cost :era ,era :requires ,requires :unlocks (framework ,id)))
//! ```
//!
//! A template only substitutes: `,x` puts an argument in, `,@x` splices a list argument, and
//! `,(sym …)` and `,(str …)` join symbols and strings. Templates run no code, and a macro whose
//! template reaches itself through other macros is refused where it is defined. So expansion
//! always ends, and its output depends only on the text, never on evaluation order.
//!
//! `(begin a b …)` at the top level splices its forms, so one call can define several entries.

use crate::diag::{Diagnostic, Sink};
use crate::reader::{Kind, Sexp};
use crate::source::Span;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug)]
pub struct Macro {
    pub name: String,
    pub span: Span,
    positional: Vec<String>,
    rest: Option<String>,
    /// Keys in declared order, each with its default when it has one.
    keys: Vec<(String, Option<Sexp>)>,
    template: Sexp,
}

#[derive(Default, Debug)]
pub struct Macros {
    pub by_name: BTreeMap<String, Macro>,
}

/// Forms the compiler defines. A macro may not take one of these names.
pub const BUILTIN_FORMS: &[&str] = &["defmacro", "begin", "import", "tracks", "research", "quote"];

const MAX_DEPTH: usize = 64;

/// Collects every `defmacro` from every file. Runs once, between parsing and expansion, because
/// a macro defined in one file may be used in another.
pub fn collect(files: &[Vec<Sexp>], sink: &mut Sink) -> Macros {
    let mut macros = Macros::default();
    for form in files.iter().flatten() {
        if form.head() != Some("defmacro") {
            continue;
        }
        let Some(m) = parse_defmacro(form, sink) else {
            continue;
        };
        if BUILTIN_FORMS.contains(&m.name.as_str()) {
            sink.push(
                Diagnostic::error(
                    "macro-name",
                    m.span,
                    format!("`{}` is a built-in form", m.name),
                )
                .label("a macro cannot take this name"),
            );
            continue;
        }
        if let Some(first) = macros.by_name.get(&m.name) {
            sink.push(
                Diagnostic::error(
                    "duplicate-macro",
                    m.span,
                    format!("the macro `{}` is defined twice", m.name),
                )
                .label("second definition")
                .note(first.span, "first defined here"),
            );
            continue;
        }
        macros.by_name.insert(m.name.clone(), m);
    }
    refuse_recursion(&mut macros, sink);
    macros
}

fn parse_defmacro(form: &Sexp, sink: &mut Sink) -> Option<Macro> {
    let items = form.list().unwrap_or_default();
    let shape = "(defmacro name (params …) `template)";
    let (Some(name), Some(params), Some(template), 4) = (
        items.get(1).and_then(Sexp::symbol),
        items.get(2).and_then(Sexp::list),
        items.get(3),
        items.len(),
    ) else {
        sink.push(
            Diagnostic::error("bad-form", form.span, "malformed defmacro")
                .help(format!("write {shape}")),
        );
        return None;
    };
    let Some(template) = template
        .list()
        .and_then(|l| (l.len() == 2 && l[0].symbol() == Some("quasiquote")).then(|| l[1].clone()))
    else {
        sink.push(
            Diagnostic::error(
                "bad-form",
                template.span,
                "a macro body is one quasiquoted template",
            )
            .help("start the body with a backquote: `(research …)"),
        );
        return None;
    };
    let mut m = Macro {
        name: name.to_string(),
        span: items[1].span,
        positional: Vec::new(),
        rest: None,
        keys: Vec::new(),
        template,
    };
    #[derive(PartialEq)]
    enum Mode {
        Positional,
        Rest,
        Key,
    }
    let mut mode = Mode::Positional;
    let mut seen = BTreeSet::new();
    for param in params {
        let (pname, default) = match (&param.kind, param.symbol()) {
            (_, Some("&rest")) => {
                mode = Mode::Rest;
                continue;
            }
            (_, Some("&key")) => {
                mode = Mode::Key;
                continue;
            }
            (_, Some(s)) => (s.to_string(), None),
            (Kind::List(l), _) if mode == Mode::Key && l.len() == 2 && l[0].symbol().is_some() => {
                (l[0].symbol().unwrap().to_string(), Some(l[1].clone()))
            }
            _ => {
                sink.push(Diagnostic::error(
                    "bad-form",
                    param.span,
                    "a parameter is a symbol, or `(name default)` after &key",
                ));
                return None;
            }
        };
        if !seen.insert(pname.clone()) {
            sink.push(Diagnostic::error(
                "bad-form",
                param.span,
                format!("the parameter `{pname}` appears twice"),
            ));
            return None;
        }
        match mode {
            Mode::Positional => m.positional.push(pname),
            Mode::Rest if m.rest.is_none() => m.rest = Some(pname),
            Mode::Rest => {
                sink.push(Diagnostic::error(
                    "bad-form",
                    param.span,
                    "&rest takes one parameter",
                ));
                return None;
            }
            Mode::Key => m.keys.push((pname, default)),
        }
    }
    Some(m)
}

/// Every head symbol a template can produce. A head built by `,(sym …)` is not known, so `sym`
/// may not build a macro name; `expand` checks that at the call.
fn heads(sexp: &Sexp, out: &mut BTreeSet<String>) {
    if let Kind::List(items) | Kind::Row(items) = &sexp.kind {
        if let Some(head) = items.first().and_then(Sexp::symbol) {
            out.insert(head.to_string());
        }
        for item in items {
            heads(item, out);
        }
    }
}

fn refuse_recursion(macros: &mut Macros, sink: &mut Sink) {
    let graph: BTreeMap<String, Vec<String>> = macros
        .by_name
        .iter()
        .map(|(name, m)| {
            let mut found = BTreeSet::new();
            heads(&m.template, &mut found);
            for (_, default) in &m.keys {
                if let Some(d) = default {
                    heads(d, &mut found);
                }
            }
            (
                name.clone(),
                found
                    .into_iter()
                    .filter(|h| macros.by_name.contains_key(h))
                    .collect(),
            )
        })
        .collect();
    let mut bad = BTreeSet::new();
    for cycle in crate::graph::cycles(&graph) {
        let first = &cycle[0];
        let path = cycle
            .iter()
            .chain(std::iter::once(first))
            .cloned()
            .collect::<Vec<_>>()
            .join(" → ");
        let mut d = Diagnostic::error(
            "macro-recursion",
            macros.by_name[first].span,
            format!("the macro `{first}` expands into itself"),
        )
        .label("defined here")
        .help(format!(
            "macros may not recurse, so expansion always ends: {path}"
        ));
        for other in &cycle[1..] {
            d = d.note(
                macros.by_name[other].span,
                format!("`{other}` is part of the loop"),
            );
        }
        sink.push(d);
        bad.extend(cycle);
    }
    for name in bad {
        macros.by_name.remove(&name);
    }
}

type Bindings = BTreeMap<String, Binding>;

#[derive(Clone)]
enum Binding {
    One(Sexp),
    Many(Vec<Sexp>, Span),
}

impl Macros {
    /// Expands one file's forms. Macro definitions drop out, `begin` splices, and every call is
    /// replaced by its expansion.
    pub fn expand_file(&self, forms: &[Sexp]) -> (Vec<Sexp>, Sink) {
        let mut sink = Sink::default();
        let mut out = Vec::new();
        for form in forms {
            if form.head() == Some("defmacro") {
                continue;
            }
            if let Some(form) = self.expand(form, 0, &mut sink) {
                splice_begin(form, &mut out);
            }
        }
        (out, sink)
    }

    fn expand(&self, form: &Sexp, depth: usize, sink: &mut Sink) -> Option<Sexp> {
        let (Kind::List(items) | Kind::Row(items)) = &form.kind else {
            return Some(form.clone());
        };
        if form.head() == Some("quote") {
            return Some(form.clone());
        }
        if let Some(m) = form.head().and_then(|h| {
            matches!(form.kind, Kind::List(_))
                .then(|| self.by_name.get(h))
                .flatten()
        }) {
            if depth >= MAX_DEPTH {
                sink.push(Diagnostic::error(
                    "macro-depth",
                    form.span,
                    "macro expansion is too deep",
                ));
                return None;
            }
            let expanded = self.call(m, form, sink)?;
            return self.expand(&expanded, depth + 1, sink);
        }
        let mut out = Vec::with_capacity(items.len());
        for item in items {
            out.push(self.expand(item, depth, sink)?);
        }
        let kind = if matches!(form.kind, Kind::List(_)) {
            Kind::List(out)
        } else {
            Kind::Row(out)
        };
        Some(Sexp::new(kind, form.span))
    }

    fn call(&self, m: &Macro, form: &Sexp, sink: &mut Sink) -> Option<Sexp> {
        let args = &form.list().unwrap()[1..];
        let mut bindings = Bindings::new();
        let mut i = 0;
        for name in &m.positional {
            let Some(arg) = args.get(i).filter(|a| a.keyword().is_none()) else {
                sink.push(
                    Diagnostic::error(
                        "macro-args",
                        form.span,
                        format!("`{}` needs the argument `{name}`", m.name),
                    )
                    .note(m.span, "macro defined here"),
                );
                return None;
            };
            bindings.insert(name.clone(), Binding::One(arg.clone()));
            i += 1;
        }
        let mut rest = Vec::new();
        let mut given = BTreeMap::new();
        while let Some(arg) = args.get(i) {
            if let (Some(key), false) = (arg.keyword(), m.keys.is_empty()) {
                if !m.keys.iter().any(|(k, _)| k == key) {
                    let known = m
                        .keys
                        .iter()
                        .map(|(k, _)| format!(":{k}"))
                        .collect::<Vec<_>>()
                        .join(", ");
                    sink.push(
                        Diagnostic::error(
                            "macro-args",
                            arg.span,
                            format!("`{}` takes no key `:{key}`", m.name),
                        )
                        .help(format!("its keys are {known}")),
                    );
                    return None;
                }
                let Some(value) = args.get(i + 1) else {
                    sink.push(Diagnostic::error(
                        "macro-args",
                        arg.span,
                        format!("`:{key}` needs a value"),
                    ));
                    return None;
                };
                if given.insert(key.to_string(), value.clone()).is_some() {
                    sink.push(Diagnostic::error(
                        "macro-args",
                        arg.span,
                        format!("`:{key}` is given twice"),
                    ));
                    return None;
                }
                i += 2;
            } else if m.rest.is_some() {
                rest.push(arg.clone());
                i += 1;
            } else {
                sink.push(
                    Diagnostic::error(
                        "macro-args",
                        arg.span,
                        format!("`{}` takes no more arguments", m.name),
                    )
                    .note(m.span, "macro defined here"),
                );
                return None;
            }
        }
        if let Some(name) = &m.rest {
            bindings.insert(name.clone(), Binding::Many(rest, form.span));
        }
        for (key, default) in &m.keys {
            let value = match (given.remove(key), default) {
                (Some(v), _) => v,
                (None, Some(d)) => relocate(d, form.span),
                (None, None) => {
                    sink.push(
                        Diagnostic::error(
                            "macro-args",
                            form.span,
                            format!("`{}` needs `:{key}`", m.name),
                        )
                        .note(m.span, "macro defined here"),
                    );
                    return None;
                }
            };
            bindings.insert(key.clone(), Binding::One(value));
        }
        let out = fill(&m.template, &bindings, form.span, &self.by_name, sink)?;
        out.into_iter().next()
    }
}

/// Gives template text the span of the call, so an error in it points where the macro was used.
fn relocate(sexp: &Sexp, span: Span) -> Sexp {
    let kind = match &sexp.kind {
        Kind::List(items) => Kind::List(items.iter().map(|i| relocate(i, span)).collect()),
        Kind::Row(items) => Kind::Row(items.iter().map(|i| relocate(i, span)).collect()),
        other => other.clone(),
    };
    Sexp::new(kind, span)
}

/// Fills a template. Returns a list because `,@x` turns into several forms.
fn fill(
    t: &Sexp,
    b: &Bindings,
    call: Span,
    macros: &BTreeMap<String, Macro>,
    sink: &mut Sink,
) -> Option<Vec<Sexp>> {
    let items = match &t.kind {
        Kind::List(items) | Kind::Row(items) => items,
        _ => return Some(vec![relocate(t, call)]),
    };
    match t.head() {
        Some("unquote") if items.len() == 2 => {
            return Some(vec![eval(&items[1], b, call, macros, sink)?])
        }
        Some("unquote-splicing") if items.len() == 2 => {
            return match eval(&items[1], b, call, macros, sink)? {
                Sexp {
                    kind: Kind::List(inner) | Kind::Row(inner),
                    ..
                } => Some(inner),
                other => {
                    sink.push(
                        Diagnostic::error(
                            "macro-splice",
                            other.span,
                            format!("`,@` needs a list, found {}", other.describe()),
                        )
                        .note(items[1].span, "spliced here"),
                    );
                    None
                }
            };
        }
        Some("quasiquote") => {
            sink.push(Diagnostic::error(
                "macro-nested",
                t.span,
                "a template may not hold another quasiquote",
            ));
            return None;
        }
        _ => {}
    }
    let mut out = Vec::with_capacity(items.len());
    for item in items {
        out.extend(fill(item, b, call, macros, sink)?);
    }
    let kind = if matches!(t.kind, Kind::List(_)) {
        Kind::List(out)
    } else {
        Kind::Row(out)
    };
    Some(vec![Sexp::new(kind, call)])
}

/// The expressions allowed after `,`: a parameter, `(sym …)`, or `(str …)`.
fn eval(
    e: &Sexp,
    b: &Bindings,
    call: Span,
    macros: &BTreeMap<String, Macro>,
    sink: &mut Sink,
) -> Option<Sexp> {
    if let Some(name) = e.symbol() {
        return match b.get(name) {
            Some(Binding::One(v)) => Some(v.clone()),
            Some(Binding::Many(items, span)) => Some(Sexp::new(Kind::List(items.clone()), *span)),
            None => {
                sink.push(Diagnostic::error(
                    "macro-unbound",
                    e.span,
                    format!("`{name}` is not a parameter of this macro"),
                ));
                None
            }
        };
    }
    let head = e.head();
    if let (Some(op @ ("sym" | "str")), Some(parts)) = (head, e.list()) {
        let mut joined = String::new();
        for part in &parts[1..] {
            let value = eval_part(part, b, call, macros, sink)?;
            match &value.kind {
                Kind::Symbol(s) | Kind::Str(s) | Kind::Keyword(s) => joined.push_str(s),
                Kind::Num(n) => joined.push_str(&n.to_string()),
                _ => {
                    sink.push(Diagnostic::error(
                        "macro-join",
                        value.span,
                        format!("`{op}` cannot join {}", value.describe()),
                    ));
                    return None;
                }
            }
        }
        if op == "sym" && macros.contains_key(&joined) {
            sink.push(Diagnostic::error(
                "macro-recursion",
                e.span,
                format!("`sym` may not build the macro name `{joined}`"),
            ));
            return None;
        }
        let kind = if op == "sym" {
            Kind::Symbol(joined)
        } else {
            Kind::Str(joined)
        };
        return Some(Sexp::new(kind, call));
    }
    sink.push(
        Diagnostic::error(
            "macro-unquote",
            e.span,
            "only a parameter, `(sym …)`, or `(str …)` can follow `,`",
        )
        .help("templates substitute; they do not run code"),
    );
    None
}

fn eval_part(
    part: &Sexp,
    b: &Bindings,
    call: Span,
    macros: &BTreeMap<String, Macro>,
    sink: &mut Sink,
) -> Option<Sexp> {
    match &part.kind {
        Kind::Str(_) | Kind::Num(_) => Some(part.clone()),
        _ => eval(part, b, call, macros, sink),
    }
}

fn splice_begin(form: Sexp, out: &mut Vec<Sexp>) {
    if form.head() == Some("begin") {
        let Kind::List(items) = form.kind else {
            unreachable!()
        };
        for item in items.into_iter().skip(1) {
            splice_begin(item, out);
        }
    } else {
        out.push(form);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::reader::read;
    use crate::source::FileId;

    fn run(text: &str) -> (Vec<String>, Vec<&'static str>) {
        let (forms, read_sink) = read(FileId(0), text);
        assert!(read_sink.items.is_empty());
        let mut sink = Sink::default();
        let macros = collect(std::slice::from_ref(&forms), &mut sink);
        let (out, expand_sink) = macros.expand_file(&forms);
        sink.extend(expand_sink);
        (
            out.iter().map(ToString::to_string).collect(),
            sink.items.iter().map(|d| d.code).collect(),
        )
    }

    #[test]
    fn substitutes_keys_defaults_rest_and_sym() {
        let (out, errors) = run(
            "(defmacro fw (id &key (cost 20) era &rest tags) `(research ,(sym \"fw-\" id) :cost ,cost :era ,era :tags (a ,@tags)))
             (fw laravel :era 3 x y)",
        );
        assert_eq!(errors, Vec::<&str>::new());
        assert_eq!(out, ["(research fw-laravel :cost 20 :era 3 :tags (a x y))"]);
    }

    #[test]
    fn begin_splices_and_macros_call_macros() {
        let (out, errors) = run("(defmacro one (x) `(item ,x))
             (defmacro two (a b) `(begin (one ,a) (one ,b)))
             (two p q)");
        assert_eq!(errors, Vec::<&str>::new());
        assert_eq!(out, ["(item p)", "(item q)"]);
    }

    #[test]
    fn refuses_mutual_recursion_at_the_definition() {
        let (_, errors) = run("(defmacro a (x) `(b ,x)) (defmacro b (x) `(a ,x)) (a 1)");
        assert_eq!(errors, ["macro-recursion"]);
    }

    #[test]
    fn reports_bad_calls() {
        let (_, errors) =
            run("(defmacro m (x &key k) `(r ,x ,k)) (m) (m 1) (m 1 :z 2) (m 1 :k 2 3)");
        assert_eq!(
            errors,
            ["macro-args", "macro-args", "macro-args", "macro-args"]
        );
    }

    #[test]
    fn unquote_runs_no_code() {
        let (_, errors) = run("(defmacro m (x) `(r ,(+ x 1))) (m 1)");
        assert_eq!(errors, ["macro-unquote"]);
    }

    #[test]
    fn substituted_arguments_keep_their_own_span() {
        let text = "(defmacro m (x) `(r ,x)) (m hello)";
        let (forms, _) = read(FileId(0), text);
        let mut sink = Sink::default();
        let macros = collect(std::slice::from_ref(&forms), &mut sink);
        let (out, _) = macros.expand_file(&forms);
        let hello = &out[0].list().unwrap()[1];
        assert_eq!(
            &text[hello.span.start as usize..hello.span.end as usize],
            "hello"
        );
    }
}
