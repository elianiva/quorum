import { Effect, Schema } from 'effect'

export const PSP_RATE = 0.029
export const PSP_FIXED = 0.3
export const SECOND_PROVIDER_FEE = 1.15
export const PSP_CAPACITY = 1_000

export const pspGlossary: ReadonlyArray<string> = ['idempotency']

export const pspFields = {
  provider: Schema.Literals(['first', 'second']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('first' as const)),
  ),
} as const
