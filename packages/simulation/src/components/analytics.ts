import { Effect, Schema } from 'effect'

export const SAMPLE_RATES = [0.01, 0.05, 0.1, 0.5, 1] as const
export const SAMPLE_OVERHEAD = [0.002, 0.01, 0.02, 0.08, 0.15] as const
export const SAMPLE_LATENCY = [0, 0.5, 1, 3, 5] as const
export const SAMPLE_STORAGE = [0.1, 0.5, 1, 5, 10] as const
export const RETENTION_WINDOWS = [900, 3_600, 21_600] as const
export const RETENTION_STORAGE = [1, 2, 4] as const
export const ANALYTICS_CAPACITY = 4

export const analyticsGlossary: ReadonlyArray<string> = ['observability']

export const analyticsFields = {
  sampleRate: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0.1))),
  retention: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(900))),
} as const
