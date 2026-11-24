import { Effect, Schema } from 'effect'
import type { RequestKind } from '../catalog/kinds.ts'

export const GATEWAY_PRICE = 0.002
export const GATEWAY_LIMITS = [0, 100, 500, 1_000, 2_500, 5_000] as const
export const GATEWAY_BURST = 200
export const GATEWAY_AUTH_MS = 2
export const COALESCE_KINDS: ReadonlyArray<RequestKind> = ['page', 'read', 'feed', 'search']
export const COALESCE_HOT = 0.3
export const COALESCE_WINDOW = 0.05

export const gwFields = {
  authEdge: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  merge: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  burst: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  rateLimit: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const
