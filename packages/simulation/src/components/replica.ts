import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const SYNC_MS = 2
export const REPLICA_SYNC_MINUTES_PER_GB = 0.5
export const REPLICA_BOX_PRICE = 0.7
export const PROMOTE_DATA_LOSS = 0.02

export const replicaGlossary: ReadonlyArray<string> = [
  'eventual-consistency',
  'read-replica',
  'read-your-writes-consistency',
  'replication-lag',
]

export const replicaFields = {
  sync: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const

export const replicaDef = def({
  id: 'replica',
  code: 'rep',
  name: 'Read Replica',
  product: 'PostgreSQL or MySQL replica',
  group: 'data',
  blurb:
    'Link a Database into it, and it copies that Database. Takes reads and reports off it, and adding one does not restart it. Lags behind writes, so some API reads come back stale.',
  cost: 60,
  sized: true,
  latency: 2,
  accepts: ['q-read', 'q-scan'],
  maxOut: 0,
  unlock: 'replication',
  limiting: true,
  coldStart: true,
})
