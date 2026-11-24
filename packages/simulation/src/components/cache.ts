import { Effect, Schema } from 'effect'
export {
  CACHE_ENGINES,
  CACHE_TTLS,
  HOT_KB_PER_USER,
  HOT_BASE_USERS,
  CACHE_OPS,
  WRITE_BEHIND_SECONDS,
  CACHE_STRATEGIES,
  COALESCED,
  WARMED,
  EARLY_LIFT,
  EARLY_REFRESH,
  cacheGlossary,
} from '../generated/cache.ts'

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
