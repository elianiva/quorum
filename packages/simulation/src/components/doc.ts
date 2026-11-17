import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const DOC_OPS = 3_000
export const DOC_JOIN_COST = 3
export const DOC_OP_MS = 1
export const DOC_TXN_LATENCY = 0.5
export const DOC_PARTIAL = 0.02
export const DOC_PATTERN_FACTOR = 1.1
export const DOC_SHAPE_DH = 0.75

export const docGlossary: ReadonlyArray<string> = ['hot-key', 'sharding']

export const docFields = {
  transactions: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const

export const docDef = def({
  id: 'doc',
  code: 'doc',
  name: 'Document Store',
  product: 'MongoDB, Firestore',
  group: 'data',
  blurb:
    'Holds documents instead of rows. No joins and no connections to pool: one flat rate of reads and writes, and each query needs its own index.',
  cost: 260,
  burn: 0.2,
  latency: 3,
  accepts: ['q-read', 'q-write', 'q-tx', 'q-scan'],
  fallback: ['q-scan'],
  maxOut: 0,
  unlock: 'document-db',
  steps: 8,
  limiting: true,
  coldStart: true,
})
