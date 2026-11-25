import { type Action, notAllowed, ok, patch, withNode, locked } from '../action-kit.ts'
import type { Game, StoreVariant } from '../state.ts'
import { LIFECYCLE_DAYS } from '../catalog.ts'

export { setStorageClass } from '../generated/storage.rule.ts'

export const setStoreVariant = (game: Game, id: string, storeVariant: StoreVariant): Action =>
  withNode(game, id, (node) =>
    node.type !== 'storage'
      ? notAllowed('Only Object Storage has a product.')
      : (locked(game, 'storage.storeVariant', storeVariant) ??
        ok(node.storeVariant === storeVariant ? game : patch(game, id, { storeVariant }))),
  )

export const setLifecycle = (game: Game, id: string, lifecycle: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'storage')
      return notAllowed('Only Object Storage moves objects between classes.')
    if (!(LIFECYCLE_DAYS as ReadonlyArray<number>).includes(lifecycle))
      return notAllowed(`Lifecycle windows are ${LIFECYCLE_DAYS.join(', ')} days.`)
    return (
      locked(game, 'storage.lifecycle', lifecycle) ??
      ok(node.lifecycle === lifecycle ? game : patch(game, id, { lifecycle }))
    )
  })
