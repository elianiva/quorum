import { causeOf, isDown, warmOf } from '@quorum/simulation/life'
import type { Ledger } from '@quorum/simulation/ledger'
import type { Game } from '@quorum/simulation/state'
import { priceOf, refundOf } from '@quorum/simulation/lookups'
import { partsValueOf } from '@quorum/simulation/parts'
import type { Board, Figures, Undo } from './model.ts'

export { STEADY_TICKS } from './machine-state.ts'
import { SETTLE_LIMIT_SECONDS, STEADY_TICKS } from './machine-state.ts'

export { figuresOf } from '@quorum/simulation/preview'
import { figuresOf } from '@quorum/simulation/preview'
import { step as changeStep, type ChangeState } from './change-machine.ts'

export const beginChange = (board: Board, label: string, before: Figures): Board => ({
  ...board,
  change: changeStep(board.change, {
    _tag: 'Changed',
    label,
    before,
    startedAt: board.game.time,
  }),
})

const warming = (game: Game): boolean =>
  game.nodes.some((node) => isDown(node.life) || warmOf(node.life) < 1)

export const settleProgress = (board: Board): number => {
  const change = board.change
  if (change._tag !== 'Settling') return 1
  const elapsed = board.game.time - change.change.startedAt
  return Math.min(1, Math.max(change.change.steady / STEADY_TICKS, elapsed / SETTLE_LIMIT_SECONDS))
}

export const advanceChange = (board: Board, ledger: Ledger, seq: number): ChangeState =>
  changeStep(board.change, {
    _tag: 'Ticked',
    sample: { revenue: ledger.revenue, served: ledger.served, errors: ledger.errorShare },
    after: figuresOf(ledger),
    warming: warming(board.game),
    at: board.game.time,
    seq,
  })

export const UNDO_SECONDS = 30
const UNDO_LIMIT = 50

export const snapshotOf = (label: string, game: Game, cash: number, at: number): Undo => ({
  label,
  nodes: game.nodes,
  links: game.links,
  nextId: game.nextId,
  cash,
  at,
})

export const pushUndo = (board: Board, entry: Undo): Pick<Board, 'undo' | 'redo'> => ({
  undo: [...board.undo, entry].slice(-UNDO_LIMIT),
  redo: [],
})

export const undoAvailable = (board: Board): boolean => board.undo.length > 0
export const redoAvailable = (board: Board): boolean => board.redo.length > 0

const restore = (game: Game, entry: Undo, cash: number): Game => ({
  ...game,
  nodes: entry.nodes.map((node) => {
    const now = game.nodes.find((current) => current.id === node.id)
    if (!now) return node
    const failed = isDown(now.life) && causeOf(now.life) !== 'restart'
    return {
      ...node,
      credits: now.credits,
      leak: now.leak,
      ...(failed ? { life: now.life, downAt: now.downAt } : {}),
    }
  }),
  links: entry.links,
  nextId: Math.max(entry.nextId, game.nextId),
  cash: game.cash + cash,
})

const settledCash = (game: Game, entry: Undo): number => {
  const ids = new Set(entry.nodes.map((node) => node.id))
  const current = new Set(game.nodes.map((node) => node.id))
  const removed = game.nodes
    .filter((node) => !ids.has(node.id))
    .reduce((total, node) => total + refundOf(game, node), 0)
  let added = 0
  let counted = game
  for (const node of entry.nodes.filter((entry) => !current.has(entry.id))) {
    added += priceOf(counted, node.type) + partsValueOf(counted, node)
    counted = { ...counted, nodes: [...counted.nodes, node] }
  }
  return removed - added
}

export type Reversal = Readonly<{
  game: Game
  label: string
  undo: ReadonlyArray<Undo>
  redo: ReadonlyArray<Undo>
}>

export const undoGame = (board: Board): Reversal | string => {
  const entry = board.undo.at(-1)
  if (!entry) return 'Nothing to undo.'
  const game = board.game
  const cash = game.time - entry.at <= UNDO_SECONDS ? -entry.cash : settledCash(game, entry)
  if (cash < 0 && game.cash + cash < 0) return 'Not enough Cash to undo that.'
  return {
    game: restore(game, entry, cash),
    label: entry.label,
    undo: board.undo.slice(0, -1),
    redo: [...board.redo, snapshotOf(entry.label, game, cash, entry.at)],
  }
}

export const redoGame = (board: Board): Reversal | string => {
  const entry = board.redo.at(-1)
  if (!entry) return 'Nothing to redo.'
  const game = board.game
  const cash = -entry.cash
  if (cash < 0 && game.cash + cash < 0) return 'Not enough Cash to redo that.'
  return {
    game: restore(game, entry, cash),
    label: entry.label,
    undo: [...board.undo, snapshotOf(entry.label, game, cash, game.time)].slice(-UNDO_LIMIT),
    redo: board.redo.slice(0, -1),
  }
}
