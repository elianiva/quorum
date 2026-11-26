import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { CONCURRENCY } from '../catalog.ts'

export const setConcurrency = (game: Game, id: string, concurrency: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'worker') return notAllowed('Only a Worker sets its concurrency.')
    if (!(CONCURRENCY as ReadonlyArray<number>).includes(concurrency))
      return notAllowed(`Concurrency is ${CONCURRENCY.join(', ')}.`)
    return ok(node.concurrency === concurrency ? game : patch(game, id, { concurrency }))
  })
