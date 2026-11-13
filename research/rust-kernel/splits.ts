/**
 * Every split in the benchmark board, computed by the TypeScript solver and by
 * the Rust routing port, compared Edge by Edge and share by share.
 */
import { ALL, BLOCK, NK, load, writeDesign, stressBoard, graph } from './harness.ts'

const ROOT = new URL('../../packages/simulation/src', import.meta.url).pathname
const { splitOf, solverOf } = await import(`${ROOT}/solve-pass.ts`)
const { demandOf } = await import(`${ROOT}/solve-demand.ts`)

const game = stressBoard()
const design = graph.graphOf(game)
const N = game.nodes.length
const kernel = await load()
const { X, view, reserve } = kernel
const info = writeDesign(kernel, game, design)

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
  intake: [],
  taskFailure: [],
  taskCapacity: [],
  connectionUsed: [],
}
void solverOf

const stride = X.split_stride()
reserve(BLOCK.splits, stride * N * NK)
const compare = (label, weights, nominal, sick, tsInputs, lbAlgorithms) => {
  writeDesign(kernel, game, design, { weights, nominal, sick })
  const status = X.design_set(design.healthChecked ? 1 : 0, design.time)
  if (status !== 0) throw new Error(`design_set: status ${status}`)
  const split = X.split_all(lbAlgorithms ? 1 : 0)
  if (split !== 0) throw new Error(`split_all: status ${split}`)
  const rust = view(BLOCK.splits, Float64Array, stride * N * NK)
  let checked = 0
  let wrong = 0
  const bad = []
  game.nodes.forEach((n, slot) => {
    for (const kind of ALL) {
      const k = ALL.indexOf(kind)
      const ts = splitOf(tsInputs, n, kind)
      const base = (slot * NK + k) * stride
      const count = rust[base]
      checked += 1
      if (count !== ts.length) {
        wrong += 1
        if (bad.length < 6) bad.push(`${n.type} ${n.id}/${kind}: ts ${ts.length} rust ${count}`)
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
}

const ones = new Array(N).fill(1)
const zeros = new Uint8Array(N)
compare('nominal all 1', ones, ones, zeros, inputs, game.researched.includes('lb-algorithms'))

// A second case with uneven weights, which exercises `weighted` and `p2c`.
const unevenWeights = Array.from({ length: N }, (_, i) => 1 + (i % 5) * 0.75)
const unevenNominal = Array.from({ length: N }, (_, i) => 1 + (i % 7) * 1.5)
compare(
  'uneven weights',
  unevenWeights,
  unevenNominal,
  zeros,
  { ...inputs, weights: unevenWeights, nominal: unevenNominal },
  false,
)

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
  for (const n of game.nodes) for (const kind of ALL) splitOf(inputs, n, kind)
})
writeDesign(kernel, game, design, { weights: ones, nominal: ones, sick: zeros })
X.design_set(design.healthChecked ? 1 : 0, design.time)
const rs = time('Rust, every split from a compiled Design', () => X.split_all(0))
console.log(`\nsplit speedup ${(ts / rs).toFixed(2)}x`)
