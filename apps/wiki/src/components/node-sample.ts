import { Result } from 'effect'
import { REQUEST_KINDS, type ComponentId, type RequestKind } from '@quorum/simulation/catalog'
import { blankNode, connect } from '@quorum/simulation/actions'
import { freeSandbox } from '@quorum/simulation/sandbox'
import type { Game, GameNode } from '@quorum/simulation/state'

const PLACEMENTS: ReadonlyArray<ReadonlyArray<readonly [string, string]>> = [
  [
    ['users', 'T'],
    ['T', 'server'],
    ['server', 'database'],
  ],
  [
    ['users', 'server'],
    ['server', 'T'],
    ['T', 'database'],
  ],
  [
    ['users', 'server'],
    ['server', 'database'],
    ['server', 'T'],
    ['T', 'W'],
  ],
  [
    ['users', 'server'],
    ['server', 'database'],
    ['server', 'T'],
  ],
  [
    ['users', 'server'],
    ['server', 'database'],
    ['database', 'T'],
    ['server', 'T'],
  ],
  [
    ['users', 'server'],
    ['server', 'database'],
    ['database', 'T'],
  ],
  [
    ['users', 'server'],
    ['server', 'T'],
  ],
  [
    ['users', 'T'],
    ['server', 'database'],
    ['T', 'database'],
  ],
  [['users', 'T']],
  [
    ['users', 'server'],
    ['server', 'database'],
    ['server', 'Q'],
    ['Q', 'T'],
  ],
]

const MIX: Partial<Record<RequestKind, number>> = Object.fromEntries(
  REQUEST_KINDS.map((kind) => [kind, ['page', 'read', 'write', 'login'].includes(kind) ? 8 : 1]),
)

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

export const wired = (type: ComponentId): { game: Game; node: GameNode } => {
  const base = freeSandbox()
  const fresh = base.nodes.some((entry) => entry.type === type)
    ? []
    : [blankNode(base, `sample-${type}`, type, 1080, 280)]
  const id = fresh[0]?.id ?? base.nodes.find((entry) => entry.type === type)?.id ?? ''
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
