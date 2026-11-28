import { Result } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Actions from '../src/actions.ts'
import type { RuntimeId } from '../src/catalog.ts'
import { preseedGame } from '../src/company.ts'
import { migrationCost, stepsOf } from '../src/migration.ts'
import { setLbVariant } from '../src/components/lb.rule.ts'
import { solveFlow } from '../src/solve.ts'
import { step } from '../src/step.ts'
import { Migration, NEW_ENGINEER, type Game } from '../src/state.ts'
import { serviceOf, serviceOfKind } from '../src/team.ts'
import * as Work from '../src/work.ts'

const ok = <Value, Error>(result: Result.Result<Value, Error>): Value => Result.getOrThrow(result)

const fromIdle = (): Game => {
  const game: Game = {
    ...preseedGame(1),
    cash: 1e9,
    autopilot: false,
    cves: [],
    engineers: [{ ...NEW_ENGINEER, id: 'e1', team: 'core', language: 'php', hiredAt: 0 }],
  }
  expect(Migration.guards.Idle(serviceOf(game).migration)).toBe(true)
  return game
}

const drain = (game: Game): Readonly<{ game: Game; seen: ReadonlySet<string> }> => {
  const seen = new Set<string>()
  let next = game
  for (let index = 0; index < 12 && !Migration.guards.Idle(serviceOf(next).migration); index += 1) {
    const migration = serviceOf(next).migration
    seen.add(migration._tag)
    if (Migration.guards.Ready(migration)) next = ok(Work.shiftMigration(next))
    for (const item of next.backlog)
      if ((item.kind === 'migration' || item.ref === 'fix-bugs') && item.block._tag === 'Blocked')
        next = ok(Work.approveBlock(next, item.id))
    const working = next.backlog.find(
      (item) => item.kind === 'migration' || item.ref === 'fix-bugs',
    )
    if (working) next = ok(Work.prioritizeItem(next, working.id))
    next = step(next, 7_200).game
  }
  expect(Migration.guards.Idle(serviceOf(next).migration)).toBe(true)
  return { game: next, seen }
}

const migrate = (
  game: Game,
  nodeId: string,
  runtime: RuntimeId,
): Readonly<{ game: Game; seen: ReadonlySet<string> }> => {
  const started = ok(Work.changeStack(game, nodeId, { runtime }))
  expect(Migration.guards.Building(serviceOf(started).migration)).toBe(true)
  return drain(started)
}

const finish = (game: Game): ReadonlySet<string> => {
  const result = migrate(game, 'server', 'mod_php')
  expect(result.game.nodes.find((node) => node.id === 'server')?.runtime).toBe('mod_php')
  return result.seen
}

const withWorker = (): Readonly<{ game: Game; worker: string; server: string }> => {
  const base = fromIdle()
  let game: Game = {
    ...base,
    researched: [...base.researched, 'queues', 'background-jobs', 'lang-go'],
    services: base.services.map((service) => ({ ...service, codebase: 100 })),
  }
  const queue = ok(Actions.place(game, 'queue', 400, 100))
  const queueId = queue.nodes.at(-1)!.id
  const placed = ok(Actions.place(queue, 'worker', 600, 100))
  const worker = placed.nodes.at(-1)!.id
  game = ok(Actions.connect(placed, queueId, worker))
  return { game, worker, server: 'server' }
}

describe('a Stack migration', () => {
  test('runs from Idle through its four steps and back to Idle, and cancelling one does the same', () => {
    const game = fromIdle()
    const before = game.nodes.find((node) => node.id === 'server')?.runtime
    const started = ok(Work.changeStack(game, 'server', { runtime: 'mod_php' }))
    const cancelled = ok(Work.cancelMigration(started))
    expect(Migration.guards.Idle(serviceOf(cancelled).migration)).toBe(true)
    expect(cancelled.nodes.find((node) => node.id === 'server')?.runtime).toBe(before)
    expect(Result.isFailure(Work.cancelMigration(cancelled))).toBe(true)

    expect([...finish(fromIdle())]).toEqual(
      expect.arrayContaining(['Building', 'Ready', 'Finishing']),
    )
  })

  test('a Worker gets a faster two-step migration that leaves App Servers alone', () => {
    const { game, worker, server } = withWorker()
    const before = game.nodes.find((node) => node.id === worker)?.runtime
    const started = ok(Work.changeStack(game, worker, { runtime: 'go' }))
    const migration = serviceOf(started).migration
    expect(started.nodes.find((node) => node.id === worker)?.runtime).toBe(before)
    expect(Migration.guards.Building(migration)).toBe(true)
    expect(stepsOf(migration)).toHaveLength(2)
    if (Migration.guards.Idle(migration)) throw new Error('No migration.')
    expect(migration.total).toBeLessThan(migrationCost(game, { runtime: 'go', framework: 'none' }))

    const done = drain(started).game
    expect(done.nodes.find((node) => node.id === worker)?.runtime).toBe('go')
    expect(done.nodes.find((node) => node.id === server)?.runtime).toBe(before)
  })
})

describe('Services with their own Stack', () => {
  const carved = () => {
    let game: Game = {
      ...fromIdle(),
      researched: [
        ...preseedGame(1).researched,
        'load-balancing',
        'service-carve-out',
        'lang-go',
        'lang-node',
        'l4-lb',
      ],
    }
    game = ok(Actions.place(game, 'lb', 0, 0))
    const lb = game.nodes.at(-1)!.id
    game = ok(Actions.place(game, 'server', 0, 200))
    const reads = game.nodes.at(-1)!.id
    game = Actions.disconnect(game, 'users', 'server')
    for (const [from, to] of [
      ['users', lb],
      [lb, 'server'],
      [lb, reads],
      [reads, 'database'],
    ] as const)
      game = ok(Actions.connect(game, from, to))
    const empty = game
    game = ok(Work.changeStack(game, reads, { runtime: 'go' }))
    game = ok(Work.splitService(game, { kinds: ['read'], node: reads, name: 'Reads' }))
    const item = game.backlog.find((entry) => entry.kind === 'split')!
    game = step(ok(Work.rushItem({ ...game, devHours: 1e6 }, item.id)), 1).game
    return { game, lb, reads, empty }
  }

  test('a new App Server serves nothing until it runs a Service', () => {
    const { empty, lb, reads } = carved()
    expect(empty.nodes.find((node) => node.id === reads)?.serviceId).toBeNull()
    const flow = solveFlow(ok(setLbVariant(empty, lb, 'l4')))
    expect(flow.nodes[reads]?.inbound ?? 0).toBe(0)
    expect(flow.errors.misrouted).toBe(0)
  })

  test('an L7 balancer routes each kind to its Service, and an L4 one misroutes', () => {
    const { game, lb, reads } = carved()
    expect(serviceOfKind(game, 'read').name).toBe('Reads')
    const l7 = solveFlow(game)
    expect(l7.errors.misrouted).toBe(0)
    expect(l7.nodes[reads]?.inbound).toBeCloseTo(l7.kinds.read?.rate ?? -1, 6)
    const l4 = solveFlow(ok(setLbVariant(game, lb, 'l4')))
    expect(l4.errors.misrouted).toBeGreaterThan(0)
    expect(l4.kinds.read?.success ?? 1).toBeLessThan(0.95)
  })

  test('one carve-out moves every chosen kind into the new Service', () => {
    const { empty, reads } = carved()
    const request = { kinds: ['read', 'write'] as const, node: reads, name: 'Data' }
    let game = ok(Work.splitService(empty, request))
    const items = game.backlog.filter((entry) => entry.kind === 'split')
    expect(new Set(items.map((item) => item.target))).toEqual(new Set(['read', 'write']))
    expect(items).toHaveLength(2)
    expect(items.reduce((sum, item) => sum + item.cost, 0)).toBeCloseTo(
      Work.splitCost(empty, request),
      6,
    )
    game = { ...game, devHours: 1e6 }
    for (const item of items) game = ok(Work.rushItem(game, item.id))
    game = step(game, 1).game
    expect(serviceOfKind(game, 'read').name).toBe('Data')
    expect(serviceOfKind(game, 'write').name).toBe('Data')
  })

  test('a Stack change migrates one Service and costs only its codebase', () => {
    const { game, reads } = carved()
    const reading = serviceOfKind(game, 'read')
    const started = ok(Work.changeStack(game, reads, { runtime: 'node' }))
    const migration = started.services.find((entry) => entry.id === reading.id)!.migration
    if (Migration.guards.Idle(migration)) throw new Error('No migration.')
    expect(Migration.guards.Idle(serviceOf(started).migration)).toBe(true)
    expect(migration.total).toBeLessThan(
      migrationCost(
        game,
        { runtime: 'node', framework: 'none' },
        undefined,
        'design',
        serviceOf(game),
      ),
    )
    let next = started
    for (let index = 0; index < 12; index += 1) {
      const service = next.services.find((entry) => entry.id === reading.id)!
      if (Migration.guards.Idle(service.migration)) break
      if (Migration.guards.Ready(service.migration))
        next = ok(Work.shiftMigration(next, reading.id))
      next = { ...next, devHours: 1e6 }
      for (const item of next.backlog) next = ok(Work.rushItem(next, item.id))
      next = step(next, 60).game
    }
    expect(next.nodes.find((node) => node.id === reads)?.runtime).toBe('node')
    expect(next.nodes.find((node) => node.id === 'server')?.runtime).toBe('php_fpm')
  })
})
