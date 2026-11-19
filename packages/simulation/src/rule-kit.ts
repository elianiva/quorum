import {
  GPU_PRECISIONS,
  GPU_MODELS,
  GPU_CACHE_GB,
  GPU_TYPES,
  COMPONENTS,
  HOT_KB_PER_USER,
  type ComponentId,
  type Kind,
} from './catalog.ts'
import { flatScale } from './lookups.ts'
import type { Game, GameNode } from './state.ts'

export const CACHE_HIT_LOW = 0.7

export const hotDataGb = (game: Game): number => (game.users * HOT_KB_PER_USER) / 1_000_000

export const evictionShareOf = (game: Game, node: GameNode): number => {
  const hot = hotDataGb(game)
  return hot > 0 ? Math.max(0, 1 - Math.min(1, flatScale(node) / hot)) : 0
}

export const gpuNeedGB = (node: GameNode): number =>
  GPU_MODELS[node.gpuModel].gb * GPU_PRECISIONS[node.precision].memory + GPU_CACHE_GB * node.batch

export const gpuHeldGB = (node: GameNode): number => GPU_TYPES[node.gpu].gb * flatScale(node)

export const gpuFits = (node: GameNode): boolean => gpuNeedGB(node) <= gpuHeldGB(node)

export const ACCEPTS = new Map<ComponentId, ReadonlySet<Kind>>(
  Object.values(COMPONENTS).map((component) => [component.id, new Set(component.accepts)]),
)

export const accepts = (node: GameNode, kind: Kind): boolean =>
  (ACCEPTS.get(node.type) as ReadonlySet<Kind>).has(kind)
