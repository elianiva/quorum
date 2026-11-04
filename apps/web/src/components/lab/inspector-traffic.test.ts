import { test } from 'vitest'
import { Scene } from 'foldkit/test'
import type { HtmlBuilder } from 'foldkit/html'
import { preseedGame } from '@quorum/simulation/company'
import type { Game } from '@quorum/simulation/state'
import { solveFlow } from '@quorum/simulation/solve'
import { initialModel, update } from '@/game/update.ts'
import { ledgerOf, type Model } from '@/game/model.ts'
import { Message } from '@/game/message.ts'
import { sampleNode, type NodeSample } from '@/game/node-metrics.ts'
import { inspectorTraffic } from './inspector-traffic.ts'

const fixture = (evidence: Partial<NodeSample> = {}): Model => {
  const start = initialModel()
  const game: Game = {
    ...preseedGame(),
    time: 30,
    researched: [...preseedGame().researched, 'metrics'],
  }
  const node = game.nodes.find((entry) => entry.id === 'database')!
  const base = sampleNode(game, node, solveFlow(game))
  const before: NodeSample = {
    ...base,
    time: 10,
    inbound: 20,
    utilization: 0.08,
    traffic: { 'q-read': 10, 'q-write': 10 },
    sources: [{ id: 'server', name: 'App Server', rate: 20 }],
  }
  const spike: NodeSample = {
    ...base,
    time: 20,
    inbound: 100,
    capacity: 250,
    utilization: 0.4,
    traffic: { 'q-read': 90, 'q-write': 10 },
    sources: [{ id: 'retired-server', name: 'App Server', rate: 100 }],
    disk: false,
    swapping: false,
    throttled: false,
    refused: 0,
    limit: 'cpu',
    ...evidence,
  }
  return {
    ...start,
    board: {
      ...start.board,
      game,
      selected: 'database',
      nodeHistory: { database: [before, spike] },
    },
  }
}

const view = (model: Model, h: HtmlBuilder<Message>) =>
  inspectorTraffic(
    model,
    model.board.game.nodes.find((node) => node.id === 'database')!,
    ledgerOf(model),
    h,
  )

test('selecting a spike shows its operation rates, deltas, and former source instead of live traffic', () => {
  Scene.scene(
    { update, view },
    Scene.given(fixture()),
    Scene.expect(Scene.text('Live traffic')).toExist(),
    Scene.type(Scene.label('Inspect recorded sample'), '1'),
    Scene.expect(Scene.text('Recorded sample')).toExist(),
    Scene.expect(Scene.selector('[data-traffic-breakdown]')).toContainText('90.0/s · 90%'),
    Scene.expect(Scene.selector('[data-traffic-breakdown]')).toContainText('+80.0/s'),
    Scene.expect(Scene.selector('[data-traffic-breakdown]')).toContainText('10.0/s · 10%'),
    Scene.expect(Scene.text('App Server · retired-server')).toExist(),
    Scene.expect(Scene.selector('[data-traffic-hint]')).toBeAbsent(),
    Scene.click(Scene.role('button', { name: 'Back to live' })),
    Scene.expect(Scene.text('Live traffic')).toExist(),
    Scene.expect(Scene.text('App Server · retired-server')).toBeAbsent(),
  )
})

test('historical disk pressure recommends read mitigation even when the live component is healthy', () => {
  Scene.scene(
    { update, view },
    Scene.given(fixture({ disk: true, limit: 'disk' })),
    Scene.type(Scene.label('Inspect recorded sample'), '1'),
    Scene.expect(Scene.selector('[data-traffic-hint]')).toContainText('reads hit disk'),
    Scene.click(Scene.role('button', { name: 'Back to live' })),
    Scene.expect(Scene.selector('[data-traffic-hint]')).toBeAbsent(),
  )
})

test('the earliest recorded sample has no invented comparison and quiet traffic does not get upgrade advice', () => {
  Scene.scene(
    { update, view },
    Scene.given(fixture()),
    Scene.type(Scene.label('Inspect recorded sample'), '0'),
    Scene.expect(Scene.text('Recorded sample')).toExist(),
    Scene.expect(Scene.selector('[data-traffic-breakdown]')).toContainText('10.0/s · 50%'),
    Scene.expect(Scene.selector('[data-traffic-breakdown]')).not.toContainText('Changes vs'),
    Scene.expect(Scene.selector('[data-traffic-hint]')).toBeAbsent(),
  )
})
