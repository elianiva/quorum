import { Result } from 'effect'
import { describe, expect, test } from 'vitest'
import { preseedGame } from '../src/company.ts'
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

const finish = (game: Game): ReadonlySet<string> => {
  const seen = new Set<string>()
  let next = ok(Work.changeStack(game, 'server', { runtime: 'mod_php' }))
  expect(Migration.guards.Building(serviceOf(next).migration)).toBe(true)
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
  expect(next.nodes.find((node) => node.id === 'server')?.runtime).toBe('mod_php')
  return seen
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
})
