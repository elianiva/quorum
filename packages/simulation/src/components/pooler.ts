import { Effect, Schema } from 'effect'
export { poolerGlossary } from '../generated/pooler.ts'

export const PoolerMode = Schema.Literals(['session', 'transaction', 'statement'])
export type PoolerMode = typeof PoolerMode.Type

export const poolerFields = {
  mode: PoolerMode.pipe(Schema.withDecodingDefaultKey(Effect.succeed('transaction' as const))),
} as const
