import { has, resizePrice } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import type { Model } from './model.ts'

export type FirstStep = 'collect' | 'upgrade'

/** A Stripe Billing Company collects on its own, so the first step is already done. */
export const collectedRevenue = (game: Game): boolean =>
  has(game, 'stripe') || game.earned > game.pending + game.spilled + 0.005

export const upgradedServer = (game: Game): boolean => {
  const servers = game.nodes.filter((node) => node.type === 'server')
  return servers.length === 0 || servers.some((node) => node.size > 1)
}

/**
 * The step a player who has never finished a Company sees on the Garage Board.
 * It is derived from Game state, so a reload picks up where the player stopped.
 */
export const firstStepOf = (model: Model): FirstStep | null => {
  if (model.board.session._tag !== 'Company') return null
  if (model.founder.history.length > 0) return null
  const game = model.board.game
  if (game.sandbox || game.stage !== 0) return null
  if (!collectedRevenue(game)) return 'collect'
  if (!upgradedServer(game)) return 'upgrade'
  return null
}

export const firstStepNodeOf = (model: Model): string | null => {
  const step = firstStepOf(model)
  if (step === null) return null
  const type = step === 'collect' ? 'payments' : 'server'
  return model.board.game.nodes.find((node) => node.type === type)?.id ?? null
}

export const upgradeTargetOf = (model: Model): GameNode | null => {
  if (firstStepOf(model) !== 'upgrade') return null
  return model.board.game.nodes.find((node) => node.type === 'server') ?? null
}

export const upgradePriceOf = (model: Model): number | null => {
  const node = upgradeTargetOf(model)
  return node === null ? null : resizePrice(model.board.game, node)
}
