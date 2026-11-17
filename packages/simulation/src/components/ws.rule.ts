import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game, GameNode } from '../state.ts'
import { HUB_RAM_KB, RUNTIMES } from '../catalog.ts'

import { flatScale, has } from '../lookups.ts'

export const hubConnections = (node: GameNode, builtIn = false): number => {
  const perConnection = RUNTIMES[node.runtime].connectionKB
  if (perConnection === null) return 0
  return (HUB_RAM_KB * (node.clustering || builtIn ? flatScale(node) : 1)) / perConnection
}

export const distributedErlang = (game: Game, node: GameNode): boolean =>
  has(game, 'distributed-erlang') && RUNTIMES[node.runtime].language === 'elixir'

export const setHubOptions = (
  game: Game,
  id: string,
  change: Readonly<{ presence?: boolean; backoff?: boolean; clustering?: boolean }>,
): Action =>
  withNode(game, id, (node) =>
    node.type === 'ws' ? ok(patch(game, id, change)) : notAllowed('Only a Realtime Hub has these.'),
  )
