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

/**
 * Share of a Cache's refills that push an older key out: 0 while the hot data fits its memory,
 * and the share that does not fit once it does not (07 \"Cache\").
 */
export const evictionShareOf = (game: Game, node: GameNode): number => {
  const hot = (game.users * HOT_KB_PER_USER) / 1_000_000
  return hot > 0 ? Math.max(0, 1 - Math.min(1, flatScale(node) / hot)) : 0
}

/** GB of GPU memory the Node's model needs: its weights at its precision, and the batch's attention cache. */
export const gpuNeedGB = (node: GameNode): number =>
  GPU_MODELS[node.gpuModel].gb * GPU_PRECISIONS[node.precision].memory + GPU_CACHE_GB * node.batch

/** GB of memory the Node's GPUs hold between them. */
export const gpuHeldGB = (node: GameNode): number => GPU_TYPES[node.gpu].gb * flatScale(node)

/** Whether the model fits in the Node's GPU memory. */
export const gpuFits = (node: GameNode): boolean => gpuNeedGB(node) <= gpuHeldGB(node)

/** Each Component's accepted kinds as a set: the solver asks on every route. */
export const ACCEPTS = new Map<ComponentId, ReadonlySet<Kind>>(
  Object.values(COMPONENTS).map((component) => [component.id, new Set(component.accepts)]),
)

/** Whether a Node takes a kind on an inbound Link. */
export const accepts = (node: GameNode, kind: Kind): boolean =>
  (ACCEPTS.get(node.type) as ReadonlySet<Kind>).has(kind)
