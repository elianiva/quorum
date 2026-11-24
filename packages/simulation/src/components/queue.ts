import { Effect, Schema } from 'effect'
export {
  QUEUE_RATE,
  BACKLOG_MS,
  DRAIN_SECONDS,
  MAX_ATTEMPTS,
  FOREVER_ATTEMPTS,
  QUEUE_LENGTHS,
  QUEUE_MESSAGE_PRICE,
  queueGlossary,
} from '../generated/queue.ts'

export const queueFields = {
  dlq: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  maxLength: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const
