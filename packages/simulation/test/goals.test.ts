import { describe, expect, test } from 'vitest'
import { preseedGame } from '../src/company.ts'
import { nextAdvice } from '../src/goals.ts'
import { solveFlow } from '../src/solve.ts'
import type { Game } from '../src/state.ts'
import type { RuntimeId } from '../src/catalog.ts'

const serverAt = (users: number, runtime: RuntimeId): Game => {
  const game = preseedGame()
  return {
    ...game,
    users,
    nodes: game.nodes.map((node) =>
      node.type === 'server'
        ? { ...node, runtime }
        : node.type === 'database'
          ? { ...node, size: 6 }
          : node,
    ),
  }
}

const spilledDatabase = (): Game => {
  const game = preseedGame()
  return {
    ...game,
    users: 2_000,
    nodes: game.nodes.map((node) =>
      node.type === 'server'
        ? { ...node, size: 4, workers: 64 }
        : node.type === 'database'
          ? { ...node, size: 1 }
          : node,
    ),
  }
}

describe('Capacity Mail', () => {
  test('stays quiet while the Node is short of its limit', () => {
    const game = serverAt(8_000, 'node')
    const ledger = solveFlow(game)
    expect(ledger.nodes.server?.limit).toBe('cpu')
    expect(ledger.nodes.server?.utilization).toBeGreaterThan(0.55)
    expect(ledger.nodes.server?.utilization).toBeLessThan(0.8)
    expect(nextAdvice(game, ledger).topic).not.toBe('cpu')
  })

  test('names the limit once the Node reaches it', () => {
    const game = serverAt(20_000, 'node')
    const ledger = solveFlow(game)
    expect(ledger.nodes.server?.utilization).toBeGreaterThanOrEqual(1)
    const advice = nextAdvice(game, ledger)
    expect(advice.key).toBe('cloud:cpu:server')
    expect(advice.topic).toBe('cpu')
  })

  test('warns about a Database whose working set left RAM before its CPU fills', () => {
    const game = spilledDatabase()
    const ledger = solveFlow(game)
    const database = ledger.nodes.database!
    expect(database.disk).toBe(true)
    expect(database.utilization).toBeLessThan(1)
    expect(database.limit).toBe('disk')
    const advice = nextAdvice(game, ledger)
    expect(advice.key).toBe('cloud:disk:database')
    expect(advice.topic).toBe('disk')
  })
})
