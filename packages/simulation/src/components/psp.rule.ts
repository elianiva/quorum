import { type Action, answering, notAllowed, ok, spend } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { SWITCH_PROVIDER_PRICE } from '../catalog.ts'

/**
 * Moves every Payment Provider Node to the second provider, or back to the first (18 "Senders":
 * "Switch provider"). The move is a rush integration that costs Cash; the second provider keeps
 * serving through an outage of the first, and charges more per checkout. Switching during an
 * outage of the first ends its effect at once.
 */
export const setProvider = (game: Game, provider: 'first' | 'second'): Action => {
  const psps = game.nodes.filter((node) => node.type === 'psp')
  if (psps.length === 0) return notAllowed('There is no Payment Provider to switch.')
  if (psps.every((node) => node.provider === provider)) return ok(game)
  return spend(game, SWITCH_PROVIDER_PRICE, 'Switch provider', (paid) => ({
    ...paid,
    nodes: paid.nodes.map((node) => (node.type === 'psp' ? { ...node, provider } : node)),
    incident:
      provider === 'second' && paid.incident?.kind === 'psp-outage'
        ? { ...answering(paid, paid.incident), remaining: 0 }
        : paid.incident,
  }))
}

/** Switches to the second Payment Provider, which an outage of the first leaves alone. */
export const switchProvider = (game: Game): Action => setProvider(game, 'second')
