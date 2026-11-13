/** Compares the Rust forward pass's arriving rates and model figures with TypeScript's. */
import { ALL, NK, NR, load, writeDesign, writeGame, forwardRun, stressBoard, graph } from './harness.ts'

const game = stressBoard()
const design = graph.graphOf(game)
const N = game.nodes.length
const kernel = await load()
const { X } = kernel
const info = writeDesign(kernel, game, design)
const written = writeGame(kernel, game, design, info)
X.design_set(design.healthChecked ? 1 : 0, design.time)
const rust = forwardRun(kernel, N)

// TypeScript's pass, from the same seed the solve uses.
const { forward } = await import(
  new URL('../../packages/simulation/src/solve-pass.ts', import.meta.url).pathname
)
const { demandOf } = await import(
  new URL('../../packages/simulation/src/solve-demand.ts', import.meta.url).pathname
)
const inputs = {
  game,
  graph: design,
  demand: demandOf(game),
  boost: null,
  callLatency: [],
  inflight: [],
  weights: [],
  failures: [],
  nominal: [],
  sick: [],
  intake: written.intake,
  taskFailure: [],
  taskCapacity: [],
  connectionUsed: [],
}
const tsPass = forward(inputs)

let checked = 0
let wrong = 0
const bad = []
game.nodes.forEach((n, i) => {
  for (const kind of ALL) {
    const k = ALL.indexOf(kind)
    const ts = tsPass.arriving[i]?.[kind] ?? 0
    const rs = rust.arriving[i * NK + k]
    checked += 1
    if (!Object.is(ts, rs)) {
      wrong += 1
      if (bad.length < 8) bad.push(`${n.type} ${n.id}/${kind}: ts ${ts} rust ${rs}`)
    }
  }
})
console.log(`forward arriving: ${checked - wrong}/${checked} rates identical`)
for (const line of bad) console.log('   ', line)

let mChecked = 0
let mWrong = 0
const mBad = []
game.nodes.forEach((n, i) => {
  const ts = tsPass.models[i]
  const base = i * rust.stride
  const pairs = [
    ['utilization', ts.utilization, rust.models[base]],
    ['share', ts.share, rust.models[base + 1]],
    ['capacity', ts.capacity, rust.models[base + 2]],
  ]
  for (let kind = 0; kind < NR; kind += 1) {
    const service = ts.service?.[ALL[kind]]
    if (service === undefined) continue
    pairs.push([`variable ${ALL[kind]}`, service.variableMs, rust.models[base + 18 + NR + kind]])
    pairs.push([`fixed ${ALL[kind]}`, service.fixedMs, rust.models[base + 18 + kind]])
  }
  for (const [name, a, b] of pairs) {
    mChecked += 1
    if (!Object.is(a, b)) {
      mWrong += 1
      if (mBad.length < 6) mBad.push(`${n.type} ${n.id} ${name}: ts ${a} rust ${b}`)
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
const tsTime = time('TypeScript forward, one pass', () => forward(inputs))
const rsTime = time('Rust forward, one pass', () => X.forward_run())
console.log(`\nforward speedup ${(tsTime / rsTime).toFixed(2)}x`)
