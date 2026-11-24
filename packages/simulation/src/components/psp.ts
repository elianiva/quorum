import { Effect, Schema } from 'effect'
export {
  PSP_RATE,
  PSP_FIXED,
  SECOND_PROVIDER_FEE,
  PSP_CAPACITY,
  pspGlossary,
} from '../generated/psp.ts'

export const pspFields = {
  provider: Schema.Literals(['first', 'second']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('first' as const)),
  ),
} as const
