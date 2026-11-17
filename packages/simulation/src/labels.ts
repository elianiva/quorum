import { COMPONENTS } from './catalog.ts'
import type { Game, GameNode } from './state.ts'

export const nodeLabelOf = (
  game: Game,
  node: GameNode,
): Readonly<{ name: string; ordinal: number }> => {
  const name = COMPONENTS[node.type].name
  if (COMPONENTS[node.type].fixed) return { name, ordinal: 0 }
  const same = game.nodes.filter((entry) => entry.type === node.type)
  if (same.length < 2 && node.ordinal <= 1) return { name, ordinal: 0 }
  const ordinal = node.ordinal > 0 ? node.ordinal : same.indexOf(node) + 1
  return { name, ordinal }
}

export const nodeLabel = (game: Game, node: GameNode): string => {
  const label = nodeLabelOf(game, node)
  return label.ordinal > 0 ? `${label.name} ${label.ordinal}` : label.name
}

export const nodeOrdinals = (game: Game): Readonly<Record<string, number>> =>
  Object.fromEntries(game.nodes.map((node) => [node.id, nodeLabelOf(game, node).ordinal] as const))

export const nextOrdinal = (game: Game, type: GameNode['type']): number => {
  const same = game.nodes.filter((node) => node.type === type)
  const highest = Math.max(0, ...same.map((node) => node.ordinal))
  return highest > 0 ? highest + 1 : same.length + 1
}

export const normalizeOrdinals = (game: Game): Game => {
  const next = new Map<GameNode['type'], number>()
  let changed = false
  const nodes = game.nodes.map((node) => {
    const highest = next.get(node.type) ?? 0
    if (node.ordinal > 0) {
      if (node.ordinal > highest) next.set(node.type, node.ordinal)
      return node
    }
    const ordinal = highest + 1
    next.set(node.type, ordinal)
    changed = true
    return { ...node, ordinal }
  })
  return changed ? { ...game, nodes } : game
}
