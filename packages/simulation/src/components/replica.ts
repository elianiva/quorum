import { Effect, Schema } from 'effect'

export const SYNC_MS = 2
export const REPLICA_SYNC_MINUTES_PER_GB = 0.5
export const REPLICA_BOX_PRICE = 0.7
export const PROMOTE_DATA_LOSS = 0.02

export const replicaGlossary: ReadonlyArray<string> = [
  'eventual-consistency',
  'read-replica',
  'read-your-writes-consistency',
  'replication-lag',
]

export const replicaFields = {
  sync: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const
