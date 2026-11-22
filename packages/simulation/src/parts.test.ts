import { describe, expect, test } from 'vitest'
import { Result } from 'effect'
import { installRam } from './actions.ts'
import { LANGUAGES, RUNTIMES } from './catalog.ts'
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

describe('ARM porting through the memory kit', () => {
  const base = preseedGame()
  const server = base.nodes.find((node) => node.type === 'server')!
  const database = base.nodes.find((node) => node.type === 'database')!
  const port = LANGUAGES[RUNTIMES[server.runtime].language].armPortDh
  const armed = {
    ...base,
    cash: 100_000,
    devHours: 100,
    researched: [...base.researched, 'arm-instances' as const],
  }

  test('installing an ARM kit charges the language port', () => {
    const result = installRam(armed, server.id, 'arm')
    expect(Result.isSuccess(result)).toBe(true)
    if (!Result.isSuccess(result)) return
    expect(result.success.devHours).toBe(100 - port)
    expect(result.success.nodes.find((node) => node.id === server.id)?.family).toBe('arm')
  })

  test('a server without the Dev Hours cannot install the ARM kit', () => {
    const result = installRam({ ...armed, devHours: 0 }, server.id, 'arm')
    expect(Result.isFailure(result)).toBe(true)
    if (!Result.isFailure(result)) return
    expect(JSON.stringify(result.failure)).toContain('Dev Hours')
  })

  test('a node already on ARM does not port again', () => {
    const node = { ...server, family: 'arm' as const, parts: { ...server.parts, ram: false } }
    const game = {
      ...armed,
      nodes: armed.nodes.map((entry) => (entry.id === node.id ? node : entry)),
    }
    const result = installRam(game, node.id, 'arm')
    expect(Result.isSuccess(result)).toBe(true)
    if (!Result.isSuccess(result)) return
    expect(result.success.devHours).toBe(100)
  })

  test('a database ports for free', () => {
    const result = installRam(armed, database.id, 'arm')
    expect(Result.isSuccess(result)).toBe(true)
    if (!Result.isSuccess(result)) return
    expect(result.success.devHours).toBe(100)
  })
})
