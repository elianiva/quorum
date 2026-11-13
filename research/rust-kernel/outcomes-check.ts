/** Compares the Rust outcome tree with TypeScript's, for every Users Node and kind. */
import { NR, S, load, writeDesign, writeGame, outcomeRun, stressBoard, graph, demand, pass } from './harness.ts'

const game = stressBoard()
const design = graph.graphOf(game)
const N = game.nodes.length
const kernel = await load()
const { X } = kernel
const info = writeDesign(kernel, game, design)
const written = writeGame(kernel, game, design, info)
X.design_set(design.healthChecked ? 1 : 0, design.time)

const inputs = {
  game,
  graph: design,
  demand: demand.demandOf(game),
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
const tsPass = pass.forward(inputs)
const tsOutcomes = (await import(
  new URL('../../packages/simulation/src/solve-outcomes.ts', import.meta.url).pathname
)).outcomesOf(inputs, tsPass)

const stride = X.outcome_stride()
const rust = outcomeRun(kernel, N)
let checked = 0
let wrong = 0
const bad = []
const users = game.nodes.findIndex((n) => n.type === 'users')
for (const kind of S.REQUEST_KINDS) {
  const k = S.REQUEST_KINDS.indexOf(kind)
  const ts = tsOutcomes.outcome(game.nodes[users], kind)
  const b = (users * NR + k) * stride
  const pairs = [
    ['success', ts.success, rust[b]],
    ['fixed', ts.fixedMs, rust[b + 1]],
    ['variable', ts.variableMs, rust[b + 2]],
    ['tailP', ts.tailP, rust[b + 3]],
    ['tailMs', ts.tailMs, rust[b + 4]],
    ['stale', ts.stale, rust[b + 5]],
    ['value', ts.value, rust[b + 6]],
    ...['stranded','dropped','refused','down','stale','oom','timeout','crash','blocked','upstream','throttled','duplicate'].map((cause, index) => [
      cause,
      ts[`fail${cause[0].toUpperCase()}${cause.slice(1)}`] ?? 0,
      rust[b + 7 + index],
    ]),
  ]
  for (const [name, a, r] of pairs) {
    checked += 1
    if (!Object.is(a, r)) {
      wrong += 1
      if (bad.length < 8) bad.push(`${kind}.${name}: ts ${a} rust ${r}`)
    }
  }
}
console.log(`outcomes: ${checked - wrong}/${checked} figures identical`)
for (const line of bad) console.log('   ', line)
