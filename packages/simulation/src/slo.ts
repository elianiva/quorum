import { sloOf, ventureOf } from './founding.ts'
import { ERROR_BUDGET_FACTORS, SLA_CREDIT, SLO_FROM_STAGE, SLO_WINDOW_HOURS } from './catalog.ts'
import { ERROR_CAUSES } from './distribution.ts'
import type { Ledger } from './ledger.ts'
import { eraOf, has } from './lookups.ts'
import { calendarMinute } from './solve.ts'
import type { BudgetHour, Game } from './state.ts'

export const budgetFailures = (ledger: Ledger): number => {
  let failed = 0
  for (const cause of ERROR_CAUSES) if (cause !== 'blocked') failed += ledger.errors[cause]
  return failed
}

export type Budget = Readonly<{
  slo: number
  requests: number
  failed: number
  allowed: number
  left: number
  availability: number
}>

export const budgetOf = (game: Game): Budget => {
  const slo = sloOf(game, eraOf(game).slo)
  let requests = 0
  let failed = 0
  for (const entry of game.budget) {
    requests += entry.requests
    failed += entry.failed
  }
  const allowed = (1 - slo) * requests
  return {
    slo,
    requests,
    failed,
    allowed,
    left: allowed > 0 ? 1 - failed / allowed : 1,
    availability: requests > 0 ? 1 - failed / requests : 1,
  }
}

export const burnRateOf = (game: Game, ledger: Ledger): number => {
  if (!budgeted(game) || ledger.demand <= 0) return 0
  const allowed = 1 - sloOf(game, eraOf(game).slo)
  return allowed > 0 ? budgetFailures(ledger) / ledger.demand / allowed : 0
}

export const budgeted = (game: Game): boolean => !game.sandbox && game.stage >= SLO_FROM_STAGE

export const budgetVelocity = (game: Game): number => {
  if (!budgeted(game) || !has(game, 'error-budgets')) return 1
  const { left } = budgetOf(game)
  return left > 0.5
    ? ERROR_BUDGET_FACTORS.ahead
    : left <= 0
      ? ERROR_BUDGET_FACTORS.spent
      : ERROR_BUDGET_FACTORS.normal
}

export const recordBudget = (
  game: Game,
  ledger: Ledger,
  seconds: number,
): ReadonlyArray<BudgetHour> => {
  if (!budgeted(game) || ledger.demand <= 0) return game.budget
  const hour = Math.floor(calendarMinute(game.time) / 60)
  const requests = ledger.demand * seconds
  const failed = budgetFailures(ledger) * seconds
  const last = game.budget.at(-1)
  const kept = game.budget.filter((entry) => entry.hour > hour - SLO_WINDOW_HOURS)
  if (last && last.hour === hour)
    return [
      ...kept.slice(0, -1),
      {
        hour,
        requests: last.requests + requests,
        failed: last.failed + failed,
        users: game.users,
      },
    ]
  return [...kept, { hour, requests, failed, users: game.users }]
}

export const spendBudget = (game: Game, failed: number): ReadonlyArray<BudgetHour> => {
  const last = game.budget.at(-1)
  if (!budgeted(game) || !last || failed <= 0) return game.budget
  return [...game.budget.slice(0, -1), { ...last, failed: last.failed + failed }]
}

export const slaCreditsOf = (game: Game, ledger: Ledger): number => {
  if (game.sandbox || !has(game, 'enterprise-sales')) return 0
  const signed = ventureOf(game).constraint.sla
  if (signed === null || game.stage < signed) return 0
  const { availability, slo } = budgetOf(game)
  return availability < slo ? ledger.subscriptions * SLA_CREDIT : 0
}
