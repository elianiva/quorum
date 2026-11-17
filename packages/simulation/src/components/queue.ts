import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const QUEUE_RATE = 20_000
export const BACKLOG_MS = 0.01
export const DRAIN_SECONDS = 10
export const MAX_ATTEMPTS = [1, 3, 10, 25] as const
export const FOREVER_ATTEMPTS = 25
export const QUEUE_LENGTHS = [0, 1_000, 10_000, 100_000] as const
export const QUEUE_MESSAGE_PRICE = 0.00144

export const queueGlossary: ReadonlyArray<string> = [
  'at-least-once-delivery',
  'backpressure',
  'dead-letter-queue',
  'transactional-outbox',
]

export const queueFields = {
  dlq: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  maxLength: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const

export const queueDef = def({
  id: 'queue',
  code: 'mq',
  name: 'Queue',
  product: 'RabbitMQ',
  group: 'compute',
  blurb: 'Takes work now so Workers can do it later. Users wait only for the enqueue.',
  cost: 360,
  burn: 0.1,
  latency: 2,
  accepts: ['task'],
  sends: ['task'],
  unlock: 'queues',
  steps: 6,
  limiting: true,
})
