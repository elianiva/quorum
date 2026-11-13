/**
 * Every split in the benchmark board, computed by the TypeScript solver and by
 * the Rust routing port, compared Edge by Edge and share by share.
 */
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../packages/simulation/src', import.meta.url).pathname
const { link, node, preseedGame } = await import(`${ROOT}/company.ts`)
const { graphOf } = await import(`${ROOT}/solve-graph.ts`)
const { demandOf } = await import(`${ROOT}/solve-demand.ts`)
const { userRoutes } = await import(`${ROOT}/regions.ts`)
const { splitOf, solverOf } = await import(`${ROOT}/solve-pass.ts`)
const { REQUEST_KINDS, BACKEND_KINDS, COMPONENT_IDS, RESEARCH_IDS, FEATURE_IDS } = await import(
  `${ROOT}/catalog.ts`
)

// Same name the Rust catalog uses, so kinds line up.
const ALL_KINDS = [...REQUEST_KINDS, ...BACKEND_KINDS]
const NK = ALL_KINDS.length
const kindMask = (kinds) => {
  let m = 0n
  for (const k of kinds) {
    const i = ALL_KINDS.indexOf(k)
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

const wasm = await WebAssembly.instantiate(
  readFileSync('./target/wasm32-unknown-unknown/release/qsim.wasm'),
)
const X = wasm.instance.exports
const ptrF = (values) => {
  const p = X.alloc(values.length * 8)
  new Float64Array(X.memory.buffer, p, values.length).set(values)
  return p
}
const ptrI = (values) => {
  const p = X.alloc(values.length * 4)
  new Int32Array(X.memory.buffer, p, values.length).set(values)
  return p
}

// Design → flat buffers.
const nodeFields = new Float64Array(N * 10)
const slotOf = new Map(game.nodes.map((n, i) => [n.id, i]))
game.nodes.forEach((n, i) => {
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

// Edges in the Rust order: one per routing Link, numbered as the graph numbers them.
const edgeFields = new Float64Array(graph.edges.length * 4)
const outOffsets = new Int32Array(N + 1)
const outEdges = []
graph.edges.forEach((edge, index) => {
  edgeFields[index * 4] = slotOf.get(edge.from.id)
  edgeFields[index * 4 + 1] = slotOf.get(edge.to.id)
  edgeFields[index * 4 + 2] = edge.link.kinds ? kindMask(edge.link.kinds) : kindMask(ALL_KINDS)
  edgeFields[index * 4 + 3] =
    edge.policy.retry === 'none' ? 0 : edge.policy.retry === 'naive' ? 1 : 2
})
game.nodes.forEach((n, i) => {
  outOffsets[i] = outEdges.length
  for (const edge of graph.out.get(n.id) ?? []) outEdges.push(edge.index)
})
outOffsets[N] = outEdges.length

// A pass's weights, and the probe's nominal, as the solver would have them.
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
const solver = solverOf(inputs)

// The Rust split is asked with the weights TS would use: nominal, then capacity.
const nominal = new Float64Array(N).fill(1)
const weights = new Float64Array(N).fill(1)
const sickBytes = new Uint8Array(N)
const stride = X.split_stride()
const resultPtr = X.alloc(stride * N * NK * 8)

const runRust = (w, nom, sick, healthChecked, time, lbAlgorithms) => {
  X.design_set(
    N,
    graph.edges.length,
    ptrF(Array.from(nodeFields)),
    ptrF(Array.from(edgeFields)),
    ptrI(Array.from(outOffsets)),
    ptrI(outEdges),
    ptrF(Array.from(w)),
    ptrF(Array.from(nom)),
    sick,
    healthChecked ? 1 : 0,
    time,
  )
  X.split_all(lbAlgorithms ? 1 : 0, resultPtr)
}

const compare = (label) => {
  runRust(
    weights,
    nominal,
    sickBytes,
    graph.healthChecked,
    graph.time,
    game.researched.includes('lb-algorithms'),
  )
  const rust = new Float64Array(X.memory.buffer, resultPtr, stride * N * NK)
  let checked = 0
  let wrong = 0
  const bad = []
  game.nodes.forEach((n, slot) => {
    for (const kind of ALL_KINDS) {
      const k = ALL_KINDS.indexOf(kind)
      const ts = splitOf(inputs, n, kind)
      const base = (slot * NK + k) * stride
      const count = rust[base]
      checked += 1
      if (count !== ts.length) {
        wrong += 1
        if (bad.length < 30) bad.push(`${n.type} ${n.id}/${kind}: ts ${ts.length} rust ${count}`)
        continue
      }
      for (let i = 0; i < ts.length; i += 1) {
        const [edge, share] = ts[i]
        if (rust[base + 1 + i * 2] !== edge.index || !Object.is(rust[base + 2 + i * 2], share)) {
          wrong += 1
          if (bad.length < 6)
            bad.push(
              `${n.id}/${kind}#${i}: ts ${edge.index}:${share} rust ${rust[base + 1 + i * 2]}:${rust[base + 2 + i * 2]}`,
            )
          break
        }
      }
    }
  })
  console.log(`${label.padEnd(22)} ${checked - wrong}/${checked} splits identical`)
  for (const line of bad) console.log('   ', line)
  return wrong === 0
}

compare('nominal all 1')

// A second case with uneven weights, which exercises `weighted` and `p2c`.
for (let i = 0; i < N; i += 1) {
  nominal[i] = 1 + (i % 7) * 1.5
  weights[i] = 1 + (i % 5) * 0.75
}
// TypeScript must see the same weights, so rebuild its Inputs.
const inputs2 = { ...inputs, weights: Array.from(weights), nominal: Array.from(nominal) }
const realSplit = splitOf
const tsSplit = (n, kind) => realSplit(inputs2, n, kind)
const original = splitOf
{
  const g2 = game
  let checked = 0,
    wrong = 0
  runRust(weights, nominal, sickBytes, graph.healthChecked, graph.time, false)
  const rust = new Float64Array(X.memory.buffer, resultPtr, stride * N * NK)
  g2.nodes.forEach((n, slot) => {
    for (const kind of ALL_KINDS) {
      const k = ALL_KINDS.indexOf(kind)
      const ts = tsSplit(n, kind)
      const base = (slot * NK + k) * stride
      checked += 1
      if (rust[base] !== ts.length) {
        wrong += 1
        return
      }
      for (let i = 0; i < ts.length; i += 1) {
        const [edge, share] = ts[i]
        if (rust[base + 1 + i * 2] !== edge.index || !Object.is(rust[base + 2 + i * 2], share)) {
          wrong += 1
          return
        }
      }
    }
  })
  console.log(`${'uneven weights'.padEnd(22)} ${checked - wrong}/${checked} splits identical`)
}

// The timing: every split in the board, one call.
const time = (label, run, samples = 400) => {
  for (let i = 0; i < 80; i += 1) run()
  const t = []
  for (let i = 0; i < samples; i += 1) {
    const s = process.hrtime.bigint()
    run()
    t.push(Number(process.hrtime.bigint() - s) / 1e6)
  }
  t.sort((a, b) => a - b)
  const mean = t.reduce((a, b) => a + b, 0) / t.length
  console.log(`${label.padEnd(44)} ${(mean * 1000).toFixed(1).padStart(8)} us`)
  return mean
}
const ts = time('TypeScript, every split (200 x 33)', () => {
  for (const n of game.nodes) for (const kind of ALL_KINDS) splitOf(inputs, n, kind)
})
const designPtrs = {
  nodes: ptrF(Array.from(nodeFields)),
  edges: ptrF(Array.from(edgeFields)),
  starts: ptrI(Array.from(outOffsets)),
  out: ptrI(outEdges),
  w: ptrF(Array.from(weights)),
  nom: ptrF(Array.from(nominal)),
}
X.design_set(
  N,
  graph.edges.length,
  designPtrs.nodes,
  designPtrs.edges,
  designPtrs.starts,
  designPtrs.out,
  designPtrs.w,
  designPtrs.nom,
  sickBytes,
  graph.healthChecked ? 1 : 0,
  graph.time,
)
const rs = time('Rust, every split from a compiled Design', () => X.split_all(0, resultPtr))
console.log(`\nsplit speedup ${(ts / rs).toFixed(2)}x`)
