import { Effect, Schema } from 'effect'
export { PARANOIA, UNDER_ATTACK, BOT_MANAGEMENT_FALSE, wafGlossary } from '../generated/waf.ts'

export const wafFields = {
  paranoia: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(2))),
  underAttack: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const
