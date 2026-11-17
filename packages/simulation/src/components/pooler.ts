import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const poolerGlossary: ReadonlyArray<string> = ['connection-pooling']

export const PoolerMode = Schema.Literals(['session', 'transaction', 'statement'])
export type PoolerMode = typeof PoolerMode.Type

export const poolerFields = {
  mode: PoolerMode.pipe(Schema.withDecodingDefaultKey(Effect.succeed('transaction' as const))),
} as const

export const poolerDef = def({
  id: 'pooler',
  code: 'pool',
  name: 'Connection Pooler',
  product: 'PgBouncer',
  group: 'data',
  blurb: 'Many app connections share 20 database connections. It pools to one host.',
  cost: 80,
  burn: 0.03,
  latency: 0.3,
  accepts: ['q-read', 'q-write', 'q-tx'],
  fallback: [],
  unlock: 'pooling',
  steps: 4,
  sends: ['q-read', 'q-write', 'q-tx'],
  maxOut: 1,
  limiting: true,
})
