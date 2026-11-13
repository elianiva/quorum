/** Compares the Rust outcome tree with TypeScript's, for every Users Node and kind. */
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../packages/simulation/src', import.meta.url).pathname
const { link, node, preseedGame } = await import(`${ROOT}/company.ts`)
const { graphOf } = await import(`${ROOT}/solve-graph.ts`)
const { demandOf } = await import(`${ROOT}/solve-demand.ts`)
const { userRoutes } = await import(`${ROOT}/regions.ts`)
const { forward } = await import(`${ROOT}/solve-pass.ts`)
const { outcomesOf } = await import(`${ROOT}/solve-outcomes.ts`)
const { usersOfGroup, dataGroupOf } = await import(`${ROOT}/lookups.ts`)
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

const ALL = [...REQUEST_KINDS, ...BACKEND_KINDS]
const NK = ALL.length
const NR = REQUEST_KINDS.length

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
const tsOutcomes = outcomesOf(inputs, tsPass)

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
  const p = X.alloc(Math.max(1, v.length) * 8)
  new Float64Array(X.memory.buffer, p, v.length).set(v)
  return p
}
const ptrI = (v) => {
  const p = X.alloc(Math.max(1, v.length) * 4)
  new Int32Array(X.memory.buffer, p, v.length).set(v)
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

const SCALARS = X.scalar_len()
const slot = new Map(game.nodes.map((n, i) => [n.id, i]))
const scalars = new Float64Array(N * SCALARS)
const nodeFields = new Float64Array(N * 10)
game.nodes.forEach((n, i) => {
  const s = i * SCALARS
  const put = (at, v) => {
    scalars[s + at] = v
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
  put(46, usersOfGroup(game, dataGroupOf(game, n)))
  put(
    47,
    game.services.reduce((sum, service) => sum + service.indexes, 0),
  )

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

const edgeFields = new Float64Array(graph.edges.length * 8)
graph.edges.forEach((e, i) => {
  const b = i * 8
  edgeFields[b] = slot.get(e.from.id)
  edgeFields[b + 1] = slot.get(e.to.id)
  edgeFields[b + 2] = e.link.kinds
    ? (() => {
        let m = 0n
        for (const k of e.link.kinds) {
          const j = ALL.indexOf(k)
          if (j >= 0) m |= 1n << BigInt(j)
        }
        return Number(m)
      })()
    : Number((1n << 33n) - 1n)
  edgeFields[b + 3] = e.policy.retry === 'none' ? 0 : e.policy.retry === 'naive' ? 1 : 2
  edgeFields[b + 4] = e.policy.timeout
  edgeFields[b + 5] = e.policy.open ? 1 : 0
  edgeFields[b + 6] = e.policy.bulkhead ? 1 : 0
  edgeFields[b + 7] = e.policy.hedge ? 1 : 0
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

const outcomePtr = X.alloc(N * NR * 19 * 8)
X.outcome_run(
  N,
  ptrF(Array.from(scalars)),
  write(bitset(RESEARCH_IDS, game.researched)),
  write(bitset(FEATURE_IDS, Object.keys(game.features ?? {}))),
  ptrF(Array.from(demandArr)),
  ptrF(Array.from(intakeArr)),
  ptrF(new Array(NR * NK).fill(0)),
  outcomePtr,
)

const rust = new Float64Array(X.memory.buffer, outcomePtr, N * NR * 19)
let checked = 0
let wrong = 0
const bad = []
const users = game.nodes.findIndex((n) => n.type === 'users')
for (const kind of REQUEST_KINDS) {
  const k = REQUEST_KINDS.indexOf(kind)
  const ts = tsOutcomes.outcome(game.nodes[users], kind)
  const b = (users * NR + k) * 19
  const pairs = [
    ['success', ts.success, rust[b]],
    ['fixed', ts.fixedMs, rust[b + 1]],
    ['variable', ts.variableMs, rust[b + 2]],
    ['tailP', ts.tailP, rust[b + 3]],
    ['tailMs', ts.tailMs, rust[b + 4]],
    ['stale', ts.stale, rust[b + 5]],
    ['value', ts.value, rust[b + 6]],
  ]
  for (const [name, a, r] of pairs) {
    checked += 1
    if (!Object.is(a, r)) {
      wrong += 1
      if (bad.length < 6) bad.push(`${kind}.${name}: ts ${a} rust ${r}`)
    }
  }
}
console.log(`outcomes: ${checked - wrong}/${checked} figures identical`)
for (const line of bad) console.log('   ', line)
