import { Result } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Actions from '../src/actions.ts'
import type { RuntimeId } from '../src/catalog.ts'
import { preseedGame } from '../src/company.ts'
import { migrationCost, stepsOf } from '../src/migration.ts'
import { step } from '../src/step.ts'
import { Migration, NEW_ENGINEER, type Game } from '../src/state.ts'
import { serviceOf } from '../src/team.ts'
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
