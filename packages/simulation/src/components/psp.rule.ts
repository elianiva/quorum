import { type Action, answering, notAllowed, ok, spend } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { SWITCH_PROVIDER_PRICE } from '../catalog.ts'

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

export const switchProvider = (game: Game): Action => setProvider(game, 'second')
