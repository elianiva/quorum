import { type Action, Refusal, no, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { RESEARCH } from '../catalog.ts'
import { databasesOf, databasesOfGroup, dataGroupOf, has, primaryOf } from '../lookups.ts'
import { warming } from '../life.ts'
import { PROMOTE_DATA_LOSS } from './replica.ts'

export const setSync = (game: Game, id: string, sync: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'replica') return notAllowed('Only a Read Replica replicates synchronously.')
    if (sync && !has(game, 'sync-replication'))
      return no(
        Refusal.Locked({
          what: 'Synchronous replication',
          research: RESEARCH['sync-replication'].name,
        }),
      )
    const copiesNothing = primaryOf(game, node) === undefined
    if (sync && copiesNothing) return notAllowed('Link a Database into this Read Replica first.')
    return ok(node.sync === sync ? game : patch(game, id, { sync }))
  })

export const promoteReplica = (game: Game, id: string): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'replica') return notAllowed('Only a Read Replica can be promoted.')
    const linked = primaryOf(game, node)
    const grouped = linked ? databasesOfGroup(game, dataGroupOf(game, linked)) : []
    const databases = grouped.length === 1 ? grouped : databasesOf(game)
    if (databases.length !== 1) return notAllowed('Promote needs exactly one Database.')
    const primary = databases[0] as (typeof databases)[number]
    const loss = node.sync ? 0 : PROMOTE_DATA_LOSS
    return ok({
      ...game,
      data: game.data * (1 - loss),
      nodes: game.nodes.map((entry) => {
        if (entry.id === node.id)
          return {
            ...entry,
            type: 'database' as const,
            sync: false,
            topology: 'single' as const,
            life: warming(0),
          }
        if (entry.id === primary.id) return { ...entry, type: 'replica' as const, sync: false }
        return entry
      }),
    })
  })
