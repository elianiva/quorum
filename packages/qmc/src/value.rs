//! Catalog values, evaluated in qmc.
//!
//! The Solver catalog and the glossary's interpolated prose read values from the catalog itself,
//! not from the generated TypeScript. `Values` evaluates a def's datum the way JavaScript evaluates
//! the module qmc writes for it: a number literal is the double its decimal text parses to,
//! arithmetic runs in `f64` in the written order, a spread keeps the first position of a key, and
//! an object lists integer keys before the others. The typed exports qmc writes from domain forms,
//! such as `COMPONENTS` or `ERAS`, are built from the same lowered forms the TypeScript emitter
//! reads.

use crate::data::{Def, Entry, Format, Hole, Key, D};
use crate::lower::{Catalog, Component, Value};
use crate::num::{Number, Ratio, Unit};
use std::cell::RefCell;
use std::collections::BTreeMap;

/// A JavaScript value.
#[derive(Clone, Debug, PartialEq)]
pub enum V {
    Num(f64),
    Str(String),
    Bool(bool),
    Null,
    Undefined,
    Arr(Vec<V>),
    /// Keys in insertion order; `keys` gives JavaScript's enumeration order.
    Obj(Vec<(String, V)>),
}

impl V {
    /// `obj[key]`, or `undefined`.
    pub fn get(&self, key: &str) -> &V {
        match self {
            V::Obj(entries) => entries
                .iter()
                .find(|(k, _)| k == key)
                .map_or(&V::Undefined, |(_, v)| v),
            V::Arr(items) => key
                .parse::<usize>()
                .ok()
                .and_then(|i| items.get(i))
                .unwrap_or(&V::Undefined),
            _ => &V::Undefined,
        }
    }

    /// `Object.keys`: integer keys ascending, then the rest in insertion order.
    pub fn keys(&self) -> Vec<String> {
        match self {
            V::Obj(entries) => {
                let index = |k: &str| {
                    (!k.is_empty() && (k == "0" || !k.starts_with('0')))
                        .then(|| k.parse::<u32>().ok())
                        .flatten()
                };
                let mut ints: Vec<(u32, String)> = entries
                    .iter()
                    .filter_map(|(k, _)| index(k).map(|i| (i, k.clone())))
                    .collect();
                ints.sort();
                ints.into_iter()
                    .map(|(_, k)| k)
                    .chain(
                        entries
                            .iter()
                            .filter(|(k, _)| index(k).is_none())
                            .map(|(k, _)| k.clone()),
                    )
                    .collect()
            }
            V::Arr(items) => (0..items.len()).map(|i| i.to_string()).collect(),
            _ => Vec::new(),
        }
    }

    pub fn items(&self) -> &[V] {
        match self {
            V::Arr(items) => items,
            _ => &[],
        }
    }

    pub fn is_missing(&self) -> bool {
        matches!(self, V::Undefined)
    }

    /// JavaScript's `typeof`, with `null` and arrays named for diagnostics.
    pub fn describe(&self) -> &'static str {
        match self {
            V::Num(_) => "a number",
            V::Str(_) => "a string",
            V::Bool(_) => "a boolean",
            V::Null => "null",
            V::Undefined => "nothing",
            V::Arr(_) => "a list",
            V::Obj(_) => "a record",
        }
    }

    fn insert(entries: &mut Vec<(String, V)>, key: String, value: V) {
        match entries.iter_mut().find(|(k, _)| *k == key) {
            Some((_, slot)) => *slot = value,
            None => entries.push((key, value)),
        }
    }
}

/// A number as prose prints it: rounded to nine decimal places, so `0.07 * 100` prints `7`, with a
/// comma between each group of three integer digits from 1,000 up.
pub fn prose_number(n: f64) -> String {
    let text = js_number((n * 1e9).round() / 1e9);
    let (sign, digits) = text
        .strip_prefix('-')
        .map_or(("", text.as_str()), |d| ("-", d));
    let (int, frac) = digits.split_once('.').map_or((digits, ""), |(i, f)| (i, f));
    if int.len() < 4 || !int.bytes().all(|b| b.is_ascii_digit()) {
        return text;
    }
    let mut grouped = String::new();
    for (i, c) in int.chars().enumerate() {
        if i > 0 && (int.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(c);
    }
    if frac.is_empty() {
        format!("{sign}{grouped}")
    } else {
        format!("{sign}{grouped}.{frac}")
    }
}

/// JavaScript's `String(n)` for a number.
pub fn js_number(n: f64) -> String {
    if n.is_nan() {
        return "NaN".into();
    }
    if n.is_infinite() {
        return if n > 0.0 { "Infinity" } else { "-Infinity" }.into();
    }
    if n == 0.0 {
        return "0".into();
    }
    let sign = if n < 0.0 { "-" } else { "" };
    // Rust's `{:e}` gives the shortest digits that round-trip, as JavaScript does.
    let e = format!("{:e}", n.abs());
    let (mantissa, exp) = e.split_once('e').unwrap();
    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let k = digits.len() as i32;
    let n_exp = exp.parse::<i32>().unwrap() + 1;
    let body = if k <= n_exp && n_exp <= 21 {
        format!("{digits}{}", "0".repeat((n_exp - k) as usize))
    } else if 0 < n_exp && n_exp <= 21 {
        format!(
            "{}.{}",
            &digits[..n_exp as usize],
            &digits[n_exp as usize..]
        )
    } else if -6 < n_exp && n_exp <= 0 {
        format!("0.{}{digits}", "0".repeat((-n_exp) as usize))
    } else {
        let e = n_exp - 1;
        let sign = if e < 0 { '-' } else { '+' };
        if k == 1 {
            format!("{digits}e{sign}{}", e.abs())
        } else {
            format!("{}.{}e{sign}{}", &digits[..1], &digits[1..], e.abs())
        }
    };
    format!("{sign}{body}")
}

/// The double a ratio's decimal literal parses to, as the generated TypeScript writes it.
pub fn ratio(r: Ratio) -> Result<f64, String> {
    let text = r
        .decimal()
        .ok_or_else(|| format!("{r} has no finite decimal form"))?;
    text.parse::<f64>()
        .map_err(|_| format!("`{text}` is not a number"))
}

/// Every value the catalog exports, evaluated on demand and cached.
pub struct Values<'a> {
    catalog: &'a Catalog,
    defs: BTreeMap<&'a str, &'a Def>,
    /// `:ids` arrays, by export name, to the def that declares them.
    ids: BTreeMap<&'a str, &'a Def>,
    cache: RefCell<BTreeMap<String, V>>,
    /// Exports being evaluated, to report a cycle instead of overflowing the stack.
    active: RefCell<Vec<String>>,
}

impl<'a> Values<'a> {
    pub fn new(catalog: &'a Catalog) -> Values<'a> {
        let mut defs = BTreeMap::new();
        let mut ids = BTreeMap::new();
        for def in &catalog.defs {
            defs.insert(def.export.as_str(), def);
            if let Some(name) = &def.ids {
                ids.insert(name.as_str(), def);
            }
        }
        Values {
            catalog,
            defs,
            ids,
            cache: RefCell::default(),
            active: RefCell::default(),
        }
    }

    /// The export a content name reads: `db-engines` or `DB_ENGINES` reads `DB_ENGINES`.
    pub fn export(&self, name: &str) -> String {
        if self.defs.contains_key(name) || self.ids.contains_key(name) || is_typed(name) {
            return name.to_string();
        }
        crate::lower::constant(name)
    }

    /// Whether `name` names a value qmc can evaluate.
    pub fn has(&self, name: &str) -> bool {
        let name = self.export(name);
        self.defs.contains_key(name.as_str())
            || self.ids.contains_key(name.as_str())
            || is_typed(&name)
            || state_tuples(self.catalog).contains(&name)
    }

    /// The value of an export, by content or export name.
    pub fn get(&self, name: &str) -> Result<V, String> {
        let name = self.export(name);
        if let Some(v) = self.cache.borrow().get(&name) {
            return Ok(v.clone());
        }
        if self.active.borrow().contains(&name) {
            return Err(format!("`{name}` reads itself"));
        }
        self.active.borrow_mut().push(name.clone());
        let value = self.compute(&name);
        self.active.borrow_mut().pop();
        let value = value?;
        self.cache.borrow_mut().insert(name, value.clone());
        Ok(value)
    }

    fn compute(&self, name: &str) -> Result<V, String> {
        if let Some(def) = self.defs.get(name) {
            return self.datum(&def.value.kind);
        }
        if let Some(def) = self.ids.get(name) {
            let table = self.get(&def.export)?;
            return Ok(V::Arr(
                keys_of(&table, def.key.as_deref())
                    .into_iter()
                    .map(V::Str)
                    .collect(),
            ));
        }
        self.typed(name)
            .ok_or_else(|| format!("there is no value `{name}`"))?
    }

    /// The value of a datum: a def's value, or part of one.
    pub fn datum(&self, d: &D) -> Result<V, String> {
        Ok(match d {
            D::Num(r) => V::Num(ratio(*r)?),
            D::Str(s) => V::Str(s.clone()),
            D::Bool(b) => V::Bool(*b),
            D::Null => V::Null,
            D::Undefined => V::Undefined,
            D::Inf => V::Num(f64::INFINITY),
            D::Ref(name) => self.get(&name.text)?,
            D::Member(base, path) => {
                let mut v = self.get(&base.text)?;
                for key in path {
                    v = match key {
                        Key::Name(k) => v.get(k).clone(),
                        Key::Index(i) => v.get(&i.to_string()).clone(),
                    };
                }
                v
            }
            D::Era(name) => {
                let index = self
                    .catalog
                    .eras
                    .iter()
                    .position(|e| e.id.text == name.text)
                    .ok_or_else(|| format!("there is no Era `{}`", name.text))?;
                V::Num(index as f64)
            }
            D::Array(items) => {
                let mut out = Vec::new();
                for (spread, item) in items {
                    let value = self.datum(&item.kind)?;
                    if *spread {
                        match value {
                            V::Arr(inner) => out.extend(inner),
                            other => {
                                return Err(format!(
                                    "cannot spread {} into a list",
                                    other.describe()
                                ))
                            }
                        }
                    } else {
                        out.push(value);
                    }
                }
                V::Arr(out)
            }
            D::Record(entries) => {
                let mut out = Vec::new();
                for entry in entries {
                    match entry {
                        Entry::Pair(key, value) => {
                            V::insert(&mut out, key.text.clone(), self.datum(&value.kind)?)
                        }
                        Entry::Spread(value) => match self.datum(&value.kind)? {
                            V::Obj(inner) => {
                                for (k, v) in inner {
                                    V::insert(&mut out, k, v);
                                }
                            }
                            V::Null | V::Undefined => {}
                            other => {
                                return Err(format!(
                                    "cannot spread {} into a record",
                                    other.describe()
                                ))
                            }
                        },
                    }
                }
                V::Obj(out)
            }
            D::Neg(value) => V::Num(-self.number(&value.kind)?),
            D::Op(op, operands) => {
                let mut acc = self.number(&operands[0].kind)?;
                for operand in &operands[1..] {
                    let n = self.number(&operand.kind)?;
                    acc = match op {
                        '+' => acc + n,
                        '-' => acc - n,
                        '*' => acc * n,
                        _ => acc / n,
                    };
                }
                V::Num(acc)
            }
            D::As(_, value) | D::Mix(value) => self.datum(&value.kind)?,
            D::Text(pieces) => {
                let mut out = String::new();
                for piece in pieces {
                    out.push_str(&piece.text);
                    if let Some(hole) = &piece.hole {
                        out.push_str(&self.hole(hole)?);
                    }
                }
                V::Str(out)
            }
        })
    }

    /// A `(text …)` hole, printed. A property name on a list finds the item whose `id` is that
    /// name. `ERAS` has no `id` field, so on `eras` the name is an Era id: `eras.garage` reads
    /// the Garage Era.
    fn hole(&self, hole: &Hole) -> Result<String, String> {
        let (base, path): (&str, &[Key]) = match &hole.value.kind {
            D::Ref(name) => (&name.text, &[]),
            D::Member(name, path) => (&name.text, path),
            _ => unreachable!("a hole reads a name or a path"),
        };
        let mut v = self.get(base)?;
        for key in path {
            v = match (key, &v) {
                (Key::Name(id), V::Arr(items)) => items
                    .iter()
                    .find(|item| item.get("id") == &V::Str(id.clone()))
                    .or_else(|| {
                        (self.export(base) == "ERAS")
                            .then(|| self.catalog.era_index(id))
                            .flatten()
                            .and_then(|i| items.get(i))
                    })
                    .cloned()
                    .unwrap_or(V::Undefined),
                (Key::Name(k), _) => v.get(k).clone(),
                (Key::Index(i), _) => v.get(&i.to_string()).clone(),
            };
            if v.is_missing() {
                return Err(format!("`{{{}}}` reads nothing", hole.source));
            }
        }
        match (v, hole.format) {
            (V::Num(n), Format::Number) => Ok(prose_number(n)),
            (V::Num(n), Format::Percent) => Ok(format!("{}%", prose_number(n * 100.0))),
            (V::Num(n), Format::Times) => Ok(format!("{}×", prose_number(n))),
            (V::Str(s), Format::Number) => Ok(s),
            (other, _) => Err(format!(
                "`{{{}}}` reads {}; a hole prints a number{}",
                hole.source,
                other.describe(),
                if hole.format == Format::Number {
                    " or a string"
                } else {
                    ""
                }
            )),
        }
    }

    fn number(&self, d: &D) -> Result<f64, String> {
        match self.datum(d)? {
            V::Num(n) => Ok(n),
            other => Err(format!(
                "arithmetic needs a number, found {}",
                other.describe()
            )),
        }
    }

    /// A value written in a domain form: a string, a number in its base unit, or a reference.
    pub fn value(&self, v: &Value) -> Result<V, String> {
        Ok(match v {
            Value::Str(s) => V::Str(s.clone()),
            Value::Num(n) => V::Num(ratio(n.base())?),
            Value::Const(name) => self.get(&name.text)?,
            Value::Ref(path) => {
                let mut out = self.get(&path[0].text)?;
                for part in &path[1..] {
                    out = out.get(&part.text).clone();
                }
                out
            }
        })
    }

    fn number_in(&self, n: &Number, unit: Unit) -> Result<V, String> {
        Ok(V::Num(ratio(n.in_unit(unit))?))
    }

    /// The typed exports the TypeScript emitter writes from domain forms. Each field follows the
    /// emitter's defaults, so both outputs describe the same catalog.
    fn typed(&self, name: &str) -> Option<Result<V, String>> {
        let c = self.catalog;
        let strings = |items: &mut dyn Iterator<Item = &str>| {
            V::Arr(items.map(|s| V::Str(s.to_string())).collect())
        };
        Some(Ok(match name {
            "REQUEST_KINDS" => strings(&mut c.request_kinds.iter().map(|k| k.text.as_str())),
            "BACKEND_KINDS" => strings(&mut c.backend_kinds.iter().map(|k| k.text.as_str())),
            "DATA_KINDS" => strings(&mut c.data_kinds.iter().map(|k| k.text.as_str())),
            "COMPONENT_IDS" => strings(&mut c.components.iter().map(|x| x.id.text.as_str())),
            "RESEARCH_IDS" => strings(&mut c.research.iter().map(|x| x.id.text.as_str())),
            "INCIDENT_IDS" => strings(&mut c.incidents.iter().map(|x| x.id.text.as_str())),
            "FALLACY_IDS" => strings(&mut c.fallacies.iter().map(|x| x.text.as_str())),
            "STUDY_SHAPE_KINDS" => strings(&mut c.shape_kinds.iter().map(|x| x.name.text.as_str())),
            "TLS_TERMINATORS" => self.flagged("tls"),
            "GLOBAL_COMPONENTS" => self.flagged("global"),
            "ZONE_SPANNING_COMPONENTS" => self.flagged("zone-spanning"),
            "STANDBY_TYPES" => self.flagged("standby"),
            "FLAT_CAPACITY" => {
                let mut out = Vec::new();
                for x in &c.components {
                    if let Some(capacity) = &x.capacity {
                        let n = match capacity {
                            Some(n) => match ratio(n.value.base()).map(V::Num) {
                                Ok(v) => v,
                                Err(e) => return Some(Err(e)),
                            },
                            None => V::Num(f64::INFINITY),
                        };
                        out.push((x.id.text.clone(), n));
                    }
                }
                V::Obj(out)
            }
            "COMPONENTS" => {
                let mut out = Vec::new();
                for x in &c.components {
                    match self.component(x) {
                        Ok(v) => out.push((x.id.text.clone(), v)),
                        Err(e) => return Some(Err(e)),
                    }
                }
                V::Obj(out)
            }
            "ERAS" => {
                let mut out = Vec::new();
                for era in &c.eras {
                    match self.era(era) {
                        Ok(v) => out.push(v),
                        Err(e) => return Some(Err(e)),
                    }
                }
                V::Arr(out)
            }
            "INCIDENTS" => {
                let mut out = Vec::new();
                for i in &c.incidents {
                    match self.incident(i) {
                        Ok(v) => out.push((i.id.text.clone(), v)),
                        Err(e) => return Some(Err(e)),
                    }
                }
                V::Obj(out)
            }
            "RESEARCH_LIST" => {
                let mut out = Vec::new();
                for r in &c.research {
                    match self.research(r) {
                        Ok(v) => out.push(v),
                        Err(e) => return Some(Err(e)),
                    }
                }
                V::Arr(out)
            }
            "FRAMEWORK_UNLOCKS" => V::Obj(
                c.research
                    .iter()
                    .filter_map(|r| {
                        let fw = r.unlocks_framework.as_ref()?;
                        Some((fw.text.clone(), V::Str(r.id.text.clone())))
                    })
                    .collect(),
            ),
            _ => return self.state_values(name),
        }))
    }

    /// A state field's `:values` tuple, as `emit_ts::states` writes it.
    fn state_values(&self, name: &str) -> Option<Result<V, String>> {
        let field = self
            .catalog
            .states
            .iter()
            .flat_map(|s| &s.fields)
            .find(|f| f.values_name.as_ref().is_some_and(|n| n.text == name))?;
        Some(match &field.ty {
            crate::lower::StateType::Enum(values) => Ok(V::Arr(
                values.iter().map(|v| V::Str(v.value.clone())).collect(),
            )),
            crate::lower::StateType::OneOf(values) => values
                .iter()
                .map(|v| ratio(v.value.base()).map(V::Num))
                .collect::<Result<Vec<_>, _>>()
                .map(V::Arr),
            _ => return None,
        })
    }

    fn era_index(&self, id: &str) -> Result<V, String> {
        self.catalog
            .era_index(id)
            .map(|i| V::Num(i as f64))
            .ok_or_else(|| format!("there is no Era `{id}`"))
    }

    /// One entry of `INCIDENTS`, as `emit_ts::incidents` writes it.
    fn incident(&self, i: &crate::lower::Incident) -> Result<V, String> {
        let n = |n: &crate::lower::Spanned<Number>| ratio(n.value.base()).map(V::Num);
        Ok(V::Obj(vec![
            ("id".into(), V::Str(i.id.text.clone())),
            ("name".into(), self.value(&i.name.value)?),
            ("era".into(), self.era_index(&i.era.value.text)?),
            ("severity".into(), n(&i.severity)?),
            (
                "escalatesTo".into(),
                match &i.escalates_to {
                    Some(e) => n(e)?,
                    None => V::Null,
                },
            ),
            (
                "duration".into(),
                self.number_in(&i.duration.value, Unit::S)?,
            ),
            ("cause".into(), self.value(&i.cause.value)?),
            ("prevention".into(), self.value(&i.prevention.value)?),
            (
                "actions".into(),
                V::Arr(i.actions.iter().map(|a| V::Str(a.text.clone())).collect()),
            ),
        ]))
    }

    /// One entry of `RESEARCH_LIST`, as `emit_ts::research` writes it.
    fn research(&self, r: &crate::lower::Research) -> Result<V, String> {
        Ok(V::Obj(vec![
            ("id".into(), V::Str(r.id.text.clone())),
            ("name".into(), self.value(&r.name.value)?),
            ("track".into(), V::Str(r.track.text.clone())),
            ("cost".into(), V::Num(ratio(r.cost.value.value)?)),
            ("era".into(), self.era_index(&r.era.value.text)?),
            (
                "requires".into(),
                V::Arr(r.requires.iter().map(|q| V::Str(q.text.clone())).collect()),
            ),
            ("blurb".into(), self.value(&r.blurb.value)?),
        ]))
    }

    fn flagged(&self, flag: &str) -> V {
        V::Arr(
            self.catalog
                .components
                .iter()
                .filter(|x| x.has(flag))
                .map(|x| V::Str(x.id.text.clone()))
                .collect(),
        )
    }

    /// One entry of `COMPONENTS`, as `emit_ts::components` writes it.
    fn component(&self, x: &Component) -> Result<V, String> {
        let kinds = |list: &Option<crate::lower::KindList>| {
            V::Arr(
                list.iter()
                    .flat_map(|l| l.resolve(self.catalog))
                    .map(|k| V::Str(k.to_string()))
                    .collect(),
            )
        };
        let or = |n: &Option<crate::lower::Spanned<Number>>, default: f64| match n {
            Some(n) => ratio(n.value.base()).map(V::Num),
            None => Ok(V::Num(default)),
        };
        let latency = match &x.latency.value {
            Value::Num(n) => self.number_in(n, Unit::Ms)?,
            other => self.value(other)?,
        };
        let flag = |name: &str| V::Bool(x.has(name));
        Ok(V::Obj(vec![
            ("id".into(), V::Str(x.id.text.clone())),
            ("code".into(), V::Str(x.code.text.clone())),
            ("name".into(), self.value(&x.name.value)?),
            ("product".into(), self.value(&x.product.value)?),
            ("group".into(), V::Str(x.group.text.clone())),
            ("blurb".into(), self.value(&x.blurb.value)?),
            ("cost".into(), V::Num(ratio(x.cost.value.base())?)),
            ("burn".into(), or(&x.burn, 0.0)?),
            ("sized".into(), flag("sized")),
            ("steps".into(), or(&x.steps, 1.0)?),
            ("latency".into(), latency),
            ("accepts".into(), kinds(&x.accepts)),
            ("sends".into(), kinds(&x.sends)),
            ("fallback".into(), kinds(&x.fallback)),
            ("stack".into(), flag("stack")),
            ("limiting".into(), flag("limiting")),
            ("coldStart".into(), flag("cold-start")),
            ("maxOut".into(), or(&x.max_out, 99.0)?),
            ("tap".into(), flag("tap")),
            ("mirror".into(), flag("mirror")),
            ("control".into(), flag("control")),
            (
                "unlock".into(),
                x.unlock
                    .as_ref()
                    .map_or(V::Null, |u| V::Str(u.text.clone())),
            ),
            ("fixed".into(), flag("fixed")),
        ]))
    }

    /// One entry of `ERAS`, as `emit_ts::eras` writes it.
    fn era(&self, era: &crate::lower::Era) -> Result<V, String> {
        let n = |n: &crate::lower::Spanned<Number>| ratio(n.value.base()).map(V::Num);
        let seconds = |n: &crate::lower::Spanned<Number>| self.number_in(&n.value, Unit::S);
        Ok(V::Obj(vec![
            ("name".into(), self.value(&era.name.value)?),
            ("market".into(), n(&era.market)?),
            (
                "raiseAt".into(),
                match &era.raise_at {
                    Some(r) => n(r)?,
                    None => V::Num(f64::INFINITY),
                },
            ),
            ("grant".into(), n(&era.grant)?),
            ("dilution".into(), n(&era.dilution)?),
            ("growth".into(), n(&era.growth)?),
            ("apdexTarget".into(), n(&era.apdex_target)?),
            ("costIndex".into(), n(&era.cost_index)?),
            ("salaryIndex".into(), n(&era.salary_index)?),
            ("slo".into(), n(&era.slo)?),
            (
                "incidentInterval".into(),
                match &era.incident_every {
                    Some(every) => seconds(every)?,
                    None => V::Num(0.0),
                },
            ),
            ("maxSeverity".into(), n(&era.max_severity)?),
            ("mix".into(), self.mix(era)?),
            ("question".into(), self.value(&era.question.value)?),
            ("arrivals".into(), self.value(&era.arrivals.value)?),
        ]))
    }

    fn mix(&self, era: &crate::lower::Era) -> Result<V, String> {
        let mix = match &era.mix {
            crate::lower::MixRef::Inline(mix) => mix,
            crate::lower::MixRef::Named(name) => self
                .catalog
                .mixes
                .iter()
                .find(|m| m.name.as_ref().is_some_and(|n| n.text == name.text))
                .ok_or_else(|| format!("there is no mix `{}`", name.text))?,
        };
        let mut out = Vec::new();
        for (kind, share) in &mix.shares {
            out.push((kind.text.clone(), V::Num(ratio(share.value.base())?)));
        }
        Ok(V::Obj(out))
    }
}

/// The exports `Values` builds from domain forms rather than from a def.
pub const TYPED: &[&str] = &[
    "REQUEST_KINDS",
    "BACKEND_KINDS",
    "DATA_KINDS",
    "COMPONENT_IDS",
    "RESEARCH_IDS",
    "INCIDENT_IDS",
    "FALLACY_IDS",
    "STUDY_SHAPE_KINDS",
    "TLS_TERMINATORS",
    "GLOBAL_COMPONENTS",
    "ZONE_SPANNING_COMPONENTS",
    "STANDBY_TYPES",
    "FLAT_CAPACITY",
    "COMPONENTS",
    "ERAS",
    "INCIDENTS",
    "RESEARCH_LIST",
    "FRAMEWORK_UNLOCKS",
];

fn is_typed(name: &str) -> bool {
    TYPED.contains(&name)
}

/// The `:values` tuples state fields declare.
pub fn state_tuples(catalog: &Catalog) -> Vec<String> {
    catalog
        .states
        .iter()
        .flat_map(|s| &s.fields)
        .filter_map(|f| f.values_name.as_ref().map(|n| n.text.clone()))
        .collect()
}

/// The row keys of a keyed table: a record's keys, or each row's `key` field in an array.
pub fn keys_of(table: &V, key: Option<&str>) -> Vec<String> {
    match (table, key) {
        (V::Arr(rows), Some(key)) => rows
            .iter()
            .filter_map(|row| match row.get(key) {
                V::Str(s) => Some(s.clone()),
                _ => None,
            })
            .collect(),
        _ => table.keys(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_print_as_javascript_prints_them() {
        for (n, text) in [
            (0.1 + 0.2, "0.30000000000000004"),
            (1e21, "1e+21"),
            (123456789012345680000.0, "123456789012345680000"),
            (0.000001, "0.000001"),
            (1e-7, "1e-7"),
            (-2.5, "-2.5"),
            (100.0, "100"),
        ] {
            assert_eq!(js_number(n), text);
        }
    }

    #[test]
    fn keys_follow_javascript_order_and_spreads_keep_the_first_position() {
        let obj = V::Obj(vec![
            ("b".into(), V::Num(1.0)),
            ("10".into(), V::Num(2.0)),
            ("2".into(), V::Num(3.0)),
            ("a".into(), V::Num(4.0)),
        ]);
        assert_eq!(obj.keys(), ["2", "10", "b", "a"]);
    }
}
