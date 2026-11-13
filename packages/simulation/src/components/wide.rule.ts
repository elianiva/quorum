import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { QUORUM_N } from '../catalog.ts'
import { warming } from '../life.ts'

/** Sets a Wide-column Store's N, R and W (07 "Wide-column Store"). */
export const setQuorum = (game: Game, id: string, n: number, r: number, w: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'wide') return notAllowed('Only a Wide-column Store has quorums.')
    if (!QUORUM_N.some((entry) => entry === n) || r < 1 || w < 1 || r > n || w > n)
      return notAllowed('R and W are between 1 and N; N is 1 to 5.')
    const rebalances = !game.sandbox && n !== node.n && node.life._tag !== 'Stopped'
    return ok(patch(game, id, { n, r, w, ...(rebalances ? { life: warming(0) } : {}) }))
  })
