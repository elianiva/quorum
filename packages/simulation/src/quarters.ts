import type { Ledger } from './ledger.ts'
import type { Game, Quarter } from './state.ts'
import { marginOf } from './valuation.ts'
import { QuarterEvent, QuarterPhase, step as quarterStep } from './quarter-machine.ts'

export const QUARTER_SECONDS = 10_080
export const GUIDANCE_WINDOW = 1_440
export const GUIDANCE_GROWTH_PERCENT = [5, 10, 20] as const
export const GUIDANCE_MARGIN_PERCENT = [10, 20, 30] as const
export const MULTIPLE_PER_BEAT = 0.5
export const MULTIPLE_PER_GUIDANCE_LEVEL = 0.25
export const MULTIPLE_LOST_PER_MISS = 1
export const MULTIPLE_PER_FOURTH_BEAT = 1
export const BONUS_LIMIT = 10

export const firstQuarter = (game: Game, revenue: number): Quarter => ({
  index: 1,
  startedAt: game.time,
  growth: 0,
  margin: 0,
  revenue,
  streak: 0,
  bonus: 0,
  last: null,
  phase: QuarterPhase.cases.AwaitingGuidance.make({}),
})

export const guidanceOpen = (game: Game): boolean => {
  const quarter = game.quarter
  return (
    !!quarter &&
    QuarterPhase.guards.AwaitingGuidance(quarter.phase) &&
    game.time - quarter.startedAt < GUIDANCE_WINDOW
  )
}

export const quarterGrowth = (quarter: Quarter, ledger: Ledger): number =>
  quarter.revenue > 0 ? (ledger.revenue / quarter.revenue - 1) * 100 : 0

export const advanceQuarter = (game: Game, ledger: Ledger): Quarter | null => {
  const quarter = game.quarter
  if (!quarter || game.time - quarter.startedAt < QUARTER_SECONDS) return quarter
  const growth = quarterGrowth(quarter, ledger)
  const margin = marginOf(ledger)
  const beat =
    growth >= (GUIDANCE_GROWTH_PERCENT[quarter.growth] ?? 5) &&
    margin >= (GUIDANCE_MARGIN_PERCENT[quarter.margin] ?? 10)
  const streak = beat ? quarter.streak + 1 : 0
  const change = beat
    ? MULTIPLE_PER_BEAT +
      MULTIPLE_PER_GUIDANCE_LEVEL * (quarter.growth + quarter.margin) +
      (streak % 4 === 0 ? MULTIPLE_PER_FOURTH_BEAT : 0)
    : -MULTIPLE_LOST_PER_MISS
  return {
    ...quarter,
    index: quarter.index + 1,
    startedAt: game.time,
    revenue: ledger.revenue,
    streak,
    bonus: Math.max(-BONUS_LIMIT, Math.min(BONUS_LIMIT, quarter.bonus + change)),
    last: { beat, growth, margin },
    phase: quarterStep(quarter.phase, QuarterEvent.cases.Started.make({})),
  }
}
