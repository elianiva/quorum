import { Effect, Schema } from 'effect'
export {
  DB_ENGINES,
  STORAGE_IOPS,
  SHARD_COUNTS,
  DB_RETENTIONS,
  ROW_KB,
  DB_STORAGE_MULT,
  RESTORE_FAILURE,
  RESTORE_DRILL_DH,
  MATERIALIZED_SCAN,
  MATERIALIZED_STALE,
  DENORMALIZED_READ,
  DENORMALIZED_WRITE,
  BACKUPS,
  SHARD_KEYS,
  SCATTER_CPU,
  SCATTER_MS,
  DISTRIBUTED_TX_FAILURE,
  RESHARD_DH,
  RESHARD_IOPS,
  RESHARD_MINUTES_PER_GB,
  ONLINE_MIGRATION_DH,
  EXPAND_CONTRACT_DH,
  INDEX_WRITE_COST,
  RESTORE_MINUTES_PER_GB,
  RESTORE_MIN_MINUTES,
  MIGRATION_LOCK_PER_GB,
  MULTI_WRITE_CPU,
  MULTI_CONFLICT,
} from '../generated/database.ts'
import { STORAGE_IOPS } from '../generated/database.ts'

export const diskMs = (volume: keyof typeof STORAGE_IOPS): number =>
  1_000 / STORAGE_IOPS[volume].iops
export const IopsClass = Schema.Literals(['general', 'provisioned'])
export type IopsClass = typeof IopsClass.Type

export const DbRetention = Schema.Literals(['keep', 'archive', 'delete'])
export type DbRetention = typeof DbRetention.Type

export const ShardKey = Schema.Literals(['hash', 'range', 'tenant', 'region'])
export type ShardKey = typeof ShardKey.Type

export const DbTopology = Schema.Literals(['single', 'sharded', 'multi'])
export type DbTopology = typeof DbTopology.Type

export const databaseFields = {
  shardKey: ShardKey.pipe(Schema.withDecodingDefaultKey(Effect.succeed('hash' as const))),
  iops: IopsClass.pipe(Schema.withDecodingDefaultKey(Effect.succeed('general' as const))),
  shards: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  keep: DbRetention.pipe(Schema.withDecodingDefaultKey(Effect.succeed('keep' as const))),
  materialized: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  topology: DbTopology.pipe(Schema.withDecodingDefaultKey(Effect.succeed('single' as const))),
} as const
