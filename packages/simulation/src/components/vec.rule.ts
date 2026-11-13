import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game, GameNode } from '../state.ts'
import { VEC_INDEXES } from '../catalog.ts'

/** Picks a Vector Index's type (07 "Vector Index"): exact, or approximate HNSW. */
export const setVecIndex = (game: Game, id: string, indexType: GameNode['indexType']): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'vec') return notAllowed('Only a Vector Index has an index type.')
    if ((VEC_INDEXES as Record<string, unknown>)[indexType] === undefined)
      return notAllowed(`Index types are ${Object.keys(VEC_INDEXES).join(', ')}.`)
    return ok(node.indexType === indexType ? game : patch(game, id, { indexType }))
  })
