import { type Action, Refusal, no, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game, GpuType } from '../state.ts'
import { activeIncident } from '../state.ts'
import {
  RESEARCH,
  type GpuModel,
  type GpuPrecision,
  GPU_PRECISIONS,
  GPU_BATCHES,
  GPU_MODELS,
} from '../catalog.ts'

import { has, restarted } from '../lookups.ts'

export const setGpuType = (game: Game, id: string, gpu: GpuType): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'gpu') return notAllowed('Only a GPU Node has a GPU type.')
    if (node.gpu === gpu) return ok(game)
    if (gpu === 'h100' && activeIncident(game)?.kind === 'gpu-shortage')
      return notAllowed('No H100 capacity this month.')
    return ok(patch(game, id, { gpu, ...restarted(node) }))
  })

export const setPrecision = (game: Game, id: string, precision: GpuPrecision): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'gpu') return notAllowed('Only a GPU Node has a precision.')
    if (precision !== 'fp16' && !has(game, 'quantization'))
      return no(
        Refusal.Locked({
          what: GPU_PRECISIONS[precision].name,
          research: RESEARCH.quantization.name,
        }),
      )
    return ok(node.precision === precision ? game : patch(game, id, { precision }))
  })

export const setBatch = (game: Game, id: string, batch: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'gpu') return notAllowed('Only a GPU Node batches prompts.')
    if (!GPU_BATCHES.some((entry) => entry.batch === batch))
      return notAllowed(`A batch is ${GPU_BATCHES.map((entry) => entry.batch).join(', ')}.`)
    return ok(node.batch === batch ? game : patch(game, id, { batch }))
  })

export const setGpuModel = (game: Game, id: string, gpuModel: GpuModel): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'gpu') return notAllowed('Only a GPU Node serves a model.')
    if (!(gpuModel in GPU_MODELS)) return notAllowed('There is no such model.')
    return ok(node.gpuModel === gpuModel ? game : patch(game, id, { gpuModel, ...restarted(node) }))
  })
