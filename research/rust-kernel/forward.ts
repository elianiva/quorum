/** Compares the Rust forward pass's arriving rates with the TypeScript pass. */
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../packages/simulation/src', import.meta.url).pathname
const { link, node, preseedGame } = await import(`${ROOT}/company.ts`)
const { graphOf } = await import(`${ROOT}/solve-graph.ts`)
const { demandOf } = await import(`${ROOT}/solve-demand.ts`)
const { userRoutes } = await import(`${ROOT}/regions.ts`)
const { forward, solverOf } = await import(`${ROOT}/solve-pass.ts`)
const {
  REQUEST_KINDS,
  BACKEND_KINDS,
  COMPONENT_IDS,
  RESEARCH_IDS,
  FEATURE_IDS,
  RUNTIME_IDS,
  FRAMEWORK_IDS,
  FAMILY_IDS,
} = await import(`${ROOT}/catalog.ts`)
const { usersOfGroup, dataGroupOf } = await import(`${ROOT}/lookups.ts`)

const ALL = [...REQUEST_KINDS, ...BACKEND_KINDS]
const NK = ALL.length
const NR = REQUEST_KINDS.length
const kindMask = (kinds) => {
  let m = 0n
  for (const k of kinds) {
    const i = ALL.indexOf(k)
    if (i >= 0) m |= 1n << BigInt(i)
  }
  return Number(m)
}

const board = () => {
  const nodes = [node('users', 'users', 0, 0), node('lb', 'lb', 100, 0)]
  const links = [link('users', 'lb')]
  for (let g = 0; g < 6; g += 1) {
    const lb = `lb${g}`,
      pool = `pool${g}`,
      db = `db${g}`
    nodes.push(
      node(lb, 'lb', 200, g * 100),
      node(pool, 'pooler', 400, g * 100),
      node(db, 'database', 500, g * 100, { size: 5 }),
    )
    links.push(link('lb', lb), link(pool, db))
    for (let i = 0; i < 30; i += 1) {
      const id = `s${g}-${i}`
      nodes.push(node(id, 'server', 300, g * 100 + i, { size: 3, runtime: 'php_fpm', workers: 40 }))
      links.push(link(lb, id), link(id, pool))
    }
  }
  return {
    ...preseedGame(),
    nodes,
    links,
    users: 400_000,
    researched: [...preseedGame().researched, 'pooling', 'opcache'],
  }
}

const game = board()
const graph = graphOf(game)
const N = game.nodes.length
const demand = demandOf(game)
const routes = userRoutes(game, (n) => (graph.routes.get(n.id)?.length ?? 0) > 0)
const intake = []
for (const entry of routes)
  if (entry.source) {
    const s = graph.at.get(entry.source.id)
    intake[s] = (intake[s] ?? 0) + entry.share
  }

// TypeScript's pass, from the same seed the solve uses.
const inputs = {
  game,
  graph,
  demand,
  boost: null,
  callLatency: [],
  inflight: [],
  weights: [],
  failures: [],
  nominal: [],
  sick: [],
  intake,
  taskFailure: [],
  taskCapacity: [],
  connectionUsed: [],
}
const tsPass = forward(inputs)

const wasm = await WebAssembly.instantiate(
  readFileSync('./target/wasm32-unknown-unknown/release/qsim.wasm'),
)
const X = wasm.instance.exports
const write = (bytes) => {
  const p = X.alloc(Math.max(1, bytes.byteLength))
  new Uint8Array(X.memory.buffer, p, bytes.byteLength).set(bytes)
  return p
}
const ptrF = (v) => {
  const n = Math.max(1, v.length)
  const p = X.alloc(n * 8)
  new Float64Array(X.memory.buffer, p, v.length).set(v)
  return p
}
const bitset = (ids, present) => {
  const bytes = new Uint8Array(Math.ceil(ids.length / 8))
  for (const id of present) {
    const i = ids.indexOf(id)
    if (i >= 0) bytes[i >> 3] |= 1 << (i & 7)
  }
  return bytes
}
const ptrI = (v) => {
  const n = Math.max(1, v.length)
  const p = X.alloc(n * 4)
  new Int32Array(X.memory.buffer, p, v.length).set(v)
  return p
}

// The Rust scalar block, one per Node.
const SCALARS = X.scalar_len()
const slot = new Map(game.nodes.map((n, i) => [n.id, i]))
const scalars = new Float64Array(N * SCALARS)
const nodeFields = new Float64Array(N * 10)
game.nodes.forEach((n, i) => {
  const s = i * SCALARS
  const put = (at, value) => {
    scalars[s + at] = value
  }
  put(0, game.users)
  put(1, game.seed)
  put(2, game.time)
  put(6, n.size)
  put(7, n.workers)
  put(8, n.replicas)
  put(9, RUNTIME_IDS.indexOf(n.runtime))
  put(10, FRAMEWORK_IDS.indexOf(n.framework))
  put(11, FAMILY_IDS.indexOf(n.family))
  put(12, n.compress ? 1 : 0)
  put(13, n.localDb ? 1 : 0)
  put(14, n.leak)
  put(15, n.credits)
  put(16, n.prefetch)
  put(17, ['static', 'dynamic', 'ondemand'].indexOf(n.pm))
  put(18, 1)
  put(19, ['g1', 'parallel', 'zgc'].indexOf(n.collector))
  put(20, n.recycle ? 1 : 0)
  put(21, n.life._tag === 'Running' ? 1 : (n.life.warm ?? 1))
  put(25, n.dbEngine === 'mysql' ? 1 : 0)
  put(26, 1)
  put(29, 1)
  put(39, n.shards ?? 1)
  put(40, ['hash', 'range', 'tenant', 'region'].indexOf(n.shardKey))
  put(41, ['general', 'provisioned'].indexOf(n.iops))
  put(42, ['keep', 'archive', 'delete'].indexOf(n.keep))
  put(43, ['single', 'multi', 'sharded'].indexOf(n.topology))
  put(44, n.depth ?? 0)
  put(45, 0)
  put(
    47,
    game.services.reduce((sum, service) => sum + service.indexes, 0),
  )
  put(46, usersOfGroup(game, dataGroupOf(game, n)))

  const b = i * 10
  nodeFields[b] = COMPONENT_IDS.indexOf(n.type)
  nodeFields[b + 1] = n.life._tag === 'Restarting' || n.life._tag === 'Stopped' ? 1 : 0
  nodeFields[b + 2] = n.sticky ? 1 : 0
  nodeFields[b + 3] = ['weighted', 'round-robin', 'least-conn', 'p2c', 'hash'].indexOf(n.policy)
  nodeFields[b + 4] = n.ttl
  nodeFields[b + 5] = n.checkEvery
  nodeFields[b + 6] = n.deepCheck ? 1 : 0
  nodeFields[b + 7] = n.type === 'replica' ? 1 : 0
  nodeFields[b + 8] = 0
  nodeFields[b + 9] = n.service._tag === 'Draining' ? 1 : 0
})

const edgeFields = new Float64Array(graph.edges.length * 4)
graph.edges.forEach((e, i) => {
  edgeFields[i * 4] = slot.get(e.from.id)
  edgeFields[i * 4 + 1] = slot.get(e.to.id)
  edgeFields[i * 4 + 2] = e.link.kinds ? kindMask(e.link.kinds) : kindMask(ALL)
  edgeFields[i * 4 + 3] = e.policy.retry === 'none' ? 0 : 1
})
const starts = new Int32Array(N + 1)
const outEdges = []
game.nodes.forEach((n, i) => {
  starts[i] = outEdges.length
  for (const e of graph.out.get(n.id) ?? []) outEdges.push(e.index)
})
starts[N] = outEdges.length

const weights = new Float64Array(N).fill(1)
const nominal = new Float64Array(N).fill(1)
const sick = new Uint8Array(N)
const demandArr = new Float64Array(NK)
for (let k = 0; k < NK; k += 1) demandArr[k] = demand[REQUEST_KINDS[k]] ?? 0
const intakeArr = new Float64Array(N)
for (let i = 0; i < N; i += 1) intakeArr[i] = intake[i] ?? 0
const latency = new Float64Array(NR * NK)

X.design_set(
  N,
  graph.edges.length,
  ptrF(Array.from(nodeFields)),
  ptrF(Array.from(edgeFields)),
  ptrI(Array.from(starts)),
  ptrI(outEdges),
  ptrF(Array.from(weights)),
  ptrF(Array.from(nominal)),
  sick,
  graph.healthChecked ? 1 : 0,
  graph.time,
)

const arrivingPtr = X.alloc(N * NK * 8)
const modelPtr = X.alloc(N * 6 * 8)
X.forward_run(
  N,
  ptrF(Array.from(scalars)),
  write(bitset(RESEARCH_IDS, game.researched)),
  write(bitset(FEATURE_IDS, Object.keys(game.features ?? {}))),
  ptrF(Array.from(demandArr)),
  ptrF(Array.from(intakeArr)),
  ptrF(Array.from(latency)),
  arrivingPtr,
  modelPtr,
)

const rustArriving = new Float64Array(X.memory.buffer, arrivingPtr, N * NK)
let checked = 0
let wrong = 0
const bad = []
game.nodes.forEach((n, i) => {
  for (const kind of ALL) {
    const k = ALL.indexOf(kind)
    const ts = tsPass.arriving[i]?.[kind] ?? 0
    const rs = rustArriving[i * NK + k]
    checked += 1
    if (!Object.is(ts, rs)) {
      wrong += 1
      if (bad.length < 8) bad.push(`${n.type} ${n.id}/${kind}: ts ${ts} rust ${rs}`)
    }
  }
})
console.log(`forward arriving: ${checked - wrong}/${checked} rates identical`)
for (const line of bad) console.log('   ', line)

// The model figures the pass produced.
const rustModel = new Float64Array(X.memory.buffer, modelPtr, N * 6)
let mChecked = 0,
  mWrong = 0
const mBad = []
const KIND_FOR_SLOT = ['q-read', 'q-write', 'q-tx']
game.nodes.forEach((n, i) => {
  const ts = tsPass.models[i]
  const pairs = [
    [ts.utilization, rustModel[i * 6]],
    [ts.share, rustModel[i * 6 + 1]],
    [ts.capacity, rustModel[i * 6 + 2]],
  ]
  for (let slot = 0; slot < 3; slot += 1) {
    const service = ts.service?.[KIND_FOR_SLOT[slot]]
    if (service === undefined) continue
    pairs.push([service.variableMs, rustModel[i * 6 + 3 + slot]])
  }
  for (const [a, b] of pairs) {
    mChecked += 1
    if (!Object.is(a, b)) {
      mWrong += 1
      if (mBad.length < 6) mBad.push(`${n.type} ${n.id}: ts ${a} rust ${b}`)
    }
  }
})
console.log(`forward models: ${mChecked - mWrong}/${mChecked} figures identical`)
for (const line of mBad) console.log('   ', line)

const time = (label, run, samples = 200) => {
  for (let i = 0; i < 50; i += 1) run()
  const t = []
  for (let i = 0; i < samples; i += 1) {
    const s = process.hrtime.bigint()
    run()
    t.push(Number(process.hrtime.bigint() - s) / 1e6)
  }
  t.sort((a, b) => a - b)
  const mean = t.reduce((a, b) => a + b, 0) / t.length
  console.log(`${label.padEnd(42)} ${(mean * 1000).toFixed(1).padStart(8)} us`)
  return mean
}
const scalarsPtr = ptrF(Array.from(scalars))
const demandPtr = ptrF(Array.from(demandArr))
const intakePtr = ptrF(Array.from(intakeArr))
const latencyPtr = ptrF(Array.from(latency))
const researchPtr = write(bitset(RESEARCH_IDS, game.researched))
const featuresPtr = write(bitset(FEATURE_IDS, Object.keys(game.features ?? {})))
const tsTime = time('TypeScript forward, one pass', () => forward(inputs))
const rsTime = time('Rust forward, one pass', () =>
  X.forward_run(
    N,
    scalarsPtr,
    researchPtr,
    featuresPtr,
    demandPtr,
    intakePtr,
    latencyPtr,
    arrivingPtr,
    modelPtr,
  ),
)
console.log(`\nforward speedup ${(tsTime / rsTime).toFixed(2)}x`)
