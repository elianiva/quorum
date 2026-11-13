import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game, PoolerMode } from '../state.ts'

/** Sets a Connection Pooler's mode: session holds a server connection per client, transaction shares a few. */
export const setPoolerMode = (game: Game, id: string, mode: PoolerMode): Action =>
  withNode(game, id, (node) =>
    node.type === 'pooler'
      ? ok(node.mode === mode ? game : patch(game, id, { mode }))
      : notAllowed('Only a Connection Pooler has a mode.'),
  )
