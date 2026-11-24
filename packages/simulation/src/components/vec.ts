import { Effect, Schema } from 'effect'
export { VEC_QUERIES, VEC_INDEXES, VEC_AI_LIFT, vecGlossary } from '../generated/vec.ts'

export const VecIndexType = Schema.Literals(['exact', 'hnsw'])
export type VecIndexType = typeof VecIndexType.Type

export const vecFields = {
  indexType: VecIndexType.pipe(Schema.withDecodingDefaultKey(Effect.succeed('exact' as const))),
} as const
