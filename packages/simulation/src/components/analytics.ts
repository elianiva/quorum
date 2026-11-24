import { Effect, Schema } from 'effect'
export {
  SAMPLE_RATES,
  SAMPLE_OVERHEAD,
  SAMPLE_LATENCY,
  SAMPLE_STORAGE,
  RETENTION_WINDOWS,
  RETENTION_STORAGE,
  ANALYTICS_CAPACITY,
  analyticsGlossary,
} from '../generated/analytics.ts'

export const analyticsFields = {
  sampleRate: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0.1))),
  retention: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(900))),
} as const
