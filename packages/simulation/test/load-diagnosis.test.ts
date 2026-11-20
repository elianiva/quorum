import { describe, expect, test } from 'vitest'
import { BLOAT_CPU, DB_ENGINES, QUERY_CPU } from '../src/catalog.ts'
import type { Receipt } from '../src/capacity.ts'
import { startIncident } from '../src/director.ts'
import { GUIDED, freeSandbox } from '../src/sandbox.ts'
import { solveFlow } from '../src/solve.ts'
import type { Game } from '../src/state.ts'
import { step } from '../src/step.ts'

const replay = (receipt: Receipt): number =>
  receipt.lines.reduce(
    (cost, line) => (line.op === 'times' ? cost * line.value : cost + line.value),
    receipt.base,
  )

const bloated = (game: Game): Game => {
  const started = startIncident(game, solveFlow(game), 'table-bloat', 0)
  if (!started) throw new Error('no Table bloat target')
  return started.game
}

describe('Cost receipt', () => {
  test('every receipt reaches its own total, on App Servers and Databases', () => {
    const game = bloated(freeSandbox())
    const ledger = solveFlow(game)
    const receipts = Object.values(ledger.nodes).flatMap((node) => Object.values(node.receipts))
    expect(receipts.length).toBeGreaterThan(4)
    for (const receipt of receipts) expect(replay(receipt!) / receipt!.total).toBeCloseTo(1, 9)
  })

  test('Table bloat shows as a line and raises the cost by its factor', () => {
    const calm = solveFlow(freeSandbox())
    const game = bloated(freeSandbox())
    const ledger = solveFlow(game)
    const read = ledger.nodes.database!.receipts['q-read']!
    expect(read.lines).toContainEqual({ cause: 'bloat', op: 'times', value: BLOAT_CPU })
    expect(calm.nodes.database!.receipts['q-read']!.lines.map((line) => line.cause)).not.toContain(
      'bloat',
    )
    expect(read.total / calm.nodes.database!.receipts['q-read']!.total).toBeCloseTo(BLOAT_CPU, 6)
    expect(ledger.nodes.database!.cost / calm.nodes.database!.cost).toBeCloseTo(BLOAT_CPU, 6)
  })
})

describe('Work share', () => {
  test('a write takes more of the CPU than its share of the queries', () => {
    const game = freeSandbox()
    const node = game.nodes.find((entry) => entry.type === 'database')!
    const engine = DB_ENGINES[node.dbEngine]
    const database = solveFlow(game).nodes.database!
    const reads = database.traffic['q-read']!
    const writes = database.traffic['q-write']!
    const readWork = reads * QUERY_CPU['q-read'] * 0.7 * engine.read
    const writeWork = writes * QUERY_CPU['q-write'] * 1.2 * engine.write
    expect(database.workShare['q-write']).toBeCloseTo(writeWork / (readWork + writeWork), 6)
    expect(database.workShare['q-write']!).toBeGreaterThan(writes / database.inbound)
  })
})

describe('Amplification', () => {
  test("a Node's inbound traces back to the Users' Request kinds", () => {
    const ledger = solveFlow(freeSandbox())
    const database = ledger.nodes.database!
    const traced = Object.values(database.origins).reduce((sum, rate) => sum + (rate ?? 0), 0)
    expect(traced).toBeCloseTo(database.inbound, 6)
    expect(database.origins.write).toBeGreaterThan(0)
  })

  test('retries on a failing Link count as repeated calls at the callee', () => {
    const sandbox = freeSandbox()
    const base: Game = {
      ...sandbox,
      users: sandbox.users * 40,
      nodes: sandbox.nodes.map((node) =>
        node.id === 'server' ? { ...node, size: 5, runtime: 'go' } : node,
      ),
    }
    const game: Game = {
      ...base,
      links: base.links.map((link) =>
        link.to === 'database' ? { ...link, retries: 'naive' } : link,
      ),
    }
    expect(solveFlow(base).nodes.database!.repeated).toBe(0)
    const ledger = solveFlow(game)
    const database = ledger.nodes.database!
    const failure = ledger.links.find((link) => link.to === 'database')!.failure
    expect(failure).toBeGreaterThan(0.5)
    const attempts = 1 + failure + failure ** 2 + failure ** 3
    expect(database.repeated / database.inbound).toBeCloseTo(1 - 1 / attempts, 1)
  })
})

describe('Timeout budget', () => {
  test('a Link reports only the calls that exceed its own timeout', () => {
    const start = GUIDED['retry-storm'].start()
    const calm = solveFlow(start)
    expect(calm.links.every((link) => link.timeout < 1e-4)).toBe(true)

    const incident = startIncident(start, calm, 'retry-storm', start.time)
    if (incident === null) throw new Error('no Retry storm target')
    let game = incident.game
    for (let index = 0; index < 4; index += 1) game = step(game, 5).game
    const ledger = solveFlow(game)

    const database = ledger.links.find((link) => link.from === 'server1' && link.to === 'database')!
    expect(database.timeout).toBeGreaterThan(0.1)
    expect(database.mean).toBeGreaterThan(1_000)
    expect(database.p99).toBeGreaterThan(1_000)

    const upstream = ledger.links.find((link) => link.from === 'lb' && link.to === 'server1')!
    expect(upstream.timeout).toBeLessThan(1e-4)
  })
})
