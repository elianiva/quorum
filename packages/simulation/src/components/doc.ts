import { Effect, Schema } from 'effect'
export {
  DOC_OPS,
  DOC_JOIN_COST,
  DOC_OP_MS,
  DOC_TXN_LATENCY,
  DOC_PARTIAL,
  DOC_PATTERN_FACTOR,
  DOC_SHAPE_DH,
  docGlossary,
} from '../generated/doc.ts'

export const docFields = {
  transactions: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const
