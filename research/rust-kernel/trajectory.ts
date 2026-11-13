/**
 * Plays every Challenge through its canonical run, untouched, and compares the
 * two implementations on the Game at every `every`-th Step: the Ledger, then the
 * Bottleneck search. An opening board has empty Queues, cold caches, and no
 * incident; a run reaches backlogs, warm-up, scripted incidents, and outages.
 *
 * Run with `node trajectory.ts [every] [id]`. Each Challenge prints the Steps it
 * compared, the Steps the kernel refused, and the first Step that differed.
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
const { CHALLENGES, beginRun, advanceRun, stepsOf, NO_TOTALS } = await import(
  `${ROOT}/challenges.ts`
)
const { designOf } = await import(`${ROOT}/replay.ts`)
const { SIM_VERSION } = await import(`${ROOT}/version.ts`)

const every = Number(process.argv[2] ?? 10)
const only = process.argv[3]
const kernel = await load()

/** Solves one Game on both sides; null when they agree, else the first differences. */
const compare = (game) => {
  const design = graph.graphOf(game)
  const info = writeDesign(kernel, game, design)
  writeGame(kernel, game, design, info)
  kernel.X.design_set(design.healthChecked ? 1 : 0, design.time)
  kernel.X.forget_solve()
  const ledger = solveRun(kernel, game)
  const searched = bottleneckRun(kernel, game)
  const { wrong, bad } = compareLedger(game, solveFlow(game), ledger)
  const rust = searched.bottleneck
  const ts = solve(game).bottleneck
  if (!Object.is(ts, rust)) bad.push(`bottleneck: ts ${ts} rust ${rust}`)
  return wrong === 0 && Object.is(ts, rust) ? null : bad
}

let clean = 0
for (const challenge of CHALLENGES) {
  if (only && challenge.id !== only) continue
  const replay = {
    v: 1,
    challenge: challenge.id,
    simVersion: SIM_VERSION,
    design: designOf(challenge.start()),
    actions: [],
  }
  const begun = beginRun(challenge, replay)
  if (begun._tag !== 'Success') {
    console.log(`${challenge.id.padEnd(26)} cannot begin: ${begun.failure}`)
    continue
  }
  let game = begun.success
  let totals = NO_TOTALS
  let compared = 0
  let refused = 0
  let first = null
  const steps = stepsOf(challenge)
  for (let index = 0; index <= steps; index += 1) {
    if (index % every === 0 || index === steps) {
      try {
        const bad = compare(game)
        compared += 1
        if (bad && !first) first = { index, bad }
      } catch {
        refused += 1
      }
    }
    if (index === steps || first) break
    const next = advanceRun(challenge, replay, game, totals)
    game = next.game
    totals = next.totals
  }
  if (!first) clean += 1
  const verdict = first ? `DIFFERS at step ${first.index}` : 'identical'
  console.log(`${challenge.id.padEnd(26)} ${verdict.padEnd(22)} ${compared} compared, ${refused} refused`)
  if (first) for (const line of only ? first.bad : first.bad.slice(0, 3)) console.log('    ', line)
}
console.log(`\n${clean} runs with no difference, of ${only ? 1 : CHALLENGES.length}`)
