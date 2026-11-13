import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game, SearchHeap, SearchVariant } from '../state.ts'
import {
  SEARCH_REPLICAS,
  SEARCH_SHARDS,
  SEARCH_REFRESH,
  SEARCH_HEAPS,
  SEARCH_VARIANTS,
} from '../catalog.ts'

import { warming } from '../life.ts'

/**
 * A Search Engine's product, shards, replicas, and heap (07 "Search Engine"). Meilisearch runs one
 * node: it takes no shards, replicas, or heap.
 */
export const setSearchOptions = (
  game: Game,
  id: string,
  change: Readonly<{
    searchVariant?: SearchVariant
    searchShards?: number
    searchReplicas?: number
    heap?: SearchHeap
  }>,
): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'search') return notAllowed('Only a Search Engine has these.')
    if (change.searchVariant !== undefined && SEARCH_VARIANTS[change.searchVariant] === undefined)
      return notAllowed(`Search products are ${Object.keys(SEARCH_VARIANTS).join(', ')}.`)
    if (
      change.searchShards !== undefined &&
      !(SEARCH_SHARDS as ReadonlyArray<number>).includes(change.searchShards)
    )
      return notAllowed(`Shard counts are ${SEARCH_SHARDS.join(', ')}.`)
    if (
      change.searchReplicas !== undefined &&
      !(SEARCH_REPLICAS as ReadonlyArray<number>).includes(change.searchReplicas)
    )
      return notAllowed(`Replica counts are ${SEARCH_REPLICAS.join(', ')}.`)
    if (change.heap !== undefined && SEARCH_HEAPS[change.heap] === undefined)
      return notAllowed(`Heaps are ${Object.keys(SEARCH_HEAPS).join(', ')}.`)
    const next = { ...node, ...change }
    if (
      !SEARCH_VARIANTS[next.searchVariant].jvm &&
      (next.searchShards !== 1 || next.searchReplicas !== 0 || next.heap !== 'half')
    )
      return notAllowed('Meilisearch runs one node: no shards, replicas, or heap.')
    const jvm = SEARCH_VARIANTS[next.searchVariant].jvm
    const indexChange =
      (change.searchVariant !== undefined && change.searchVariant !== node.searchVariant) ||
      (jvm &&
        ((change.searchShards !== undefined && change.searchShards !== node.searchShards) ||
          (change.searchReplicas !== undefined && change.searchReplicas !== node.searchReplicas)))
    const copy = !game.sandbox && indexChange && node.life._tag !== 'Stopped'
    return ok(patch(game, id, { ...change, ...(copy ? { life: warming(0) } : {}) }))
  })

/**
 * Picks a Search Engine's refresh interval (07 "Search Engine"): a longer interval saves indexing
 * CPU, so the Node answers more queries and a bigger share of its answers are staler.
 */
export const setSearchRefresh = (game: Game, id: string, refresh: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'search') return notAllowed('Only a Search Engine has a refresh interval.')
    if (!SEARCH_REFRESH.some((entry) => entry.seconds === refresh))
      return notAllowed(
        `Refresh intervals are ${SEARCH_REFRESH.map((entry) => entry.seconds).join(', ')} s.`,
      )
    return ok(node.refresh === refresh ? game : patch(game, id, { refresh }))
  })
