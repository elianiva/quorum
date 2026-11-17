import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const CACHE_ENGINES = {
  redis: { name: 'Redis', scales: false, warmAfterRestart: 0.5 },
  memcached: { name: 'Memcached', scales: true, warmAfterRestart: 0 },
} as const
export const CACHE_TTLS = [
  { ttl: 10, factor: 0.6, stale: 0.005 },
  { ttl: 60, factor: 0.85, stale: 0.02 },
  { ttl: 3_600, factor: 0.97, stale: 0.1 },
] as const
export const HOT_KB_PER_USER = 200
export const CACHE_OPS = 50_000

export const WRITE_BEHIND_SECONDS = 10

export const CACHE_STRATEGIES = {
  aside: {
    name: 'Cache-aside',
    stale: 1,
    write: 'bypass',
    writeMs: 0,
    flush: 1,
    loadMs: 0,
  },
  'read-through': {
    name: 'Read-through',
    stale: 0.75,
    write: 'bypass',
    writeMs: 0,
    flush: 1,
    loadMs: 1,
  },
  'write-through': {
    name: 'Write-through',
    stale: 0,
    write: 'through',
    writeMs: 0.5,
    flush: 1,
    loadMs: 0,
  },
  'write-behind': {
    name: 'Write-behind',
    stale: 0.5,
    write: 'ahead',
    writeMs: 0,
    flush: 0.5,
    loadMs: 0,
  },
} as const

export const COALESCED = 0.25
export const WARMED = 0.8

export const EARLY_LIFT = 0.5
export const EARLY_REFRESH = 0.02

export const cacheGlossary: ReadonlyArray<string> = [
  'cache-hit-rate',
  'cache-aside',
  'hot-key',
  'write-through-cache',
]

export const CacheEngine = Schema.Literals(['redis', 'memcached'])
export type CacheEngine = typeof CacheEngine.Type

export const CacheStrategy = Schema.Literals([
  'aside',
  'read-through',
  'write-through',
  'write-behind',
])
export type CacheStrategy = typeof CacheStrategy.Type

export const cacheFields = {
  earlyExpiry: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  swr: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  engine: CacheEngine.pipe(Schema.withDecodingDefaultKey(Effect.succeed('redis' as const))),
  cacheStrategy: CacheStrategy.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('aside' as const)),
  ),
  coalesce: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  warming: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  split: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const

export const cacheDef = def({
  id: 'cache',
  code: 'kv',
  name: 'Cache',
  product: 'Redis',
  group: 'data',
  blurb:
    'The cheapest way to cut reads while the hot data fits in memory. Writes pass through and invalidate, and a restart starts cold.',
  cost: 150,
  burn: 0.06,
  latency: 0.5,
  accepts: [
    'q-read',
    'q-write',
    'q-search',
    'blob-put',
    'q-tx',
    'blob-get',
    'q-scan',
    'k-write',
    'change',
  ],
  fallback: ['q-search', 'blob-put', 'blob-get', 'q-scan', 'q-tx', 'k-write'],
  unlock: 'caching',
  steps: 8,
  sends: ['q-read', 'q-write', 'q-search', 'blob-put', 'q-tx', 'blob-get', 'q-scan', 'k-write'],
  limiting: true,
  coldStart: true,
})
