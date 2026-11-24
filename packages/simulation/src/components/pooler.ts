import { Effect, Schema } from 'effect'

export const poolerGlossary: ReadonlyArray<string> = ['connection-pooling']

export const PoolerMode = Schema.Literals(['session', 'transaction', 'statement'])
export type PoolerMode = typeof PoolerMode.Type

export const poolerFields = {
  mode: PoolerMode.pipe(Schema.withDecodingDefaultKey(Effect.succeed('transaction' as const))),
} as const
