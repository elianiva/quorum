import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const SEARCH_QPS = 400

export const SEARCH_REFRESH = [
  { seconds: 1, capacity: 1, stale: 0 },
  { seconds: 5, capacity: 1.1, stale: 0.05 },
  { seconds: 60, capacity: 1.3, stale: 0.25 },
] as const

export const SEARCH_SHARDS = [1, 2, 4] as const
export const SEARCH_REPLICAS = [0, 1, 2] as const
export const SEARCH_FANOUT = 0.2
export const SEARCH_HEAPS = {
  small: { name: '25% of RAM', capacity: 1, tailP: 0.05, tailMs: 150 },
  half: { name: '50% of RAM', capacity: 1, tailP: 0, tailMs: 0 },
  large: { name: '75% of RAM', capacity: 0.85, tailP: 0.02, tailMs: 400 },
} as const
export const SEARCH_VARIANTS = {
  elasticsearch: {
    name: 'Elasticsearch',
    jvm: true,
    capacity: 1,
    fixedMs: 15,
    burn: 1,
    relevance: 0,
    cap: 0,
  },
  opensearch: {
    name: 'OpenSearch',
    jvm: true,
    capacity: 1,
    fixedMs: 15,
    burn: 1,
    relevance: 0,
    cap: 0,
  },
  meilisearch: {
    name: 'Meilisearch',
    jvm: false,
    capacity: 1.5,
    fixedMs: 8,
    burn: 0.6,
    relevance: 0.0000005,
    cap: 0.25,
  },
} as const
export const SEARCH_INDEX_SHARE = 0.3
export const SEARCH_COPY_MINUTES_PER_GB = 0.5

export const searchGlossary: ReadonlyArray<string> = ['inverted-index']

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

export const searchDef = def({
  id: 'search',
  code: 'fts',
  name: 'Search Engine',
  product: 'Elasticsearch',
  group: 'data',
  blurb: 'Answers search queries. 400 per second per size step.',
  cost: 300,
  burn: 0.25,
  latency: 15,
  accepts: ['q-search', 'change'],
  maxOut: 0,
  unlock: 'full-text-search',
  steps: 8,
  limiting: true,
})
