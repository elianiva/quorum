import { Effect, Schema } from 'effect'
export {
  SEARCH_QPS,
  SEARCH_REFRESH,
  SEARCH_SHARDS,
  SEARCH_REPLICAS,
  SEARCH_FANOUT,
  SEARCH_HEAPS,
  SEARCH_VARIANTS,
  SEARCH_INDEX_SHARE,
  SEARCH_COPY_MINUTES_PER_GB,
  searchGlossary,
} from '../generated/search.ts'

export const SearchRefresh = Schema.Finite
export type SearchRefresh = typeof SearchRefresh.Type

export const SearchVariant = Schema.Literals(['elasticsearch', 'opensearch', 'meilisearch'])
export type SearchVariant = typeof SearchVariant.Type

export const SearchHeap = Schema.Literals(['small', 'half', 'large'])
export type SearchHeap = typeof SearchHeap.Type

export const searchFields = {
  searchVariant: SearchVariant.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('elasticsearch' as const)),
  ),
  searchShards: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  searchReplicas: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  heap: SearchHeap.pipe(Schema.withDecodingDefaultKey(Effect.succeed('half' as const))),
  refresh: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
} as const
