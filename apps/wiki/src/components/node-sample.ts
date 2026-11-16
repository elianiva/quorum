import { Result } from 'effect'
import { REQUEST_KINDS, type ComponentId, type RequestKind } from '@quorum/simulation/catalog'
import { blankNode, connect } from '@quorum/simulation/actions'
import { freeSandbox } from '@quorum/simulation/sandbox'
import type { Game, GameNode } from '@quorum/simulation/state'

/* The Sandbox a Component's card is drawn in. The card shows what the game would show a player who
   had placed that Component, so it sits in a request path that carries traffic. */

/** Where a Component can sit in the Sandbox's Users, App Server, Database path, tried in order. */
const PLACEMENTS: ReadonlyArray<ReadonlyArray<readonly [string, string]>> = [
  // In front of the App Server: DNS, Load Balancer, CDN, WAF, API Gateway, Edge Function.
  [
    ['users', 'T'],
    ['T', 'server'],
    ['server', 'database'],
  ],
  // Between the App Server and the Database: Pooler, Cache.
  [
    ['users', 'server'],
    ['server', 'T'],
    ['T', 'database'],
  ],
  // A Queue holds tasks until a Worker takes them.
  [
    ['users', 'server'],
    ['server', 'database'],
    ['server', 'T'],
    ['T', 'W'],
  ],
  // Beside the App Server: Search, Storage, Queue, and the other Managed Components.
  [
    ['users', 'server'],
    ['server', 'database'],
    ['server', 'T'],
  ],
  // A Read Replica copies the Database, and the App Server reads from it.
  [
    ['users', 'server'],
    ['server', 'database'],
    ['database', 'T'],
    ['server', 'T'],
  ],
  // Off the Database: CDC Connector.
  [
    ['users', 'server'],
    ['server', 'database'],
    ['database', 'T'],
  ],
  // In place of the Database: a Document Store, a Wide-column Store, Distributed SQL.
  [
    ['users', 'server'],
    ['server', 'T'],
  ],
  // At the Users: a Function or a Realtime Hub taking requests on its own.
  [
    ['users', 'T'],
    ['server', 'database'],
    ['T', 'database'],
  ],
  [['users', 'T']],
  // A Worker takes tasks from a Queue the App Server fills.
  [
    ['users', 'server'],
    ['server', 'database'],
    ['server', 'Q'],
    ['Q', 'T'],
  ],
]

/** Pages and API calls carry most of the traffic, and every other kind trickles, so each Component that takes one sees some. */
const MIX: Partial<Record<RequestKind, number>> = Object.fromEntries(
  REQUEST_KINDS.map((kind) => [kind, ['page', 'read', 'write', 'login'].includes(kind) ? 8 : 1]),
)

/** The Nodes a path may name besides the Component and the Sandbox's own: a Queue and a Worker. */
const HELPERS = { Q: 'queue', W: 'worker' } as const

const place = (
  start: Game,
  id: string,
  path: ReadonlyArray<readonly [string, string]>,
): Game | null => {
  let game = start
  const named = (end: string) => (end === 'T' ? id : end in HELPERS ? `sample-${end}` : end)
  for (const [key, type] of Object.entries(HELPERS)) {
    if (path.some((link) => link.includes(key)))
      game = { ...game, nodes: [...game.nodes, blankNode(game, `sample-${key}`, type, 1080, 40)] }
  }
  for (const [from, to] of path) {
    const result = connect(game, named(from), named(to))
    if (!Result.isSuccess(result)) return null
    game = result.success
  }
  return game
}

/**
 * The free Sandbox with every kind of request flowing and the Component wired into the first
 * path the game's own `connect` accepts. A Component that fits no path stands alone.
 */
export const wired = (type: ComponentId): { game: Game; node: GameNode } => {
  const base = freeSandbox()
  const fresh = base.nodes.some((entry) => entry.type === type)
    ? []
    : [blankNode(base, `sample-${type}`, type, 1080, 280)]
  const id = fresh[0]?.id ?? base.nodes.find((entry) => entry.type === type)?.id ?? ''
  // The App Server, the Database and the heavy Components are sized to carry their share of the
  // mix, so each card shows its own figures and not a saturated one.
  const sized = [...base.nodes, ...fresh].map((entry) =>
    entry.type === 'server'
      ? { ...entry, size: 5, workers: 64 }
      : entry.type === 'database' || entry.type === 'worker' || entry.type === 'gpu'
        ? { ...entry, size: 4 }
        : entry,
  )
  const open: Game = { ...base, nodes: sized, links: [], users: 100, scenario: { mix: MIX } }
  const found = (game: Game): GameNode => game.nodes.find((entry) => entry.id === id) as GameNode
  for (const path of PLACEMENTS) {
    const game = place(open, id, path)
    if (game) return { game, node: found(game) }
  }
  const alone = { ...open, links: base.links }
  return { game: alone, node: found(alone) }
}
