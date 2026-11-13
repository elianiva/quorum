import { CHAOS_EVERY, CHAOS_SECONDS } from './catalog.ts'
import { carrySolver, solverBottleneck, solverFlow } from './solver.ts'
import type { Ledger } from './ledger.ts'
import type { Game } from './state.ts'

export { calendarMinute, clockOf, cosTurns } from './calendar.ts'
export { demandOf, diurnal, weekly } from './solve-demand.ts'
export { policyOf } from './solve-graph.ts'
export { installSolver } from './solver.ts'

/**
 * Whether a chaos experiment is running now (10 "Track: Reliability", "Chaos engineering"). An
 * experiment runs for its first seconds out of every gap, on the clock the Company started at.
 */
export const chaosRunning = (game: Game): boolean =>
  game.chaos && game.time % CHAOS_EVERY < CHAOS_SECONDS

/** The Node an experiment hits: the Design's weakest, or null when nothing runs or nothing is weak. */
export const chaosTarget = (game: Game): string | null => (chaosRunning(game) ? game.weakest : null)

const flows = new WeakMap<Game, Ledger>()
const marked = new WeakMap<Game, Ledger>()

/**
 * The Ledger without the bottleneck search: what each Step and each view
 * needs. The game runs the search once per sim second (04 "The bottleneck")
 * and keeps the answer itself. Cached per Game.
 */
export const solveFlow = (game: Game): Ledger => {
  const cached = flows.get(game)
  if (cached) return cached
  const ledger = solverFlow(game)
  flows.set(game, ledger)
  return ledger
}

/**
 * The Node whose doubled capacity would earn the most: re-solve with each of
 * the three busiest Nodes boosted, from the flow solve's converged state, and
 * keep the largest gain.
 */
export const bottleneckOf = (game: Game): string | null => {
  solveFlow(game)
  return solverBottleneck(game)
}

/** `to` reads the Ledger `from` solved: the Step that made it changed nothing the solve reads. */
export const carryLedger = (from: Game, to: Game): void => {
  const ledger = flows.get(from)
  if (ledger) flows.set(to, ledger)
  carrySolver(from, to)
}

/** The full Ledger, with the bottleneck searched now. For tests and one-off checks. Cached per Game. */
export const solve = (game: Game): Ledger => {
  const cached = marked.get(game)
  if (cached) return cached
  const ledger = { ...solveFlow(game), bottleneck: bottleneckOf(game) }
  marked.set(game, ledger)
  return ledger
}
