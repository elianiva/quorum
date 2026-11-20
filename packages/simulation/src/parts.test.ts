import { describe, expect, test } from 'vitest'
import { preseedGame } from './company.ts'
import {
  PART_MARKET_WEEK,
  installedPart,
  marketPercent,
  partMarket,
  partPrice,
  provisioned,
} from './parts.ts'

describe('part market', () => {
  const game = preseedGame()
  const server = game.nodes.find((node) => node.type === 'server')!
  const bare = { ...server, parts: { cpu: false, ram: false, disk: false } }

  test('each slot moves on its own weekly phase', () => {
    const start = {
      cpu: partMarket(game, 'cpu'),
      ram: partMarket(game, 'ram'),
      disk: partMarket(game, 'disk'),
    }
    expect(new Set(Object.values(start).map((value) => value.toFixed(2))).size).toBe(3)
    for (const slot of ['cpu', 'ram', 'disk'] as const) {
      expect(partMarket({ ...game, time: game.time + PART_MARKET_WEEK }, slot)).toBeCloseTo(
        start[slot],
        10,
      )
      expect(Math.abs(partMarket(game, slot) - 1)).toBeLessThanOrEqual(0.15)
    }
  })

  test('a later week changes the CPU price and the percent label', () => {
    const later = { ...game, time: PART_MARKET_WEEK / 4 }
    expect(partPrice(later, server, 'cpu', 2)).not.toBe(partPrice(game, server, 'cpu', 2))
    expect(marketPercent(later, 'cpu')).not.toBe(marketPercent(game, 'cpu'))
  })

  test('an empty Node has no Parts and is not provisioned', () => {
    expect(installedPart(bare, 'cpu')).toBeNull()
    expect(installedPart(bare, 'ram')).toBeNull()
    expect(installedPart(bare, 'disk')).toBeNull()
    expect(provisioned(bare)).toBe(false)
  })
})
