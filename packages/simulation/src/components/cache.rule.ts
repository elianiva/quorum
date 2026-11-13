import { type Action, Refusal, no, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { CacheEngine, CacheStrategy, Game } from '../state.ts'
import { RESEARCH, WARMED } from '../catalog.ts'
import { withWarm } from '../life.ts'

import { has } from '../lookups.ts'

/** Swaps a Cache's engine. The new one starts empty. */
export const setCacheEngine = (game: Game, id: string, engine: CacheEngine): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'cache') return notAllowed('Only a Cache has an engine.')
    return ok(
      node.engine === engine ? game : patch(game, id, { engine, life: withWarm(node.life, 0) }),
    )
  })

/** Turns a Cache's stampede protection or warming on or off. Each needs its research. */
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
    if ((change.coalesce || change.earlyExpiry || change.swr) && !has(game, 'stampede-protection'))
      return no(
        Refusal.Locked({
          what: change.coalesce
            ? 'Coalescing'
            : change.earlyExpiry
              ? 'Early expiration'
              : 'Stale-while-revalidate',
          research: RESEARCH['stampede-protection'].name,
        }),
      )
    if (change.warming && !has(game, 'cache-warming'))
      return no(Refusal.Locked({ what: 'Warming', research: RESEARCH['cache-warming'].name }))
    return ok(patch(game, id, change))
  })

/**
 * Picks what a Cache does on a write (07 "Strategies"): cache-aside, read-through,
 * write-through or write-behind. Every strategy but cache-aside needs Cache strategies.
 */
export const setCacheStrategy = (game: Game, id: string, cacheStrategy: CacheStrategy): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'cache') return notAllowed('Only a Cache has a strategy.')
    if (cacheStrategy !== 'aside' && !has(game, 'cache-strategies'))
      return no(
        Refusal.Locked({ what: 'Cache strategies', research: RESEARCH['cache-strategies'].name }),
      )
    return ok(
      node.cacheStrategy === cacheStrategy
        ? game
        : patch(game, id, {
            cacheStrategy,
            life: withWarm(node.life, node.warming && has(game, 'cache-warming') ? WARMED : 0),
          }),
    )
  })
