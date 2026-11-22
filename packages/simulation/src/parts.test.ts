import { describe, expect, test } from 'vitest'
import { Result } from 'effect'
import { installCpu, installRam } from './actions.ts'
import { FAMILIES, LANGUAGES, RUNTIMES } from './catalog.ts'
import { preseedGame } from './company.ts'
import { refundOf } from './lookups.ts'
import {
  PART_MARKET_WEEK,
  cpuPartPrice,
  installedPart,
  marketPercent,
  missingParts,
  partMarket,
  partPrice,
  partsUnlocked,
  partsValueOf,
  presetPlan,
  provisioned,
} from './parts.ts'

describe('part market', () => {
  const game = preseedGame()
  const server = game.nodes.find((node) => node.type === 'server')!
  const bare = { ...server, parts: { cpu: false, ram: false, disk: false } }
  const unlocked = {
    ...game,
    researched: [...game.researched, 'custom-instances' as const],
  }

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

  test('a locked Node treats its parts as a bundle', () => {
    expect(installedPart(bare, 'cpu')).toBeNull()
    expect(installedPart(bare, 'ram')).toBeNull()
    expect(installedPart(bare, 'disk')).toBeNull()
    expect(partsUnlocked(game)).toBe(false)
    expect(provisioned(game, bare)).toBe(true)
    expect(missingParts(game, bare)).toEqual([])
    expect(partsValueOf(game, bare)).toBe(0)
  })

  test('an empty Node with Custom instances is not provisioned', () => {
    expect(partsUnlocked(unlocked)).toBe(true)
    expect(provisioned(unlocked, bare)).toBe(false)
    expect(missingParts(unlocked, bare)).toEqual(['cpu', 'ram'])
  })

  test('the family ratios match the real families', () => {
    expect(FAMILIES.burstable.ramPerVcpu).toBe(2)
    expect(FAMILIES.general.ramPerVcpu).toBe(4)
    expect(FAMILIES.compute.ramPerVcpu).toBe(2)
    expect(FAMILIES.memory.ramPerVcpu).toBe(8)
    expect(FAMILIES.arm.ramPerVcpu).toBe(4)
  })

  test('the Parts actions wait for Custom instances', () => {
    expect(Result.isFailure(installCpu(game, server.id, 2))).toBe(true)
    expect(Result.isFailure(installRam(game, server.id, 'general'))).toBe(true)
  })

  test('a CPU upgrade charges every step from the installed size or from micro', () => {
    const target = 4
    const steps = [3, 4].reduce((total, size) => total + cpuPartPrice(game, server, size), 0)
    expect(partPrice(game, server, 'cpu', target)).toBe(steps)
    const first = [1, 2, 3, 4].reduce((total, size) => total + cpuPartPrice(game, bare, size), 0)
    expect(partPrice(game, bare, 'cpu', target)).toBe(first)
  })

  test('installed Parts count toward the sell refund', () => {
    expect(partsValueOf(unlocked, server)).toBeGreaterThan(0)
    expect(refundOf(unlocked, server)).toBeGreaterThan(refundOf(unlocked, bare))
  })

  test('an instance preset buys only the Parts that are missing', () => {
    expect(presetPlan(game, bare, 'general', 2)).toBeNull()
    const first = presetPlan(unlocked, bare, 'general', 2)
    expect(first).not.toBeNull()
    expect(first?.cpu).toBe(true)
    expect(first?.ram).toBe(true)
    expect(first?.disk).toBe(false)
    expect(first?.price).toBe(
      partPrice(unlocked, bare, 'cpu', 2) + partPrice(unlocked, bare, 'ram', 'general'),
    )

    const same = presetPlan(unlocked, server, 'general', server.size)
    expect(same).toEqual({ cpu: false, ram: false, disk: false, price: 0 })

    const family = presetPlan(unlocked, server, 'memory', server.size)
    expect(family?.cpu).toBe(false)
    expect(family?.ram).toBe(true)
    expect(family?.price).toBe(partPrice(unlocked, server, 'ram', 'memory'))

    const larger = presetPlan(unlocked, server, 'general', server.size + 1)
    expect(larger?.cpu).toBe(true)
    expect(larger?.ram).toBe(false)
    expect(larger?.price).toBe(partPrice(unlocked, server, 'cpu', server.size + 1))
  })

  test('an instance preset never hides a CPU downgrade', () => {
    const larger = { ...server, size: server.size + 1 }
    expect(presetPlan(unlocked, larger, 'general', server.size)).toBeNull()
  })

  test('a Database preset adds the general purpose disk when it is missing', () => {
    const database = game.nodes.find((node) => node.type === 'database')!
    const bareDatabase = { ...database, parts: { cpu: false, ram: false, disk: false } }
    const plan = presetPlan(unlocked, bareDatabase, 'general', database.size)
    expect(plan?.disk).toBe(true)
    expect(plan?.price).toBe(
      partPrice(unlocked, bareDatabase, 'cpu', database.size) +
        partPrice(unlocked, bareDatabase, 'ram', 'general') +
        partPrice(unlocked, bareDatabase, 'disk', 'general'),
    )
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
    researched: [...base.researched, 'arm-instances' as const, 'custom-instances' as const],
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
