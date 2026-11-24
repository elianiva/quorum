import { type Action, notAllowed, ok, patch, withNode, locked } from '../action-kit.ts'
import type { CacheEngine, CacheStrategy, Game } from '../state.ts'
import { WARMED } from '../catalog.ts'
import { withWarm } from '../life.ts'

import { has } from '../lookups.ts'

export const setCacheEngine = (game: Game, id: string, engine: CacheEngine): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'cache') return notAllowed('Only a Cache has an engine.')
    if (engine === 'memcached' && node.cacheStrategy === 'write-behind')
      return notAllowed(
        'Memcached keeps nothing on disk, so it cannot hold write-behind. Change the strategy first.',
      )
    if (engine === 'memcached' && node.standby)
      return notAllowed(
        'Memcached has no replication, so it cannot keep a standby. Turn the standby off first.',
      )
    return ok(
      node.engine === engine ? game : patch(game, id, { engine, life: withWarm(node.life, 0) }),
    )
  })

export const setCacheGuard = (
  game: Game,
  id: string,
  change: Readonly<{
    coalesce?: boolean
    warming?: boolean
    earlyExpiry?: boolean
    swr?: boolean
  }>,
): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'cache') return notAllowed('Only a Cache has stampede guards.')
    for (const field of ['coalesce', 'earlyExpiry', 'swr', 'warming'] as const) {
      const value = change[field]
      const refused = value === undefined ? undefined : locked(game, `cache.${field}`, value)
      if (refused) return refused
    }
    return ok(patch(game, id, change))
  })

export const setCacheStrategy = (game: Game, id: string, cacheStrategy: CacheStrategy): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'cache') return notAllowed('Only a Cache has a strategy.')
    if (cacheStrategy === 'write-behind' && node.engine === 'memcached')
      return notAllowed(
        'Write-behind needs Redis: Memcached keeps nothing on disk, so a restart loses unflushed writes.',
      )
    const refused = locked(game, 'cache.cacheStrategy', cacheStrategy)
    if (refused) return refused
    return ok(
      node.cacheStrategy === cacheStrategy
        ? game
        : patch(game, id, {
            cacheStrategy,
            life: withWarm(node.life, node.warming && has(game, 'cache-warming') ? WARMED : 0),
          }),
    )
  })
