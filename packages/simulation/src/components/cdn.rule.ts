import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { CacheKey, Game } from '../state.ts'
import { CACHE_KEYS } from '../catalog.ts'
import { withWarm } from '../life.ts'

/** Sets a CDN's purge on deploy and its cache key (05 "CDN"). A key change empties the cache. */
export const setCdnOptions = (
  game: Game,
  id: string,
  change: Readonly<{ purge?: boolean; cacheKey?: CacheKey }>,
): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'cdn') return notAllowed('Only a CDN has a purge or a cache key.')
    if (change.cacheKey !== undefined && CACHE_KEYS[change.cacheKey] === undefined)
      return notAllowed(`Cache keys are ${Object.keys(CACHE_KEYS).join(', ')}.`)
    const clears = change.cacheKey !== undefined && change.cacheKey !== node.cacheKey
    return ok(patch(game, id, clears ? { ...change, life: withWarm(node.life, 0) } : change))
  })
