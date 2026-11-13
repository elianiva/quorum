import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game, GameNode } from '../state.ts'
import { LOG_ACKS, LOG_PARTITIONS, LOG_REPLICAS, LOG_RETENTION } from '../catalog.ts'
import { warming } from '../life.ts'

/**
 * An Event Stream's partitions, acknowledgements, retention and partition key (07 "Event Stream").
 * Each one trades parallelism or durability against order, disk, and the window a consumer has.
 */
export const setLogOptions = (
  game: Game,
  id: string,
  change: Readonly<{
    partitions?: number
    acks?: GameNode['acks']
    retain?: number
    keyed?: boolean
    replicas?: number
  }>,
): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'log') return notAllowed('Only an Event Stream has these.')
    if (
      change.partitions !== undefined &&
      !(LOG_PARTITIONS as ReadonlyArray<number>).includes(change.partitions)
    )
      return notAllowed(`Partition counts are ${LOG_PARTITIONS.join(', ')}.`)
    if (
      change.acks !== undefined &&
      (LOG_ACKS as Record<string, unknown>)[change.acks] === undefined
    )
      return notAllowed(`Acknowledgements are ${Object.keys(LOG_ACKS).join(', ')}.`)
    if (
      change.retain !== undefined &&
      !(LOG_RETENTION as ReadonlyArray<number>).includes(change.retain)
    )
      return notAllowed(`Retention windows are ${LOG_RETENTION.join(', ')} seconds.`)
    if (
      change.replicas !== undefined &&
      !(LOG_REPLICAS as ReadonlyArray<number>).includes(change.replicas)
    )
      return notAllowed(`Replication factors are ${LOG_REPLICAS.join(', ')}.`)
    const { replicas, ...rest } = change
    const nextN = replicas === undefined ? node.n : replicas
    const rebalances = !game.sandbox && nextN !== node.n && node.life._tag !== 'Stopped'
    return ok(
      patch(game, id, {
        ...(replicas === undefined ? rest : { ...rest, n: replicas }),
        ...(rebalances ? { life: warming(0) } : {}),
      }),
    )
  })
