import {
  type Action,
  Refusal,
  answering,
  no,
  notAllowed,
  ok,
  patch,
  spend,
  withNode,
} from '../action-kit.ts'
import type { Backup, DbRetention, DbTopology, Game, IopsClass, ShardKey } from '../state.ts'
import {
  RESEARCH,
  RESTORE_DRILL_DH,
  RESTORE_FAILURE,
  SHARD_COUNTS,
  SHARD_KEYS,
} from '../catalog.ts'
import { nextRandom } from '../random.ts'
import { has, replacePrice } from '../lookups.ts'

export const setBackup = (game: Game, id: string, backup: Backup): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database keeps backups.')
    if (backup !== 'none' && !has(game, 'pitr'))
      return no(Refusal.Locked({ what: 'Backups', research: RESEARCH.pitr.name }))
    if (node.backup === backup) return ok(game)
    if (backup === 'none') return ok(patch(game, id, { backup, restore: 'ok' }))
    return ok(rollRestore(patch(game, id, { backup }), id))
  })

export const rollRestore = (game: Game, id: string): Game => {
  const [roll, seed] = nextRandom(game.seed)
  const failed = !has(game, 'restore-drills') && roll < RESTORE_FAILURE
  return { ...patch(game, id, { restore: failed ? 'failed' : 'ok' }), seed }
}

export const runRestoreDrill = (game: Game, id: string): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database keeps backups.')
    if (node.backup === 'none') return notAllowed('Take a backup before drilling a restore.')
    if (game.devHours < RESTORE_DRILL_DH)
      return notAllowed(`A restore drill needs ${RESTORE_DRILL_DH} Dev Hours.`)
    return ok({ ...rollRestore(game, id), devHours: game.devHours - RESTORE_DRILL_DH })
  })

export const setMaterialized = (game: Game, id: string, materialized: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database holds a materialized view.')
    if (materialized && !has(game, 'precompute'))
      return no(Refusal.Locked({ what: 'A view', research: RESEARCH.precompute.name }))
    return ok(node.materialized === materialized ? game : patch(game, id, { materialized }))
  })

export const setStorageIops = (game: Game, id: string, iops: IopsClass): Action =>
  withNode(game, id, (node) =>
    node.type === 'database'
      ? ok(node.iops === iops ? game : patch(game, id, { iops }))
      : notAllowed('Only a Database has a volume.'),
  )

export const setShards = (game: Game, id: string, shards: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database shards.')
    if (!(SHARD_COUNTS as ReadonlyArray<number>).includes(shards))
      return notAllowed(`Shard counts are ${SHARD_COUNTS.join(', ')}.`)
    if (shards > 1 && !has(game, 'sharding'))
      return no(Refusal.Locked({ what: 'Sharding', research: RESEARCH.sharding.name }))
    return ok(node.shards === shards ? game : patch(game, id, { shards }))
  })

export const setShardKey = (game: Game, id: string, shardKey: ShardKey): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database shards.')
    if (SHARD_KEYS[shardKey] === undefined)
      return notAllowed(`Shard keys are ${Object.keys(SHARD_KEYS).join(', ')}.`)
    return ok(node.shardKey === shardKey ? game : patch(game, id, { shardKey }))
  })

export const setDbRetention = (game: Game, id: string, keep: DbRetention): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database keeps rows.')
    if (keep !== 'keep' && !has(game, 'retention'))
      return no(Refusal.Locked({ what: 'Retention', research: RESEARCH.retention.name }))
    return ok(node.keep === keep ? game : patch(game, id, { keep }))
  })

export const setTopology = (game: Game, id: string, topology: DbTopology): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database picks a topology.')
    return ok({
      ...game,
      nodes: game.nodes.map((entry) =>
        entry.type === 'database' ? { ...entry, topology } : entry,
      ),
    })
  })

export const expandVolume = (game: Game): Action => {
  const target = game.nodes.find((node) => node.id === game.incident?.nodeId)
  if (game.incident?.kind !== 'disk-full' || !target) return notAllowed('No disk is full.')
  return spend(game, replacePrice(game, target), 'A bigger volume', (paid) =>
    paid.incident
      ? { ...paid, incident: { ...answering(paid, paid.incident), remaining: 0 } }
      : paid,
  )
}
