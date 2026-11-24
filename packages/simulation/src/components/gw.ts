import { Effect, Schema } from 'effect'
export {
  GATEWAY_PRICE,
  GATEWAY_LIMITS,
  GATEWAY_BURST,
  GATEWAY_AUTH_MS,
  COALESCE_KINDS,
  COALESCE_HOT,
  COALESCE_WINDOW,
} from '../generated/gw.ts'

export const gwFields = {
  authEdge: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  merge: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  burst: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  rateLimit: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const
