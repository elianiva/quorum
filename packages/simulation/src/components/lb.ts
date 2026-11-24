import { Effect, Schema } from 'effect'

export const LB_POLICIES = {
  weighted: { label: 'Weighted', research: null },
  'round-robin': { label: 'Round robin', research: null },
  'least-conn': { label: 'Least conn', research: 'lb-algorithms' },
  p2c: { label: 'Two choices', research: 'lb-algorithms' },
  hash: { label: 'Consistent hash', research: 'lb-algorithms' },
} as const
export const P2C_CAPACITY = 1.5
export const P2C_IMBALANCE = 0.1
export const CHECK_INTERVALS = [2, 10, 30] as const
export const L4_CAPACITY = 10
export const L4_MS = 0.2
export const L4_BURN = 0.6
export const LB_VARIANTS = {
  l7: { name: 'L7', research: null },
  l4: { name: 'L4', research: 'l4-lb' },
} as const
export type LbVariant = keyof typeof LB_VARIANTS

export const STICKY_SHARE = 0.4
export const STICKY_DECAY = 0.8

export const lbGlossary: ReadonlyArray<string> = [
  'health-check',
  'load-balancer',
  'vertical-and-horizontal-scaling',
]

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
