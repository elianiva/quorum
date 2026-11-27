import { css } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import {
  SEARCH_REFRESH,
  SEARCH_HEAPS,
  SEARCH_REPLICAS,
  SEARCH_SHARDS,
  SEARCH_VARIANTS,
} from '@quorum/simulation/catalog'
import type { GameNode, SearchHeap, SearchVariant } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, picker, section } from './shared.ts'

const search = (node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const variant = SEARCH_VARIANTS[node.searchVariant]
  return [
    section(h, t.inspectorSearch.product, [
      picker(
        h,
        'search-variant',
        (Object.keys(SEARCH_VARIANTS) as ReadonlyArray<SearchVariant>).map(
          (id) => [id, SEARCH_VARIANTS[id].name] as const,
        ),
        node.searchVariant,
        (searchVariant) => Message.SearchOptionsChosen({ nodeId: node.id, searchVariant }),
        () => true,
        css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
      ),
      caption(
        h,
        variant.jvm
          ? t.inspectorSearch.fullFeaturesOnAJVMShards
          : t.inspectorSearch.answersHalfAgainAsManyQueries,
      ),
    ]),
    ...(variant.jvm
      ? [
          section(h, t.inspectorSearch.shardsAndReplicas, [
            picker(
              h,
              'search-shards',
              SEARCH_SHARDS.map((count) => [count, t.inspectorSearch.shardCount(count)] as const),
              node.searchShards,
              (searchShards) => Message.SearchOptionsChosen({ nodeId: node.id, searchShards }),
              () => true,
              css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
            ),
            picker(
              h,
              'search-replicas',
              SEARCH_REPLICAS.map(
                (count) => [count, t.inspectorSearch.replicaCount(count)] as const,
              ),
              node.searchReplicas,
              (searchReplicas) => Message.SearchOptionsChosen({ nodeId: node.id, searchReplicas }),
              () => true,
              css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
            ),
            caption(h, t.inspectorSearch.moreShardsParallelizeTheIndexAnd),
          ]),
          section(h, t.inspectorSearch.heap, [
            picker(
              h,
              'search-heap',
              (Object.keys(SEARCH_HEAPS) as ReadonlyArray<SearchHeap>).map(
                (id) => [id, t.inspectorSearch.heaps[id]] as const,
              ),
              node.heap,
              (heap) => Message.SearchOptionsChosen({ nodeId: node.id, heap }),
              () => true,
              css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
            ),
            caption(
              h,
              node.heap === 'small'
                ? t.inspectorSearch.tooSmallGarbageCollectionPauses
                : node.heap === 'large'
                  ? t.inspectorSearch.tooLargeLongPausesAndLess
                  : t.inspectorSearch.theJVMHeapHoldsCachesWithout,
            ),
          ]),
        ]
      : []),
    searchRefresh(node, h),
  ]
}

const searchRefresh = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorSearch.refresh, [
    picker(
      h,
      'refresh',
      SEARCH_REFRESH.map((entry) => [entry.seconds, t.inspectorSearch.s(entry.seconds)] as const),
      node.refresh,
      (refresh) => Message.SearchRefreshChosen({ nodeId: node.id, refresh }),
    ),
    caption(
      h,
      node.refresh <= 1
        ? t.inspectorSearch.aNewDocumentIsSearchableWithin
        : t.inspectorSearch.aNewDocumentWaitsUpTo(node.refresh),
    ),
  ])
}

export const searchPanel: Panel = {
  body: ({ node, h }) => [...search(node, h)],
}
