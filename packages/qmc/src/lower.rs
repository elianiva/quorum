//! Lowering: expanded forms to the typed catalog.
//!
//! Lowering checks each form's own shape: known keys, required keys, value kinds, and units.
//! Rules that relate entries to each other, such as references and cycles, live in `check`.

use crate::diag::{suggest, Diagnostic, Sink};
use crate::num::{Dimension, Number, Ratio, Unit};
use crate::reader::{Kind, Sexp};
use crate::source::Span;
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq)]
pub struct Name {
    pub text: String,
    pub span: Span,
}

/// A value that goes into the output as written.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    Str(String),
    Num(Number),
    /// `(ref RUNTIMES puma blurb)`: a property of an imported TypeScript value.
    Ref(Vec<Name>),
    /// An imported TypeScript constant, used as a number.
    Const(Name),
}

#[derive(Clone, Debug)]
pub struct Spanned<T> {
    pub value: T,
    pub span: Span,
}

#[derive(Debug)]
pub struct Import {
    pub from: String,
    pub names: Vec<Name>,
}

#[derive(Debug)]
pub struct Track {
    pub key: Name,
    pub label: String,
}

/// The kind of value a study shape field holds.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FieldType {
    /// A whole number, written plain.
    Count,
    /// A share from 0% to 100%, written with `%`.
    Share,
    /// A time, written with a unit and emitted in seconds.
    Seconds,
}

impl FieldType {
    fn parse(name: &str) -> Option<FieldType> {
        Some(match name {
            "count" => FieldType::Count,
            "share" => FieldType::Share,
            "seconds" => FieldType::Seconds,
            _ => return None,
        })
    }

    pub fn dimension(self) -> Dimension {
        match self {
            FieldType::Count => Dimension::Plain,
            FieldType::Share => Dimension::Share,
            FieldType::Seconds => Dimension::Time,
        }
    }
}

#[derive(Debug)]
pub struct ShapeKind {
    pub name: Name,
    pub fields: Vec<(Name, FieldType)>,
}

#[derive(Debug)]
pub struct Shape {
    pub kind: Name,
    pub fields: Vec<(Name, Spanned<Value>)>,
    pub span: Span,
}

#[derive(Debug)]
pub struct Research {
    pub id: Name,
    pub name: Spanned<Value>,
    pub track: Name,
    pub cost: Spanned<Number>,
    pub era: Spanned<Number>,
    pub requires: Vec<Name>,
    pub blurb: Spanned<Value>,
    /// The Insight pools a study draws on, with the span of the list.
    pub insight: Option<(Span, Vec<Name>)>,
    pub shape: Option<Shape>,
    pub breadth: Option<Spanned<Number>>,
    pub region_breadth: Option<Spanned<Number>>,
    /// `(framework laravel)`: the framework this research unlocks.
    pub unlocks_framework: Option<Name>,
    pub span: Span,
}

/// A traffic mix: the share of requests of each kind. Shares are exact, so the check that they
/// sum to 100% needs no tolerance.
#[derive(Debug)]
pub struct Mix {
    pub name: Option<Name>,
    pub shares: Vec<(Name, Spanned<Number>)>,
    pub span: Span,
}

#[derive(Debug)]
pub enum MixRef {
    Named(Name),
    Inline(Mix),
}

#[derive(Debug)]
pub struct Era {
    pub id: Name,
    pub name: Spanned<Value>,
    pub slo: Spanned<Number>,
    /// `None` when the Era has no incidents (`:incident-every none`).
    pub incident_every: Option<Spanned<Number>>,
    pub max_severity: Spanned<Number>,
    pub market: Spanned<Number>,
    /// `None` when the Era never raises (`:raise-at never`).
    pub raise_at: Option<Spanned<Number>>,
    pub raise_span: Span,
    pub grant: Spanned<Number>,
    pub dilution: Spanned<Number>,
    pub growth: Spanned<Number>,
    pub apdex_target: Spanned<Number>,
    pub cost_index: Spanned<Number>,
    pub salary_index: Spanned<Number>,
    pub mix: MixRef,
    pub question: Spanned<Value>,
    pub arrivals: Spanned<Value>,
    pub span: Span,
}

#[derive(Default, Debug)]
pub struct Catalog {
    pub imports: Vec<Import>,
    pub tracks: Vec<Track>,
    pub shape_kinds: Vec<ShapeKind>,
    pub research: Vec<Research>,
    pub mixes: Vec<Mix>,
    pub eras: Vec<Era>,
}

/// Lowers one file. The driver lowers files in parallel and concatenates them in file order.
pub fn lower(forms: &[Sexp]) -> (Catalog, Sink) {
    let mut cx = Lower {
        sink: Sink::default(),
        catalog: Catalog::default(),
    };
    for form in forms {
        cx.form(form);
    }
    (cx.catalog, cx.sink)
}

impl Catalog {
    pub fn append(&mut self, other: Catalog) {
        self.imports.extend(other.imports);
        self.tracks.extend(other.tracks);
        self.shape_kinds.extend(other.shape_kinds);
        self.research.extend(other.research);
        self.mixes.extend(other.mixes);
        self.eras.extend(other.eras);
    }
}

struct Lower {
    sink: Sink,
    catalog: Catalog,
}

const FORMS: &[&str] = &["import", "tracks", "study-shapes", "research", "mix", "era"];

/// A form's keyword arguments, after the head and any positional arguments.
struct Keys<'a> {
    map: BTreeMap<&'a str, (&'a Sexp, &'a Sexp)>,
    span: Span,
}

impl<'a> Keys<'a> {
    fn get(&self, key: &str) -> Option<&'a Sexp> {
        self.map.get(key).map(|(_, v)| *v)
    }

    fn required(&self, key: &str, what: &str, sink: &mut Sink) -> Option<&'a Sexp> {
        let value = self.get(key);
        if value.is_none() {
            sink.push(
                Diagnostic::error("missing-key", self.span, format!("{what} needs `:{key}`"))
                    .label(format!("no :{key}")),
            );
        }
        value
    }
}

impl Lower {
    fn form(&mut self, form: &Sexp) {
        let Some(head) = form.head() else {
            self.sink.push(
                Diagnostic::error(
                    "bad-form",
                    form.span,
                    format!(
                        "expected a form like (research …), found {}",
                        form.describe()
                    ),
                )
                .label("not a form"),
            );
            return;
        };
        match head {
            "import" => self.import(form),
            "tracks" => self.tracks(form),
            "study-shapes" => self.shape_kinds(form),
            "research" => {
                if let Some(r) = self.research(form) {
                    self.catalog.research.push(r);
                }
            }
            "mix" => {
                let items = form.list().unwrap();
                let name = items.get(1).and_then(|n| self.name(n, "a mix name"));
                if let (Some(name), Some(mix)) = (name, self.mix(&items[2..], form.span)) {
                    self.catalog.mixes.push(Mix {
                        name: Some(name),
                        ..mix
                    });
                }
            }
            "era" => {
                if let Some(era) = self.era(form) {
                    self.catalog.eras.push(era);
                }
            }
            other => {
                let head_span = form.list().unwrap()[0].span;
                let mut d =
                    Diagnostic::error("unknown-form", head_span, format!("unknown form `{other}`"))
                        .label("not a form or a macro");
                if let Some(s) = suggest(other, FORMS.iter().copied()) {
                    d = d.help(format!("did you mean `{s}`?"));
                }
                self.sink.push(d);
            }
        }
    }

    fn name(&mut self, sexp: &Sexp, what: &str) -> Option<Name> {
        match sexp.symbol() {
            Some(s) => Some(Name {
                text: s.to_string(),
                span: sexp.span,
            }),
            None => {
                self.sink.push(
                    Diagnostic::error(
                        "expected-name",
                        sexp.span,
                        format!("{what} is a name, found {}", sexp.describe()),
                    )
                    .label("expected a name"),
                );
                None
            }
        }
    }

    fn names(&mut self, sexp: &Sexp, what: &str) -> Vec<Name> {
        match sexp.list() {
            Some(items) => items.iter().filter_map(|i| self.name(i, what)).collect(),
            None => {
                self.sink.push(Diagnostic::error(
                    "expected-list",
                    sexp.span,
                    format!("{what} is a list like (a b), found {}", sexp.describe()),
                ));
                Vec::new()
            }
        }
    }

    /// Splits `(head positional… :key value …)` and refuses unknown, repeated, and dangling keys.
    fn keys<'a>(
        &mut self,
        form: &'a Sexp,
        positional: usize,
        allowed: &[&str],
    ) -> Option<(&'a [Sexp], Keys<'a>)> {
        let items = &form.list().unwrap()[1..];
        if items.len() < positional || items[..positional].iter().any(|i| i.keyword().is_some()) {
            self.sink.push(Diagnostic::error(
                "bad-form",
                form.span,
                format!(
                    "`{}` takes {positional} argument(s) before its keys",
                    form.head().unwrap()
                ),
            ));
            return None;
        }
        let (args, rest) = items.split_at(positional);
        let mut keys = Keys {
            map: BTreeMap::new(),
            span: form.list().unwrap()[0].span,
        };
        let mut i = 0;
        let mut ok = true;
        while i < rest.len() {
            let Some(key) = rest[i].keyword() else {
                self.sink.push(
                    Diagnostic::error(
                        "expected-key",
                        rest[i].span,
                        format!("expected a :key, found {}", rest[i].describe()),
                    )
                    .label("no key for this value"),
                );
                ok = false;
                i += 1;
                continue;
            };
            if !allowed.contains(&key) {
                let mut d = Diagnostic::error(
                    "unknown-key",
                    rest[i].span,
                    format!("`{}` takes no `:{key}`", form.head().unwrap()),
                );
                if let Some(s) = suggest(key, allowed.iter().copied()) {
                    d = d.help(format!("did you mean `:{s}`?"));
                }
                self.sink.push(d);
                ok = false;
            }
            let Some(value) = rest.get(i + 1) else {
                self.sink.push(Diagnostic::error(
                    "missing-value",
                    rest[i].span,
                    format!("`:{key}` needs a value"),
                ));
                return None;
            };
            if let Some((first, _)) = keys.map.insert(key, (&rest[i], value)) {
                self.sink.push(
                    Diagnostic::error(
                        "duplicate-key",
                        rest[i].span,
                        format!("`:{key}` is given twice"),
                    )
                    .note(first.span, "first given here"),
                );
                ok = false;
            }
            i += 2;
        }
        ok.then_some((args, keys))
    }

    fn value(&mut self, sexp: &Sexp) -> Option<Spanned<Value>> {
        let value = match &sexp.kind {
            Kind::Str(s) => Value::Str(s.clone()),
            Kind::Num(n) => Value::Num(*n),
            Kind::Symbol(s) => Value::Const(Name {
                text: s.clone(),
                span: sexp.span,
            }),
            Kind::List(items) if sexp.head() == Some("ref") && items.len() >= 3 => Value::Ref(
                items[1..]
                    .iter()
                    .filter_map(|i| self.name(i, "a ref path"))
                    .collect(),
            ),
            _ => {
                self.sink.push(Diagnostic::error(
                    "bad-value",
                    sexp.span,
                    format!(
                        "expected a string, number, or (ref …), found {}",
                        sexp.describe()
                    ),
                ));
                return None;
            }
        };
        Some(Spanned {
            value,
            span: sexp.span,
        })
    }

    fn text(&mut self, sexp: &Sexp, what: &str) -> Option<Spanned<Value>> {
        let value = self.value(sexp)?;
        if matches!(value.value, Value::Num(_) | Value::Const(_)) {
            self.sink.push(Diagnostic::error(
                "expected-text",
                sexp.span,
                format!("{what} is text: a string or (ref …)"),
            ));
            return None;
        }
        Some(value)
    }

    /// A whole number with no unit, at least `min`.
    fn count(&mut self, sexp: &Sexp, what: &str, min: i128) -> Option<Spanned<Number>> {
        let Kind::Num(n) = sexp.kind else {
            self.sink.push(Diagnostic::error(
                "expected-number",
                sexp.span,
                format!("{what} is a number, found {}", sexp.describe()),
            ));
            return None;
        };
        if n.unit != Unit::None {
            self.sink.push(
                Diagnostic::error(
                    "unit",
                    sexp.span,
                    format!("{what} is a plain number, found {}", n.unit.dimension()),
                )
                .label("remove the unit"),
            );
            return None;
        }
        if !n.value.is_int() || n.value.num < min {
            self.sink.push(Diagnostic::error(
                "range",
                sexp.span,
                format!("{what} is a whole number of at least {min}, found {n}"),
            ));
            return None;
        }
        Some(Spanned {
            value: n,
            span: sexp.span,
        })
    }

    fn import(&mut self, form: &Sexp) {
        let items = &form.list().unwrap()[1..];
        let Some(Kind::Str(from)) = items.first().map(|i| &i.kind) else {
            self.sink.push(Diagnostic::error(
                "bad-form",
                form.span,
                "write (import \"./file.ts\" NAME …)",
            ));
            return;
        };
        let names = items[1..]
            .iter()
            .filter_map(|i| self.name(i, "an imported name"))
            .collect::<Vec<_>>();
        if names.is_empty() {
            self.sink.push(Diagnostic::error(
                "bad-form",
                form.span,
                "an import names at least one value",
            ));
        }
        self.catalog.imports.push(Import {
            from: from.clone(),
            names,
        });
    }

    fn tracks(&mut self, form: &Sexp) {
        for item in &form.list().unwrap()[1..] {
            match item.list() {
                Some(
                    [key, Sexp {
                        kind: Kind::Str(label),
                        ..
                    }],
                ) => {
                    if let Some(key) = self.name(key, "a track key") {
                        self.catalog.tracks.push(Track {
                            key,
                            label: label.clone(),
                        });
                    }
                }
                _ => self.sink.push(Diagnostic::error(
                    "bad-form",
                    item.span,
                    "a track is (key \"Label\")",
                )),
            }
        }
    }

    fn shape_kinds(&mut self, form: &Sexp) {
        for item in &form.list().unwrap()[1..] {
            let Some(name) = item
                .list()
                .and_then(|l| l.first())
                .and_then(|h| self.name(h, "a shape kind"))
            else {
                self.sink.push(Diagnostic::error(
                    "bad-form",
                    item.span,
                    "a study shape is (kind :field type …)",
                ));
                continue;
            };
            let mut fields: Vec<(Name, FieldType)> = Vec::new();
            for pair in item.list().unwrap()[1..].chunks(2) {
                let [key, value] = pair else {
                    self.sink.push(Diagnostic::error(
                        "missing-value",
                        pair[0].span,
                        "a field needs a type",
                    ));
                    continue;
                };
                let Some(key_text) = key.keyword() else {
                    self.sink.push(Diagnostic::error(
                        "expected-key",
                        key.span,
                        "expected :field type",
                    ));
                    continue;
                };
                match value.symbol().and_then(FieldType::parse) {
                    Some(t) => fields.push((
                        Name {
                            text: key_text.to_string(),
                            span: key.span,
                        },
                        t,
                    )),
                    None => self.sink.push(
                        Diagnostic::error(
                            "bad-type",
                            value.span,
                            "a field type is count, share, or seconds",
                        )
                        .label("unknown type"),
                    ),
                }
            }
            self.catalog.shape_kinds.push(ShapeKind { name, fields });
        }
    }

    fn research(&mut self, form: &Sexp) -> Option<Research> {
        const KEYS: &[&str] = &[
            "name",
            "track",
            "cost",
            "era",
            "requires",
            "blurb",
            "insight",
            "shape",
            "breadth",
            "region-breadth",
            "unlocks",
        ];
        let (args, keys) = self.keys(form, 1, KEYS)?;
        let id = self.name(&args[0], "a research id");
        let what = "research";
        let name = keys
            .required("name", what, &mut self.sink)
            .and_then(|v| self.text(v, "a name"));
        let track = keys
            .required("track", what, &mut self.sink)
            .and_then(|v| self.name(v, "a track"));
        let cost = keys
            .required("cost", what, &mut self.sink)
            .and_then(|v| self.count(v, "a cost", 1));
        let era = keys
            .required("era", what, &mut self.sink)
            .and_then(|v| self.count(v, "an era", 0));
        let blurb = keys
            .required("blurb", what, &mut self.sink)
            .and_then(|v| self.text(v, "a blurb"));
        let requires = keys
            .get("requires")
            .map_or_else(Vec::new, |v| self.names(v, "requires"));
        let insight = keys
            .get("insight")
            .map(|v| (v.span, self.names(v, "insight")));
        let breadth = keys
            .get("breadth")
            .and_then(|v| self.count(v, "breadth", 1));
        let region_breadth = keys
            .get("region-breadth")
            .and_then(|v| self.count(v, "region breadth", 1));
        let shape = keys.get("shape").and_then(|v| self.shape(v));
        let unlocks_framework = keys.get("unlocks").and_then(|v| match v.list() {
            Some([head, fw]) if head.symbol() == Some("framework") => self.name(fw, "a framework"),
            _ => {
                self.sink.push(Diagnostic::error(
                    "bad-value",
                    v.span,
                    "write :unlocks (framework id)",
                ));
                None
            }
        });
        Some(Research {
            id: id?,
            name: name?,
            track: track?,
            cost: cost?,
            era: era?,
            requires,
            blurb: blurb?,
            insight,
            shape,
            breadth,
            region_breadth,
            unlocks_framework,
            span: form.span,
        })
    }

    fn shape(&mut self, sexp: &Sexp) -> Option<Shape> {
        let items = sexp.list().filter(|l| !l.is_empty());
        let Some(kind) = items.and_then(|l| self.name(&l[0], "a shape kind")) else {
            self.sink.push(Diagnostic::error(
                "bad-value",
                sexp.span,
                "a shape is (kind :field value …)",
            ));
            return None;
        };
        let rest = &items.unwrap()[1..];
        let mut fields = Vec::new();
        for pair in rest.chunks(2) {
            match pair {
                [key, value] if key.keyword().is_some() => {
                    let value = self.value(value)?;
                    fields.push((
                        Name {
                            text: key.keyword().unwrap().to_string(),
                            span: key.span,
                        },
                        value,
                    ));
                }
                _ => {
                    self.sink.push(Diagnostic::error(
                        "expected-key",
                        pair[0].span,
                        "expected :field value",
                    ));
                    return None;
                }
            }
        }
        Some(Shape {
            kind,
            fields,
            span: sexp.span,
        })
    }

    /// A number whose unit has the given dimension.
    fn measure(
        &mut self,
        sexp: &Sexp,
        what: &str,
        dimension: Dimension,
    ) -> Option<Spanned<Number>> {
        match sexp.kind {
            Kind::Num(n) if n.unit.dimension() == dimension => Some(Spanned {
                value: n,
                span: sexp.span,
            }),
            Kind::Num(n) => {
                self.sink.push(
                    Diagnostic::error(
                        "unit",
                        sexp.span,
                        format!("{what} is {dimension}, found {}", n.unit.dimension()),
                    )
                    .label("wrong unit"),
                );
                None
            }
            _ => {
                self.sink.push(Diagnostic::error(
                    "expected-number",
                    sexp.span,
                    format!("{what} is a number, found {}", sexp.describe()),
                ));
                None
            }
        }
    }

    /// A share from 0% to 100%.
    fn share(&mut self, sexp: &Sexp, what: &str) -> Option<Spanned<Number>> {
        let n = self.measure(sexp, what, Dimension::Share)?;
        let share = n.value.base();
        if share < Ratio::int(0) || share > Ratio::int(1) {
            self.sink.push(Diagnostic::error(
                "range",
                sexp.span,
                format!("{what} is between 0% and 100%, found {}", n.value),
            ));
            return None;
        }
        Some(n)
    }

    /// `none` or `never`, written as a symbol in place of a value.
    fn is_word(sexp: &Sexp, word: &str) -> bool {
        sexp.symbol() == Some(word)
    }

    /// `:kind share …` pairs.
    fn mix(&mut self, items: &[Sexp], span: Span) -> Option<Mix> {
        let mut shares = Vec::new();
        let mut ok = true;
        for pair in items.chunks(2) {
            match pair {
                [key, value] if key.keyword().is_some() => {
                    let kind = Name {
                        text: key.keyword().unwrap().to_string(),
                        span: key.span,
                    };
                    match self.share(value, "a mix share") {
                        Some(share) => shares.push((kind, share)),
                        None => ok = false,
                    }
                }
                _ => {
                    self.sink.push(Diagnostic::error(
                        "expected-key",
                        pair[0].span,
                        "a mix is :kind share pairs, like :page 60%",
                    ));
                    ok = false;
                }
            }
        }
        ok.then_some(Mix {
            name: None,
            shares,
            span,
        })
    }

    fn era(&mut self, form: &Sexp) -> Option<Era> {
        const KEYS: &[&str] = &[
            "name",
            "slo",
            "incident-every",
            "max-severity",
            "market",
            "raise-at",
            "grant",
            "dilution",
            "growth",
            "apdex-target",
            "cost-index",
            "salary-index",
            "mix",
            "question",
            "arrivals",
        ];
        let (args, keys) = self.keys(form, 1, KEYS)?;
        let id = self.name(&args[0], "an era id");
        let what = "an era";
        let req = |cx: &mut Lower, key: &str| keys.required(key, what, &mut cx.sink);
        let name = req(self, "name").and_then(|v| self.text(v, "a name"));
        let question = req(self, "question").and_then(|v| self.text(v, "a question"));
        let arrivals = req(self, "arrivals").and_then(|v| self.text(v, "the arrivals"));
        let slo = req(self, "slo").and_then(|v| self.share(v, "an SLO"));
        let dilution = req(self, "dilution").and_then(|v| self.share(v, "a dilution"));
        let growth = req(self, "growth").and_then(|v| self.share(v, "a growth rate"));
        let apdex_target = req(self, "apdex-target").and_then(|v| self.share(v, "an Apdex target"));
        let market = req(self, "market").and_then(|v| self.count(v, "a market", 1));
        let grant = req(self, "grant").and_then(|v| self.count(v, "a grant", 0));
        let cost_index = req(self, "cost-index").and_then(|v| self.count(v, "a cost index", 1));
        let salary_index =
            req(self, "salary-index").and_then(|v| self.count(v, "a salary index", 1));
        let max_severity = req(self, "max-severity").and_then(|v| {
            let n = self.count(v, "a severity", 1)?;
            if n.value.value > Ratio::int(3) {
                self.sink.push(Diagnostic::error(
                    "range",
                    v.span,
                    "a severity is 1, 2, or 3",
                ));
                return None;
            }
            Some(n)
        });
        let incident_every = req(self, "incident-every").map(|v| {
            if Self::is_word(v, "none") {
                Ok(None)
            } else {
                self.measure(v, "an incident interval", Dimension::Time)
                    .map(Some)
                    .ok_or(())
            }
        });
        let raise = keys.required("raise-at", what, &mut self.sink);
        let raise_at = raise.map(|v| {
            if Self::is_word(v, "never") {
                Ok(None)
            } else {
                self.count(v, "a raise target", 1).map(Some).ok_or(())
            }
        });
        let mix = req(self, "mix").and_then(|v| match &v.kind {
            Kind::Symbol(s) => Some(MixRef::Named(Name {
                text: s.clone(),
                span: v.span,
            })),
            Kind::List(items) => self.mix(items, v.span).map(MixRef::Inline),
            _ => {
                self.sink.push(Diagnostic::error(
                    "bad-value",
                    v.span,
                    "a mix is a mix name or (:kind share …)",
                ));
                None
            }
        });
        Some(Era {
            id: id?,
            name: name?,
            slo: slo?,
            incident_every: incident_every?.ok()?,
            max_severity: max_severity?,
            market: market?,
            raise_at: raise_at?.ok()?,
            raise_span: raise?.span,
            grant: grant?,
            dilution: dilution?,
            growth: growth?,
            apdex_target: apdex_target?,
            cost_index: cost_index?,
            salary_index: salary_index?,
            mix: mix?,
            question: question?,
            arrivals: arrivals?,
            span: form.span,
        })
    }
}
