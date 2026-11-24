import { Effect, Schema } from 'effect'

export const PARANOIA = [
  { level: 1, block: 0.6, falsePositive: 0.001, cpu: 1 },
  { level: 2, block: 0.8, falsePositive: 0.005, cpu: 1.5 },
  { level: 3, block: 0.92, falsePositive: 0.02, cpu: 2.5 },
  { level: 4, block: 0.98, falsePositive: 0.06, cpu: 4 },
] as const
export const UNDER_ATTACK = { block: 0.99, falsePositive: 0.01, latency: 40, cpu: 1 } as const
export const BOT_MANAGEMENT_FALSE = 0.5

export const wafGlossary: ReadonlyArray<string> = ['rate-limiting', 'waf-web-application-firewall']

export const wafFields = {
  paranoia: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(2))),
  underAttack: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const
