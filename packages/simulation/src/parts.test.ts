import { describe, expect, test } from 'vitest'
import { preseedGame } from './company.ts'
import { refundOf } from './lookups.ts'
import {
  PART_MARKET_WEEK,
  cpuPartPrice,
  installedPart,
  marketPercent,
  partMarket,
  partPrice,
  partsValueOf,
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

  test('a CPU upgrade charges every step from the installed size or from micro', () => {
    const target = 4
    const steps = [3, 4].reduce((total, size) => total + cpuPartPrice(game, server, size), 0)
    expect(partPrice(game, server, 'cpu', target)).toBe(steps)
    const first = [1, 2, 3, 4].reduce((total, size) => total + cpuPartPrice(game, bare, size), 0)
    expect(partPrice(game, bare, 'cpu', target)).toBe(first)
  })

  test('installed Parts count toward the sell refund', () => {
    expect(partsValueOf(game, server)).toBeGreaterThan(0)
    expect(refundOf(game, server)).toBeGreaterThan(refundOf(game, bare))
  })
})
