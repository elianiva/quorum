/**
 * Rebuilds the TypeScript `Ledger` from the stream `src/wire.rs` writes. The
 * kernel writes every record in the key order `ledgerOf` builds it in, so each
 * object literal here reads its fields in source order, and the result has the
 * same keys, in the same order, with the same nulls. The two files change together.
 */

const LIMITS = ['none', 'cpu', 'workers', 'network', 'memory', 'credits', 'throughput', 'disk', 'connections']
const WORK_UNITS = ['cpu', 'workers', 'network', 'disk']
const STATUSES = ['idle', 'ok', 'warn', 'danger', 'down']
/** `CostCause`, in the order of `Cause` in `src/model.rs`. */
const CAUSES = ['runtime', 'collector', 'opcache', 'variant', 'arm', 'recycle', 'warmup', 'framework', 'jit', 'hashing', 'async', 'compression', 'local-db', 'serialization', 'auth', 'sampling', 'neighbours', 'swapping', 'gc', 'slow-query', 'disk', 'eviction', 'hot-shard', 'bloat', 'denormalization', 'indexes', 'features', 'engine', 'multi-leader', 'scatter', 'report', 'retention', 'view', 'busiest-shard']

/**
 * @param block the stream
 * @param game the Game the kernel solved, for Node ids
 * @param names the catalog lists: `kinds` (every Kind, request kinds first), `causes`, and `pools`
 */
export const decodeLedger = (block, game, names) => {
  const { kinds, causes, pools, regions, devices, services, extras } = names
  let at = 0
  const num = () => block[at++]
  const flag = () => block[at++] !== 0
  const opt = () => {
    const present = block[at++] !== 0
    const value = block[at++]
    return present ? value : null
  }
  const pair = (shape) => {
    const present = block[at++] !== 0
    const a = block[at++]
    const b = block[at++]
    return present ? shape(a, b) : null
  }
  const gauge = () => pair((used, total) => ({ used, total }))
  const keyed = () => {
    const record = {}
    for (let left = block[at++]; left > 0; left -= 1) {
      const kind = kinds[block[at++]]
      record[kind] = block[at++]
    }
    return record
  }
  const kindList = () => {
    const list = []
    for (let left = block[at++]; left > 0; left -= 1) list.push(kinds[block[at++]])
    return list
  }
  const receipts = () => {
    const record = {}
    for (let left = block[at++]; left > 0; left -= 1) {
      const kind = kinds[block[at++]]
      const base = block[at++]
      const lines = []
      for (let count = block[at++]; count > 0; count -= 1)
        lines.push({ cause: CAUSES[block[at++]], op: block[at++] !== 0 ? 'plus' : 'times', value: block[at++] })
      record[kind] = { base, lines, total: block[at++] }
    }
    return record
  }
  const nodeId = (slot) => (slot >= 0 ? game.nodes[slot].id : null)

  const nodes = {}
  const count = num()
  for (let index = 0; index < count; index += 1)
    nodes[game.nodes[index].id] = {
      inbound: num(),
      traffic: keyed(),
      capacity: num(),
      utilization: num(),
      limit: LIMITS[num()],
      latency: num(),
      p99: num(),
      hopByKind: keyed(),
      waitByKind: keyed(),
      workShare: keyed(),
      workUnit: WORK_UNITS[num()] ?? null,
      cost: num(),
      receipts: receipts(),
      repeated: num(),
      origins: keyed(),
      dropped: num(),
      refused: num(),
      stranded: num(),
      strandedKinds: kindList(),
      connections: pair((used, max) => ({ used, max })),
      hitRatio: opt(),
      evictions: opt(),
      age: opt(),
      lagMs: opt(),
      disk: flag(),
      out: keyed(),
      resources: {
        cpuCores: gauge(),
        ramGb: gauge(),
        slots: gauge(),
        networkKbps: gauge(),
        creditsCoreSeconds: pair((balance, rate) => ({ balance, rate })),
      },
      throttled: flag(),
      swapping: flag(),
      status: STATUSES[num()],
    }
  const links = game.links.map((link) => ({
    ...link,
    rate: num(),
    traffic: keyed(),
    kind: kinds[num()],
    failing: flag(),
    failure: num(),
  }))
  let latency = 0
  const serviceKeyed = () => {
    const record = {}
    for (let left = num(); left > 0; left -= 1) {
      const id = services[num()]
      record[id] = num()
    }
    return record
  }
  const serviceRows = () => {
    const record = {}
    for (let index = 0, count = num(); index < count; index += 1) {
      const served = []
      for (let left = num(); left > 0; left -= 1) served.push(kinds[num()])
      const rate = num()
      const done = num()
      const satisfied = num()
      const spent = num()
      record[services[index]] = {
        kinds: served,
        rate,
        served: done,
        failed: rate - done,
        apdex: rate > 0 ? satisfied / rate : 1,
        mean: done > 0 ? spent / done : 0,
        p99: num(),
      }
    }
    return record
  }
  const regionApdex = () => {
    const record = {}
    for (let left = num(); left > 0; left -= 1) {
      const region = regions[num()]
      record[region] = num()
    }
    return record
  }
  const regionRows = () => {
    const record = {}
    for (let left = num(); left > 0; left -= 1) {
      const rows = {}
      record[regions[num()]] = rows
      for (let count = num(); count > 0; count -= 1)
        rows[kinds[num()]] = {
          rate: num(),
          success: num(),
          apdex: num(),
          near: num(),
          fail: Object.fromEntries(causes.map((cause) => [cause, num()])),
          hopMs: num(),
          p99: num(),
        }
    }
    return record
  }
  const kindRows = {}
  for (let left = num(); left > 0; left -= 1)
    kindRows[kinds[num()]] = {
      rate: num(),
      success: num(),
      apdex: num(),
      completion: opt(),
      mean: num(),
      p50: num(),
      p95: num(),
      p99: num(),
    }
  const ledger = {
    nodes,
    links,
    kinds: kindRows,
    demand: num(),
    served: num(),
    errors: Object.fromEntries(causes.map((cause) => [cause, num()])),
    errorShare: num(),
    latency: (latency = num()),
    p50: num(),
    p95: num(),
    p99: num(),
    apdex: num(),
    regions: regionApdex(),
    // Each device's mean: `latency` plus its own radio round trip.
    deviceLatency: Object.fromEntries(devices.map(([device, rttMs]) => [device, latency + rttMs])),
    regionKinds: regionRows(),
    revenue: num(),
    subscriptions: num(),
    insight: Object.fromEntries(pools.map((pool) => [pool, num()])),
    breadth: keyed(),
    breadthRegions: keyed(),
    burn: num(),
    fines: num(),
    salaries: num(),
    egress: num(),
    fees: num(),
    burnLines: {
      compute: num(),
      data: num(),
      storage: num(),
      egress: num(),
      thirdParty: num(),
      requests: num(),
      observability: num(),
      salaries: num(),
    },
    revenueByKind: keyed(),
    finesByKind: keyed(),
    costPerKind: keyed(),
    costPerService: serviceKeyed(),
    services: serviceRows(),
    market: extras.market,
    velocity: num(),
    failing: kindList(),
    forecastPeak: 0,
    bottleneck: nodeId(num()),
    bottleneckByKind: {},
  }
  ledger.forecastPeak = extras.forecastPeak(ledger.demand)
  for (let left = num(); left > 0; left -= 1) ledger.bottleneckByKind[kinds[num()]] = nodeId(num())
  if (at !== block.length) throw new Error(`ledger wire: read ${at} of ${block.length}`)
  return ledger
}

/**
 * Compares two Ledgers field by field: numbers by `Object.is`, records by their
 * keys in order. `pending` lists the paths the kernel does not write yet; a `*`
 * matches any one key.
 */
export const compareDeep = (ts, rust, pending = []) => {
  let checked = 0
  let wrong = 0
  const bad = []
  const skip = pending.map((path) => path.split('.'))
  const skipped = (path) =>
    skip.some((pattern) => pattern.length <= path.length && pattern.every((part, index) => part === '*' || part === path[index]))
  const report = (path, message) => {
    wrong += 1
    if (bad.length < 40) bad.push(`${path.join('.')}: ${message}`)
  }
  const walk = (a, b, path) => {
    if (skipped(path)) return
    checked += 1
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      if (!Object.is(a, b)) report(path, `ts ${JSON.stringify(a) ?? a} rust ${JSON.stringify(b) ?? b}`)
      return
    }
    if (Array.isArray(a) !== Array.isArray(b)) return report(path, 'array against record')
    const keysA = Object.keys(a).filter((key) => !skipped([...path, key]))
    const keysB = Object.keys(b).filter((key) => !skipped([...path, key]))
    if (keysA.join() !== keysB.join()) report(path, `keys ts [${keysA}] rust [${keysB}]`)
    for (const key of keysA) if (key in b) walk(a[key], b[key], [...path, key])
  }
  walk(ts, rust, [])
  return { checked, wrong, bad }
}
