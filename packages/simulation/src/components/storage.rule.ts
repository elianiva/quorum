import { type Action, notAllowed, ok, patch, withNode, locked } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { LIFECYCLE_DAYS } from '../catalog.ts'

export { setStorageClass, setStoreVariant } from '../generated/storage.rule.ts'

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
