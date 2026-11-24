import { Effect, Schema } from 'effect'
export { HUB_RAM_KB, PRESENCE_CPU, PRESENCE_VALUE, HERD_REFUSED } from '../generated/ws.ts'

export const wsFields = {
  presence: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  backoff: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  clustering: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const
