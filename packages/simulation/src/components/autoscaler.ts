import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const VM_REACTION_SECONDS = 180
export const POD_REACTION_SECONDS = 30
export const SCALE_COOLDOWN_SECONDS = 30
export const SCALE_TARGETS = [0.4, 0.6, 0.8] as const
export const SCALE_MINIMA = [1, 2, 4, 8] as const
export const SCALE_MAXIMA = [4, 8, 16, 0] as const
export const SCALE_IN = 0.6
export const SCHEDULE_LEAD_MINUTES = 120

export const SCALE_RPS_PER_VCPU = 100
export const SCALE_QUEUE_DEPTH = 100

export const autoscalerGlossary: ReadonlyArray<string> = [
  'autoscaling',
  'cold-start',
  'diurnal-traffic',
  'vertical-and-horizontal-scaling',
]

export const ScaleSignal = Schema.Literals(['cpu', 'load', 'rps', 'queue'])
export type ScaleSignal = typeof ScaleSignal.Type

export const autoscalerFields = {
  signal: ScaleSignal.pipe(Schema.withDecodingDefaultKey(Effect.succeed('cpu' as const))),
  target: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0.6))),
  minCopies: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  maxCopies: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(8))),
  schedule: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
} as const

export const autoscalerDef = def({
  id: 'autoscaler',
  code: 'hpa',
  name: 'Autoscaler',
  product: 'Auto Scaling group',
  group: 'ops',
  blurb:
    'Link App Servers or Workers into it. It adds copies when they run hot and removes them when idle.',
  cost: 200,
  latency: 0,
  accepts: [],
  maxOut: 0,
  control: true,
  unlock: 'autoscaling',
})
