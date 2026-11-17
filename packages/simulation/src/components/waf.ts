import { Effect, Schema } from 'effect'
import { def } from './define.ts'
import { REQUEST_KINDS } from '../catalog/kinds.ts'

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

export const wafDef = def({
  id: 'waf',
  code: 'waf',
  name: 'WAF',
  product: 'ModSecurity',
  group: 'edge',
  blurb: 'Blocks bots before they reach the app, and some real users with them.',
  cost: 260,
  burn: 0.1,
  latency: 2,
  accepts: REQUEST_KINDS,
  sends: REQUEST_KINDS,
  unlock: 'waf',
  steps: 6,
  limiting: true,
})
