import { expect, test } from 'vitest'
import { newGame } from '@quorum/simulation/company'
import { eventsOf } from './analytics-bridge.ts'
import type { LogEntry } from './playlog.ts'

const entry = (type: string, data: Record<string, unknown>): LogEntry => ({
  t: 1,
  type,
  data: JSON.stringify(data),
})

const events = (lines: ReadonlyArray<LogEntry>) =>
  eventsOf(lines, { game: newGame(), seenComponents: new Set() })

const named = (lines: ReadonlyArray<LogEntry>, event: string) =>
  events(lines).filter((line) => line.event === event)

test('Collecting the drawer becomes a first-step event with the Cash it moved', () => {
  const found = named(
    [entry('Collected', { diff: { cash: 42 }, context: { stage: 0 } })],
    'game:collected',
  )
  expect(found).toEqual([{ event: 'game:collected', properties: { amount: 42, era: 0 } }])
})

test('a size change becomes an upgrade event, and a refused one makes nothing', () => {
  const found = named(
    [
      entry('ResizeChosen', {
        nodeId: 'server',
        direction: 1,
        diff: {
          cash: -120,
          changed: [{ id: 'server', type: 'server', field: 'size', from: 1, to: 2 }],
        },
        context: { stage: 0 },
      }),
      entry('ResizeChosen', { nodeId: 'server', direction: 1 }),
    ],
    'board:node_resized',
  )
  expect(found).toHaveLength(1)
  expect(found[0]?.properties).toMatchObject({
    component_id: 'server',
    from_size: 1,
    to_size: 2,
    era: 0,
  })
})

test('Shop, parts, hiring, and Mail opening each have their own event', () => {
  const lines = [
    entry('ShopOpened', { nodeId: 'server', slot: 'cpu', mode: 'instance' }),
    entry('InstallCpu', { nodeId: 'server', size: 2 }),
    entry('InstallRam', { nodeId: 'server', family: 'general' }),
    entry('InstallDisk', { nodeId: 'database', iops: 'general' }),
    entry('TeamChanged', { message: { _tag: 'HireChosen' } }),
    entry('PanelOpened', { panel: 'inbox' }),
    entry('InboxChanged', { message: { _tag: 'Opened', id: 4 } }),
  ]
  expect(named(lines, 'shop:opened')).toHaveLength(1)
  expect(named(lines, 'shop:part_bought').map((line) => line.properties['slot'])).toEqual([
    'cpu',
    'ram',
    'disk',
  ])
  expect(named(lines, 'team:hired')).toHaveLength(1)
  expect(named(lines, 'inbox:opened')).toHaveLength(1)
  expect(named(lines, 'mail:opened')).toHaveLength(1)
})

test('the play log lines that were silent now cross into analytics', () => {
  const lines = [
    entry('SandboxStarted', { sandbox: 'free' }),
    entry('ChallengeStarted', { challenge: 'hello-world' }),
    entry('AchievementEarned', { id: 'first-exit' }),
    entry('ObjectivePassed', { sandbox: 'garage', objective: 2 }),
    entry('SessionResumed', { context: { stage: 1 } }),
  ]
  expect(named(lines, 'sandbox:started')[0]?.properties).toMatchObject({
    sandbox: 'free',
    free: true,
  })
  expect(named(lines, 'challenge:started')[0]?.properties).toEqual({ challenge: 'hello-world' })
  expect(named(lines, 'achievement:earned')[0]?.properties).toEqual({
    achievement_id: 'first-exit',
  })
  expect(named(lines, 'sandbox:objective_passed')[0]?.properties).toEqual({
    sandbox: 'garage',
    objective: 2,
  })
  expect(named(lines, 'session:resumed')[0]?.properties).toEqual({ era: 1 })
})
