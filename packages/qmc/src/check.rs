//! Rules that relate entries to each other. Each pass reads the shared catalog and fills its own
//! sink, so the passes run at once on separate threads.

use crate::diag::{suggest, Diagnostic, Sink};
use crate::graph;
use crate::lower::{Catalog, FieldType, Mix, MixRef, Name, Research, Value};
use crate::num::{Dimension, Ratio, Unit};
use crate::par;
use crate::source::Span;
use std::collections::{BTreeMap, BTreeSet};

type Pass = fn(&Catalog) -> Sink;

const PASSES: &[Pass] = &[
    names, requires, cycles, eras, shapes, imports, insight, era_rules, mixes,
];

pub fn run(catalog: &Catalog) -> Sink {
    let jobs = PASSES
        .iter()
        .map(|pass| Box::new(move || pass(catalog)) as par::Job<'_, Sink>)
        .collect();
    let mut sink = Sink::default();
    for result in par::join_all(jobs) {
        sink.extend(result);
    }
    sink
}

/// Reports every name defined twice and returns the first definition of each.
fn unique<'a>(
    names: impl Iterator<Item = &'a Name>,
    what: &str,
    sink: &mut Sink,
) -> BTreeMap<&'a str, &'a Name> {
    let mut seen: BTreeMap<&str, &Name> = BTreeMap::new();
    for name in names {
        if let Some(first) = seen.get(name.text.as_str()) {
            sink.push(
                Diagnostic::error(
                    "duplicate",
                    name.span,
                    format!("{what} `{}` is defined twice", name.text),
                )
                .label("second definition")
                .note(first.span, "first defined here"),
            );
        } else {
            seen.insert(&name.text, name);
        }
    }
    seen
}

fn unknown(code: &'static str, name: &Name, what: &str, known: &[&str]) -> Diagnostic {
    let mut d = Diagnostic::error(
        code,
        name.span,
        format!("there is no {what} `{}`", name.text),
    )
    .label("not defined");
    if let Some(s) = suggest(&name.text, known.iter().copied()) {
        d = d.help(format!("did you mean `{s}`?"));
    }
    d
}

fn names(catalog: &Catalog) -> Sink {
    let mut sink = Sink::default();
    unique(
        catalog.research.iter().map(|r| &r.id),
        "the research",
        &mut sink,
    );
    unique(
        catalog.shape_kinds.iter().map(|s| &s.name),
        "the study shape",
        &mut sink,
    );
    let tracks = unique(
        catalog.tracks.iter().map(|t| &t.key),
        "the track",
        &mut sink,
    );
    let known: Vec<&str> = tracks.keys().copied().collect();
    for r in &catalog.research {
        if !tracks.contains_key(r.track.text.as_str()) {
            sink.push(unknown("unknown-track", &r.track, "track", &known));
        }
    }
    let mut frameworks: BTreeMap<&str, &Research> = BTreeMap::new();
    for r in &catalog.research {
        let Some(fw) = &r.unlocks_framework else {
            continue;
        };
        if let Some(first) = frameworks.insert(&fw.text, r) {
            sink.push(
                Diagnostic::error(
                    "framework-twice",
                    fw.span,
                    format!("two research entries unlock the framework `{}`", fw.text),
                )
                .label("second unlock")
                .note(first.id.span, "also unlocked by this research"),
            );
        }
    }
    sink
}

fn by_id(catalog: &Catalog) -> BTreeMap<&str, &Research> {
    let mut map = BTreeMap::new();
    for r in &catalog.research {
        map.entry(r.id.text.as_str()).or_insert(r);
    }
    map
}

fn requirement_graph(catalog: &Catalog) -> BTreeMap<String, Vec<String>> {
    let mut graph: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for r in &catalog.research {
        graph
            .entry(r.id.text.clone())
            .or_default()
            .extend(r.requires.iter().map(|q| q.text.clone()));
    }
    graph
}

fn requires(catalog: &Catalog) -> Sink {
    let mut sink = Sink::default();
    let ids = by_id(catalog);
    let known: Vec<&str> = ids.keys().copied().collect();
    let graph = requirement_graph(catalog);
    for r in &catalog.research {
        let mut seen: BTreeMap<&str, Span> = BTreeMap::new();
        for q in &r.requires {
            if !ids.contains_key(q.text.as_str()) {
                sink.push(unknown("unknown-research", q, "research", &known));
            }
            if let Some(first) = seen.insert(&q.text, q.span) {
                sink.push(
                    Diagnostic::warning(
                        "duplicate-requires",
                        q.span,
                        format!("`{}` is required twice", q.text),
                    )
                    .note(first, "first required here"),
                );
            }
        }
        // A requirement that another requirement already implies says nothing and hides the
        // real shape of the tree.
        for q in &r.requires {
            let implied_by = r.requires.iter().find(|other| {
                other.text != q.text && graph::reach(&graph, &other.text).contains(q.text.as_str())
            });
            if let Some(other) = implied_by {
                sink.push(
                    Diagnostic::warning(
                        "redundant-requires",
                        q.span,
                        format!("`{}` is already required through `{}`", q.text, other.text),
                    )
                    .label("implied")
                    .note(other.span, "which requires it"),
                );
            }
        }
    }
    sink
}

fn cycles(catalog: &Catalog) -> Sink {
    let mut sink = Sink::default();
    let ids = by_id(catalog);
    for cycle in graph::cycles(&requirement_graph(catalog)) {
        let start = ids[cycle[0].as_str()];
        let path = cycle
            .iter()
            .chain(std::iter::once(&cycle[0]))
            .cloned()
            .collect::<Vec<_>>()
            .join(" → ");
        let mut d = Diagnostic::error(
            "research-cycle",
            start.id.span,
            format!(
                "`{}` can never be studied: its requirements loop back to it",
                start.id.text
            ),
        )
        .label("part of a loop")
        .help(path);
        for pair in cycle.windows(2).chain(std::iter::once(
            [cycle[cycle.len() - 1].clone(), cycle[0].clone()].as_slice(),
        )) {
            let from = ids[pair[0].as_str()];
            if let Some(edge) = from.requires.iter().find(|q| q.text == pair[1]) {
                d = d.note(edge.span, format!("`{}` requires `{}`", pair[0], pair[1]));
            }
        }
        sink.push(d);
    }
    sink
}

/// Research of one Era cannot require research the player only meets in a later Era.
fn eras(catalog: &Catalog) -> Sink {
    let mut sink = Sink::default();
    let ids = by_id(catalog);
    for r in &catalog.research {
        for q in &r.requires {
            let Some(req) = ids.get(q.text.as_str()) else {
                continue;
            };
            if req.era.value.value > r.era.value.value {
                sink.push(
                    Diagnostic::error(
                        "later-era",
                        q.span,
                        format!(
                            "`{}` is Era {} research but requires `{}`, which is Era {}",
                            r.id.text, r.era.value, q.text, req.era.value
                        ),
                    )
                    .label("arrives in a later Era")
                    .note(req.era.span, "its Era is set here"),
                );
            }
        }
    }
    sink
}

/// Each Era's money and incidents agree with each other, and every research names a real Era.
fn era_rules(catalog: &Catalog) -> Sink {
    let mut sink = Sink::default();
    unique(catalog.eras.iter().map(|e| &e.id), "the era", &mut sink);
    if catalog.eras.is_empty() {
        if let Some(r) = catalog.research.first() {
            sink.push(Diagnostic::error(
                "no-eras",
                r.era.span,
                "research names an Era, but no (era …) is declared",
            ));
        }
        return sink;
    }
    for era in &catalog.eras {
        match &era.raise_at {
            Some(raise) if raise.value.value > era.market.value.value => sink.push(
                Diagnostic::error(
                    "raise-above-market",
                    raise.span,
                    format!(
                        "`{}` raises at {} users, but its market is only {}",
                        era.id.text, raise.value, era.market.value
                    ),
                )
                .label("can never be reached")
                .note(era.market.span, "the market is set here"),
            ),
            None => {
                for (what, n) in [("grant", &era.grant), ("dilution", &era.dilution)] {
                    if n.value.value != Ratio::int(0) {
                        sink.push(
                            Diagnostic::error(
                                "never-raises",
                                n.span,
                                format!(
                                    "`{}` never raises, so its {what} is never paid",
                                    era.id.text
                                ),
                            )
                            .label(format!("set the {what} to 0"))
                            .note(era.raise_span, "the Era never raises"),
                        );
                    }
                }
            }
            _ => {}
        }
    }
    let last = catalog.eras.len() - 1;
    for r in &catalog.research {
        let era = r.era.value.value;
        if era > Ratio::int(last as i128) {
            sink.push(
                Diagnostic::error("unknown-era", r.era.span, format!("there is no Era {era}"))
                    .label(format!("Eras are numbered 0 to {last}"))
                    .note(catalog.eras[last].id.span, "the last Era"),
            );
        }
    }
    sink
}

/// Every mix an Era uses exists and sums to exactly 100%.
fn mixes(catalog: &Catalog) -> Sink {
    let mut sink = Sink::default();
    let named = unique(
        catalog.mixes.iter().filter_map(|m| m.name.as_ref()),
        "the mix",
        &mut sink,
    );
    let known: Vec<&str> = named.keys().copied().collect();
    for era in &catalog.eras {
        match &era.mix {
            MixRef::Named(name) if !named.contains_key(name.text.as_str()) => {
                sink.push(unknown("unknown-mix", name, "mix", &known));
            }
            MixRef::Named(_) => {}
            MixRef::Inline(mix) => check_mix(mix, &mut sink),
        }
    }
    for mix in &catalog.mixes {
        check_mix(mix, &mut sink);
    }
    sink
}

fn check_mix(mix: &Mix, sink: &mut Sink) {
    let mut seen: BTreeMap<&str, Span> = BTreeMap::new();
    let mut total = Ratio::int(0);
    for (kind, share) in &mix.shares {
        total = total + share.value.base();
        if let Some(first) = seen.insert(&kind.text, kind.span) {
            sink.push(
                Diagnostic::error(
                    "duplicate",
                    kind.span,
                    format!("`{}` has two shares in one mix", kind.text),
                )
                .note(first, "first share here"),
            );
        }
        if share.value.base() == Ratio::int(0) {
            sink.push(
                Diagnostic::warning(
                    "zero-share",
                    share.span,
                    format!("`{}` has a 0% share", kind.text),
                )
                .help("leave the kind out instead"),
            );
        }
    }
    if total != Ratio::int(1) {
        let percent = total * Ratio::int(100);
        let gap = (Ratio::int(1) + Ratio::new(-total.num, total.den)) * Ratio::int(100);
        let fix = if gap > Ratio::int(0) {
            format!("add {gap}% to a kind")
        } else {
            format!("take {}% from a kind", Ratio::new(-gap.num, gap.den))
        };
        sink.push(
            Diagnostic::error(
                "mix-total",
                mix.span,
                format!("the shares sum to {percent}%, not 100%"),
            )
            .label("every request needs a kind")
            .help(fix),
        );
    }
}

fn shapes(catalog: &Catalog) -> Sink {
    let mut sink = Sink::default();
    let kinds: BTreeMap<&str, _> = catalog
        .shape_kinds
        .iter()
        .map(|k| (k.name.text.as_str(), k))
        .collect();
    let known: Vec<&str> = kinds.keys().copied().collect();
    for r in &catalog.research {
        let Some(shape) = &r.shape else { continue };
        let Some(kind) = kinds.get(shape.kind.text.as_str()) else {
            sink.push(unknown("unknown-shape", &shape.kind, "study shape", &known));
            continue;
        };
        for (field, _) in &kind.fields {
            if !shape.fields.iter().any(|(n, _)| n.text == field.text) {
                sink.push(
                    Diagnostic::error(
                        "missing-key",
                        shape.span,
                        format!("a `{}` shape needs `:{}`", kind.name.text, field.text),
                    )
                    .note(field.span, "declared here"),
                );
            }
        }
        for (name, value) in &shape.fields {
            let Some((_, ty)) = kind.fields.iter().find(|(n, _)| n.text == name.text) else {
                sink.push(
                    Diagnostic::error(
                        "unknown-key",
                        name.span,
                        format!("a `{}` shape has no `:{}`", kind.name.text, name.text),
                    )
                    .note(kind.name.span, "the shape is declared here"),
                );
                continue;
            };
            let bad = |why: String| {
                Diagnostic::error("shape-value", value.span, why).note(name.span, "for this field")
            };
            match (&value.value, ty) {
                (Value::Const(_), FieldType::Count) => {}
                (Value::Num(n), FieldType::Count)
                    if n.unit == Unit::None && n.value.is_int() && n.value.num >= 0 => {}
                (Value::Num(n), FieldType::Share) if n.unit.dimension() == Dimension::Share => {
                    let share = n.base();
                    if share < Ratio::int(0) || share > Ratio::int(1) {
                        sink.push(bad(format!("a share is between 0% and 100%, found {n}")));
                    }
                }
                (Value::Num(n), FieldType::Seconds) if n.unit.dimension() == Dimension::Time => {
                    if n.base() <= Ratio::int(0) {
                        sink.push(bad(format!("a time is more than zero, found {n}")));
                    }
                }
                (_, ty) => sink.push(bad(format!("`:{}` is {}", name.text, ty.dimension()))),
            }
        }
    }
    sink
}

/// Names in `(ref …)` and bare constants must come from an `(import …)`, and every import is used.
fn imports(catalog: &Catalog) -> Sink {
    let mut sink = Sink::default();
    let imported = unique(
        catalog.imports.iter().flat_map(|i| &i.names),
        "the import",
        &mut sink,
    );
    let known: Vec<&str> = imported.keys().copied().collect();
    let mut used = BTreeSet::new();
    let mut check = |name: &Name, sink: &mut Sink| {
        used.insert(name.text.clone());
        if !imported.contains_key(name.text.as_str()) {
            sink.push(
                unknown("unknown-import", name, "imported value", &known).help(format!(
                    "add (import \"../catalog/….ts\" {}) or check the spelling",
                    name.text
                )),
            );
        }
    };
    for era in &catalog.eras {
        for value in [&era.name, &era.question, &era.arrivals] {
            if let Value::Ref(path) = &value.value {
                check(&path[0], &mut sink);
            }
        }
    }
    for r in &catalog.research {
        let shape_values = r.shape.iter().flat_map(|s| s.fields.iter().map(|(_, v)| v));
        for value in [&r.name, &r.blurb].into_iter().chain(shape_values) {
            match &value.value {
                Value::Ref(path) => check(&path[0], &mut sink),
                Value::Const(name) => check(name, &mut sink),
                _ => {}
            }
        }
    }
    for (name, def) in imported {
        if !used.contains(name) {
            sink.push(Diagnostic::warning(
                "unused-import",
                def.span,
                format!("`{name}` is imported but never used"),
            ));
        }
    }
    sink
}

fn insight(catalog: &Catalog) -> Sink {
    let mut sink = Sink::default();
    for r in &catalog.research {
        let Some((span, pools)) = &r.insight else {
            continue;
        };
        if pools.is_empty() {
            sink.push(
                Diagnostic::error(
                    "empty-insight",
                    *span,
                    "a study draws on at least one Insight pool",
                )
                .label("its cost would be split zero ways")
                .help("remove :insight to use the Era's pools"),
            );
        }
        let mut seen: BTreeMap<&str, Span> = BTreeMap::new();
        for pool in pools {
            if let Some(first) = seen.insert(&pool.text, pool.span) {
                sink.push(
                    Diagnostic::error(
                        "duplicate-insight",
                        pool.span,
                        format!("`{}` is listed twice", pool.text),
                    )
                    .label("would double its share of the cost")
                    .note(first, "first listed here"),
                );
            }
        }
    }
    sink
}

#[cfg(test)]
mod tests {
    use crate::diag::Severity;

    const PRELUDE: &str = "(tracks (data \"Data\")) \
        (study-shapes (read-share :share share) (backlog :seconds seconds))\n";

    /// An Era with valid defaults; `extra` keys come first, so they win over the defaults.
    fn era(id: &str, extra: &str) -> String {
        format!(
            "(era {id} {extra} :name \"{id}\" :slo 99% :incident-every none :max-severity 1 \
             :market 100 :raise-at 50 :grant 10 :dilution 10% :growth 1% :apdex-target 90% \
             :cost-index 1 :salary-index 1 :mix (:page 100%) :question \"q\" :arrivals \"a\")\n"
        )
    }

    /// The codes `compile` reports for `body`, errors first, in source order.
    fn codes(body: &str) -> Vec<(Severity, &'static str)> {
        let eras = era("e0", "") + &era("e1", "") + &era("e2", "");
        let compiled = crate::compile(vec![("t.qm".into(), format!("{PRELUDE}{eras}{body}"))]);
        let mut out: Vec<_> = compiled
            .diagnostics
            .iter()
            .map(|d| (d.severity, d.code))
            .collect();
        out.sort();
        out
    }

    fn r(id: &str, era: u32, requires: &str, extra: &str) -> String {
        format!("(research {id} :name \"{id}\" :track data :cost 10 :era {era} :requires ({requires}) :blurb \"b\" {extra})\n")
    }

    #[test]
    fn valid_content_compiles_with_no_diagnostics() {
        let body = r("a", 0, "", "")
            + &r("b", 0, "a", ":shape (read-share :share 100%)")
            + &r("c", 1, "b", "");
        assert_eq!(codes(&body), []);
    }

    #[test]
    fn a_requirement_loop_is_one_error_naming_the_loop() {
        let body =
            r("a", 0, "c", "") + &r("b", 0, "a", "") + &r("c", 0, "b", "") + &r("d", 0, "d", "");
        let compiled = crate::compile(vec![("t.qm".into(), format!("{PRELUDE}{body}"))]);
        let helps: Vec<_> = compiled
            .diagnostics
            .iter()
            .filter_map(|d| d.help.as_deref())
            .collect();
        assert_eq!(helps, ["a → c → b → a", "d → d"]);
        assert!(compiled.outputs.is_empty());
    }

    #[test]
    fn requiring_a_later_era_is_an_error_and_the_same_era_is_not() {
        assert_eq!(codes(&(r("a", 1, "", "") + &r("b", 1, "a", ""))), []);
        assert_eq!(
            codes(&(r("a", 2, "", "") + &r("b", 1, "a", ""))),
            [(Severity::Error, "later-era")]
        );
    }

    #[test]
    fn an_implied_requirement_warns_and_an_independent_one_does_not() {
        let base = r("a", 0, "", "") + &r("b", 0, "a", "") + &r("x", 0, "", "");
        assert_eq!(codes(&(base.clone() + &r("c", 0, "b x", ""))), []);
        assert_eq!(
            codes(&(base + &r("c", 0, "b a", ""))),
            [(Severity::Warning, "redundant-requires")]
        );
    }

    #[test]
    fn unknown_names_suggest_the_closest_one() {
        let compiled = crate::compile(vec![(
            "t.qm".into(),
            format!(
                "{PRELUDE}{}{}{}",
                era("e0", ""),
                r("pooling", 0, "", ""),
                r("b", 0, "poolign", "")
            ),
        )]);
        let d = &compiled.diagnostics[0];
        assert_eq!(
            (d.code, d.help.as_deref()),
            ("unknown-research", Some("did you mean `pooling`?"))
        );
    }

    #[test]
    fn shape_values_keep_their_dimension_and_range() {
        let share = |v: &str| codes(&r("a", 0, "", &format!(":shape (read-share :share {v})")));
        assert_eq!(share("0%"), []);
        assert_eq!(share("101%"), [(Severity::Error, "shape-value")]);
        assert_eq!(share("2s"), [(Severity::Error, "shape-value")]);
        assert_eq!(codes(&r("a", 0, "", ":shape (backlog :seconds 500ms)")), []);
        assert_eq!(
            codes(&r("a", 0, "", ":shape (backlog)")),
            [(Severity::Error, "missing-key")]
        );
        assert_eq!(
            codes(&r("a", 0, "", ":shape (backlog :seconds 1s :share 5%)")),
            [(Severity::Error, "unknown-key")]
        );
    }

    #[test]
    fn empty_and_repeated_insight_pools_are_errors() {
        assert_eq!(
            codes(&r("a", 0, "", ":insight ()")),
            [(Severity::Error, "empty-insight")]
        );
        assert_eq!(
            codes(&r("a", 0, "", ":insight (read read)")),
            [(Severity::Error, "duplicate-insight")]
        );
    }

    #[test]
    fn refs_need_an_import_and_imports_need_a_use() {
        let body = "(import \"./x.ts\" USED UNUSED)\n".to_string()
            + &r("a", 0, "", ":shape (read-share :share 5%)").replace("\"b\"", "(ref USED a b)")
            + &r("c", 0, "", "").replace("\"b\"", "(ref MISSING a)");
        assert_eq!(
            codes(&body),
            [
                (Severity::Error, "unknown-import"),
                (Severity::Warning, "unused-import")
            ]
        );
    }

    #[test]
    fn two_entries_cannot_unlock_one_framework() {
        let body = r("a", 0, "", ":unlocks (framework rails)")
            + &r("b", 0, "", ":unlocks (framework rails)");
        assert_eq!(codes(&body), [(Severity::Error, "framework-twice")]);
    }

    #[test]
    fn output_is_the_same_on_one_thread_and_many() {
        let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../simulation/content");
        let mut paths: Vec<_> = std::fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().path())
            .collect();
        paths.sort();
        let inputs: Vec<(String, String)> = paths
            .iter()
            .map(|p| (p.display().to_string(), std::fs::read_to_string(p).unwrap()))
            .collect();
        let run = || crate::compile(inputs.clone());
        let many = run();
        std::env::set_var("QMC_THREADS", "1");
        let one = run();
        std::env::remove_var("QMC_THREADS");
        assert!(many.diagnostics.is_empty(), "the content has diagnostics");
        assert_eq!(many.outputs.len(), 2);
        assert_eq!(one.outputs, many.outputs);
    }

    /// `era` with one key replaced: duplicate keys are an error, so the default is cut out.
    fn era_with(id: &str, key: &str, value: &str) -> String {
        let base = era(id, "");
        let start = base.find(&format!(":{key} ")).unwrap();
        let rest = &base[start + key.len() + 2..];
        let end = if rest.starts_with('(') {
            rest.find(')').unwrap() + 1
        } else {
            rest.find(' ').unwrap()
        };
        format!("{}:{key} {value}{}", &base[..start], &rest[end..])
    }

    fn era_codes(body: &str) -> Vec<(Severity, &'static str)> {
        let compiled = crate::compile(vec![("t.qm".into(), format!("{PRELUDE}{body}"))]);
        let mut out: Vec<_> = compiled
            .diagnostics
            .iter()
            .map(|d| (d.severity, d.code))
            .collect();
        out.sort();
        out
    }

    #[test]
    fn a_mix_sums_to_exactly_100_percent_where_floats_would_not() {
        assert_eq!(
            era_codes(&era_with("e", "mix", "(:page 10% :read 20% :write 70%)")),
            []
        );
        assert_eq!(
            era_codes(&era_with(
                "e",
                "mix",
                "(:page 33.3% :read 33.3% :write 33.3%)"
            )),
            [(Severity::Error, "mix-total")]
        );
        let compiled = crate::compile(vec![(
            "t.qm".into(),
            format!("{PRELUDE}{}", era_with("e", "mix", "(:page 60% :read 39%)")),
        )]);
        assert_eq!(
            compiled.diagnostics[0].help.as_deref(),
            Some("add 1% to a kind")
        );
        assert_eq!(
            era_codes(&era_with("e", "mix", "(:page 60% :page 40%)")),
            [(Severity::Error, "duplicate")]
        );
    }

    #[test]
    fn named_mixes_resolve_and_are_checked_once() {
        assert_eq!(
            era_codes(
                &("(mix web :page 50% :read 50%)\n".to_string() + &era_with("e", "mix", "web"))
            ),
            []
        );
        assert_eq!(
            era_codes(
                &("(mix web :page 50% :read 40%)\n".to_string() + &era_with("e", "mix", "web"))
            ),
            [(Severity::Error, "mix-total")]
        );
        assert_eq!(
            era_codes(&era_with("e", "mix", "wbe")),
            [(Severity::Error, "unknown-mix")]
        );
    }

    #[test]
    fn a_raise_the_market_cannot_reach_is_an_error() {
        assert_eq!(era_codes(&era_with("e", "raise-at", "100")), []);
        assert_eq!(
            era_codes(&era_with("e", "raise-at", "101")),
            [(Severity::Error, "raise-above-market")]
        );
    }

    #[test]
    fn an_era_that_never_raises_pays_no_grant_and_no_dilution() {
        let never = era_with("e", "raise-at", "never");
        assert_eq!(
            era_codes(&never),
            [
                (Severity::Error, "never-raises"),
                (Severity::Error, "never-raises")
            ]
        );
        let clean = era_with("e", "raise-at", "never")
            .replace(":grant 10", ":grant 0")
            .replace(":dilution 10%", ":dilution 0%");
        assert_eq!(era_codes(&clean), []);
    }

    #[test]
    fn research_must_name_an_era_that_exists() {
        assert_eq!(codes(&r("a", 2, "", "")), []);
        assert_eq!(
            codes(&r("a", 3, "", "")),
            [(Severity::Error, "unknown-era")]
        );
        assert_eq!(
            era_codes(&r("a", 0, "", "")),
            [(Severity::Error, "no-eras")]
        );
    }

    #[test]
    fn era_values_keep_their_units() {
        assert_eq!(
            era_codes(&era_with("e", "slo", "0.99")),
            [(Severity::Error, "unit")]
        );
        assert_eq!(
            era_codes(&era_with("e", "incident-every", "720")),
            [(Severity::Error, "unit")]
        );
        assert_eq!(
            era_codes(&era_with("e", "max-severity", "4")),
            [(Severity::Error, "range")]
        );
    }
}
