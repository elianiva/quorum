import { Effect, Result, Schema } from 'effect'
import {
  COMPONENTS,
  EXITS,
  EXIT_IDS,
  RUNTIMES,
  STREAK_BONUS,
  STREAK_BONUS_CAP,
  type ExitId,
} from './catalog.ts'
import { Refusal } from './actions.ts'
import { legacyMultiplier } from './founding.ts'
import type { Ledger } from './ledger.ts'
import { ComponentId, Founding, QuarterState, type Game } from './state.ts'
import { valuationOf } from './valuation.ts'

export const legacyOf = (payout: number, multiplier = 1): number =>
  Math.floor(Math.sqrt(Math.max(0, payout) / 1_000_000) * multiplier)

export const Snapshot = Schema.Struct({
  nodes: Schema.Array(Schema.Struct({ type: ComponentId, x: Schema.Finite, y: Schema.Finite })),
  links: Schema.Array(Schema.Tuple([Schema.Finite, Schema.Finite])),
})
export type Snapshot = typeof Snapshot.Type

export const HistoryRow = Schema.Struct({
  name: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(''))),
  exit: Schema.Literals(EXIT_IDS),
  founding: Founding,
  time: Schema.Finite,
  peak: Schema.Finite,
  stage: Schema.Finite,
  payout: Schema.Finite,
  legacy: Schema.Finite,
  stack: Schema.Array(Schema.Tuple([Schema.String, Schema.Finite])),
  snapshot: Snapshot,
})
export type HistoryRow = typeof HistoryRow.Type

export type ExitOffer = Readonly<{
  id: ExitId
  valuation: number
  multiplier: number
  payout: number
  legacy: number
}>

const multiplierOf = (game: Game, id: ExitId): number =>
  EXITS[id].multiplier +
  (id === 'step-down'
    ? Math.min(
        STREAK_BONUS_CAP,
        STREAK_BONUS * (QuarterState.guards.Active(game.quarter) ? game.quarter.streak : 0),
      )
    : 0)

export const exitOffer = (game: Game, ledger: Ledger, id: ExitId): ExitOffer => {
  const valuation = Math.min(EXITS[id].cap, valuationOf(game, ledger).valuation)
  const multiplier = multiplierOf(game, id)
  const payout = game.equity * valuation * multiplier
  const legacy = Math.max(0, legacyOf(payout, legacyMultiplier(game.founding)) - game.banked)
  return { id, valuation, multiplier, payout, legacy }
}

export const exitOffers = (game: Game, ledger: Ledger): ReadonlyArray<ExitOffer> => {
  if (game.sandbox) return []
  return EXIT_IDS.filter((id) => {
    const def = EXITS[id]
    if (def.continues) return false
    if (id === 'step-down') return game.stage >= def.stage
    return game.stage >= def.stage && game.stage < EXITS['step-down'].stage
  }).map((id) => exitOffer(game, ledger, id))
}

const snapshotOf = (game: Game): Snapshot => {
  const index = new Map(game.nodes.map((node, at) => [node.id, at]))
  return {
    nodes: game.nodes.map((node) => ({ type: node.type, x: node.x, y: node.y })),
    links: game.links.flatMap((link) => {
      const from = index.get(link.from)
      const to = index.get(link.to)
      return from === undefined || to === undefined ? [] : [[from, to] as const]
    }),
  }
}

const stackOf = (game: Game): ReadonlyArray<readonly [string, number]> => {
  const counts = new Map<string, number>()
  for (const node of game.nodes) {
    if (!COMPONENTS[node.type] || (node.type !== 'server' && node.type !== 'worker')) continue
    const language = RUNTIMES[node.runtime].language
    counts.set(language, (counts.get(language) ?? 0) + 1)
  }
  return [...counts.entries()]
}

export type ExitResult = Readonly<{ legacy: number; row: HistoryRow; game: Game }>

const resultOf = (game: Game, offer: ExitOffer, name: string): ExitResult => ({
  legacy: offer.legacy,
  game: { ...game, banked: game.banked + offer.legacy },
  row: {
    name,
    exit: offer.id,
    founding: game.founding,
    time: game.time,
    peak: Math.max(game.peak, game.users),
    stage: game.stage,
    payout: offer.payout,
    legacy: offer.legacy,
    stack: stackOf(game),
    snapshot: snapshotOf(game),
  },
})

export const takeExit = (
  game: Game,
  ledger: Ledger,
  id: ExitId,
  name = '',
): Result.Result<ExitResult, Refusal> => {
  const offer = exitOffers(game, ledger).find((entry) => entry.id === id)
  if (!offer)
    return Result.fail(Refusal.NotAllowed({ reason: `${EXITS[id].name} is not offered.` }))
  return Result.succeed(resultOf(game, offer, name))
}

export const ipoExit = (game: Game, ledger: Ledger, name = ''): ExitResult =>
  resultOf(game, exitOffer(game, ledger, 'ipo'), name)
