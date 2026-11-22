import { Effect, Schema } from 'effect'
import { def } from './define.ts'

export const GPU_TYPES = {
  t4: { name: 'T4', burn: 0.53, tokens: 200, gb: 16 },
  a100: { name: 'A100', burn: 1.8, tokens: 900, gb: 80 },
  h100: { name: 'H100', burn: 3.3, tokens: 2_000, gb: 80 },
} as const
export const GPU_MODELS = {
  small: { name: 'Small (3B)', gb: 6, speed: 2, value: 0.6 },
  medium: { name: 'Medium (7B)', gb: 14, speed: 1, value: 1 },
  large: { name: 'Large (34B)', gb: 68, speed: 0.25, value: 1.8 },
} as const
export type GpuModel = keyof typeof GPU_MODELS
export const GPU_CACHE_GB = 0.25
export const GPU_FIRST_TOKEN_MS = 300
export const GPU_PRECISIONS = {
  fp16: { name: 'FP16', speed: 1, value: 1, memory: 1 },
  int8: { name: 'INT8', speed: 2, value: 0.92, memory: 0.5 },
  int4: { name: 'INT4', speed: 3, value: 0.7, memory: 0.25 },
} as const
export type GpuPrecision = keyof typeof GPU_PRECISIONS

export const GPU_BATCHES = [
  { batch: 1, gain: 1, ttft: 0 },
  { batch: 8, gain: 1.6, ttft: 700 },
  { batch: 32, gain: 2.2, ttft: 3_200 },
] as const

export const gpuGlossary: ReadonlyArray<string> = ['model-inference']

export const GpuType = Schema.Literals(['t4', 'a100', 'h100'])
export type GpuType = typeof GpuType.Type

export const gpuFields = {
  gpu: GpuType.pipe(Schema.withDecodingDefaultKey(Effect.succeed('t4' as const))),
  precision: Schema.Literals(['fp16', 'int8', 'int4']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('fp16' as const)),
  ),
  gpuModel: Schema.Literals(['small', 'medium', 'large']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('medium' as const)),
  ),
  batch: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
} as const

export const gpuDef = def({
  id: 'gpu',
  code: 'gpu',
  name: 'GPU Node',
  product: 'vLLM on NVIDIA',
  group: 'compute',
  blurb: 'Serves AI prompts in tokens per second. Each size step doubles the GPUs.',
  cost: 900,
  latency: 300,
  accepts: ['infer'],
  maxOut: 0,
  unlock: 'model-serving',
  steps: 8,
  limiting: true,
  coldStart: true,
})
