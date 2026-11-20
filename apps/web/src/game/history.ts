import { Option, Schema } from 'effect'
import { CALENDAR_START } from '@quorum/simulation/catalog'
import type { Sample } from '@quorum/simulation/state'

export const FIELDS = [
  'users',
  'demand',
  'served',
  'latency',
  'p99',
  'apdex',
  'errors',
  'revenue',
  'burn',
  'cash',
] as const satisfies ReadonlyArray<keyof Sample>
export type Field = (typeof FIELDS)[number]

const Figures = Schema.Record(Schema.String, Schema.Finite)

const Block = Schema.Struct({
  index: Schema.Finite,
  count: Schema.Finite,
  min: Figures,
  max: Figures,
  sum: Figures,
})
export type Block = typeof Block.Type

export const History = Schema.Struct({
  quarter: Schema.Array(Block),
  hour: Schema.Array(Block),
})
export type History = typeof History.Type

export const EMPTY_HISTORY: History = { quarter: [], hour: [] }

export const TIERS = {
  quarter: { minutes: 15, keep: 672 },
  hour: { minutes: 60, keep: 720 },
} as const
export type Tier = keyof typeof TIERS

const indexOf = (time: number, minutes: number): number =>
  Math.floor((CALENDAR_START + time) / minutes)

export const startOf = (index: number, tier: Tier): number =>
  index * TIERS[tier].minutes - CALENDAR_START

export const blockIndexAt = (time: number, tier: Tier): number => indexOf(time, TIERS[tier].minutes)

const add = (blocks: ReadonlyArray<Block>, index: number, sample: Sample): ReadonlyArray<Block> => {
  const last = blocks[blocks.length - 1]
  if (last && last.index === index) {
    const min: Record<string, number> = { ...last.min }
    const max: Record<string, number> = { ...last.max }
    const sum: Record<string, number> = { ...last.sum }
    for (const field of FIELDS) {
      min[field] = Math.min(min[field] ?? sample[field], sample[field])
      max[field] = Math.max(max[field] ?? sample[field], sample[field])
      sum[field] = (sum[field] ?? 0) + sample[field]
    }
    return [...blocks.slice(0, -1), { index, count: last.count + 1, min, max, sum }]
  }
  const figures: Record<string, number> = {}
  for (const field of FIELDS) figures[field] = sample[field]
  return [...blocks, { index, count: 1, min: figures, max: figures, sum: figures }]
}

export const record = (history: History, samples: ReadonlyArray<Sample>, last: number): History => {
  if (samples.length === 0) return history
  const fold = (tier: Tier): ReadonlyArray<Block> => {
    const { minutes, keep } = TIERS[tier]
    const now = indexOf(last, minutes)
    let blocks: ReadonlyArray<Block> = history[tier].filter((block) => block.index <= now)
    samples.forEach((sample, offset) => {
      blocks = add(blocks, indexOf(last - (samples.length - 1 - offset), minutes), sample)
    })
    return blocks.length > keep ? blocks.slice(-keep) : blocks
  }
  return { quarter: fold('quarter'), hour: fold('hour') }
}

export const newSamples = (
  history: ReadonlyArray<Sample>,
  before: number,
  after: number,
): ReadonlyArray<Sample> => {
  const crossed = Math.floor(after) - Math.floor(before)
  return crossed > 0 ? history.slice(-Math.min(crossed, history.length)) : []
}

const decodeHistory = Schema.decodeUnknownOption(History)

export const historyOfSave = (saved: unknown): History =>
  typeof saved === 'object' && saved !== null && 'dashboard' in saved
    ? Option.getOrElse(decodeHistory(saved.dashboard), () => EMPTY_HISTORY)
    : EMPTY_HISTORY
