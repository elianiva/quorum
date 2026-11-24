import { Effect, Schema } from 'effect'

export const WIDE_OPS = 30_000
export const QUORUM_N = [1, 2, 3, 4, 5] as const
export const WIDE_STALE = 0.5
export const WIDE_TX_STALE = 0.02
export const WIDE_TX_DUPLICATE = 0.01

export const wideGlossary: ReadonlyArray<string> = [
  'consistent-hashing',
  'eventual-consistency',
  'hedged-request',
  'hot-key',
  'leaderless-replication',
  'quorum',
  'tail-at-scale',
]

export const wideFields = {
  r: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  w: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  lost: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const
