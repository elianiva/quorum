/**
 * Emits Rust source for every constant and table the solve reads, straight from
 * the TypeScript catalog, so the two sides cannot drift.
 */
import { writeFileSync } from 'node:fs'
import * as catalog from '/Users/elianiva/Development/personal/apps/quorum-wasm-research/packages/simulation/src/catalog.ts'
import { FLAT_CAPACITY } from '/Users/elianiva/Development/personal/apps/quorum-wasm-research/packages/simulation/src/capacity.ts'

const out: Array<string> = []
const push = (line: string) => out.push(line)

const REQUEST_KINDS = catalog.REQUEST_KINDS
const BACKEND_KINDS = catalog.BACKEND_KINDS
const ALL_KINDS = [...REQUEST_KINDS, ...BACKEND_KINDS]
const NK = ALL_KINDS.length
const NR = REQUEST_KINDS.length
const NB = BACKEND_KINDS.length

/** A catalog id as a Rust constant name: `q-read` is `Q_READ`. */
const constName = (id: string): string => {
  const name = id.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  return /^[0-9]/.test(name) ? `_${name}` : name
}

/** One module of index constants, so a rule names `kind::LOGIN`, not a string it looks up. */
const pushIds = (module: string, doc: string, ids: ReadonlyArray<string>) => {
  push(`/// ${doc}`)
  push(`pub mod ${module} {`)
  for (const [index, id] of ids.entries()) push(`    pub const ${constName(id)}: usize = ${index};`)
  push('}')
}

/** A Rust enum over a table's distinct string values, in first-seen order. */
const pushEnum = (name: string, values: ReadonlyArray<string>): Map<string, string> => {
  const variants = new Map<string, string>()
  for (const value of values) {
    if (!variants.has(value)) {
      variants.set(value, value.replace(/(^|[-_])([a-z])/g, (_, __, letter: string) => letter.toUpperCase()))
    }
  }
  push('#[derive(Clone, Copy, PartialEq, Eq, Debug)]')
  push(`pub enum ${name} {`)
  for (const variant of variants.values()) push(`    ${variant},`)
  push('}')
  return variants
}

push('// Generated from packages/simulation/src/catalog.ts. Do not edit by hand.')
push(`pub const NK: usize = ${NK};`)
push(`pub const NR: usize = ${NR};`)
push(`pub const NB: usize = ${NB};`)
push('')
push(`pub static KINDS: [&str; NK] = [${ALL_KINDS.map((k) => `"${k}"`).join(', ')}];`)
push('')
pushIds('kind', 'Kind indices: request kinds first, then backend kinds.', ALL_KINDS)
pushIds('backend', 'Backend kind indices, counted from `NR`: `NR + backend::Q_READ` is `kind::Q_READ`.', BACKEND_KINDS)
push('')
push('/// Whether a kind index is one a user asks for (a Request kind).')
push('pub fn is_request_kind(kind: usize) -> bool {')
push(`    kind < ${NR}`)
push('}')

// Every exported scalar constant, so none is retyped by hand.
push('')
push('// ---- scalar constants, generated ----')
const scalarNames: Array<string> = []
/** These get a dedicated section below, with their own index lookup. */
const DEFINED_LATER = new Set([
  'RUNTIME_IDS',
  'LANGUAGE_IDS',
  'FRAMEWORK_IDS',
  'COMPONENT_IDS',
  'RESEARCH_IDS',
  'KINDS',
  'PROFILES',
  'RUNTIMES',
  'FRAMEWORKS',
  'LANGUAGES',
  'COMPONENTS',
  'DB_ENGINES',
  'COLLECTORS',
  'STORAGE_IOPS',
  'DB_RETENTIONS',
  'SHARD_KEYS',
  'CDN_TTLS',
  'GOGC',
])
for (const [name, value] of Object.entries(catalog)) {
  if (DEFINED_LATER.has(name)) continue
  if (typeof value === 'number' && Number.isFinite(value)) {
    push(`pub const ${name.toUpperCase()}: f64 = ${formatNumber(value)};`)
    scalarNames.push(name)
  } else if (typeof value === 'boolean') {
    push(`pub const ${name.toUpperCase()}: bool = ${value};`)
    scalarNames.push(name)
  } else if (typeof value === 'string') {
    push(`pub const ${name.toUpperCase()}: &str = "${value}";`)
    scalarNames.push(name)
  } else if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
    push(
      `pub static ${name.toUpperCase()}: [f64; ${value.length}] = [${value.map(formatNumber).join(', ')}];`,
    )
    scalarNames.push(name)
  } else if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
    push(
      `pub static ${name.toUpperCase()}: [&str; ${value.length}] = [${value.map((e) => `"${e}"`).join(', ')}];`,
    )
    scalarNames.push(name)
  }
}
push(`pub static SCALAR_COUNT: usize = ${scalarNames.length};`)

/** `fixedMs` as a Rust name part: `FIXED_MS`. */
const snake = (field: string): string => constName(field.replace(/([a-z0-9])([A-Z])/g, '$1_$2'))

/**
 * A table of rows, keyed by id (a record) or by position (an array): an id module for a record,
 * then one column per field that every row holds as a number or a boolean. A rule reads
 * `SEARCH_HEAPS_TAIL_P[node.heap]`, the same row the TypeScript reads as `SEARCH_HEAPS[heap].tailP`.
 */
const pushTable = (name: string, module: string | null) => {
  const table = (catalog as Record<string, unknown>)[name] as
    | Record<string, Record<string, unknown>>
    | ReadonlyArray<Record<string, unknown>>
  // A single settings object, such as `UNDER_ATTACK`, is a table of one row.
  const single = !Array.isArray(table) && Object.values(table).every((value) => typeof value !== 'object')
  const rows = Array.isArray(table) ? table : single ? [table as Record<string, unknown>] : Object.values(table)
  push('')
  if (module) pushIds(module, `\`${name}\` rows.`, Object.keys(table))
  for (const field of Object.keys(rows[0] ?? {})) {
    const values = rows.map((row) => row[field])
    const column = `${name}_${snake(field)}`
    if (values.every((value) => typeof value === 'number'))
      push(`pub static ${column}: [f64; ${rows.length}] = [${values.map((v) => formatNumber(v as number)).join(', ')}];`)
    else if (values.every((value) => typeof value === 'boolean'))
      push(`pub static ${column}: [bool; ${rows.length}] = [${values.join(', ')}];`)
    else if (field !== 'name' && values.every((value) => typeof value === 'string'))
      push(`pub static ${column}: [&str; ${rows.length}] = [${values.map((v) => JSON.stringify(v)).join(', ')}];`)
  }
}
push('')
push('// ---- row tables, generated ----')
pushTable('SEARCH_VARIANTS', 'search_variant')
pushTable('SEARCH_HEAPS', 'search_heap')
pushTable('SEARCH_REFRESH', null)
pushTable('STORAGE_CLASSES', 'storage_class')
pushTable('GPU_TYPES', 'gpu_type')
pushTable('GPU_MODELS', 'gpu_model')
pushTable('GPU_PRECISIONS', 'gpu_precision')
pushTable('GPU_BATCHES', null)
pushTable('CACHE_ENGINES', 'cache_engine')
pushTable('CACHE_TTLS', null)
pushTable('CACHE_STRATEGIES', 'cache_strategy')
pushTable('PARANOIA', null)
pushTable('UNDER_ATTACK', null)
pushTable('VEC_INDEXES', 'vec_index')
pushTable('CACHE_KEYS', 'cache_key')
pushTable('LOG_ACKS', null)

function formatNumber(value: number): string {
  if (value === Number.POSITIVE_INFINITY) return 'f64::INFINITY'
  if (value === Number.NEGATIVE_INFINITY) return 'f64::NEG_INFINITY'
  if (Number.isInteger(value)) return `${value}.0`
  return String(value)
}

// ---- record tables ----
const requestIndex = new Map(REQUEST_KINDS.map((kind, index) => [kind, index]))
const backendIndex = new Map(BACKEND_KINDS.map((kind, index) => [kind, index]))
const kindIndex = new Map(ALL_KINDS.map((kind, index) => [kind, index]))

const sparse = (record: Record<string, number> | undefined, total: number): Array<string> => {
  const row = new Array(total).fill('0.0')
  for (const [key, value] of Object.entries(record ?? {})) {
    const index = kindIndex.get(key)
    if (index !== undefined) row[index] = formatNumber(value)
  }
  return row
}

push('')
push('// ---- Request kind profiles ----')
const profile = catalog.PROFILES
push(
  `pub static PROFILE_CPU: [f64; NR] = [${REQUEST_KINDS.map((k) => formatNumber(profile[k].cpu)).join(', ')}];`,
)
push(
  `pub static PROFILE_NATIVE: [bool; NR] = [${REQUEST_KINDS.map((k) => profile[k].native).join(', ')}];`,
)
push(
  `pub static PROFILE_APDEX: [f64; NR] = [${REQUEST_KINDS.map((k) => formatNumber(profile[k].apdex)).join(', ')}];`,
)
push(
  `pub static PROFILE_OFFLOAD: [f64; NR] = [${REQUEST_KINDS.map((k) => formatNumber(profile[k].offload)).join(', ')}];`,
)
push(
  `pub static PROFILE_IN_KB: [f64; NR] = [${REQUEST_KINDS.map((k) => formatNumber(profile[k].inKB)).join(', ')}];`,
)
push(
  `pub static PROFILE_PAYLOAD_KB: [f64; NR] = [${REQUEST_KINDS.map((k) => formatNumber(profile[k].payloadKB)).join(', ')}];`,
)
push(
  `pub static PROFILE_ASYNC_KB: [f64; NR] = [${REQUEST_KINDS.map((k) => formatNumber(profile[k].asyncKB)).join(', ')}];`,
)
push(
  `pub static PROFILE_ORM: [bool; NR] = [${REQUEST_KINDS.map((k) => profile[k].orm).join(', ')}];`,
)
push(
  `pub static PROFILE_SCORED: [bool; NR] = [${REQUEST_KINDS.map((k) => profile[k].scored).join(', ')}];`,
)
push(
  `pub static PROFILE_COMPRESSIBLE: [bool; NR] = [${REQUEST_KINDS.map((k) => profile[k].compressible).join(', ')}];`,
)
push(
  `pub static PROFILE_STREAM: [bool; NR] = [${REQUEST_KINDS.map((k) => profile[k].stream).join(', ')}];`,
)
push(
  `pub static PROFILE_COMPLETION: [f64; NR] = [${REQUEST_KINDS.map((k) => formatNumber((profile[k] as { completion?: number }).completion ?? 0)).join(', ')}];`,
)
push('pub static PROFILE_CALLS: [[f64; NK]; NR] = [')
for (const kind of REQUEST_KINDS) push(`    [${sparse(profile[kind].calls, NK).join(', ')}],`)
push('];')
push('pub static PROFILE_ASYNC_CALLS: [[f64; NK]; NR] = [')
for (const kind of REQUEST_KINDS) push(`    [${sparse(profile[kind].asyncCalls, NK).join(', ')}],`)
push('];')

push('')
push('// ---- Kind values ----')
push(
  `pub static KIND_VALUE: [f64; NK] = [${ALL_KINDS.map((k) => formatNumber(catalog.KINDS[k]?.value ?? 0)).join(', ')}];`,
)

// ---- Runtimes ----
push('')
push('// ---- Runtimes ----')
const RUNTIME_IDS = catalog.RUNTIME_IDS
push(`pub const RUNTIME_COUNT: usize = ${RUNTIME_IDS.length};`)
push(
  `pub static RUNTIME_IDS: [&str; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => `"${id}"`).join(', ')}];`,
)
pushIds('runtime', 'Runtime indices.', RUNTIME_IDS)
const runtime = catalog.RUNTIMES
push('/// Each runtime\'s language, as an index into `LANGUAGE_IDS`.')
push(
  `pub static RUNTIME_LANGUAGE: [usize; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => catalog.LANGUAGE_IDS.indexOf(runtime[id].language)).join(', ')}];`,
)
const concurrency = pushEnum('Concurrency', RUNTIME_IDS.map((id) => runtime[id].model))
push(
  `pub static RUNTIME_MODEL: [Concurrency; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => `Concurrency::${concurrency.get(runtime[id].model)}`).join(', ')}];`,
)
push(
  `pub static RUNTIME_SPEED: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].speed)).join(', ')}];`,
)
push(
  `pub static RUNTIME_MEMORY_MB: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].memoryMb)).join(', ')}];`,
)
push(
  `pub static RUNTIME_POOL: [bool; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => runtime[id].pool).join(', ')}];`,
)
push(
  `pub static RUNTIME_THREADS: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].threads)).join(', ')}];`,
)
push(
  `pub static RUNTIME_PARALLEL: [bool; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => runtime[id].parallel).join(', ')}];`,
)
push(
  `pub static RUNTIME_CONNECTION_KB: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => (runtime[id].connectionKB === null ? '-1.0' : formatNumber(runtime[id].connectionKB))).join(', ')}];`,
)
push(
  `pub static RUNTIME_STARTUP_S: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].startupSeconds)).join(', ')}];`,
)
push(
  `pub static RUNTIME_WARM_FROM: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].warmFrom)).join(', ')}];`,
)
push(
  `pub static RUNTIME_WARMUP: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].warmup)).join(', ')}];`,
)
push(
  `pub static RUNTIME_OVERHEAD_FACTOR: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].overheadFactor ?? 1)).join(', ')}];`,
)
push(
  `pub static RUNTIME_PERSISTENT: [bool; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => runtime[id].persistent).join(', ')}];`,
)
const blocking = pushEnum('Blocking', RUNTIME_IDS.map((id) => runtime[id].blocking ?? 'none'))
push(
  `pub static RUNTIME_BLOCKING: [Blocking; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => `Blocking::${blocking.get(runtime[id].blocking ?? 'none')}`).join(', ')}];`,
)
push(
  `pub static RUNTIME_CONNECTIONS: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].connections ?? 0)).join(', ')}];`,
)
push(
  `pub static RUNTIME_VELOCITY: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].velocity ?? 1)).join(', ')}];`,
)
push(
  `pub static RUNTIME_GC_PAUSE: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].gc?.pauseMs ?? -1)).join(', ')}];`,
)
push(
  `pub static RUNTIME_GC_CPU: [f64; ${RUNTIME_IDS.length}] = [${RUNTIME_IDS.map((id) => formatNumber(runtime[id].gc?.cpu ?? 0)).join(', ')}];`,
)

// ---- Languages ----
push('')
push('// ---- Languages ----')
// PHP-FPM pool modes, in the order the harness encodes `pm`: spares (-1 for the whole pool), spawn share, spawn ms.
const PM_IDS = ['static', 'dynamic', 'ondemand']
push(`pub static PM_SPARES: [f64; 3] = [${PM_IDS.map((id) => formatNumber(catalog.PM_MODES[id].spares ?? -1)).join(', ')}];`)
push(`pub static PM_SPAWN_SHARE: [f64; 3] = [${PM_IDS.map((id) => formatNumber(catalog.PM_MODES[id].spawnShare)).join(', ')}];`)
push(`pub static PM_SPAWN_MS: [f64; 3] = [${PM_IDS.map((id) => formatNumber(catalog.PM_MODES[id].spawnMs)).join(', ')}];`)

const LANGUAGE_IDS = catalog.LANGUAGE_IDS
push(`pub const LANGUAGE_COUNT: usize = ${LANGUAGE_IDS.length};`)
push(
  `pub static LANGUAGE_IDS: [&str; ${LANGUAGE_IDS.length}] = [${LANGUAGE_IDS.map((id) => `"${id}"`).join(', ')}];`,
)
pushIds('language', 'Language indices.', LANGUAGE_IDS)
const language = catalog.LANGUAGES
push(
  `pub static LANGUAGE_VELOCITY: [f64; ${LANGUAGE_IDS.length}] = [${LANGUAGE_IDS.map((id) => formatNumber(language[id].velocity)).join(', ')}];`,
)
push(
  `pub static LANGUAGE_BLAST: [&str; ${LANGUAGE_IDS.length}] = [${LANGUAGE_IDS.map((id) => `"${language[id].blast}"`).join(', ')}];`,
)

// ---- Frameworks ----
push('')
push('// ---- Frameworks ----')
const FRAMEWORK_IDS = catalog.FRAMEWORK_IDS
push(`pub const FRAMEWORK_COUNT: usize = ${FRAMEWORK_IDS.length};`)
push(
  `pub static FRAMEWORK_IDS: [&str; ${FRAMEWORK_IDS.length}] = [${FRAMEWORK_IDS.map((id) => `"${id}"`).join(', ')}];`,
)
push('pub fn framework_index(name: &str) -> usize {')
push('    match name {')
for (const [index, id] of FRAMEWORK_IDS.entries()) push(`        "${id}" => ${index},`)
push('        _ => 0,')
push('    }')
push('}')
const framework = catalog.FRAMEWORKS
push(
  `pub static FRAMEWORK_OVERHEAD: [f64; ${FRAMEWORK_IDS.length}] = [${FRAMEWORK_IDS.map((id) => formatNumber(framework[id].overhead)).join(', ')}];`,
)
push(
  `pub static FRAMEWORK_VELOCITY: [f64; ${FRAMEWORK_IDS.length}] = [${FRAMEWORK_IDS.map((id) => formatNumber(framework[id].velocity)).join(', ')}];`,
)
push(
  `pub static FRAMEWORK_MEMORY_MB: [f64; ${FRAMEWORK_IDS.length}] = [${FRAMEWORK_IDS.map((id) => formatNumber(framework[id].memoryMb)).join(', ')}];`,
)
push(
  `pub static FRAMEWORK_ORM: [bool; ${FRAMEWORK_IDS.length}] = [${FRAMEWORK_IDS.map((id) => framework[id].orm).join(', ')}];`,
)
push(
  `pub static FRAMEWORK_ASGI: [bool; ${FRAMEWORK_IDS.length}] = [${FRAMEWORK_IDS.map((id) => framework[id].asgi ?? false).join(', ')}];`,
)
push(
  `pub static FRAMEWORK_CACHEABLE: [f64; ${FRAMEWORK_IDS.length}] = [${FRAMEWORK_IDS.map((id) => formatNumber(framework[id].cacheable ?? 0)).join(', ')}];`,
)
push(
  `pub static FRAMEWORK_WORKER_OVERHEAD: [f64; ${FRAMEWORK_IDS.length}] = [${FRAMEWORK_IDS.map((id) => formatNumber(framework[id].workerOverhead ?? -1)).join(', ')}];`,
)
push(`pub static FRAMEWORK_VALUE: [[f64; NR]; ${FRAMEWORK_IDS.length}] = [`)
for (const id of FRAMEWORK_IDS) {
  const row = new Array(NR).fill('1.0')
  for (const [key, value] of Object.entries(framework[id].value ?? {})) {
    const index = requestIndex.get(key)
    if (index !== undefined) row[index] = formatNumber(value as number)
  }
  push(`    [${row.join(', ')}],`)
}
push('];')
push(`pub static FRAMEWORK_CPU: [[f64; NR]; ${FRAMEWORK_IDS.length}] = [`)
for (const id of FRAMEWORK_IDS) {
  const row = new Array(NR).fill('1.0')
  for (const [key, value] of Object.entries(framework[id].cpu ?? {})) {
    const index = requestIndex.get(key)
    if (index !== undefined) row[index] = formatNumber(value as number)
  }
  push(`    [${row.join(', ')}],`)
}
push('];')

// ---- DB engines ----
push('')
push('// ---- Database engines ----')
const DB_ENGINES = ['postgres', 'mysql'] as const
push(
  `pub static DB_CONNECTIONS: [f64; 2] = [${DB_ENGINES.map((id) => formatNumber(catalog.DB_ENGINES[id].connections)).join(', ')}];`,
)
push(
  `pub static DB_CONNECTION_MB: [f64; 2] = [${DB_ENGINES.map((id) => formatNumber(catalog.DB_ENGINES[id].connectionMB)).join(', ')}];`,
)
push(
  `pub static DB_READ: [f64; 2] = [${DB_ENGINES.map((id) => formatNumber(catalog.DB_ENGINES[id].read)).join(', ')}];`,
)
push(
  `pub static DB_WRITE: [f64; 2] = [${DB_ENGINES.map((id) => formatNumber(catalog.DB_ENGINES[id].write)).join(', ')}];`,
)
push(
  `pub static DB_SCAN: [f64; 2] = [${DB_ENGINES.map((id) => formatNumber(catalog.DB_ENGINES[id].scan)).join(', ')}];`,
)
push(
  `pub static DB_SEARCH_COST: [f64; 2] = [${DB_ENGINES.map((id) => formatNumber(catalog.DB_ENGINES[id].searchCost)).join(', ')}];`,
)
push(
  `pub static DB_LAG: [f64; 2] = [${DB_ENGINES.map((id) => formatNumber(catalog.DB_ENGINES[id].lag)).join(', ')}];`,
)
push('pub fn db_engine_index(name: &str) -> usize { if name == "mysql" { 1 } else { 0 } }')

// ---- Components ----
push('')
push('// ---- Components ----')
const COMPONENT_IDS = catalog.COMPONENT_IDS
push(`pub const COMPONENT_COUNT: usize = ${COMPONENT_IDS.length};`)
push(
  `pub static COMPONENT_IDS: [&str; ${COMPONENT_IDS.length}] = [${COMPONENT_IDS.map((id) => `"${id}"`).join(', ')}];`,
)
pushIds('component', 'Component type codes.', COMPONENT_IDS)
/** A bitmask over all 33 kinds: what a Component accepts. */
const maskOf = (kinds: ReadonlyArray<string>): string => {
  let mask = 0n
  for (const kind of kinds) {
    const index = kindIndex.get(kind)
    if (index !== undefined) mask |= 1n << BigInt(index)
  }
  return `0x${mask.toString(16)}`
}
push(`pub static COMPONENT_ACCEPTS: [u64; ${COMPONENT_IDS.length}] = [`)
for (const id of COMPONENT_IDS) push(`    ${maskOf(catalog.COMPONENTS[id].accepts)}, // ${id}`)
push('];')
push(`pub static COMPONENT_SENDS: [u64; ${COMPONENT_IDS.length}] = [`)
for (const id of COMPONENT_IDS) push(`    ${maskOf(catalog.COMPONENTS[id].sends)}, // ${id}`)
push('];')
push(`pub static COMPONENT_FALLBACK: [u64; ${COMPONENT_IDS.length}] = [`)
for (const id of COMPONENT_IDS) push(`    ${maskOf(catalog.COMPONENTS[id].fallback)}, // ${id}`)
push('];')
push(
  `pub static COMPONENT_STACK: [bool; ${COMPONENT_IDS.length}] = [${COMPONENT_IDS.map((id) => catalog.COMPONENTS[id].stack).join(', ')}];`,
)
push(
  `pub static COMPONENT_LIMITING: [bool; ${COMPONENT_IDS.length}] = [${COMPONENT_IDS.map((id) => catalog.COMPONENTS[id].limiting).join(', ')}];`,
)
push(
  `pub static COMPONENT_COLD_START: [bool; ${COMPONENT_IDS.length}] = [${COMPONENT_IDS.map((id) => catalog.COMPONENTS[id].coldStart).join(', ')}];`,
)
push(
  `pub static COMPONENT_TAP: [bool; ${COMPONENT_IDS.length}] = [${COMPONENT_IDS.map((id) => catalog.COMPONENTS[id].tap).join(', ')}];`,
)
push(
  `pub static COMPONENT_LATENCY: [f64; ${COMPONENT_IDS.length}] = [${COMPONENT_IDS.map((id) => formatNumber(catalog.COMPONENTS[id].latency ?? 0)).join(', ')}];`,
)
push(
  `pub static COMPONENT_STEPS: [f64; ${COMPONENT_IDS.length}] = [${COMPONENT_IDS.map((id) => formatNumber(catalog.COMPONENTS[id].steps)).join(', ')}];`,
)

// ---- Other tables ----
push('')
push('// ---- Other tables ----')
push(
  `pub static FLAT_CAPACITY: [f64; ${COMPONENT_IDS.length}] = [${COMPONENT_IDS.map((id) => {
    const value = (FLAT_CAPACITY as Record<string, number>)[id]
    return value === undefined
      ? '0.0'
      : value === Number.POSITIVE_INFINITY
        ? 'f64::INFINITY'
        : formatNumber(value)
  }).join(', ')}];`,
)
// A Component that serves every region from everywhere, and one that spans every
// zone: `regions.ts` and `lookups.ts` own these lists, mirrored here because
// neither exports them.
const GLOBAL_COMPONENTS = ['psp', 'llm', 'msgp', 'auth', 'cdn', 'analytics', 'payments']
push(
  `pub static COMPONENT_GLOBAL: [bool; ${COMPONENT_IDS.length}] = [${COMPONENT_IDS.map((id) => GLOBAL_COMPONENTS.includes(id)).join(', ')}];`,
)
push(
  `pub static COMPONENT_FIXED: [bool; ${COMPONENT_IDS.length}] = [${COMPONENT_IDS.map((id) => catalog.COMPONENTS[id].fixed).join(', ')}];`,
)
// Round trips between regions, from the catalog's own lookup.
const REGIONS = catalog.REGIONS
push(
  `pub static REGION_RTT: [[f64; ${REGIONS.length}]; ${REGIONS.length}] = [${REGIONS.map(
    (from) => `[${REGIONS.map((to) => formatNumber(catalog.rttOf(from, to))).join(', ')}]`,
  ).join(', ')}];`,
)
// Each Venture's traffic profile and rule, so the revenue layer reads the same
// numbers the TypeScript does.
const VENTURES = catalog.VENTURE_IDS.map((id) => catalog.VENTURES[id])
push(`pub static VENTURE_VALUE: [f64; ${VENTURES.length}] = [${VENTURES.map((v) => formatNumber(v.value)).join(', ')}];`)
push(`pub static VENTURE_MARKET: [f64; ${VENTURES.length}] = [${VENTURES.map((v) => formatNumber(v.market)).join(', ')}];`)
push(`pub static VENTURE_AMPLITUDE: [f64; ${VENTURES.length}] = [${VENTURES.map((v) => formatNumber(v.amplitude)).join(', ')}];`)
push(`pub static VENTURE_PEAK: [f64; ${VENTURES.length}] = [${VENTURES.map((v) => formatNumber(v.peak)).join(', ')}];`)
push(`pub static VENTURE_WEEKEND: [f64; ${VENTURES.length}] = [${VENTURES.map((v) => formatNumber(v.weekend)).join(', ')}];`)
push(`pub static VENTURE_DEADLINE: [f64; ${VENTURES.length}] = [${VENTURES.map((v) => (v.constraint.deadline === null ? '-1.0' : formatNumber(v.constraint.deadline))).join(', ')}];`)
push(`pub static VENTURE_STALE_FINE: [f64; ${VENTURES.length}] = [${VENTURES.map((v) => formatNumber(v.constraint.staleFine)).join(', ')}];`)

push(
  `pub static COLLECTOR_PAUSE: [f64; 3] = [${['g1', 'parallel', 'zgc'].map((id) => formatNumber(catalog.COLLECTORS[id as 'g1'].pauseMs)).join(', ')}];`,
)
push(
  `pub static COLLECTOR_SPEED: [f64; 3] = [${['g1', 'parallel', 'zgc'].map((id) => formatNumber(catalog.COLLECTORS[id as 'g1'].speed)).join(', ')}];`,
)
push(
  `pub static COLLECTOR_MEMORY: [f64; 3] = [${['g1', 'parallel', 'zgc'].map((id) => formatNumber(catalog.COLLECTORS[id as 'g1'].memory)).join(', ')}];`,
)
push(
  `pub static STORAGE_IOPS: [f64; 2] = [${['general', 'provisioned'].map((id) => formatNumber(catalog.STORAGE_IOPS[id as 'general'].iops)).join(', ')}];`,
)
push(
  `pub static RETENTION_SCAN_MS: [f64; 3] = [${['keep', 'archive', 'delete'].map((id) => formatNumber(catalog.DB_RETENTIONS[id as 'keep'].scanMs)).join(', ')}];`,
)
push(
  `pub static RETENTION_REBUILD: [f64; 3] = [${['keep', 'archive', 'delete'].map((id) => formatNumber(catalog.DB_RETENTIONS[id as 'keep'].rebuild)).join(', ')}];`,
)
push(
  `pub static SHARD_HOT: [f64; 4] = [${['hash', 'range', 'tenant', 'region'].map((id) => formatNumber(catalog.SHARD_KEYS[id as 'hash'].hot)).join(', ')}];`,
)
push(
  `pub static SHARD_CROSS: [f64; 4] = [${['hash', 'range', 'tenant', 'region'].map((id) => formatNumber(catalog.SHARD_KEYS[id as 'hash'].cross)).join(', ')}];`,
)
push(
  `pub static SHARD_FAR_MS: [f64; 4] = [${['hash', 'range', 'tenant', 'region'].map((id) => formatNumber(catalog.SHARD_KEYS[id as 'hash'].farMs)).join(', ')}];`,
)
push(
  `pub static GOGC_CPU: [f64; 3] = [${(catalog.GOGC as ReadonlyArray<{ cpu: number }>).map((entry) => formatNumber(entry.cpu)).join(', ')}];`,
)
push(
  `pub static GOGC_MEMORY: [f64; 3] = [${(catalog.GOGC as ReadonlyArray<{ memory: number }>).map((entry) => formatNumber(entry.memory)).join(', ')}];`,
)
push(
  `pub static GOGC_VALUES: [f64; 3] = [${(catalog.GOGC as ReadonlyArray<{ gogc: number }>).map((entry) => formatNumber(entry.gogc)).join(', ')}];`,
)
push(
  `pub static CDN_TTL_VALUES: [f64; ${catalog.CDN_TTLS.length}] = [${catalog.CDN_TTLS.map((entry) => formatNumber(entry.ttl)).join(', ')}];`,
)
push(
  `pub static COLD_START_MS: [f64; ${catalog.LANGUAGE_IDS.length}] = [${catalog.LANGUAGE_IDS.map((language: string) => formatNumber((catalog.COLD_START_MS as Record<string, number>)[language] ?? catalog.NATIVE_COLD_MS)).join(', ')}];`,
)
push(
  `pub static CDN_HIT: [f64; NK] = [${[...catalog.REQUEST_KINDS, ...catalog.BACKEND_KINDS].map((kind) => formatNumber((catalog.CDN_HIT as Record<string, number>)[kind] ?? 0)).join(', ')}];`,
)
push(
  `pub static CDN_TTL_FACTOR: [f64; ${catalog.CDN_TTLS.length}] = [${catalog.CDN_TTLS.map((entry) => formatNumber(entry.factor)).join(', ')}];`,
)

// ---- Research and features: the `has` checks ----
push('')
push('// ---- Research ----')
const RESEARCH_IDS = catalog.RESEARCH_IDS
push(`pub const RESEARCH_COUNT: usize = ${RESEARCH_IDS.length};`)
push(
  `pub static RESEARCH_IDS: [&str; ${RESEARCH_IDS.length}] = [${RESEARCH_IDS.map((id) => `"${id}"`).join(', ')}];`,
)
pushIds('research', 'Research bit indices.', RESEARCH_IDS)
pushIds('fix', 'Fix bit indices: the code fixes a Service can ship.', catalog.FIXES)

// ---- derived masks and per-backend cost tables ----
push('')
push('// ---- derived masks ----')
const AUTHENTICATED = new Set(catalog.AUTHENTICATED_KINDS)
push(
  `pub static AUTHENTICATED_KINDS_MASK: [u8; NR] = [${REQUEST_KINDS.map((k) => (AUTHENTICATED.has(k as never) ? 1 : 0)).join(', ')}];`,
)
const HEAVY = new Set(catalog.CPU_HEAVY_KINDS)
push(
  `pub static CPU_HEAVY_MASK: [u8; NK] = [${ALL_KINDS.map((k) => (HEAVY.has(k as never) ? 1 : 0)).join(', ')}];`,
)
push(
  `pub static MONEY_KINDS_MASK: u64 = 0x${catalog.MONEY_KINDS.reduce((mask, kind) => mask | (1n << BigInt(kindIndex.get(kind)!)), 0n).toString(16)};`,
)
const DATA = new Set(catalog.DATA_KINDS)
push(
  `pub static DATA_KINDS_MASK: u64 = ${(() => {
    let m = 0n
    for (const k of catalog.DATA_KINDS) {
      const i = kindIndex.get(k)
      if (i !== undefined) m |= 1n << BigInt(i)
    }
    return `0x${m.toString(16)}`
  })()};`,
)
const queryCpu = catalog.QUERY_CPU as Record<string, number>
push(
  `pub static QUERY_CPU_BY_BACKEND: [f64; NB] = [${BACKEND_KINDS.map((k) => (queryCpu[k] === undefined ? '-1.0' : formatNumber(queryCpu[k]!))).join(', ')}];`,
)
writeFileSync(process.argv[2] ?? 'src/catalog.rs', `${out.join('\n')}\n`)
console.log(
  `wrote ${out.length} lines; ${scalarNames.length} scalar constants; NK=${NK} NR=${NR} NB=${NB}`,
)
