import { type Action, Refusal, no, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game, StorageClass, StoreVariant } from '../state.ts'
import { LIFECYCLE_DAYS, RESEARCH } from '../catalog.ts'

import { has } from '../lookups.ts'

export const setStoreVariant = (game: Game, id: string, storeVariant: StoreVariant): Action =>
  withNode(game, id, (node) =>
    node.type !== 'storage'
      ? notAllowed('Only Object Storage has a product.')
      : storeVariant === 'r2' && !has(game, 'egress-optimization')
        ? no(Refusal.Locked({ what: 'R2', research: RESEARCH['egress-optimization'].name }))
        : ok(node.storeVariant === storeVariant ? game : patch(game, id, { storeVariant })),
  )

export const setStorageClass = (game: Game, id: string, storageClass: StorageClass): Action =>
  withNode(game, id, (node) =>
    node.type === 'storage'
      ? ok(node.storageClass === storageClass ? game : patch(game, id, { storageClass }))
      : notAllowed('Only Object Storage has a storage class.'),
  )

export const setLifecycle = (game: Game, id: string, lifecycle: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'storage')
      return notAllowed('Only Object Storage moves objects between classes.')
    if (!(LIFECYCLE_DAYS as ReadonlyArray<number>).includes(lifecycle))
      return notAllowed(`Lifecycle windows are ${LIFECYCLE_DAYS.join(', ')} days.`)
    if (lifecycle > 0 && !has(game, 'lifecycle-rules'))
      return no(
        Refusal.Locked({ what: 'Lifecycle rules', research: RESEARCH['lifecycle-rules'].name }),
      )
    return ok(node.lifecycle === lifecycle ? game : patch(game, id, { lifecycle }))
  })
