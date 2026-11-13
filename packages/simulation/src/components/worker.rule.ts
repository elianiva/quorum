import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { PREFETCH } from '../catalog.ts'

/** Sets how many tasks each Worker process takes from its Queue ahead of time. */
export const setPrefetch = (game: Game, id: string, prefetch: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'worker') return notAllowed('Only a Worker prefetches tasks.')
    if (!(PREFETCH as ReadonlyArray<number>).includes(prefetch))
      return notAllowed(`Prefetch is ${PREFETCH.join(', ')}.`)
    return ok(node.prefetch === prefetch ? game : patch(game, id, { prefetch }))
  })
