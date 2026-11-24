//! Writes the Solver's `catalog.rs`: every scalar of the Simulation's catalog, the tables the
//! solve reads, and `CATALOG_HASH`, which the Simulation checks before it trusts the module.
//!
//! The values come from the generated TypeScript through `tsval`, and numbers print as
//! JavaScript prints them, so this writes the same bytes the old TypeScript generator did.

use crate::tsval::{format_number_plain, Env, J};
use std::collections::BTreeSet;

struct Out {
    lines: Vec<String>,
}

impl Out {
    fn push(&mut self, line: impl Into<String>) {
        self.lines.push(line.into());
    }
}

/// `formatNumber` of the old generator.
fn num(v: &J) -> String {
    match v {
        J::Num(n) if *n == f64::INFINITY => "f64::INFINITY".into(),
        J::Num(n) if *n == f64::NEG_INFINITY => "f64::NEG_INFINITY".into(),
        J::Num(n) if n.fract() == 0.0 => format!("{}.0", format_number_plain(*n)),
        J::Num(n) => format_number_plain(*n),
        other => text(other),
    }
}

/// JavaScript's `String(v)` for a scalar, as a template literal prints it.
fn text(v: &J) -> String {
    match v {
        J::Num(n) => format_number_plain(*n),
        J::Str(s) => s.clone(),
        J::Bool(b) => b.to_string(),
        J::Null => "null".into(),
        J::Undefined => "undefined".into(),
        J::Arr(items) => items.iter().map(joined).collect::<Vec<_>>().join(","),
        J::Obj(_) => "[object Object]".into(),
    }
}

/// How `Array.prototype.join` prints an item: `null` and `undefined` are empty.
fn joined(v: &J) -> String {
    match v {
        J::Null | J::Undefined => String::new(),
        v => text(v),
    }
}

fn join(items: impl IntoIterator<Item = String>) -> String {
    items.into_iter().collect::<Vec<_>>().join(", ")
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

fn const_name(id: &str) -> String {
    let name: String = id
        .chars()
        .flat_map(char::to_uppercase)
        .map(|c| {
            if c.is_ascii_uppercase() || c.is_ascii_digit() {
                c
            } else {
                '_'
            }
        })
        .collect();
    if name.starts_with(|c: char| c.is_ascii_digit()) {
        format!("_{name}")
    } else {
        name
    }
}

/// `snake`: `connectionKB` to `CONNECTION_KB`.
fn snake(field: &str) -> String {
    let chars: Vec<char> = field.chars().collect();
    let mut o = String::new();
    for (i, c) in chars.iter().enumerate() {
        if i > 0
            && c.is_ascii_uppercase()
            && (chars[i - 1].is_ascii_lowercase() || chars[i - 1].is_ascii_digit())
        {
            o.push('_');
        }
        o.push(*c);
    }
    const_name(&o)
}

fn strings(v: &J) -> Vec<String> {
    v.items().iter().map(text).collect()
}

fn quoted(ids: &[String]) -> String {
    join(ids.iter().map(|id| format!("\"{id}\"")))
}

impl Out {
    fn ids(&mut self, module: &str, ids: &[String]) {
        self.push(format!("pub mod {module} {{"));
        for (index, id) in ids.iter().enumerate() {
            self.push(format!(
                "    pub const {}: usize = {index};",
                const_name(id)
            ));
        }
        self.push("}");
    }

    /// Declares an enum of the distinct values, in first-seen order, and returns their variants.
    fn enumeration(&mut self, name: &str, values: &[String]) -> Vec<(String, String)> {
        let mut variants: Vec<(String, String)> = Vec::new();
        for value in values {
            if variants.iter().any(|(v, _)| v == value) {
                continue;
            }
            // `/(^|[-_])([a-z])/g` to the upper-case letter: a separator goes only before a
            // lower-case letter.
            let chars: Vec<char> = value.chars().collect();
            let mut variant = String::new();
            let mut i = 0;
            while i < chars.len() {
                let c = chars[i];
                let next = chars.get(i + 1).copied().unwrap_or(' ');
                if (c == '-' || c == '_') && next.is_ascii_lowercase() {
                    variant.push(next.to_ascii_uppercase());
                    i += 2;
                } else {
                    variant.push(if i == 0 { c.to_ascii_uppercase() } else { c });
                    i += 1;
                }
            }
            variants.push((value.clone(), variant));
        }
        self.push("#[derive(Clone, Copy, PartialEq, Eq, Debug)]");
        self.push(format!("pub enum {name} {{"));
        for (_, variant) in &variants {
            self.push(format!("    {variant},"));
        }
        self.push("}");
        variants
    }

    fn table(&mut self, env: &Env, name: &str, module: Option<&str>) {
        let table = env.get(name);
        let single = !matches!(table, J::Arr(_)) && table.values().iter().all(|v| !v.is_object());
        let rows: Vec<J> = match &table {
            J::Arr(items) => items.clone(),
            _ if single => vec![table.clone()],
            _ => table.values().into_iter().cloned().collect(),
        };
        self.push("");
        if let Some(module) = module {
            self.ids(module, &table.keys());
        }
        let fields = rows.first().map(J::keys).unwrap_or_default();
        for field in fields {
            let values: Vec<&J> = rows.iter().map(|r| r.get(&field)).collect();
            let column = format!("{name}_{}", snake(&field));
            let n = rows.len();
            if values.iter().all(|v| matches!(v, J::Num(_))) {
                self.push(format!(
                    "pub static {column}: [f64; {n}] = [{}];",
                    join(values.iter().map(|v| num(v)))
                ));
            } else if values.iter().all(|v| matches!(v, J::Bool(_))) {
                self.push(format!(
                    "pub static {column}: [bool; {n}] = [{}];",
                    join(values.iter().map(|v| text(v)))
                ));
            } else if field != "name" && values.iter().all(|v| matches!(v, J::Str(_))) {
                self.push(format!(
                    "pub static {column}: [&str; {n}] = [{}];",
                    join(values.iter().map(|v| json(v.str().unwrap())))
                ));
            }
        }
    }
}

const DEFINED_LATER: &[&str] = &[
    "RUNTIME_IDS",
    "LANGUAGE_IDS",
    "FRAMEWORK_IDS",
    "COMPONENT_IDS",
    "RESEARCH_IDS",
    "KINDS",
    "PROFILES",
    "RUNTIMES",
    "FRAMEWORKS",
    "LANGUAGES",
    "COMPONENTS",
    "DB_ENGINES",
    "COLLECTORS",
    "STORAGE_IOPS",
    "DB_RETENTIONS",
    "SHARD_KEYS",
    "CDN_TTLS",
    "GOGC",
];

const TABLES: &[(&str, Option<&str>)] = &[
    ("SEARCH_VARIANTS", Some("search_variant")),
    ("SEARCH_HEAPS", Some("search_heap")),
    ("SEARCH_REFRESH", None),
    ("STORAGE_CLASSES", Some("storage_class")),
    ("GPU_TYPES", Some("gpu_type")),
    ("GPU_MODELS", Some("gpu_model")),
    ("GPU_PRECISIONS", Some("gpu_precision")),
    ("GPU_BATCHES", None),
    ("CACHE_ENGINES", Some("cache_engine")),
    ("CACHE_TTLS", None),
    ("CACHE_STRATEGIES", Some("cache_strategy")),
    ("PARANOIA", None),
    ("UNDER_ATTACK", None),
    ("VEC_INDEXES", Some("vec_index")),
    ("CACHE_KEYS", Some("cache_key")),
    ("LOG_ACKS", None),
];

/// The Solver catalog for the given generated modules. `namespace` is every name the
/// Simulation's `catalog.ts` exports; its scalars become constants.
pub fn catalog(modules: &[&str], namespace: &BTreeSet<String>) -> String {
    let env = Env::new(modules.iter().copied());
    let mut o = Out { lines: Vec::new() };
    let request = strings(&env.get("REQUEST_KINDS"));
    let backend = strings(&env.get("BACKEND_KINDS"));
    let all: Vec<String> = request.iter().chain(&backend).cloned().collect();
    let (nk, nr, nb) = (all.len(), request.len(), backend.len());
    let kind_index = |k: &str| all.iter().position(|x| x == k);
    let request_index = |k: &str| request.iter().position(|x| x == k);

    o.push(format!("pub const NK: usize = {nk};"));
    o.push(format!("pub const NR: usize = {nr};"));
    o.push(format!("pub const NB: usize = {nb};"));
    o.push("");
    o.push(format!(
        "pub static KINDS: [&str; NK] = [{}];",
        quoted(&all)
    ));
    o.push("");
    o.ids("kind", &all);
    o.ids("backend", &backend);
    o.push("");
    o.push("pub fn is_request_kind(kind: usize) -> bool {");
    o.push(format!("    kind < {nr}"));
    o.push("}");

    o.push("");
    let mut scalars = 0;
    // A module namespace lists its exports in code unit order.
    for name in namespace {
        if DEFINED_LATER.contains(&name.as_str()) || !env.has(name) {
            continue;
        }
        let upper = name.to_uppercase();
        let value = env.get(name);
        let line = match &value {
            J::Num(n) if n.is_finite() => format!("pub const {upper}: f64 = {};", num(&value)),
            J::Bool(b) => format!("pub const {upper}: bool = {b};"),
            J::Str(s) => format!("pub const {upper}: &str = \"{s}\";"),
            J::Arr(items) if items.iter().all(|i| matches!(i, J::Num(_))) => format!(
                "pub static {upper}: [f64; {}] = [{}];",
                items.len(),
                join(items.iter().map(num))
            ),
            J::Arr(items) if items.iter().all(|i| matches!(i, J::Str(_))) => format!(
                "pub static {upper}: [&str; {}] = [{}];",
                items.len(),
                quoted(&strings(&value))
            ),
            _ => continue,
        };
        o.push(line);
        scalars += 1;
    }
    o.push(format!("pub static SCALAR_COUNT: usize = {scalars};"));

    o.push("");
    for (name, module) in TABLES {
        o.table(&env, name, *module);
    }

    let sparse = |record: &J, total: usize| -> Vec<String> {
        let mut row = vec!["0.0".to_string(); total];
        for key in record.keys() {
            if let Some(i) = kind_index(&key) {
                row[i] = num(record.get(&key));
            }
        }
        row
    };

    o.push("");
    let profiles = env.get("PROFILES");
    let per_request = |field: &str, f: &dyn Fn(&J) -> String| -> String {
        join(request.iter().map(|k| f(profiles.get(k).get(field))))
    };
    for (field, column, ty) in [
        ("cpu", "CPU", "f64"),
        ("native", "NATIVE", "bool"),
        ("apdex", "APDEX", "f64"),
        ("offload", "OFFLOAD", "f64"),
        ("inKB", "IN_KB", "f64"),
        ("payloadKB", "PAYLOAD_KB", "f64"),
        ("asyncKB", "ASYNC_KB", "f64"),
        ("orm", "ORM", "bool"),
        ("scored", "SCORED", "bool"),
        ("compressible", "COMPRESSIBLE", "bool"),
        ("stream", "STREAM", "bool"),
    ] {
        let row = if ty == "f64" {
            per_request(field, &num)
        } else {
            per_request(field, &joined)
        };
        o.push(format!(
            "pub static PROFILE_{column}: [{ty}; NR] = [{row}];"
        ));
    }
    o.push(format!(
        "pub static PROFILE_COMPLETION: [f64; NR] = [{}];",
        per_request("completion", &|v| num(v.or(&J::Num(0.0))))
    ));
    for (field, column) in [("calls", "CALLS"), ("asyncCalls", "ASYNC_CALLS")] {
        o.push(format!("pub static PROFILE_{column}: [[f64; NK]; NR] = ["));
        for k in &request {
            o.push(format!(
                "    [{}],",
                join(sparse(profiles.get(k).get(field), nk))
            ));
        }
        o.push("];");
    }

    o.push("");
    let kinds = env.get("KINDS");
    o.push(format!(
        "pub static KIND_VALUE: [f64; NK] = [{}];",
        join(
            all.iter()
                .map(|k| num(kinds.get(k).get("value").or(&J::Num(0.0))))
        )
    ));

    o.push("");
    let runtime_ids = strings(&env.get("RUNTIME_IDS"));
    let language_ids = strings(&env.get("LANGUAGE_IDS"));
    let nrt = runtime_ids.len();
    o.push(format!("pub const RUNTIME_COUNT: usize = {nrt};"));
    o.push(format!(
        "pub static RUNTIME_IDS: [&str; {nrt}] = [{}];",
        quoted(&runtime_ids)
    ));
    o.ids("runtime", &runtime_ids);
    let runtimes = env.get("RUNTIMES");
    let rt = |id: &String| runtimes.get(id);
    o.push(format!(
        "pub static RUNTIME_LANGUAGE: [usize; {nrt}] = [{}];",
        join(runtime_ids.iter().map(|id| {
            let lang = text(rt(id).get("language"));
            language_ids
                .iter()
                .position(|l| *l == lang)
                .map_or("-1".to_string(), |i| i.to_string())
        }))
    ));
    let models: Vec<String> = runtime_ids
        .iter()
        .map(|id| text(rt(id).get("model")))
        .collect();
    let concurrency = o.enumeration("Concurrency", &models);
    let variant = |variants: &[(String, String)], v: &str| {
        variants
            .iter()
            .find(|(k, _)| k == v)
            .map(|(_, x)| x.clone())
            .unwrap()
    };
    o.push(format!(
        "pub static RUNTIME_MODEL: [Concurrency; {nrt}] = [{}];",
        join(
            models
                .iter()
                .map(|m| format!("Concurrency::{}", variant(&concurrency, m)))
        )
    ));
    let column = |o: &mut Out, name: &str, ty: &str, f: &dyn Fn(&J) -> String| {
        o.push(format!(
            "pub static {name}: [{ty}; {nrt}] = [{}];",
            join(runtime_ids.iter().map(|id| f(rt(id))))
        ));
    };
    column(&mut o, "RUNTIME_SPEED", "f64", &|r| num(r.get("speed")));
    column(&mut o, "RUNTIME_MEMORY_MB", "f64", &|r| {
        num(r.get("memoryMb"))
    });
    column(&mut o, "RUNTIME_POOL", "bool", &|r| joined(r.get("pool")));
    column(&mut o, "RUNTIME_THREADS", "f64", &|r| num(r.get("threads")));
    column(&mut o, "RUNTIME_PARALLEL", "bool", &|r| {
        joined(r.get("parallel"))
    });
    column(
        &mut o,
        "RUNTIME_CONNECTION_KB",
        "f64",
        &|r| match r.get("connectionKB") {
            J::Null => "-1.0".into(),
            v => num(v),
        },
    );
    column(&mut o, "RUNTIME_STARTUP_S", "f64", &|r| {
        num(r.get("startupSeconds"))
    });
    column(&mut o, "RUNTIME_WARM_FROM", "f64", &|r| {
        num(r.get("warmFrom"))
    });
    column(&mut o, "RUNTIME_WARMUP", "f64", &|r| num(r.get("warmup")));
    column(&mut o, "RUNTIME_OVERHEAD_FACTOR", "f64", &|r| {
        num(r.get("overheadFactor").or(&J::Num(1.0)))
    });
    column(&mut o, "RUNTIME_PERSISTENT", "bool", &|r| {
        joined(r.get("persistent"))
    });
    let none = J::Str("none".into());
    let blockings: Vec<String> = runtime_ids
        .iter()
        .map(|id| text(rt(id).get("blocking").or(&none)))
        .collect();
    let blocking = o.enumeration("Blocking", &blockings);
    o.push(format!(
        "pub static RUNTIME_BLOCKING: [Blocking; {nrt}] = [{}];",
        join(
            blockings
                .iter()
                .map(|b| format!("Blocking::{}", variant(&blocking, b)))
        )
    ));
    column(&mut o, "RUNTIME_CONNECTIONS", "f64", &|r| {
        num(r.get("connections").or(&J::Num(0.0)))
    });
    column(&mut o, "RUNTIME_VELOCITY", "f64", &|r| {
        num(r.get("velocity").or(&J::Num(1.0)))
    });
    column(&mut o, "RUNTIME_GC_PAUSE", "f64", &|r| {
        num(r.get("gc").get("pauseMs").or(&J::Num(-1.0)))
    });
    column(&mut o, "RUNTIME_GC_CPU", "f64", &|r| {
        num(r.get("gc").get("cpu").or(&J::Num(0.0)))
    });

    o.push("");
    let pm = env.get("PM_MODES");
    let pm_ids = ["static", "dynamic", "ondemand"];
    o.push(format!(
        "pub static PM_SPARES: [f64; 3] = [{}];",
        join(
            pm_ids
                .iter()
                .map(|id| num(pm.get(id).get("spares").or(&J::Num(-1.0))))
        )
    ));
    o.push(format!(
        "pub static PM_SPAWN_SHARE: [f64; 3] = [{}];",
        join(pm_ids.iter().map(|id| num(pm.get(id).get("spawnShare"))))
    ));
    o.push(format!(
        "pub static PM_SPAWN_MS: [f64; 3] = [{}];",
        join(pm_ids.iter().map(|id| num(pm.get(id).get("spawnMs"))))
    ));

    let nl = language_ids.len();
    o.push(format!("pub const LANGUAGE_COUNT: usize = {nl};"));
    o.push(format!(
        "pub static LANGUAGE_IDS: [&str; {nl}] = [{}];",
        quoted(&language_ids)
    ));
    o.ids("language", &language_ids);
    let languages = env.get("LANGUAGES");
    for (field, name) in [
        ("velocity", "LANGUAGE_VELOCITY"),
        ("sessionKB", "LANGUAGE_SESSION_KB"),
        ("armSpeed", "LANGUAGE_ARM_SPEED"),
    ] {
        o.push(format!(
            "pub static {name}: [f64; {nl}] = [{}];",
            join(
                language_ids
                    .iter()
                    .map(|id| num(languages.get(id).get(field)))
            )
        ));
    }
    o.push(format!(
        "pub static LANGUAGE_BLAST: [&str; {nl}] = [{}];",
        join(
            language_ids
                .iter()
                .map(|id| format!("\"{}\"", text(languages.get(id).get("blast"))))
        )
    ));

    o.push("");
    let framework_ids = strings(&env.get("FRAMEWORK_IDS"));
    let nf = framework_ids.len();
    o.push(format!("pub const FRAMEWORK_COUNT: usize = {nf};"));
    o.push(format!(
        "pub static FRAMEWORK_IDS: [&str; {nf}] = [{}];",
        quoted(&framework_ids)
    ));
    o.push("pub fn framework_index(name: &str) -> usize {");
    o.push("    match name {");
    for (index, id) in framework_ids.iter().enumerate() {
        o.push(format!("        \"{id}\" => {index},"));
    }
    o.push("        _ => 0,");
    o.push("    }");
    o.push("}");
    let frameworks = env.get("FRAMEWORKS");
    let fw = |o: &mut Out, name: &str, ty: &str, f: &dyn Fn(&J) -> String| {
        o.push(format!(
            "pub static {name}: [{ty}; {nf}] = [{}];",
            join(framework_ids.iter().map(|id| f(frameworks.get(id))))
        ));
    };
    fw(&mut o, "FRAMEWORK_OVERHEAD", "f64", &|f| {
        num(f.get("overhead"))
    });
    fw(&mut o, "FRAMEWORK_VELOCITY", "f64", &|f| {
        num(f.get("velocity"))
    });
    fw(&mut o, "FRAMEWORK_MEMORY_MB", "f64", &|f| {
        num(f.get("memoryMb"))
    });
    fw(&mut o, "FRAMEWORK_ORM", "bool", &|f| joined(f.get("orm")));
    fw(&mut o, "FRAMEWORK_ASGI", "bool", &|f| {
        joined(f.get("asgi").or(&J::Bool(false)))
    });
    fw(&mut o, "FRAMEWORK_CACHEABLE", "f64", &|f| {
        num(f.get("cacheable").or(&J::Num(0.0)))
    });
    fw(&mut o, "FRAMEWORK_WORKER_OVERHEAD", "f64", &|f| {
        num(f.get("workerOverhead").or(&J::Num(-1.0)))
    });
    for (field, name) in [("value", "FRAMEWORK_VALUE"), ("cpu", "FRAMEWORK_CPU")] {
        o.push(format!("pub static {name}: [[f64; NR]; {nf}] = ["));
        for id in &framework_ids {
            let mut row = vec!["1.0".to_string(); nr];
            let record = frameworks.get(id).get(field);
            for key in record.keys() {
                if let Some(i) = request_index(&key) {
                    row[i] = num(record.get(&key));
                }
            }
            o.push(format!("    [{}],", join(row)));
        }
        o.push("];");
    }

    o.push("");
    let db = env.get("DB_ENGINES");
    for (field, name) in [
        ("connections", "DB_CONNECTIONS"),
        ("connectionMB", "DB_CONNECTION_MB"),
        ("read", "DB_READ"),
        ("write", "DB_WRITE"),
        ("scan", "DB_SCAN"),
        ("searchCost", "DB_SEARCH_COST"),
        ("lag", "DB_LAG"),
    ] {
        o.push(format!(
            "pub static {name}: [f64; 2] = [{}];",
            join(
                ["postgres", "mysql"]
                    .iter()
                    .map(|id| num(db.get(id).get(field)))
            )
        ));
    }
    o.push("pub fn db_engine_index(name: &str) -> usize { if name == \"mysql\" { 1 } else { 0 } }");

    o.push("");
    let component_ids = strings(&env.get("COMPONENT_IDS"));
    let nc = component_ids.len();
    o.push(format!("pub const COMPONENT_COUNT: usize = {nc};"));
    o.push(format!(
        "pub static COMPONENT_IDS: [&str; {nc}] = [{}];",
        quoted(&component_ids)
    ));
    o.ids("component", &component_ids);
    let mask = |kinds: &J| -> String {
        let mut m: u128 = 0;
        for k in kinds.items() {
            if let Some(i) = kind_index(&text(k)) {
                m |= 1 << i;
            }
        }
        format!("0x{m:x}")
    };
    let components = env.get("COMPONENTS");
    for (field, name) in [
        ("accepts", "COMPONENT_ACCEPTS"),
        ("sends", "COMPONENT_SENDS"),
        ("fallback", "COMPONENT_FALLBACK"),
    ] {
        o.push(format!("pub static {name}: [u64; {nc}] = ["));
        for id in &component_ids {
            o.push(format!("    {},", mask(components.get(id).get(field))));
        }
        o.push("];");
    }
    let comp = |o: &mut Out, name: &str, ty: &str, f: &dyn Fn(&String, &J) -> String| {
        o.push(format!(
            "pub static {name}: [{ty}; {nc}] = [{}];",
            join(component_ids.iter().map(|id| f(id, components.get(id))))
        ));
    };
    comp(&mut o, "COMPONENT_STACK", "bool", &|_, c| {
        joined(c.get("stack"))
    });
    comp(&mut o, "COMPONENT_LIMITING", "bool", &|_, c| {
        joined(c.get("limiting"))
    });
    comp(&mut o, "COMPONENT_COLD_START", "bool", &|_, c| {
        joined(c.get("coldStart"))
    });
    comp(&mut o, "COMPONENT_TAP", "bool", &|_, c| {
        joined(c.get("tap"))
    });
    comp(&mut o, "COMPONENT_LATENCY", "f64", &|_, c| {
        num(c.get("latency").or(&J::Num(0.0)))
    });
    comp(
        &mut o,
        "COMPONENT_STEPS",
        "f64",
        &|_, c| num(c.get("steps")),
    );

    o.push("");
    let flat = env.get("FLAT_CAPACITY");
    comp(
        &mut o,
        "FLAT_CAPACITY",
        "f64",
        &|id, _| match flat.get(id) {
            J::Undefined => "0.0".into(),
            v => num(v),
        },
    );
    let global = strings(&env.get("GLOBAL_COMPONENTS"));
    let spanning = strings(&env.get("ZONE_SPANNING_COMPONENTS"));
    comp(&mut o, "COMPONENT_GLOBAL", "bool", &|id, _| {
        global.contains(id).to_string()
    });
    comp(&mut o, "COMPONENT_SPANS_ZONES", "bool", &|id, _| {
        spanning.contains(id).to_string()
    });
    comp(&mut o, "COMPONENT_FIXED", "bool", &|_, c| {
        joined(c.get("fixed"))
    });

    let regions = strings(&env.get("REGIONS"));
    let rtt = env.get("RTT");
    let rtt_of = |from: &str, to: &str| -> J {
        if from == to {
            return J::Num(0.0);
        }
        rtt.get(&format!("{from}-{to}"))
            .or(rtt.get(&format!("{to}-{from}")))
            .or(&J::Num(0.0))
            .clone()
    };
    let nreg = regions.len();
    o.push(format!(
        "pub static REGION_RTT: [[f64; {nreg}]; {nreg}] = [{}];",
        join(regions.iter().map(|from| format!(
            "[{}]",
            join(regions.iter().map(|to| num(&rtt_of(from, to))))
        )))
    ));
    let ventures_table = env.get("VENTURES");
    let ventures: Vec<&J> = env
        .get("VENTURE_IDS")
        .items()
        .iter()
        .map(|id| ventures_table.get(&text(id)))
        .collect::<Vec<_>>();
    let nv = ventures.len();
    for (field, name) in [
        ("value", "VENTURE_VALUE"),
        ("market", "VENTURE_MARKET"),
        ("amplitude", "VENTURE_AMPLITUDE"),
        ("peak", "VENTURE_PEAK"),
        ("weekend", "VENTURE_WEEKEND"),
    ] {
        o.push(format!(
            "pub static {name}: [f64; {nv}] = [{}];",
            join(ventures.iter().map(|v| num(v.get(field))))
        ));
    }
    o.push(format!(
        "pub static VENTURE_DEADLINE: [f64; {nv}] = [{}];",
        join(
            ventures
                .iter()
                .map(|v| match v.get("constraint").get("deadline") {
                    J::Null => "-1.0".into(),
                    d => num(d),
                })
        )
    ));
    o.push(format!(
        "pub static VENTURE_STALE_FINE: [f64; {nv}] = [{}];",
        join(
            ventures
                .iter()
                .map(|v| num(v.get("constraint").get("staleFine")))
        )
    ));

    let keyed = |o: &mut Out, table: &str, ids: &[&str], field: &str, name: &str| {
        let t = env.get(table);
        o.push(format!(
            "pub static {name}: [f64; {}] = [{}];",
            ids.len(),
            join(ids.iter().map(|id| num(t.get(id).get(field))))
        ));
    };
    let collectors = ["g1", "parallel", "zgc"];
    keyed(
        &mut o,
        "COLLECTORS",
        &collectors,
        "pauseMs",
        "COLLECTOR_PAUSE",
    );
    keyed(
        &mut o,
        "COLLECTORS",
        &collectors,
        "speed",
        "COLLECTOR_SPEED",
    );
    keyed(
        &mut o,
        "COLLECTORS",
        &collectors,
        "memory",
        "COLLECTOR_MEMORY",
    );
    keyed(
        &mut o,
        "STORAGE_IOPS",
        &["general", "provisioned"],
        "iops",
        "STORAGE_IOPS",
    );
    let retentions = ["keep", "archive", "delete"];
    keyed(
        &mut o,
        "DB_RETENTIONS",
        &retentions,
        "scanMs",
        "RETENTION_SCAN_MS",
    );
    keyed(
        &mut o,
        "DB_RETENTIONS",
        &retentions,
        "rebuild",
        "RETENTION_REBUILD",
    );
    keyed(
        &mut o,
        "DB_RETENTIONS",
        &retentions,
        "hotSet",
        "RETENTION_HOT_SET",
    );
    let shards = ["hash", "range", "tenant", "region"];
    keyed(&mut o, "SHARD_KEYS", &shards, "hot", "SHARD_HOT");
    keyed(&mut o, "SHARD_KEYS", &shards, "cross", "SHARD_CROSS");
    keyed(&mut o, "SHARD_KEYS", &shards, "farMs", "SHARD_FAR_MS");
    let gogc = env.get("GOGC");
    for (field, name) in [
        ("cpu", "GOGC_CPU"),
        ("memory", "GOGC_MEMORY"),
        ("gogc", "GOGC_VALUES"),
    ] {
        o.push(format!(
            "pub static {name}: [f64; 3] = [{}];",
            join(gogc.items().iter().map(|e| num(e.get(field))))
        ));
    }
    let ttls = env.get("CDN_TTLS");
    o.push(format!(
        "pub static CDN_TTL_VALUES: [f64; {}] = [{}];",
        ttls.items().len(),
        join(ttls.items().iter().map(|e| num(e.get("ttl"))))
    ));
    let cold = env.get("COLD_START_MS");
    let native_cold = env.get("NATIVE_COLD_MS");
    o.push(format!(
        "pub static COLD_START_MS: [f64; {nl}] = [{}];",
        join(
            language_ids
                .iter()
                .map(|l| num(cold.get(l).or(&native_cold)))
        )
    ));
    let cdn_hit = env.get("CDN_HIT");
    o.push(format!(
        "pub static CDN_HIT: [f64; NK] = [{}];",
        join(all.iter().map(|k| num(cdn_hit.get(k).or(&J::Num(0.0)))))
    ));
    o.push(format!(
        "pub static CDN_TTL_FACTOR: [f64; {}] = [{}];",
        ttls.items().len(),
        join(ttls.items().iter().map(|e| num(e.get("factor"))))
    ));

    o.push("");
    let research_ids = strings(&env.get("RESEARCH_IDS"));
    let nres = research_ids.len();
    o.push(format!("pub const RESEARCH_COUNT: usize = {nres};"));
    o.push(format!(
        "pub static RESEARCH_IDS: [&str; {nres}] = [{}];",
        quoted(&research_ids)
    ));
    o.ids("research", &research_ids);
    o.ids("fix", &strings(&env.get("FIXES")));

    o.push("");
    let authenticated = strings(&env.get("AUTHENTICATED_KINDS"));
    o.push(format!(
        "pub static AUTHENTICATED_KINDS_MASK: [u8; NR] = [{}];",
        join(
            request
                .iter()
                .map(|k| u8::from(authenticated.contains(k)).to_string())
        )
    ));
    let heavy = strings(&env.get("CPU_HEAVY_KINDS"));
    o.push(format!(
        "pub static CPU_HEAVY_MASK: [u8; NK] = [{}];",
        join(all.iter().map(|k| u8::from(heavy.contains(k)).to_string()))
    ));
    o.push(format!(
        "pub static MONEY_KINDS_MASK: u64 = {};",
        mask(&env.get("MONEY_KINDS"))
    ));
    o.push(format!(
        "pub static DATA_KINDS_MASK: u64 = {};",
        mask(&env.get("DATA_KINDS"))
    ));
    let query_cpu = env.get("QUERY_CPU");
    o.push(format!(
        "pub static QUERY_CPU_BY_BACKEND: [f64; NB] = [{}];",
        join(backend.iter().map(|k| match query_cpu.get(k) {
            J::Undefined => "-1.0".into(),
            v => num(v),
        }))
    ));
    let stamp = &crate::sha256::hex(o.lines.join("\n").as_bytes())[..8];
    o.push("");
    o.push(format!("pub const CATALOG_HASH: u32 = 0x{stamp};"));
    format!("{}\n", o.lines.join("\n"))
}
