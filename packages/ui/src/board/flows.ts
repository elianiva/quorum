import type { Game, GameNode } from '@quorum/simulation/state'
import { placeMs } from '@quorum/simulation/regions'
import { ms, rate as rateText } from '../game/format.ts'

const ARROW_SPACING = 70
const ARROW_LIMIT = 4

export type FlowMarks = Readonly<{
  packets: number
  arrows: ReadonlyArray<number>
  label: string | null
}>

const packetCount = (rate: number, length: number): number =>
  Math.max(1, Math.min(9, Math.round(Math.log2(1 + rate) * 1.4), Math.floor(length / 20) || 1))

const arrowOffsets = (length: number): ReadonlyArray<number> => {
  const count = Math.max(1, Math.min(ARROW_LIMIT, Math.floor(length / ARROW_SPACING)))
  return Array.from({ length: count }, (_, index) => (index + 1) / (count + 1))
}

export const flowLabel = (rate: number): string => `${rateText(rate)}/s`

export const placeLabel = (game: Game, from: GameNode, to: GameNode): string | null => {
  if (from.region === to.region) return null
  const cost = placeMs(game, from, to)
  return cost > 0 ? ms(cost) : null
}

export const flowMarks = (still: boolean, rate: number, length: number): FlowMarks =>
  still
    ? { packets: 0, arrows: arrowOffsets(length), label: flowLabel(rate) }
    : { packets: packetCount(rate, length), arrows: [], label: null }
