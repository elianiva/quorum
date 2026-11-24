import { Effect, Schema } from 'effect'
export {
  GPU_TYPES,
  GPU_MODELS,
  GPU_CACHE_GB,
  GPU_FIRST_TOKEN_MS,
  GPU_PRECISIONS,
  GPU_BATCHES,
  gpuGlossary,
} from '../generated/gpu.ts'
import { GPU_MODELS, GPU_PRECISIONS } from '../generated/gpu.ts'

export type GpuModel = keyof typeof GPU_MODELS
export type GpuPrecision = keyof typeof GPU_PRECISIONS

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
