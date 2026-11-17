import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const WIDE_OPS = 30_000
export const QUORUM_N = [1, 2, 3, 4, 5] as const
export const WIDE_STALE = 0.5
export const WIDE_TX_STALE = 0.02
export const WIDE_TX_DUPLICATE = 0.01

export const wideGlossary: ReadonlyArray<string> = [
  'consistent-hashing',
  'eventual-consistency',
  'hedged-request',
  'hot-key',
  'leaderless-replication',
  'quorum',
  'tail-at-scale',
]

export const wideFields = {
  r: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  w: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  lost: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const

export const wideDef = def({
  id: 'wide',
  code: 'wide',
  name: 'Wide-column Store',
  product: 'Apache Cassandra',
  group: 'data',
  blurb: 'Replicates each key to N nodes. Reads ask R of them, writes wait for W.',
  cost: 1_200,
  burn: 1.2,
  latency: 3,
  accepts: ['q-read', 'q-write', 'q-tx', 'k-write'],
  maxOut: 0,
  unlock: 'leaderless',
  steps: 6,
  limiting: true,
})
