import { Effect, Schema } from 'effect'
export {
  SYNC_MS,
  REPLICA_SYNC_MINUTES_PER_GB,
  REPLICA_BOX_PRICE,
  PROMOTE_DATA_LOSS,
  replicaGlossary,
} from '../generated/replica.ts'

export const replicaFields = {
  sync: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const
