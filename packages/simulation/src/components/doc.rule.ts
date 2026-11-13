import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game } from '../state.ts'

/** Turns multi-document transactions on or off on a Document Store (07 "Document Store"). */
export const setDocOptions = (
  game: Game,
  id: string,
  change: Readonly<{ transactions?: boolean }>,
): Action =>
  withNode(game, id, (node) =>
    node.type === 'doc'
      ? ok(patch(game, id, change))
      : notAllowed('Only a Document Store has multi-document transactions.'),
  )
