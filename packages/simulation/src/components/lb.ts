import { Effect, Schema } from 'effect'
export {
  LB_POLICIES,
  P2C_CAPACITY,
  P2C_IMBALANCE,
  CHECK_INTERVALS,
  L4_CAPACITY,
  L4_MS,
  L4_BURN,
  LB_VARIANTS,
  STICKY_SHARE,
  STICKY_DECAY,
  lbGlossary,
} from '../generated/lb.ts'
import { LB_VARIANTS } from '../generated/lb.ts'

export type LbVariant = keyof typeof LB_VARIANTS

export const LbPolicy = Schema.Literals(['weighted', 'round-robin', 'least-conn', 'p2c', 'hash'])
export type LbPolicy = typeof LbPolicy.Type

export const lbFields = {
  policy: LbPolicy.pipe(Schema.withDecodingDefaultKey(Effect.succeed('weighted' as const))),
  sticky: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  slowStart: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  variant: Schema.Literals(['l7', 'l4']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('l7' as const)),
  ),
  checkEvery: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(10))),
  deepCheck: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const
