import { Result } from 'effect'
import { describe, expect, test } from 'vitest'
import { connect, place } from '../src/actions.ts'
import { solveFlow } from '../src/solve.ts'
import { freeSandbox } from '../src/sandbox.ts'
import type { Game } from '../src/state.ts'

const ok = (result: Result.Result<Game, unknown>): Game => {
  if (Result.isFailure(result)) throw new Error(JSON.stringify(result.failure))
  return result.success
}

/** Every Node already warm, so a fresh Node's cold start does not move the figures. */
const warm = (game: Game): Game => ({
  ...game,
  nodes: game.nodes.map((node) => ({ ...node, life: { _tag: 'Running' } as const })),
})

describe('CDC and outbox staleness', () => {
  test('dual writes leave a stale share from Series B, and an outbox shrinks it without ending it', () => {
    const base: Game = { ...freeSandbox(), stage: 4, users: 3_000 }
    const placed = ok(place(base, 'search', 900, 400))
    const dual = ok(connect(placed, 'server', placed.nodes.at(-1)!.id))
    const others = dual.researched.filter((id) => id !== 'outbox')
    const without = solveFlow(warm({ ...dual, researched: others })).errors.stale
    const outbox = solveFlow(warm({ ...dual, researched: [...others, 'outbox'] })).errors.stale
    expect(without).toBeGreaterThan(0)
    expect(outbox).toBeGreaterThan(0)
    expect(outbox).toBeLessThan(without)
  })
})

describe('a CDC Connector reaches the copies', () => {
  test('a Stream carries changes to a Search Engine and lowers its stale share', () => {
    let game: Game = { ...freeSandbox(), stage: 4, users: 3_000 }
    const database = game.nodes.find((node) => node.type === 'database')!.id
    let search: string
    let placed = ok(place(game, 'search', 900, 400))
    search = placed.nodes.at(-1)!.id
    game = ok(connect(placed, 'server', search))
    const before = solveFlow(warm(game))
    let cdc: string
    placed = ok(place(game, 'cdc', 900, 600))
    cdc = placed.nodes.at(-1)!.id
    game = ok(connect(placed, database, cdc))
    let stream: string
    placed = ok(place(game, 'log', 900, 800))
    stream = placed.nodes.at(-1)!.id
    game = ok(connect(placed, cdc, stream))
    game = ok(connect(game, stream, search))
    let warehouse: string
    placed = ok(place(game, 'warehouse', 1_200, 800))
    warehouse = placed.nodes.at(-1)!.id
    game = ok(connect(placed, stream, warehouse))
    const after = solveFlow(warm(game))
    const changes = after.nodes[cdc]!.out['change'] ?? 0
    expect(after.nodes[search]!.traffic['change'] ?? 0).toBeCloseTo(changes)
    expect(after.nodes[warehouse]!.traffic['change'] ?? 0).toBeCloseTo(changes)
    expect(after.errors.stale).toBeLessThan(before.errors.stale)
    expect(after.nodes[cdc]!.out['change'] ?? 0).toBeGreaterThan(0)
  })

  test('a Stream that feeds only a Warehouse can drain its change backlog', () => {
    let game: Game = { ...freeSandbox(), stage: 4 }
    const database = game.nodes.find((node) => node.type === 'database')!.id
    let placed = ok(place(game, 'cdc', 900, 600))
    const cdc = placed.nodes.at(-1)!.id
    game = ok(connect(placed, database, cdc))
    placed = ok(place(game, 'log', 900, 800))
    const stream = placed.nodes.at(-1)!.id
    game = ok(connect(placed, cdc, stream))
    const unread = solveFlow(warm(game)).nodes[stream]!
    placed = ok(place(game, 'warehouse', 1_200, 800))
    const warehouse = placed.nodes.at(-1)!.id
    game = ok(connect(placed, stream, warehouse))
    const read = solveFlow(warm(game)).nodes[stream]!
    expect(unread.stranded).toBeGreaterThan(0)
    expect(read.stranded).toBe(0)
    expect(read.age).toBe(0)
  })
})
