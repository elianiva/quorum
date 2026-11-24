import { Effect, Schema } from 'effect'
export {
  LOG_RATE,
  LOG_READ_RATE,
  LOG_PARTITIONS,
  LOG_ACKS,
  LOG_RETENTION,
  LOG_REPLICA_BURN,
  LOG_REPLICAS,
  LOG_LOSS,
  logGlossary,
} from '../generated/log.ts'

export const Acks = Schema.Literals(['0', '1', 'all'])
export type Acks = typeof Acks.Type

export const logFields = {
  partitions: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(3))),
  acks: Acks.pipe(Schema.withDecodingDefaultKey(Effect.succeed('all' as const))),
  retain: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(3_600))),
  keyed: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
} as const
