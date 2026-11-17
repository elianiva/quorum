import { def } from './define.ts'

export const DSQL_TX = 6_000
export const DSQL_READ_COST = 0.25

export const dsqlGlossary: ReadonlyArray<string> = ['quorum', 'raft', 'synchronous-replication']

export const dsqlDef = def({
  id: 'dsql',
  code: 'dsql',
  name: 'Distributed SQL',
  product: 'CockroachDB',
  group: 'data',
  blurb: 'SQL on Raft. Every write waits for a majority of its replicas.',
  cost: 2_500,
  burn: 1.95,
  latency: 3,
  accepts: ['q-read', 'q-write', 'q-tx'],
  maxOut: 0,
  unlock: 'consensus',
  steps: 6,
  limiting: true,
})
