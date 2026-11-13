/**
 * Every Challenge's opening board, solved by both implementations and compared
 * figure by figure: the Ledger, then the Bottleneck search.
 *
 * Run with `node challenges.ts`, or `node challenges.ts <id>` for one Challenge
 * with every figure that differs. A board the kernel refuses prints its status.
 */
import {
  load,
  writeDesign,
  writeGame,
  solveRun,
  bottleneckRun,
  graph,
  compareLedger,
} from './harness.ts'

const ROOT = new URL('../../packages/simulation/src', import.meta.url).pathname
const { solveFlow, solve } = await import(`${ROOT}/solve.ts`)
const { CHALLENGES } = await import(`${ROOT}/challenges.ts`)

const only = process.argv[2]
const kernel = await load()
let matched = 0
let refused = 0
for (const challenge of CHALLENGES) {
  if (only && challenge.id !== only) continue
  const game = challenge.start()
  const nodes = game.nodes.length
  const design = graph.graphOf(game)
  const info = writeDesign(kernel, game, design)
  writeGame(kernel, game, design, info)
  kernel.X.design_set(design.healthChecked ? 1 : 0, design.time)
  let ledger
  let searched
  try {
    ledger = solveRun(kernel, game)
    searched = bottleneckRun(kernel, game)
  } catch (error) {
    refused += 1
    console.log(`${challenge.id.padEnd(26)} refused: ${error.message}`)
    continue
  }
  const { checked, wrong, bad } = compareLedger(game, solveFlow(game), ledger)
  const marked = solve(game)
  const rustBottleneck = searched.bottleneck
  const bottleneckSame = Object.is(marked.bottleneck, rustBottleneck)
  if (!bottleneckSame) bad.push(`bottleneck: ts ${marked.bottleneck} rust ${rustBottleneck}`)
  const same = wrong === 0 && bottleneckSame
  if (same) matched += 1
  console.log(
    `${challenge.id.padEnd(26)} ${same ? 'identical' : 'DIFFERS  '} ${checked - wrong}/${checked}`,
  )
  for (const line of only ? bad : bad.slice(0, 3)) console.log('    ', line)
}
console.log(`\n${matched} identical, ${refused} refused, of ${only ? 1 : CHALLENGES.length}`)
