import { Effect, Schema } from 'effect'

export const HUB_RAM_KB = 8 * 1_048_576
export const PRESENCE_CPU = 0.15
export const PRESENCE_VALUE = 1.25
export const HERD_REFUSED = 0.5

export const wsFields = {
  presence: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  backoff: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  clustering: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const
