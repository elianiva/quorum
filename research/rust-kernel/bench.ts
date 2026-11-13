/**
 * The measurement harness: the same figures the TypeScript benchmark reports
 * (`solveFlow`, `solve`, `bottleneckOf`) for both implementations on the 200-Node
 * stress board, compared figure by figure, then timed.
 *
 * Run with `node bench.ts`. Timings are wall-clock means over the samples shown;
 * the machine is shared, so treat the ratios as the figure and the absolutes as
 * context.
 */
import { load, writeDesign, writeGame, solveRun, bottleneckRun, stressBoard, graph, compareLedger, passesOf, BLOCK } from './harness.ts'

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
const ledger = solveRun(kernel, game)
const searched = bottleneckRun(kernel, game)

// ---- the figures, side by side ----
const { checked: ledgerChecked, wrong: ledgerWrong, bad } = compareLedger(game, flow, ledger)
let checked = ledgerChecked
let wrong = ledgerWrong
const tsBottleneck = marked.bottleneck
const rustBottleneck = searched.bottleneck
for (const [label, ts, rust] of [
  ['bottleneck', tsBottleneck, rustBottleneck],
  ['bottleneck revenue', marked.revenue, searched.revenue],
]) {
  checked += 1
  if (!Object.is(ts, rust)) {
    wrong += 1
    bad.push(`${label}: ts ${ts} rust ${rust}`)
  }
}

console.log(`solve figures: ${checked - wrong}/${checked} identical`)
for (const line of bad) console.log('   ', line)
console.log(`bottleneck: TypeScript ${tsBottleneck}, Rust ${rustBottleneck}`)
console.log(`revenue:    TypeScript ${flow.revenue}, Rust ${ledger.revenue}`)
console.log(`passes:     Rust ${passesOf(kernel)}`)

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
const rsFlow = time('Rust solveFlow (6 passes, Ledger)', () => solveRun(kernel, game))
const tsBottleneckTime = time('TypeScript bottleneckOf (up to 3 re-solves)', () =>
  bottleneckOf(game, flow),
)
const rsBottleneckTime = time('Rust bottleneckOf (up to 3 re-solves)', () => bottleneckRun(kernel, game))
const tsSolve = time('TypeScript solve (flow + bottleneck)', () => {
  const fresh = { ...game }
  const base = solveFlow(fresh)
  return bottleneckOf(fresh, base)
})
const rsSolve = time('Rust solve (flow + bottleneck)', () => {
  solveRun(kernel, game)
  return bottleneckRun(kernel, game)
})

// ---- memory ----
// Three figures that measure different things, so all three are reported:
// the wasm module's whole linear memory (working buffers included), the size of
// the Ledger block the kernel writes, and the JSON size of the TypeScript Ledger
// it is compared with.
const wasmBytes = X.memory.buffer.byteLength
const rustLedgerBytes = X.len(BLOCK.ledger) * 8
const tsLedgerBytes = JSON.stringify(flow).length

console.log('')
console.log(`speedup solveFlow    ${(tsFlow / rsFlow).toFixed(2)}x`)
console.log(`speedup bottleneckOf ${(tsBottleneckTime / rsBottleneckTime).toFixed(2)}x`)
console.log(`speedup solve        ${(tsSolve / rsSolve).toFixed(2)}x`)
console.log('')
console.log(`wasm linear memory after a solve   ${(wasmBytes / 1024).toFixed(1)} KB`)
console.log(`Rust Ledger block                  ${(rustLedgerBytes / 1024).toFixed(1)} KB`)
console.log(`TypeScript Ledger as JSON          ${(tsLedgerBytes / 1024).toFixed(1)} KB`)
