import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const LOG_RATE = 100_000
export const LOG_READ_RATE = 20_000
export const LOG_PARTITIONS = [1, 3, 6, 12] as const
export const LOG_ACKS = {
  '0': { name: 'No ack', latency: 0.4 },
  '1': { name: 'Leader', latency: 1 },
  all: { name: 'All replicas', latency: 1.5 },
} as const
export const LOG_RETENTION = [600, 3_600, 10_080] as const
export const LOG_REPLICA_BURN = 0.5
export const LOG_REPLICAS = [1, 2, 3] as const
export const LOG_LOSS = { '0': 0.1, '1': 0.05, all: 0 } as const

export const logGlossary: ReadonlyArray<string> = [
  'at-least-once-delivery',
  'cdc-change-data-capture',
]

export const Acks = Schema.Literals(['0', '1', 'all'])
export type Acks = typeof Acks.Type

export const logFields = {
  partitions: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(3))),
  acks: Acks.pipe(Schema.withDecodingDefaultKey(Effect.succeed('all' as const))),
  retain: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(3_600))),
  keyed: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
} as const

export const logDef = def({
  id: 'log',
  code: 'log',
  name: 'Event Stream',
  product: 'Apache Kafka',
  group: 'compute',
  blurb:
    'A log, not a queue: events stay after they are read, so a consumer can replay them. Consumers read one partition each and fall behind at their own pace.',
  cost: 900,
  burn: 0.3,
  latency: 5,
  accepts: ['task', 'change'],
  sends: ['task', 'change'],
  unlock: 'event-streaming',
  steps: 6,
  limiting: true,
})
