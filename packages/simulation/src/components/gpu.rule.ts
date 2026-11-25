import { type Action, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game, GameNode, GpuType } from '../state.ts'
import { activeIncident } from '../state.ts'
import { type GpuModel, GPU_BATCHES, GPU_MODELS } from '../catalog.ts'

export { setPrecision } from '../generated/gpu.rule.ts'

import { restarted } from '../lookups.ts'

export const setGpuType = (game: Game, id: string, gpu: GpuType): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'gpu') return notAllowed('Only a GPU Node has a GPU type.')
    if (node.gpu === gpu) return ok(game)
    if (gpu === 'h100' && activeIncident(game)?.kind === 'gpu-shortage')
      return notAllowed('No H100 capacity this month.')
    return ok(patch(game, id, { gpu, ...restarted(node) }))
  })

export const setBatch = (game: Game, id: string, batch: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'gpu') return notAllowed('Only a GPU Node batches prompts.')
    if (!GPU_BATCHES.some((entry) => entry.batch === batch))
      return notAllowed(`A batch is ${GPU_BATCHES.map((entry) => entry.batch).join(', ')}.`)
    return ok(node.batch === batch ? game : patch(game, id, { batch: batch as GameNode['batch'] }))
  })

export const setGpuModel = (game: Game, id: string, gpuModel: GpuModel): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'gpu') return notAllowed('Only a GPU Node serves a model.')
    if (!(gpuModel in GPU_MODELS)) return notAllowed('There is no such model.')
    return ok(node.gpuModel === gpuModel ? game : patch(game, id, { gpuModel, ...restarted(node) }))
  })
