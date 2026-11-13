/**
 * The measurement harness: the same figures the TypeScript benchmark reports
 * (`solveFlow`, `solve`, `bottleneckOf`) for both implementations on the 200-Node
 * stress board, compared figure by figure, then timed.
 *
 * Run with `node bench.ts`. Timings are wall-clock means over the samples shown;
 * the machine is shared, so treat the ratios as the figure and the absolutes as
 * context.
 */
import { NR, load, writeDesign, writeGame, solveRun, bottleneckRun, stressBoard, graph } from './harness.ts'

const ROOT = new URL('../../packages/simulation/src', import.meta.url).pathname
const { solveFlow, solve, bottleneckOf } = await import(`${ROOT}/solve.ts`)

const game = stressBoard()
const design = graph.graphOf(game)
const N = game.nodes.length

// ---- TypeScript ----
const flow = solveFlow(game)
const marked = solve(game)

// ---- Rust ----
const kernel = await load()
const { X } = kernel
const info = writeDesign(kernel, game, design)
writeGame(kernel, game, design, info)
X.design_set(design.healthChecked ? 1 : 0, design.time)
const ledger = solveRun(kernel, N)
const searched = bottleneckRun(kernel, N)

// ---- the figures, side by side ----
let checked = 0
let wrong = 0
const bad = []
const compare = (label, ts, rust) => {
  checked += 1
  if (!Object.is(ts, rust)) {
    wrong += 1
    if (bad.length < 12) bad.push(`${label}: ts ${ts} rust ${rust}`)
  }
}

compare('revenue', flow.revenue, ledger.revenue)
compare('demand', flow.demand, ledger.demand)
compare('served', flow.served, ledger.served)
compare('apdex', flow.apdex, ledger.apdex)
compare('latency', flow.latency, ledger.latency)
compare('p50', flow.p50, ledger.p50)
compare('p95', flow.p95, ledger.p95)
compare('p99', flow.p99, ledger.p99)
compare('errorShare', flow.errorShare, ledger.errorShare)
compare('fines', flow.fines, ledger.fines)
compare('subscriptions', flow.subscriptions, ledger.subscriptions)
compare(
  'errorTotal',
  Object.values(flow.errors).reduce((sum, rate) => sum + rate, 0),
  ledger.errorTotal,
)
for (let kind = 0; kind < NR; kind += 1) {
  const name = Object.keys(flow.kinds)[kind]
  const ts = flow.kinds[name]
  const rust = ledger.kinds[kind]
  if (!ts) {
    compare(`kind ${name} absent`, 0, rust.rate)
    continue
  }
  compare(`${name}.rate`, ts.rate, rust.rate)
  compare(`${name}.success`, ts.success, rust.success)
  compare(`${name}.apdex`, ts.apdex, rust.apdex)
  compare(`${name}.mean`, ts.mean, rust.mean)
  compare(`${name}.p50`, ts.p50, rust.p50)
  compare(`${name}.p95`, ts.p95, rust.p95)
  compare(`${name}.p99`, ts.p99, rust.p99)
}
game.nodes.forEach((node, slot) => {
  const ts = flow.nodes[node.id]
  const rust = ledger.nodes[slot]
  compare(`${node.id}.inbound`, ts.inbound, rust.inbound)
  compare(`${node.id}.capacity`, ts.capacity, rust.capacity)
  compare(`${node.id}.utilization`, ts.utilization, rust.utilization)
  compare(`${node.id}.dropped`, ts.dropped, rust.dropped)
  compare(`${node.id}.refused`, ts.refused, rust.refused)
  compare(`${node.id}.stranded`, ts.stranded, rust.stranded)
  compare(`${node.id}.latency`, ts.latency, rust.latency)
  compare(`${node.id}.p99`, ts.p99, rust.p99)
  compare(`${node.id}.repeated`, ts.repeated, rust.repeated)
})
const tsBottleneck = marked.bottleneck
const rustBottleneck = searched.bottleneck >= 0 ? game.nodes[searched.bottleneck].id : null
compare('bottleneck', tsBottleneck, rustBottleneck)
compare('bottleneck revenue', marked.revenue, searched.revenue)

console.log(`solve figures: ${checked - wrong}/${checked} identical`)
for (const line of bad) console.log('   ', line)
console.log(`bottleneck: TypeScript ${tsBottleneck}, Rust ${rustBottleneck}`)
console.log(`revenue:    TypeScript ${flow.revenue}, Rust ${ledger.revenue}`)
console.log(`passes:     Rust ${ledger.passes}`)

// ---- timings ----
const time = (label, run, samples = 40) => {
  for (let i = 0; i < 5; i += 1) run()
  const t = []
  for (let i = 0; i < samples; i += 1) {
    const s = process.hrtime.bigint()
    run()
    t.push(Number(process.hrtime.bigint() - s) / 1e6)
  }
  t.sort((a, b) => a - b)
  const mean = t.reduce((a, b) => a + b, 0) / t.length
  console.log(`${label.padEnd(46)} ${(mean * 1000).toFixed(1).padStart(9)} us`)
  return mean
}

const tsFlow = time('TypeScript solveFlow (6 passes, Ledger)', () => solveFlow({ ...game }))
const rsFlow = time('Rust solveFlow (6 passes, Ledger)', () => solveRun(kernel, N))
const tsBottleneckTime = time('TypeScript bottleneckOf (up to 3 re-solves)', () =>
  bottleneckOf(game, flow),
)
const rsBottleneckTime = time('Rust bottleneckOf (up to 3 re-solves)', () => bottleneckRun(kernel, N))
const tsSolve = time('TypeScript solve (flow + bottleneck)', () => {
  const fresh = { ...game }
  const base = solveFlow(fresh)
  return bottleneckOf(fresh, base)
})
const rsSolve = time('Rust solve (flow + bottleneck)', () => {
  solveRun(kernel, N)
  return bottleneckRun(kernel, N)
})

// ---- memory ----
// Three figures that measure different things, so all three are reported:
// the wasm module's whole linear memory (working buffers included), the size of
// the Ledger block the kernel writes, and the JSON size of the TypeScript Ledger
// it is compared with.
const wasmBytes = X.memory.buffer.byteLength
const rustLedgerBytes = X.ledger_len_for(N) * 8
const tsLedgerBytes = JSON.stringify(flow).length

console.log('')
console.log(`speedup solveFlow    ${(tsFlow / rsFlow).toFixed(2)}x`)
console.log(`speedup bottleneckOf ${(tsBottleneckTime / rsBottleneckTime).toFixed(2)}x`)
console.log(`speedup solve        ${(tsSolve / rsSolve).toFixed(2)}x`)
console.log('')
console.log(`wasm linear memory after a solve   ${(wasmBytes / 1024).toFixed(1)} KB`)
console.log(`Rust Ledger block                  ${(rustLedgerBytes / 1024).toFixed(1)} KB`)
console.log(`TypeScript Ledger as JSON          ${(tsLedgerBytes / 1024).toFixed(1)} KB`)
