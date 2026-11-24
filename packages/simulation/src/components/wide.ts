import { Effect, Schema } from 'effect'
export {
  WIDE_OPS,
  QUORUM_N,
  WIDE_STALE,
  WIDE_TX_STALE,
  WIDE_TX_DUPLICATE,
  wideGlossary,
} from '../generated/wide.ts'

export const wideFields = {
  r: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  w: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  lost: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const
