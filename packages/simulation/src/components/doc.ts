import { Effect, Schema } from 'effect'

export const DOC_OPS = 3_000
export const DOC_JOIN_COST = 3
export const DOC_OP_MS = 1
export const DOC_TXN_LATENCY = 0.5
export const DOC_PARTIAL = 0.02
export const DOC_PATTERN_FACTOR = 1.1
export const DOC_SHAPE_DH = 0.75

export const docGlossary: ReadonlyArray<string> = ['hot-key', 'sharding']

export const docFields = {
  transactions: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const
