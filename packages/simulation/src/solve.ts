import { CHAOS_EVERY, CHAOS_SECONDS } from './catalog.ts'
import { carrySolver, solverBottleneck, solverFlow } from './solver.ts'
import type { Ledger } from './ledger.ts'
import type { Game } from './state.ts'

export { calendarMinute, clockOf, cosTurns } from './calendar.ts'
export { demandOf, diurnal, weekly } from './solve-demand.ts'
export { policyOf } from './solve-graph.ts'
export { installSolver } from './solver.ts'

export const chaosRunning = (game: Game): boolean =>
  game.chaos && game.time % CHAOS_EVERY < CHAOS_SECONDS

export const chaosTarget = (game: Game): string | null => (chaosRunning(game) ? game.weakest : null)

const flows = new WeakMap<Game, Ledger>()
const marked = new WeakMap<Game, Ledger>()

export const solveFlow = (game: Game): Ledger => {
  const cached = flows.get(game)
  if (cached) return cached
  const ledger = solverFlow(game)
  flows.set(game, ledger)
  return ledger
}

export const bottleneckOf = (game: Game): string | null => {
  solveFlow(game)
  return solverBottleneck(game)
}

export const carryLedger = (from: Game, to: Game): void => {
  const ledger = flows.get(from)
  if (ledger) flows.set(to, ledger)
  carrySolver(from, to)
}

export const solve = (game: Game): Ledger => {
  const cached = marked.get(game)
  if (cached) return cached
  const ledger = { ...solveFlow(game), bottleneck: bottleneckOf(game) }
  marked.set(game, ledger)
  return ledger
}
