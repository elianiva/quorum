import { Effect, Schema } from 'effect'
import { def } from './define.ts'

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

export const pspDef = def({
  id: 'psp',
  code: 'psp',
  name: 'Payment Provider',
  product: 'Stripe',
  group: 'data',
  blurb: 'Charges cards for checkouts. 2.9% plus $0.30 per checkout.',
  cost: 0,
  latency: 400,
  accepts: ['charge'],
  maxOut: 0,
  unlock: 'checkout',
  steps: 8,
  limiting: true,
})
