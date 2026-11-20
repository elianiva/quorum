import { Result } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Actions from '../src/actions.ts'
import { preseedGame } from '../src/company.ts'
import { autoscalerViewOf, scaleStateOf } from '../src/scaling.ts'
import { solveFlow } from '../src/solve.ts'
import { step } from '../src/step.ts'
import type { Game } from '../src/state.ts'

const ok = (action: Actions.Action): Game => {
  if (Result.isFailure(action)) throw new Error(JSON.stringify(action.failure))
  return action.success
}

const lastId = (game: Game): string => game.nodes.at(-1)?.id ?? ''

const harness = (
  workers = 1,
): Readonly<{ game: Game; queue: string; workerIds: ReadonlyArray<string>; scaler: string }> => {
  let game: Game = {
    ...preseedGame(),
    researched: [...preseedGame().researched, 'queues', 'background-jobs', 'autoscaling'],
    cash: 100_000,
  }
  const placedQueue = ok(Actions.place(game, 'queue', 400, 100))
  const queue = lastId(placedQueue)
  game = ok(Actions.connect(placedQueue, 'server', queue))
  const workerIds: string[] = []
  for (let index = 0; index < workers; index += 1) {
    const placed = ok(Actions.place(game, 'worker', 600, 100 + index * 40))
    const worker = lastId(placed)
    workerIds.push(worker)
    game = ok(Actions.connect(ok(Actions.connect(placed, queue, worker)), worker, 'database'))
  }
  const placedScaler = ok(Actions.place(game, 'autoscaler', 800, 100))
  const scaler = lastId(placedScaler)
  game = workerIds.reduce(
    (current, worker) => ok(Actions.connect(current, worker, scaler)),
    placedScaler,
  )
  game = ok(
    Actions.setAutoscaler(game, scaler, {
      signal: 'queue',
      target: 0.6,
      minCopies: 4,
      maxCopies: 8,
    }),
  )
  return { game, queue, workerIds, scaler }
}

const withDepth = (game: Game, queue: string, depth: number): Game => ({
  ...game,
  nodes: game.nodes.map((node) => (node.id === queue ? { ...node, depth } : node)),
})

const scalerOf = (game: Game, id: string): Game['nodes'][number] => {
  const node = game.nodes.find((entry) => entry.id === id)
  if (node === undefined) throw new Error(`No Node ${id}.`)
  return node
}

describe('the scaling view', () => {
  test('reports the reading, the next copy count and the cooldown the engine will use', () => {
    const { game, queue, workerIds, scaler } = harness()
    const worker = scalerOf(game, workerIds[0]!)
    const busy = withDepth(game, queue, 400)
    const state = scaleStateOf(
      busy,
      solveFlow(busy),
      scalerOf(busy, worker.id),
      scalerOf(busy, scaler),
    )

    expect(state.reading).toBe(4)
    expect(state.phase).toBe('up')
    expect(state.wanted).toBe(7)
    expect(state.cooldown).toBe(0)

    const after = step(busy, 1).game
    const booting = scalerOf(after, worker.id)
    expect(booting.scaler._tag).toBe('Scaling')
    if (booting.scaler._tag !== 'Scaling') return
    expect(booting.scaler.pending).toBe(6)
    const stateBooting = scaleStateOf(after, solveFlow(after), booting, scalerOf(after, scaler))
    expect(stateBooting.phase).toBe('booting')
    expect(stateBooting.booting).toBe(6)
    expect(stateBooting.wanted).toBe(7)
    expect(stateBooting.readyIn).toBe(180)
  })

  test('a Worker with no Queue feeds reads zero on queue depth', () => {
    const { game, queue, workerIds, scaler } = harness()
    const placed = ok(Actions.place(game, 'worker', 900, 300))
    const lonely = lastId(placed)
    const linked = ok(Actions.connect(placed, lonely, scaler))
    const busy = withDepth(linked, queue, 900)
    const state = scaleStateOf(
      busy,
      solveFlow(busy),
      scalerOf(busy, lonely),
      scalerOf(busy, scaler),
    )
    expect(workerIds).toHaveLength(1)
    expect(state.signal).toBe('queue')
    expect(state.feeds).toBe(0)
    expect(state.reading).toBe(0)
    expect(state.phase).toBe('up')
    expect(state.wanted).toBe(4)
  })

  test('the floor and ceiling multiply by the linked Nodes', () => {
    const { game, scaler } = harness(2)
    const view = autoscalerViewOf(game, solveFlow(game), scalerOf(game, scaler))
    expect(view.members).toHaveLength(2)
    expect(view.floor).toBe(8)
    expect(view.ceiling).toBe(16)
  })

  test('a max caps the demand and the view says it is at max', () => {
    const { game, queue, workerIds, scaler } = harness()
    const capped = ok(Actions.setAutoscaler(game, scaler, { maxCopies: 4, minCopies: 4 }))
    const busy = withDepth(capped, queue, 900)
    const scaled = {
      ...busy,
      nodes: busy.nodes.map((node) => (node.id === workerIds[0] ? { ...node, replicas: 4 } : node)),
    }
    const state = scaleStateOf(
      scaled,
      solveFlow(scaled),
      scalerOf(scaled, workerIds[0]!),
      scalerOf(scaled, scaler),
    )
    expect(state.atLimit).toBe('max')
    expect(state.wanted).toBe(4)
    expect(state.phase).toBe('steady')
  })

  test('a runaway bill drives every scaled Node to its max', () => {
    const { game, workerIds, scaler } = harness()
    const capped = ok(Actions.setAutoscaler(game, scaler, { minCopies: 1, maxCopies: 8 }))
    const burning: Game = {
      ...capped,
      incident: {
        kind: 'runaway-bill',
        remaining: 60,
        nodeId: null,
        startedAt: capped.time,
        baseline: 0,
        usersAtStart: capped.users,
        impaired: 0,
        lostRevenue: 0,
        failed: 0,
        phase: { _tag: 'Quiet' },
        severity: 3,
        magnitude: 3,
        zone: null,
        region: null,
        causedBy: null,
      },
      nodes: capped.nodes.map((node) =>
        node.id === workerIds[0] ? { ...node, replicas: 2 } : node,
      ),
    }
    const state = scaleStateOf(
      burning,
      solveFlow(burning),
      scalerOf(burning, workerIds[0]!),
      scalerOf(burning, scaler),
    )
    expect(state.phase).toBe('up')
    expect(state.wanted).toBe(8)
  })

  test('a quiet Node removes one copy after the cooldown', () => {
    const { game, queue, workerIds, scaler } = harness()
    const low = ok(Actions.setAutoscaler(game, scaler, { minCopies: 1 }))
    const four = {
      ...withDepth(low, queue, 0),
      nodes: low.nodes.map((node) =>
        node.id === workerIds[0] ? { ...node, replicas: 4, scaledAt: 0 } : node,
      ),
    }
    const state = scaleStateOf(
      four,
      solveFlow(four),
      scalerOf(four, workerIds[0]!),
      scalerOf(four, scaler),
    )
    expect(state.phase).toBe('down')
    expect(state.wanted).toBe(3)
    expect(state.cooldown).toBe(0)
  })
})
