import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game, GameNode } from '../state.ts'
import { HUB_RAM_KB, RUNTIMES } from '../catalog.ts'

import { flatScale, has } from '../lookups.ts'

/**
 * Connections a Hub holds at its size: the RAM it gives them over what one costs its runtime
 * (06 "Realtime connections"). A runtime that holds a worker or a thread per connection holds
 * none, and without Clustering only one box takes connections, so the larger sizes add Burn and
 * no room.
 */
export const hubConnections = (node: GameNode, builtIn = false): number => {
  const perConnection = RUNTIMES[node.runtime].connectionKB
  if (perConnection === null) return 0
  return (HUB_RAM_KB * (node.clustering || builtIn ? flatScale(node) : 1)) / perConnection
}

/**
 * Distributed Erlang gives an Elixir Hub its own cluster backbone, so it takes connections on
 * every box without the Clustering option (06 "Elixir", "Realtime connections").
 */
export const distributedErlang = (game: Game, node: GameNode): boolean =>
  has(game, 'distributed-erlang') && RUNTIMES[node.runtime].language === 'elixir'

/** Sets a Realtime Hub's Presence, Reconnect backoff, or Clustering (05 "Realtime Hub"). */
export const setHubOptions = (
  game: Game,
  id: string,
  change: Readonly<{ presence?: boolean; backoff?: boolean; clustering?: boolean }>,
): Action =>
  withNode(game, id, (node) =>
    node.type === 'ws' ? ok(patch(game, id, change)) : notAllowed('Only a Realtime Hub has these.'),
  )
