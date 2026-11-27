import { css } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import {
  STORAGE_CLASSES,
  R2_FIRST_BYTE_MS,
  STORE_VARIANTS,
  LIFECYCLE_DAYS,
} from '@quorum/simulation/catalog'
import { has, agedShareOf } from '@quorum/simulation/lookups'
import type { Game, GameNode, StorageClass, StoreVariant } from '@quorum/simulation/state'

import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, picker, section } from './shared.ts'

const storage = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)
  return [
    section(h, t.inspectorStorage.product, [
      picker(
        h,
        'store-variant',
        (Object.keys(STORE_VARIANTS) as ReadonlyArray<StoreVariant>).map(
          (id) => [id, STORE_VARIANTS[id].name] as const,
        ),
        node.storeVariant,
        (storeVariant) => Message.StoreVariantChosen({ nodeId: node.id, storeVariant }),
        (id) => id === 's3' || has(game, 'egress-optimization'),
      ),
      caption(
        h,
        node.storeVariant === 'r2'
          ? t.inspectorStorage.noEgressToTheInternet(t.units.ms(R2_FIRST_BYTE_MS))
          : t.inspectorStorage.egressToTheInternetBillsPer,
      ),
    ]),
    section(h, t.inspectorStorage.storageClass, [
      picker(
        h,
        'storage-class',
        (Object.keys(STORAGE_CLASSES) as ReadonlyArray<StorageClass>).map(
          (id) => [id, t.catalog.storageClasses[id].name] as const,
        ),
        node.storageClass,
        (storageClass) => Message.StorageClassChosen({ nodeId: node.id, storageClass }),
        () => true,
        css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
      ),
      caption(
        h,
        STORAGE_CLASSES[node.storageClass].archived
          ? t.inspectorStorage.cheapestToKeepMediaReadsFail
          : STORAGE_CLASSES[node.storageClass].retrieval > 0
            ? t.inspectorStorage.halfTheStoragePriceAndPer(
                STORAGE_CLASSES[node.storageClass].retrieval,
              )
            : t.inspectorStorage.fullStoragePriceReadsComeBack,
      ),
    ]),
    section(h, t.inspectorStorage.lifecycle, [
      picker(
        h,
        'lifecycle',
        LIFECYCLE_DAYS.map(
          (days) =>
            [days, days === 0 ? t.inspectorStorage.off : t.inspectorStorage.d(days)] as const,
        ),
        node.lifecycle,
        (lifecycle) => Message.LifecycleChosen({ nodeId: node.id, lifecycle }),
        (days) => days === 0 || has(game, 'lifecycle-rules'),
      ),
      caption(
        h,
        node.lifecycle > 0
          ? t.inspectorStorage.ofTheStoreIsOlderThan(
              Math.round(agedShareOf(game, node.lifecycle) * 100),
              node.lifecycle,
            )
          : t.inspectorStorage.everyObjectKeepsTheClassAbove,
      ),
    ]),
  ]
}

export const storagePanel: Panel = {
  body: ({ game, node, h }) => [...storage(game, node, h)],
}
