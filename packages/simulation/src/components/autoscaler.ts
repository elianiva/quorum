import { Effect, Schema } from 'effect'
export {
  VM_REACTION_SECONDS,
  POD_REACTION_SECONDS,
  SCALE_COOLDOWN_SECONDS,
  SCALE_TARGETS,
  SCALE_MINIMA,
  SCALE_MAXIMA,
  SCALE_IN,
  SCHEDULE_LEAD_MINUTES,
  SCALE_RPS_PER_VCPU,
  SCALE_QUEUE_DEPTH,
  autoscalerGlossary,
} from '../generated/autoscaler.ts'

export const ScaleSignal = Schema.Literals(['cpu', 'load', 'rps', 'queue'])
export type ScaleSignal = typeof ScaleSignal.Type

export const autoscalerFields = {
  signal: ScaleSignal.pipe(Schema.withDecodingDefaultKey(Effect.succeed('cpu' as const))),
  target: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0.6))),
  minCopies: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  maxCopies: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(8))),
  schedule: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const
