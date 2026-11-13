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

/**
 * Sets a Database's backups. Needs Point-in-time recovery. A backup nobody has restored is
 * untested, so writing one rolls the design's 20% chance that it would not restore; with
 * Restore drills the Company tests every backup as it takes it, so the roll never fails
 * (07 "Backups").
 */
export const setBackup = (game: Game, id: string, backup: Backup): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database keeps backups.')
    if (backup !== 'none' && !has(game, 'pitr'))
      return no(Refusal.Locked({ what: 'Backups', research: RESEARCH.pitr.name }))
    if (node.backup === backup) return ok(game)
    if (backup === 'none') return ok(patch(game, id, { backup, restore: 'ok' }))
    return ok(rollRestore(patch(game, id, { backup }), id))
  })

/**
 * Tests a backup nobody has restored: rolls the design's 20% chance that it would not restore and
 * advances the seed, so the same save always finds the same answer. Restore drills remove the roll.
 */
export const rollRestore = (game: Game, id: string): Game => {
  const [roll, seed] = nextRandom(game.seed)
  const failed = !has(game, 'restore-drills') && roll < RESTORE_FAILURE
  return { ...patch(game, id, { restore: failed ? 'failed' : 'ok' }), seed }
}

/**
 * Runs a restore drill on a Database's backup (07 "Backups"). It costs Dev Hours, and an untested
 * restore fails on the design's 20% until Restore drills; a backup that fails is broken, and the
 * drill writes a new one. With the research the drill always restores.
 */
export const runRestoreDrill = (game: Game, id: string): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database keeps backups.')
    if (node.backup === 'none') return notAllowed('Take a backup before drilling a restore.')
    if (game.devHours < RESTORE_DRILL_DH)
      return notAllowed(`A restore drill needs ${RESTORE_DRILL_DH} Dev Hours.`)
    return ok({ ...rollRestore(game, id), devHours: game.devHours - RESTORE_DRILL_DH })
  })

/**
 * Turns a Database's materialized view on or off (Materialized views): a report scans the stored
 * view for half the CPU, and the figures are as old as its refresh.
 */
export const setMaterialized = (game: Game, id: string, materialized: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database holds a materialized view.')
    if (materialized && !has(game, 'precompute'))
      return no(Refusal.Locked({ what: 'A view', research: RESEARCH.precompute.name }))
    return ok(node.materialized === materialized ? game : patch(game, id, { materialized }))
  })

/** Picks the volume a Database's reads and writes wait on (07 "Capacity"). Needs no research. */
export const setStorageIops = (game: Game, id: string, iops: IopsClass): Action =>
  withNode(game, id, (node) =>
    node.type === 'database'
      ? ok(node.iops === iops ? game : patch(game, id, { iops }))
      : notAllowed('Only a Database has a volume.'),
  )

/**
 * Splits a Database into shards (07 "Partitioning"). Needs Sharding. Each shard is another copy of
 * the Database, and the writes divide across them.
 */
export const setShards = (game: Game, id: string, shards: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database shards.')
    if (!(SHARD_COUNTS as ReadonlyArray<number>).includes(shards))
      return notAllowed(`Shard counts are ${SHARD_COUNTS.join(', ')}.`)
    if (shards > 1 && !has(game, 'sharding'))
      return no(Refusal.Locked({ what: 'Sharding', research: RESEARCH.sharding.name }))
    return ok(node.shards === shards ? game : patch(game, id, { shards }))
  })

/**
 * Picks the key a Database shards on (07 "Partitioning"). It moves the data, so a Company changes
 * it through `queueReshard`; this is the Sandbox's and a replay's instant change.
 */
export const setShardKey = (game: Game, id: string, shardKey: ShardKey): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database shards.')
    if (SHARD_KEYS[shardKey] === undefined)
      return notAllowed(`Shard keys are ${Object.keys(SHARD_KEYS).join(', ')}.`)
    return ok(node.shardKey === shardKey ? game : patch(game, id, { shardKey }))
  })

/**
 * What a Database does with rows past its window (07 "Data volume"). Needs Retention policies.
 * Keeping everything is the default, so it needs nothing.
 */
export const setDbRetention = (game: Game, id: string, keep: DbRetention): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database keeps rows.')
    if (keep !== 'keep' && !has(game, 'retention'))
      return no(Refusal.Locked({ what: 'Retention', research: RESEARCH.retention.name }))
    return ok(node.keep === keep ? game : patch(game, id, { keep }))
  })

/**
 * Picks how more than one Database holds the rows (07 "Topologies"). One choice for every
 * Database: `single` is one primary with Read Replicas, `sharded` splits the rows across them,
 * `multi` copies every row to every Database and lets each take writes.
 */
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

/** Expands a full Database volume: writes come back. Costs what a replacement would. */
export const expandVolume = (game: Game): Action => {
  const target = game.nodes.find((node) => node.id === game.incident?.nodeId)
  if (game.incident?.kind !== 'disk-full' || !target) return notAllowed('No disk is full.')
  return spend(game, replacePrice(game, target), 'A bigger volume', (paid) =>
    paid.incident
      ? { ...paid, incident: { ...answering(paid, paid.incident), remaining: 0 } }
      : paid,
  )
}
