//! Lowering: expanded forms to the typed catalog.
//!
//! Lowering checks each form's own shape: known keys, required keys, value kinds, and units.
//! Rules that relate entries to each other, such as references and cycles, live in `check`.

use crate::diag::{suggest, Diagnostic, Sink};
use crate::num::{Dimension, Number, Ratio, Unit};
use crate::reader::{Kind, Sexp};
use crate::source::Span;
use std::collections::BTreeMap;

/// `shard-key` to `shardKey`, the key a Node field uses.
pub(crate) fn camel(name: &str) -> String {
    let mut out = String::new();
    let mut upper = false;
    for c in name.chars() {
        if c == '-' {
            upper = true;
        } else if upper {
            out.extend(c.to_uppercase());
            upper = false;
        } else {
            out.push(c);
        }
    }
    out
}

/// `shardKey` to `ShardKey`, the name a field's Schema const takes by default.
pub(crate) fn pascal(name: &str) -> String {
    let mut chars = name.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

/// `db-engines` to `DB_ENGINES`, the name a constant is exported under. A name that already has an
/// uppercase letter is a TypeScript name such as `wideGlossary` and stays as written.
pub(crate) fn constant(name: &str) -> String {
    if name.chars().any(|c| c.is_ascii_uppercase()) {
        name.to_string()
    } else {
        scream(name)
    }
}

/// `db-engines` to `DB_ENGINES`, the name a constant is exported under.
pub(crate) fn scream(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '-' | ' ' => '_',
            c => c.to_ascii_uppercase(),
        })
        .collect()
}

/// `quantization` to `Quantization`, the default label a refusal uses.
fn title(id: &str) -> String {
    id.split('-')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

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
    pub era: Spanned<Name>,
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
    pub tracks: Vec<Track>,
    pub shape_kinds: Vec<ShapeKind>,
    pub research: Vec<Research>,
    pub mixes: Vec<Mix>,
    pub eras: Vec<Era>,
    pub fallacies: Vec<Name>,
    /// `(kinds :request (…) :backend (…))`: every request and backend kind, in order.
    pub request_kinds: Vec<Name>,
    pub backend_kinds: Vec<Name>,
    /// The backend kinds that touch stored data.
    pub data_kinds: Vec<Name>,
    /// Backend kinds that leave the system, such as a call to a third party. No component
    /// receives them.
    pub external_kinds: Vec<Name>,
    pub build_groups: Vec<Group>,
    pub dock_groups: Vec<Group>,
    pub components: Vec<Component>,
    pub incidents: Vec<Incident>,
    pub defs: Vec<crate::data::Def>,
    pub type_defs: Vec<crate::data::TypeDef>,
    pub ids: Vec<IdDef>,
    pub gates: Vec<Gate>,
    pub states: Vec<State>,
}

/// A state field's `:gate (gzip "Gzip" :lock-all)`: a setting that needs research. Without
/// `:locked` or `:lock-all`, every value but the field's default needs the research.
#[derive(Debug)]
pub struct Gate {
    pub component: Name,
    pub field: Name,
    pub research: Name,
    pub what: GateLabel,
    pub open: GateValues,
    pub span: Span,
}

/// What a refusal names: fixed text, or `:labels TABLE`, the value's `name` in that table.
#[derive(Clone, Debug)]
pub enum GateLabel {
    Text(Spanned<String>),
    Table(Name),
}

#[derive(Debug)]
pub enum GateValues {
    Free(Vec<crate::data::Datum>),
    Locked(Vec<crate::data::Datum>),
}

/// `(state database (field shard-key (enum hash range) :default hash))`: a Component's writable
/// settings, in one place. A field with `:requires` also declares the gate on that setting.
#[derive(Debug)]
pub struct State {
    pub component: Name,
    /// The stem of the content file, which names the generated module the descriptor lands in.
    pub module: String,
    pub fields: Vec<StateField>,
    pub span: Span,
}

#[derive(Debug)]
pub struct StateField {
    /// The content key, such as `shard-key`.
    pub key: Name,
    pub ty: StateType,
    pub default: crate::data::Datum,
    pub requires: Option<Name>,
    pub label: Option<GateLabel>,
    /// `:required`: the schema has no default.
    pub required: bool,
    /// `:schema ShardKey`: the name of the generated Schema const for an enum or number.
    pub as_name: Option<Name>,
    /// `:values SHARD_COUNTS`: the name of the generated tuple for a one-of.
    pub values_name: Option<Name>,
    /// `(set setShards …)`: the exported setter and its refuse, values label, and scope.
    pub setter: Option<Name>,
    /// `:refuse "Only a Database shards."`: the refusal for another Component.
    pub only: Option<Spanned<String>>,
    /// `:values-label "Shard counts"`: what the refusal calls the allowed values.
    pub values_what: Option<Spanned<String>>,
    /// `:scope all-of-type`: the setter patches every Node of the Component.
    pub scope: Option<Name>,
    pub span: Span,
}

#[derive(Debug)]
pub enum StateType {
    Enum(Vec<Spanned<String>>),
    /// `(key-of table)`: the enum of a keyed table's keys, resolved once every file is lowered.
    KeyOf(Name),
    OneOf(Vec<Spanned<Number>>),
    Number,
    Bool,
}

/// A build group, `(edge "Edge")`, or a dock group, `(edge "Edge" :family edge)`.
#[derive(Debug)]
pub struct Group {
    pub key: Name,
    pub label: String,
    pub family: Option<Name>,
}

/// A list of kinds: names, or `(requests)` and `(requests except rt)`, which follow the declared
/// request kinds.
#[derive(Debug)]
pub enum KindList {
    Names(Vec<Name>),
    Requests { except: Vec<Name> },
}

impl KindList {
    /// The kinds in order. Request kinds come from the catalog, so `(requests)` stays in step.
    pub fn resolve<'a>(&'a self, catalog: &'a Catalog) -> Vec<&'a str> {
        match self {
            KindList::Names(names) => names.iter().map(|n| n.text.as_str()).collect(),
            KindList::Requests { except } => catalog
                .request_kinds
                .iter()
                .map(|k| k.text.as_str())
                .filter(|k| !except.iter().any(|e| e.text == *k))
                .collect(),
        }
    }
}

#[derive(Debug)]
pub struct Component {
    pub id: Name,
    pub code: Name,
    pub name: Spanned<Value>,
    pub product: Spanned<Value>,
    pub group: Name,
    pub dock: Name,
    pub cost: Spanned<Number>,
    /// A time, or an imported constant in milliseconds.
    pub latency: Spanned<Value>,
    pub burn: Option<Spanned<Number>>,
    pub steps: Option<Spanned<Number>>,
    pub max_out: Option<Spanned<Number>>,
    pub unlock: Option<Name>,
    /// `Some(None)` is `:capacity unlimited`.
    pub capacity: Option<Option<Spanned<Number>>>,
    pub capacity_span: Option<Span>,
    pub flags: Vec<Name>,
    pub accepts: Option<KindList>,
    pub sends: Option<KindList>,
    pub fallback: Option<KindList>,
    pub glossary: Vec<Name>,
    pub blurb: Spanned<Value>,
    pub span: Span,
}

impl Component {
    pub fn has(&self, flag: &str) -> bool {
        self.flags.iter().any(|f| f.text == flag)
    }
}

/// `(id NAME VALUES)`: an Effect Schema for a generated array of ids.
#[derive(Debug)]
pub struct IdDef {
    pub name: Name,
    pub values: Name,
    pub span: Span,
}

#[derive(Debug)]
pub struct Incident {
    pub id: Name,
    pub name: Spanned<Value>,
    pub era: Spanned<Name>,
    /// 1 is the worst.
    pub severity: Spanned<Number>,
    /// The severity it steps to when left alone, from `:severity (3 -> 2)`.
    pub escalates_to: Option<Spanned<Number>>,
    pub duration: Spanned<Number>,
    pub actions: Vec<Name>,
    pub fallacy: Option<Name>,
    pub cascades: Option<Name>,
    /// `:surge (media 4)`: the request kind that surges, and by how many times.
    pub surge: Option<(Name, Spanned<Value>)>,
    pub failures: Option<Spanned<Number>>,
    pub cause: Spanned<Value>,
    pub prevention: Spanned<Value>,
    pub span: Span,
}

/// Lowers one file. The driver lowers files in parallel and concatenates them in file order.
/// `module` is the file's stem, which names the generated file its defs land in.
pub fn lower(forms: &[Sexp], module: &str) -> (Catalog, Sink) {
    let mut cx = Lower {
        sink: Sink::default(),
        catalog: Catalog::default(),
        module: module.to_string(),
    };
    for form in forms {
        cx.form(form);
    }
    (cx.catalog, cx.sink)
}

impl Catalog {
    /// The position of an Era id in the catalog. The content names Eras; the generated data still
    /// uses their index.
    pub fn era_index(&self, id: &str) -> Option<usize> {
        self.eras.iter().position(|era| era.id.text == id)
    }

    pub fn append(&mut self, other: Catalog) {
        self.tracks.extend(other.tracks);
        self.shape_kinds.extend(other.shape_kinds);
        self.research.extend(other.research);
        self.mixes.extend(other.mixes);
        self.eras.extend(other.eras);
        self.fallacies.extend(other.fallacies);
        self.request_kinds.extend(other.request_kinds);
        self.backend_kinds.extend(other.backend_kinds);
        self.data_kinds.extend(other.data_kinds);
        self.external_kinds.extend(other.external_kinds);
        self.build_groups.extend(other.build_groups);
        self.dock_groups.extend(other.dock_groups);
        self.components.extend(other.components);
        self.incidents.extend(other.incidents);
        self.defs.extend(other.defs);
        self.type_defs.extend(other.type_defs);
        self.ids.extend(other.ids);
        self.gates.extend(other.gates);
        self.states.extend(other.states);
    }
}

type SetParts = (
    Option<Name>,
    Option<Spanned<String>>,
    Option<Spanned<String>>,
    Option<Name>,
);

struct Lower {
    sink: Sink,
    catalog: Catalog,
    module: String,
}

const FORMS: &[&str] = &[
    "tracks",
    "study-shapes",
    "research",
    "mix",
    "era",
    "fallacies",
    "incident",
    "kinds",
    "build-groups",
    "dock-groups",
    "component",
    "def",
    "type",
    "id",
    "constants",
    "state",
    "table",
    "records",
];

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
            "kinds" => {
                if let Some((_, keys)) =
                    self.keys(form, 0, &["request", "backend", "data", "external"])
                {
                    let request = keys.required("request", "kinds", &mut self.sink);
                    let backend = keys.required("backend", "kinds", &mut self.sink);
                    if let (Some(request), Some(backend)) = (request, backend) {
                        let request = self.names(request, "request kinds");
                        let backend = self.names(backend, "backend kinds");
                        self.catalog.request_kinds.extend(request);
                        self.catalog.backend_kinds.extend(backend);
                        if let Some(data) = keys.get("data") {
                            let data = self.names(data, "data kinds");
                            self.catalog.data_kinds.extend(data);
                        }
                        if let Some(external) = keys.get("external") {
                            let external = self.names(external, "external kinds");
                            self.catalog.external_kinds.extend(external);
                        }
                    }
                }
            }
            "build-groups" | "dock-groups" => {
                let dock = head == "dock-groups";
                for item in &form.list().unwrap()[1..] {
                    if let Some(group) = self.group(item, dock) {
                        let list = if dock {
                            &mut self.catalog.dock_groups
                        } else {
                            &mut self.catalog.build_groups
                        };
                        list.push(group);
                    }
                }
            }
            "component" => {
                if let Some(component) = self.component(form) {
                    self.catalog.components.push(component);
                }
            }
            "fallacies" => {
                for item in &form.list().unwrap()[1..] {
                    if let Some(name) = self.name(item, "a fallacy") {
                        self.catalog.fallacies.push(name);
                    }
                }
            }
            "def" => {
                if let Some(def) = crate::data::lower_def(form, &self.module, &mut self.sink) {
                    self.catalog.defs.push(def);
                }
            }
            "type" => {
                if let Some(ty) = crate::data::lower_type(form, &mut self.sink) {
                    self.catalog.type_defs.push(ty);
                }
            }
            "id" => {
                if let Some(id) = self.id(form) {
                    self.catalog.ids.push(id);
                }
            }
            "constants" => {
                self.catalog.defs.extend(crate::data::lower_constants(
                    form,
                    &self.module,
                    &mut self.sink,
                ));
            }
            "state" => {
                if let Some(state) = self.state(form) {
                    self.catalog.states.push(state);
                }
            }
            "table" => {
                if let Some(table) = crate::data::lower_table(form, &self.module, &mut self.sink) {
                    self.catalog.defs.push(table);
                }
            }
            "records" => {
                if let Some(records) =
                    crate::data::lower_records(form, &self.module, &mut self.sink)
                {
                    self.catalog.defs.push(records);
                }
            }
            "incident" => {
                if let Some(incident) = self.incident(form) {
                    self.catalog.incidents.push(incident);
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

    fn id(&mut self, form: &Sexp) -> Option<IdDef> {
        let items = &form.list().unwrap()[1..];
        match items {
            [name, values] => Some(IdDef {
                name: self.name(name, "an id name")?,
                values: self.name(values, "an id value list")?,
                span: form.span,
            }),
            _ => {
                self.sink.push(
                    Diagnostic::error("bad-form", form.span, "write (id NAME VALUES)")
                        .help("VALUES is the name of a generated array of ids"),
                );
                None
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
        self.keys_with(form, positional, allowed, &[])
    }

    /// Like `keys`, with keys that may stand alone as flags, such as `:required`.
    fn keys_with<'a>(
        &mut self,
        form: &'a Sexp,
        positional: usize,
        allowed: &[&str],
        flags: &[&str],
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
                if flags.contains(&key) {
                    keys.map.insert(key, (&rest[i], &rest[i]));
                    i += 1;
                    continue;
                }
                self.sink.push(Diagnostic::error(
                    "missing-value",
                    rest[i].span,
                    format!("`:{key}` needs a value"),
                ));
                return None;
            };
            if flags.contains(&key) && value.keyword().is_some() {
                keys.map.insert(key, (&rest[i], &rest[i]));
                i += 1;
                continue;
            }
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
        let era = keys.required("era", what, &mut self.sink).and_then(|v| {
            self.name(v, "an era").map(|value| Spanned {
                value,
                span: v.span,
            })
        });
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
        let max_severity = req(self, "max-severity").and_then(|v| self.severity(v));
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

    fn incident(&mut self, form: &Sexp) -> Option<Incident> {
        const KEYS: &[&str] = &[
            "name",
            "era",
            "severity",
            "duration",
            "actions",
            "fallacy",
            "cascades",
            "surge",
            "failures",
            "cause",
            "prevention",
        ];
        let (args, keys) = self.keys(form, 1, KEYS)?;
        let id = self.name(&args[0], "an incident id");
        let what = "an incident";
        let req = |cx: &mut Lower, key: &str| keys.required(key, what, &mut cx.sink);
        let name = req(self, "name").and_then(|v| self.text(v, "a name"));
        let cause = req(self, "cause").and_then(|v| self.text(v, "a cause"));
        let prevention = req(self, "prevention").and_then(|v| self.text(v, "a prevention"));
        let era = req(self, "era").and_then(|v| {
            self.name(v, "an era").map(|value| Spanned {
                value,
                span: v.span,
            })
        });
        let duration =
            req(self, "duration").and_then(|v| self.measure(v, "a duration", Dimension::Time));
        let severity = req(self, "severity").and_then(|v| match v.list() {
            Some([from, arrow, to]) if arrow.symbol() == Some("->") => {
                let from = self.severity(from)?;
                let to = self.severity(to)?;
                Some((from, Some(to)))
            }
            Some(_) => {
                self.sink.push(Diagnostic::error(
                    "bad-value",
                    v.span,
                    "write :severity 3, or (3 -> 2) when it escalates",
                ));
                None
            }
            None => self.severity(v).map(|s| (s, None)),
        });
        let actions = keys
            .get("actions")
            .map_or_else(Vec::new, |v| self.names(v, "actions"));
        let fallacy = keys.get("fallacy").and_then(|v| self.name(v, "a fallacy"));
        let cascades = keys
            .get("cascades")
            .and_then(|v| self.name(v, "an incident"));
        let failures = keys
            .get("failures")
            .and_then(|v| self.share(v, "a failure share"));
        let surge = keys.get("surge").and_then(|v| match v.list() {
            Some([kind, by]) => {
                let kind = self.name(kind, "a request kind")?;
                let by = self.value(by)?;
                Some((kind, by))
            }
            _ => {
                self.sink.push(Diagnostic::error(
                    "bad-value",
                    v.span,
                    "write :surge (kind times)",
                ));
                None
            }
        });
        let (severity, escalates_to) = severity?;
        Some(Incident {
            id: id?,
            name: name?,
            era: era?,
            severity,
            escalates_to,
            duration: duration?,
            actions,
            fallacy,
            cascades,
            surge,
            failures,
            cause: cause?,
            prevention: prevention?,
            span: form.span,
        })
    }

    /// A severity from 1, the worst, to 3.
    fn severity(&mut self, sexp: &Sexp) -> Option<Spanned<Number>> {
        let n = self.count(sexp, "a severity", 1)?;
        if n.value.value > Ratio::int(3) {
            self.sink.push(Diagnostic::error(
                "range",
                sexp.span,
                "a severity is 1, 2, or 3",
            ));
            return None;
        }
        Some(n)
    }

    fn group(&mut self, item: &Sexp, dock: bool) -> Option<Group> {
        let shape = if dock {
            "(key \"Label\" :family group)"
        } else {
            "(key \"Label\")"
        };
        let items = item.list().unwrap_or_default();
        let (
            Some(key),
            Some(Sexp {
                kind: Kind::Str(label),
                ..
            }),
        ) = (items.first(), items.get(1))
        else {
            self.sink.push(Diagnostic::error(
                "bad-form",
                item.span,
                format!("a group is {shape}"),
            ));
            return None;
        };
        let key = self.name(key, "a group key")?;
        let family = match (dock, &items[2..]) {
            (false, []) => None,
            (true, [k, v]) if k.keyword() == Some("family") => Some(self.name(v, "a build group")?),
            _ => {
                self.sink.push(Diagnostic::error(
                    "bad-form",
                    item.span,
                    format!("a group is {shape}"),
                ));
                return None;
            }
        };
        Some(Group {
            key,
            label: label.clone(),
            family,
        })
    }

    fn kind_list(&mut self, sexp: &Sexp) -> Option<KindList> {
        let items = sexp.list();
        match items {
            Some([head, rest @ ..]) if head.symbol() == Some("requests") => match rest {
                [] => Some(KindList::Requests { except: Vec::new() }),
                [word, names @ ..] if word.symbol() == Some("except") && !names.is_empty() => {
                    let except = names
                        .iter()
                        .filter_map(|n| self.name(n, "a request kind"))
                        .collect();
                    Some(KindList::Requests { except })
                }
                _ => {
                    self.sink.push(Diagnostic::error(
                        "bad-value",
                        sexp.span,
                        "write (requests) or (requests except kind …)",
                    ));
                    None
                }
            },
            Some(_) => Some(KindList::Names(self.names(sexp, "kinds"))),
            None => {
                self.sink.push(Diagnostic::error(
                    "expected-list",
                    sexp.span,
                    "kinds are a list like (q-read q-write)",
                ));
                None
            }
        }
    }

    /// A plain number of at least zero, which may be a fraction.
    fn plain(&mut self, sexp: &Sexp, what: &str) -> Option<Spanned<Number>> {
        let n = self.measure(sexp, what, Dimension::Plain)?;
        if n.value.value < Ratio::int(0) {
            self.sink.push(Diagnostic::error(
                "range",
                sexp.span,
                format!("{what} is at least 0, found {}", n.value),
            ));
            return None;
        }
        Some(n)
    }

    /// `(state database (field shard-key (enum hash range) :default hash) …)`: one declaration per
    /// setting, for the Effect Schema field, its default, and the gate it needs.
    fn state(&mut self, form: &Sexp) -> Option<State> {
        let items = form.list().unwrap();
        if items.len() < 2 {
            self.sink.push(Diagnostic::error(
                "bad-form",
                form.span,
                "write (state COMPONENT (field …) …)",
            ));
            return None;
        }
        let component = self.name(&items[1], "a component id")?;
        let mut fields = Vec::new();
        for item in &items[2..] {
            if let Some(field) = self.state_field(item, &component) {
                fields.push(field);
            }
        }
        if fields.is_empty() && items.len() == 2 {
            self.sink.push(Diagnostic::error(
                "bad-form",
                form.span,
                format!("`{}` declares no fields", component.text),
            ));
            return None;
        }
        Some(State {
            component,
            module: self.module.clone(),
            fields,
            span: form.span,
        })
    }

    fn state_field(&mut self, form: &Sexp, component: &Name) -> Option<StateField> {
        if form.head() != Some("field") {
            self.sink.push(Diagnostic::error(
                "bad-form",
                form.span,
                format!("a state holds (field …) forms, found {}", form.describe()),
            ));
            return None;
        }
        let (args, keys) = self.keys_with(
            form,
            2,
            &["default", "gate", "set", "schema", "values", "required"],
            &["required"],
        )?;
        let key = self.name(&args[0], "a field name");
        let ty = self.state_type(&args[1])?;
        let required = keys.get("required").is_some();
        let default = match keys.get("default") {
            Some(value) => self.state_default(value, &ty),
            None if required => None,
            None => {
                self.sink.push(
                    Diagnostic::error(
                        "missing-key",
                        form.span,
                        "a field needs `:default` unless it is `:required`",
                    )
                    .label("no :default"),
                );
                None
            }
        };
        if required && keys.get("default").is_some() {
            self.sink.push(Diagnostic::error(
                "state-required",
                form.span,
                "a field takes `:required` or `:default`, not both",
            ));
        }
        let schema = keys
            .get("schema")
            .and_then(|v| self.name(v, "a schema name"));
        let values_name = keys
            .get("values")
            .and_then(|v| self.name(v, "a values name"));
        if schema.is_some()
            && !matches!(
                ty,
                StateType::Enum(_) | StateType::KeyOf(_) | StateType::OneOf(_) | StateType::Number
            )
        {
            self.sink.push(Diagnostic::error(
                "state-name",
                form.span,
                "`:schema` names the Schema const of an enum or number field",
            ));
        }
        if values_name.is_some() && matches!(ty, StateType::Bool) {
            self.sink.push(Diagnostic::error(
                "state-name",
                form.span,
                "`:values` names the values of an enum or one-of field",
            ));
        }
        let (requires, label, open) = keys
            .get("gate")
            .map(|gate| self.state_gate(gate))
            .unwrap_or((None, None, None));
        let (setter, only, values_what, scope) = keys
            .get("set")
            .map(|set| self.state_set(set))
            .unwrap_or((None, None, None, None));
        if setter.is_some() && only.is_none() && scope.is_none() {
            self.sink.push(Diagnostic::error(
                "state-setter",
                form.span,
                "a setter needs `:refuse` or `:scope`",
            ));
        }
        if let Some(scope) = &scope {
            if scope.text != "all-of-type" {
                self.sink.push(Diagnostic::error(
                    "state-scope",
                    scope.span,
                    "a setter's :scope is all-of-type, or absent",
                ));
            }
        }
        let key = key?;
        if let Some(research) = requires.clone() {
            let what = label.clone().unwrap_or_else(|| {
                GateLabel::Text(Spanned {
                    value: title(&research.text),
                    span: research.span,
                })
            });
            let locked = default.clone().unwrap_or(crate::data::Datum {
                kind: crate::data::D::Null,
                span: form.span,
            });
            self.catalog.gates.push(Gate {
                component: component.clone(),
                field: Name {
                    text: camel(&key.text),
                    span: key.span,
                },
                research,
                what,
                open: open.unwrap_or_else(|| GateValues::Free(vec![locked])),
                span: form.span,
            });
        }
        Some(StateField {
            key,
            ty,
            default: default.unwrap_or(crate::data::Datum {
                kind: crate::data::D::Null,
                span: form.span,
            }),
            requires,
            label,
            required,
            as_name: schema,
            values_name,
            setter,
            only,
            values_what,
            scope,
            span: form.span,
        })
    }

    /// `(gate sharding "Sharding")`, `(gate quantization :labels gpu-precisions)`, or
    /// `(gate egress-optimization "R2" :locked ("r2"))`. `:lock-all` locks every value, which is
    /// how a boolean setting refuses before its research.
    fn state_gate(&mut self, form: &Sexp) -> (Option<Name>, Option<GateLabel>, Option<GateValues>) {
        let Some(items) = form.list() else {
            self.sink.push(Diagnostic::error(
                "bad-form",
                form.span,
                "a gate is (research), (research \"Label\"), or (research :labels TABLE)",
            ));
            return (None, None, None);
        };
        let research = items
            .first()
            .and_then(|item| self.name(item, "a research id"));
        let mut label = None;
        let mut values = None;
        let mut lock_all = false;
        let mut i = 1;
        while i < items.len() {
            let item = &items[i];
            if item.keyword() == Some("lock-all") {
                lock_all = true;
                i += 1;
                continue;
            }
            if let Some(key) = item.keyword() {
                let Some(value) = items.get(i + 1) else {
                    self.sink.push(Diagnostic::error(
                        "missing-value",
                        item.span,
                        format!("`:{key}` needs a value"),
                    ));
                    return (research, label, values);
                };
                match key {
                    "labels" => {
                        if label.is_some() {
                            self.sink.push(Diagnostic::error(
                                "gate-label",
                                item.span,
                                "a gate has one label",
                            ));
                        } else {
                            label = self.name(value, "a table").map(GateLabel::Table);
                        }
                    }
                    "locked" | "free" => {
                        if values.is_some() {
                            self.sink.push(Diagnostic::error(
                                "gate-values",
                                item.span,
                                "a gate has one value list",
                            ));
                            i += 2;
                            continue;
                        }
                        let Some(list) = value.list() else {
                            self.sink.push(Diagnostic::error(
                                "expected-list",
                                value.span,
                                format!(":{key} is a list of values, such as (false)"),
                            ));
                            return (research, label, values);
                        };
                        let mut out = Vec::new();
                        for item in list {
                            match crate::data::datum(item, &mut self.sink) {
                                Some(datum)
                                    if matches!(
                                        datum.kind,
                                        crate::data::D::Num(_)
                                            | crate::data::D::Str(_)
                                            | crate::data::D::Bool(_)
                                    ) =>
                                {
                                    out.push(datum)
                                }
                                Some(_) | None => {
                                    self.sink.push(Diagnostic::error(
                                        "bad-value",
                                        item.span,
                                        "a gate value is a number, a string, true, or false",
                                    ));
                                }
                            }
                        }
                        values = Some(if key == "free" {
                            GateValues::Free(out)
                        } else {
                            GateValues::Locked(out)
                        });
                    }
                    _ => {
                        self.sink.push(Diagnostic::error(
                            "gate-label",
                            item.span,
                            format!("a gate has no `:{key}`"),
                        ));
                    }
                }
                i += 2;
                continue;
            }
            match &item.kind {
                Kind::Str(value) | Kind::Symbol(value) if label.is_none() => {
                    label = Some(GateLabel::Text(Spanned {
                        value: value.clone(),
                        span: item.span,
                    }));
                    i += 1;
                }
                _ => {
                    self.sink.push(Diagnostic::error(
                        "gate-label",
                        item.span,
                        "a gate's label is a string or :labels TABLE",
                    ));
                    i += 1;
                }
            }
        }
        if lock_all && values.is_some() {
            self.sink.push(Diagnostic::error(
                "gate-values",
                form.span,
                "a gate takes :lock-all or a value list, not both",
            ));
        }
        if lock_all {
            values = Some(GateValues::Free(Vec::new()));
        }
        (research, label, values)
    }

    /// `(setShards :refuse "Only a Database shards." :values-label "Shard counts")`.
    fn state_set(&mut self, form: &Sexp) -> SetParts {
        let Some(item) = form.list() else {
            self.sink.push(Diagnostic::error(
                "bad-form",
                form.span,
                "a setter is (name :refuse \"…\" :values-label \"…\" :scope all-of-type)",
            ));
            return (None, None, None, None);
        };
        let setter = item
            .first()
            .and_then(|head| self.name(head, "a setter name"));
        let Some((_, keys)) = self.keys(form, 0, &["refuse", "values-label", "scope"]) else {
            return (setter, None, None, None);
        };
        let text = |cx: &mut Lower, key: &str| {
            keys.get(key).and_then(|value| match &value.kind {
                Kind::Str(text) => Some(Spanned {
                    value: text.clone(),
                    span: value.span,
                }),
                _ => {
                    cx.sink.push(Diagnostic::error(
                        "expected-string",
                        value.span,
                        format!("a setter's :{key} is a string"),
                    ));
                    None
                }
            })
        };
        let refuse = text(self, "refuse");
        let values = text(self, "values-label");
        let scope = keys.get("scope").and_then(|v| self.name(v, "a scope"));
        (setter, refuse, values, scope)
    }

    fn state_type(&mut self, sexp: &Sexp) -> Option<StateType> {
        if let Some(name) = sexp.symbol() {
            if name == "bool" {
                return Some(StateType::Bool);
            }
            if name == "number" {
                return Some(StateType::Number);
            }
            self.sink.push(
                Diagnostic::error(
                    "state-type",
                    sexp.span,
                    format!(
                        "a field type is number, bool, (enum …), or (one-of …), found `{name}`"
                    ),
                )
                .label("unknown type"),
            );
            return None;
        }
        let Some(items) = sexp.list() else {
            self.sink.push(Diagnostic::error(
                "state-type",
                sexp.span,
                format!(
                    "a field type is number, bool, (enum …), or (one-of …), found {}",
                    sexp.describe()
                ),
            ));
            return None;
        };
        match items.first().and_then(|i| i.symbol()) {
            Some("key-of") => {
                let Some(table) = items.get(1) else {
                    self.sink.push(Diagnostic::error(
                        "state-type",
                        sexp.span,
                        "write (key-of table)",
                    ));
                    return None;
                };
                if items.len() != 2 {
                    self.sink.push(Diagnostic::error(
                        "state-type",
                        sexp.span,
                        "(key-of …) takes one table name",
                    ));
                    return None;
                }
                Some(StateType::KeyOf(self.name(table, "a table")?))
            }
            Some("enum") => {
                let mut values: Vec<Spanned<String>> = Vec::new();
                for item in &items[1..] {
                    let value = match &item.kind {
                        Kind::Symbol(value) | Kind::Str(value) => value.as_str(),
                        _ => {
                            self.sink.push(Diagnostic::error(
                                "state-type",
                                item.span,
                                format!(
                                    "an enum value is a name or string, found {}",
                                    item.describe()
                                ),
                            ));
                            continue;
                        }
                    };
                    if values.iter().any(|v| v.value == value) {
                        self.sink.push(Diagnostic::error(
                            "duplicate",
                            item.span,
                            format!("`{value}` appears twice in one enum"),
                        ));
                        continue;
                    }
                    values.push(Spanned {
                        value: value.to_string(),
                        span: item.span,
                    });
                }
                if values.is_empty() {
                    self.sink.push(Diagnostic::error(
                        "state-type",
                        sexp.span,
                        "an enum names at least one value",
                    ));
                    return None;
                }
                Some(StateType::Enum(values))
            }
            Some("one-of") => {
                let mut values: Vec<Spanned<Number>> = Vec::new();
                for item in &items[1..] {
                    let Kind::Num(n) = item.kind else {
                        self.sink.push(Diagnostic::error(
                            "state-type",
                            item.span,
                            format!("a one-of value is a number, found {}", item.describe()),
                        ));
                        continue;
                    };
                    if n.unit != Unit::None {
                        self.sink.push(Diagnostic::error(
                            "state-type",
                            item.span,
                            format!(
                                "a one-of value is a plain number, found {}",
                                n.unit.dimension()
                            ),
                        ));
                        continue;
                    }
                    if values.iter().any(|v| v.value == n) {
                        self.sink.push(Diagnostic::error(
                            "duplicate",
                            item.span,
                            format!("`{n}` appears twice in one one-of"),
                        ));
                        continue;
                    }
                    values.push(Spanned {
                        value: n,
                        span: item.span,
                    });
                }
                if values.is_empty() {
                    self.sink.push(Diagnostic::error(
                        "state-type",
                        sexp.span,
                        "a one-of names at least one value",
                    ));
                    return None;
                }
                Some(StateType::OneOf(values))
            }
            _ => {
                self.sink.push(Diagnostic::error(
                    "state-type",
                    sexp.span,
                    "a field type is number, bool, (enum …), or (one-of …)",
                ));
                None
            }
        }
    }

    fn state_default(&mut self, sexp: &Sexp, ty: &StateType) -> Option<crate::data::Datum> {
        let datum = |kind, span| crate::data::Datum { kind, span };
        match ty {
            StateType::Enum(values) => {
                let text = match &sexp.kind {
                    Kind::Symbol(s) | Kind::Str(s) => s.clone(),
                    _ => {
                        self.sink.push(Diagnostic::error(
                            "state-default",
                            sexp.span,
                            format!("an enum default is a name, found {}", sexp.describe()),
                        ));
                        return None;
                    }
                };
                if !values.iter().any(|v| v.value == text) {
                    self.sink.push(
                        Diagnostic::error(
                            "state-default",
                            sexp.span,
                            format!("`{text}` is not one of the field's values"),
                        )
                        .help(format!(
                            "the values are {}",
                            values
                                .iter()
                                .map(|v| v.value.as_str())
                                .collect::<Vec<_>>()
                                .join(", ")
                        )),
                    );
                    return None;
                }
                Some(datum(crate::data::D::Str(text), sexp.span))
            }
            StateType::KeyOf(_) => {
                let text = match &sexp.kind {
                    Kind::Symbol(s) | Kind::Str(s) => s.clone(),
                    _ => {
                        self.sink.push(Diagnostic::error(
                            "state-default",
                            sexp.span,
                            format!("a key-of default is a name, found {}", sexp.describe()),
                        ));
                        return None;
                    }
                };
                Some(datum(crate::data::D::Str(text), sexp.span))
            }
            StateType::OneOf(values) => {
                let Kind::Num(n) = sexp.kind else {
                    self.sink.push(Diagnostic::error(
                        "state-default",
                        sexp.span,
                        format!("a one-of default is a number, found {}", sexp.describe()),
                    ));
                    return None;
                };
                if n.unit != Unit::None {
                    self.sink.push(Diagnostic::error(
                        "state-default",
                        sexp.span,
                        format!(
                            "a one-of default is a plain number, found {}",
                            n.unit.dimension()
                        ),
                    ));
                    return None;
                }
                if !values.iter().any(|v| v.value == n) {
                    self.sink.push(
                        Diagnostic::error(
                            "state-default",
                            sexp.span,
                            format!("`{n}` is not one of the field's values"),
                        )
                        .help(format!(
                            "the values are {}",
                            values
                                .iter()
                                .map(|v| v.value.to_string())
                                .collect::<Vec<_>>()
                                .join(", ")
                        )),
                    );
                    return None;
                }
                Some(datum(crate::data::D::Num(n.value), sexp.span))
            }
            StateType::Number => {
                let Kind::Num(n) = sexp.kind else {
                    self.sink.push(Diagnostic::error(
                        "state-default",
                        sexp.span,
                        format!("a number default is a number, found {}", sexp.describe()),
                    ));
                    return None;
                };
                if n.unit != Unit::None {
                    self.sink.push(Diagnostic::error(
                        "state-default",
                        sexp.span,
                        format!("a number default has no unit, found {}", n.unit.dimension()),
                    ));
                    return None;
                }
                Some(datum(crate::data::D::Num(n.value), sexp.span))
            }
            StateType::Bool => {
                let value = match sexp.symbol() {
                    Some("true") => true,
                    Some("false") => false,
                    _ => {
                        self.sink.push(Diagnostic::error(
                            "state-default",
                            sexp.span,
                            "a bool default is true or false",
                        ));
                        return None;
                    }
                };
                Some(datum(crate::data::D::Bool(value), sexp.span))
            }
        }
    }

    fn component(&mut self, form: &Sexp) -> Option<Component> {
        const KEYS: &[&str] = &[
            "code", "name", "product", "group", "dock", "cost", "latency", "burn", "steps",
            "max-out", "unlock", "capacity", "flags", "accepts", "sends", "fallback", "glossary",
            "blurb",
        ];
        let (args, keys) = self.keys(form, 1, KEYS)?;
        let id = self.name(&args[0], "a component id");
        let what = "a component";
        let req = |cx: &mut Lower, key: &str| keys.required(key, what, &mut cx.sink);
        let code = req(self, "code").and_then(|v| self.name(v, "a code"));
        let name = req(self, "name").and_then(|v| self.text(v, "a name"));
        let product = req(self, "product").and_then(|v| self.text(v, "a product"));
        let blurb = req(self, "blurb").and_then(|v| self.text(v, "a blurb"));
        let group = req(self, "group").and_then(|v| self.name(v, "a build group"));
        let dock = req(self, "dock").and_then(|v| self.name(v, "a dock group"));
        let cost = req(self, "cost").and_then(|v| self.count(v, "a cost", 0));
        let latency = req(self, "latency").and_then(|v| self.value(v));
        let burn = keys.get("burn").and_then(|v| self.plain(v, "a burn"));
        let steps = keys.get("steps").and_then(|v| self.count(v, "steps", 1));
        let max_out = keys
            .get("max-out")
            .and_then(|v| self.count(v, "a max out", 0));
        let unlock = keys.get("unlock").and_then(|v| self.name(v, "research"));
        let capacity = keys.get("capacity").and_then(|v| {
            if Self::is_word(v, "unlimited") {
                Some(None)
            } else {
                self.count(v, "a capacity", 1).map(Some)
            }
        });
        let flags = keys
            .get("flags")
            .map_or_else(Vec::new, |v| self.names(v, "flags"));
        let accepts = keys.get("accepts").and_then(|v| self.kind_list(v));
        let sends = keys.get("sends").and_then(|v| self.kind_list(v));
        let fallback = keys.get("fallback").and_then(|v| self.kind_list(v));
        Some(Component {
            id: id?,
            code: code?,
            name: name?,
            product: product?,
            group: group?,
            dock: dock?,
            cost: cost?,
            latency: latency?,
            burn,
            steps,
            max_out,
            unlock,
            capacity,
            capacity_span: keys.get("capacity").map(|v| v.span),
            flags,
            accepts,
            sends,
            fallback,
            glossary: keys
                .get("glossary")
                .map_or_else(Vec::new, |v| self.names(v, "a glossary id")),
            blurb: blurb?,
            span: form.span,
        })
    }
}
