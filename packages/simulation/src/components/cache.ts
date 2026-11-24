import { Effect, Schema } from 'effect'

export const CACHE_ENGINES = {
  redis: { name: 'Redis', growth: 1.7, memory: 1, speed: 1, warmAfterRestart: 0.5 },
  memcached: { name: 'Memcached', growth: 2, memory: 1.12, speed: 1.2, warmAfterRestart: 0 },
} as const
export const CACHE_TTLS = [
  { ttl: 10, factor: 0.6, stale: 0.005 },
  { ttl: 60, factor: 0.85, stale: 0.02 },
  { ttl: 3_600, factor: 0.97, stale: 0.1 },
] as const
export const HOT_KB_PER_USER = 200
export const HOT_BASE_USERS = 10_000
export const CACHE_OPS = 100_000

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
