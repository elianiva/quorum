import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const HUB_RAM_KB = 8 * 1_048_576
export const PRESENCE_CPU = 0.15
export const PRESENCE_VALUE = 1.25
export const HERD_REFUSED = 0.5

export const wsFields = {
  presence: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  backoff: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  clustering: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const

export const wsDef = def({
  id: 'ws',
  code: 'ws',
  name: 'Realtime Hub',
  product: 'Socket.IO',
  group: 'compute',
  blurb: 'Holds a connection open for every realtime message. How many fit depends on the runtime.',
  cost: 400,
  burn: 0.15,
  latency: 1,
  accepts: ['rt'],
  maxOut: 0,
  unlock: 'websockets',
  steps: 8,
  limiting: true,
})
