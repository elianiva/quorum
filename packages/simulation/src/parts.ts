import { CALENDAR_DAY, COMPONENTS, ERAS, FAMILIES, SIZES, type FamilyId } from './catalog.ts'
import { cosTurns } from './calendar.ts'
import type { Game, GameNode, IopsClass } from './state.ts'

export const PART_SLOTS = ['cpu', 'ram', 'disk'] as const
export type SlotKind = (typeof PART_SLOTS)[number]

export const partsUnlocked = (game: Game): boolean => game.researched.includes('custom-instances')

export const PART_MARKET_WEEK = 7 * CALENDAR_DAY
export const PART_MARKET_SWING = 0.15

const MARKET_PHASE: Record<SlotKind, number> = {
  cpu: -0.25,
  ram: 0.15,
  disk: 0.45,
}

const MARKET_RAM_KIT = 40
const MARKET_DISK = { general: 24, provisioned: 72 } as const

export const missingParts = (game: Game, node: GameNode): ReadonlyArray<SlotKind> => {
  if (!partsUnlocked(game)) return []
  if (node.type !== 'server' && node.type !== 'database') return []
  return PART_SLOTS.filter((slot) => {
    if (slot === 'disk' && node.type !== 'database') return false
    return !node.parts[slot]
  })
}

export const provisioned = (game: Game, node: GameNode): boolean =>
  missingParts(game, node).length === 0

export const installedPart = (node: GameNode, slot: SlotKind): string | null => {
  if (slot === 'disk' && node.type !== 'database') return null
  if (!node.parts[slot]) return null
  if (slot === 'cpu') {
    const vcpu = SIZES[node.size]?.vcpu ?? 0
    return `${Number.isInteger(vcpu) ? vcpu : vcpu.toFixed(1)}c`
  }
  if (slot === 'ram') {
    const vcpu = node.parts.cpu ? (SIZES[node.size]?.vcpu ?? 0) : 0
    return `${Math.round(vcpu * FAMILIES[node.family].ramPerVcpu)}g`
  }
  return node.type === 'database' && node.iops === 'provisioned' ? '64k' : '3k'
}

export const partMarket = (game: Game, slot: SlotKind): number =>
  1 + PART_MARKET_SWING * cosTurns(game.time / PART_MARKET_WEEK + MARKET_PHASE[slot])

export const marketPercent = (game: Game, slot: SlotKind): number =>
  Math.round((partMarket(game, slot) - 1) * 100)

export const marketDirection = (game: Game, slot: SlotKind): 'up' | 'down' | 'flat' => {
  const now = partMarket(game, slot)
  const next = partMarket({ ...game, time: game.time + PART_MARKET_WEEK / 48 }, slot)
  if (next > now + 0.001) return 'up'
  if (next < now - 0.001) return 'down'
  return 'flat'
}

const eraIndex = (game: Game): number => ERAS[Math.min(game.stage, ERAS.length - 1)]?.costIndex ?? 1

export const cpuPartPrice = (game: Game, node: GameNode, size: number): number => {
  const vcpu = SIZES[size]?.vcpu ?? 0
  const base = COMPONENTS[node.type].cost * 2 * vcpu
  return Math.round(base * eraIndex(game) * partMarket(game, 'cpu'))
}

export const cpuInstallPrice = (game: Game, node: GameNode, size: number): number => {
  if (size <= 0) return cpuPartPrice(game, node, size)
  if (node.parts.cpu && size <= node.size) return cpuPartPrice(game, node, size)
  const start = node.parts.cpu ? node.size + 1 : 1
  let total = 0
  for (let step = start; step <= size; step += 1) total += cpuPartPrice(game, node, step)
  return total
}

export const ramPartPrice = (game: Game, family: FamilyId): number =>
  Math.round(MARKET_RAM_KIT * FAMILIES[family].price * eraIndex(game) * partMarket(game, 'ram'))

export const diskPartPrice = (game: Game, iops: IopsClass): number =>
  Math.round(MARKET_DISK[iops] * eraIndex(game) * partMarket(game, 'disk'))

export const partPrice = (
  game: Game,
  node: GameNode,
  slot: SlotKind,
  part: number | string,
): number => {
  if (slot === 'cpu') return cpuInstallPrice(game, node, Number(part))
  if (slot === 'ram') return ramPartPrice(game, part as FamilyId)
  return diskPartPrice(game, part as IopsClass)
}

export const partsValueOf = (game: Game, node: GameNode): number => {
  if (!partsUnlocked(game)) return 0
  if (node.type !== 'server' && node.type !== 'database') return 0
  return (
    (node.parts.cpu ? partPrice(game, node, 'cpu', node.size) : 0) +
    (node.parts.ram ? partPrice(game, node, 'ram', node.family) : 0) +
    (node.type === 'database' && node.parts.disk ? partPrice(game, node, 'disk', node.iops) : 0)
  )
}
