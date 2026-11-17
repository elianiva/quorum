import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const VEC_QUERIES = 500
export const VEC_INDEXES = {
  exact: { name: 'Exact', recall: 1, queries: 1, burn: 1 },
  hnsw: { name: 'HNSW', recall: 0.95, queries: 2, burn: 2 },
} as const
export const VEC_AI_LIFT = 1.35

export const vecGlossary: ReadonlyArray<string> = ['model-inference']

export const VecIndexType = Schema.Literals(['exact', 'hnsw'])
export type VecIndexType = typeof VecIndexType.Type

export const vecFields = {
  indexType: VecIndexType.pipe(Schema.withDecodingDefaultKey(Effect.succeed('exact' as const))),
} as const

export const vecDef = def({
  id: 'vec',
  code: 'vec',
  name: 'Vector Index',
  product: 'pgvector, Pinecone, Qdrant',
  group: 'data',
  blurb:
    'Answers nearest-neighbour lookups over your embeddings. It holds the index in memory, and a prompt that reaches it earns more.',
  cost: 400,
  burn: 0.3,
  latency: 20,
  accepts: ['q-vector'],
  maxOut: 0,
  unlock: 'embeddings',
  steps: 6,
  limiting: true,
  coldStart: true,
})
