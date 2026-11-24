import { Effect, Schema } from 'effect'
export {
  CDN_HIT,
  ANONYMOUS_PAGE,
  TIERED_MEDIA_HIT,
  CDN_TTLS,
  ESI_PAGE_HIT,
  STALE_AFTER_DEPLOY,
  CACHE_KEYS,
  cdnGlossary,
} from '../generated/cdn.ts'

export const CacheKey = Schema.Literals(['full', 'query', 'path'])
export type CacheKey = typeof CacheKey.Type

export const cdnFields = {
  purge: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  cacheKey: CacheKey.pipe(Schema.withDecodingDefaultKey(Effect.succeed('full' as const))),
  staleUntil: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const
