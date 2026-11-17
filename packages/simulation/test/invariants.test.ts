import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { raise, setGuidance } from '../src/actions.ts'
import {
  GUIDANCE_WINDOW,
  QUARTER_SECONDS,
  advanceQuarter,
  firstQuarter,
  guidanceOpen,
} from '../src/quarters.ts'
import { nextRandom } from '../src/random.ts'
import { acceptBridge } from '../src/runway.ts'
import { Result } from 'effect'
import { node, preseedGame } from '../src/company.ts'
import { hashGame } from '../src/hash.ts'
import { RESPONSES, applyAction, type ReplayAction } from '../src/replay.ts'
import { CALENDAR_DAY } from '../src/catalog.ts'
import { solveFlow } from '../src/solve.ts'
import { step } from '../src/step.ts'
import type { Game } from '../src/state.ts'

type Move =
  | { kind: 'wait'; seconds: number }
  | { kind: 'shortfall'; days: number }
  | {
      kind: 'act'
      target: number
      action: ReplayAction['_tag']
      direction: 1 | -1
      response: number
    }
  | { kind: 'bridge' }

const move: fc.Arbitrary<Move> = fc.oneof(
  fc.record({ kind: fc.constant('wait' as const), seconds: fc.constantFrom(0.1, 0.1, 1, 60) }),
  fc.record({ kind: fc.constant('shortfall' as const), days: fc.constantFrom(0.5, 1.5, 2.5, 3.5) }),
  fc.record({
    kind: fc.constant('act' as const),
    target: fc.oneof(fc.constantFrom(5, 6, 7), fc.nat(20)),
    action: fc.constantFrom(
      'Restart',
      'Restart',
      'Resize',
      'Resize',
      'Replace',
      'FailOver',
      'Throttle',
      'Respond',
    ),
    direction: fc.constantFrom(1, -1),
    response: fc.nat(RESPONSES.length - 1),
  }),
  fc.record({ kind: fc.constant('bridge' as const) }),
)

const start = (): Game => {
  const base = preseedGame()
  return {
    ...base,
    users: 2_000,
    cash: 1_000_000,
    nodes: [
      ...base.nodes,
      node('doc', 'doc', 900, 100),
      node('wide', 'wide', 900, 300),
      node('log', 'log', 900, 500),
    ],
  }
}

const actionOf = (game: Game, m: Extract<Move, { kind: 'act' }>): ReplayAction => {
  const id = game.nodes[m.target % game.nodes.length]?.id ?? ''
  switch (m.action) {
    case 'Resize':
      return { _tag: 'Resize', node: id, direction: m.direction }
    case 'Respond':
      return { _tag: 'Respond', response: RESPONSES[m.response] ?? RESPONSES[0] }
    default:
      return { _tag: m.action, node: id }
  }
}

const play = (moves: ReadonlyArray<Move>, check: (before: Game, after: Game) => void): Game => {
  let game = start()
  for (const m of moves) {
    const before = game
    if (m.kind === 'wait') game = step(game, m.seconds).game
    else if (m.kind === 'shortfall')
      game = { ...game, cash: -m.days * solveFlow(game).burn * CALENDAR_DAY }
    else if (m.kind === 'act') game = applyAction(game, actionOf(game, m))
    else {
      const accepted = acceptBridge(game)
      if (Result.isSuccess(accepted)) game = accepted.success
    }
    check(before, game)
  }
  return game
}

const BRIDGE_ORDER = { None: 0, Offered: 1, Taken: 2 } as const
const plays = fc.array(move, { minLength: 1, maxLength: 12 })

describe('random plays', () => {
  test('keep every figure finite and the bridge and Nodes consistent', () => {
    fc.assert(
      fc.property(plays, (moves) => {
        play(moves, (before, game) => {
          for (const figure of [game.cash, game.users, game.equity, game.time])
            expect(Number.isFinite(figure)).toBe(true)
          expect(game.equity).toBeGreaterThan(0)
          expect(game.equity).toBeLessThanOrEqual(before.equity)
          expect(BRIDGE_ORDER[game.bridge._tag]).toBeGreaterThanOrEqual(
            BRIDGE_ORDER[before.bridge._tag],
          )
          for (const entry of game.nodes)
            if (entry.service._tag === 'Shut') expect(entry.life._tag).toBe('Stopped')
        })
      }),
      { numRuns: 40 },
    )
  })

  test('run twice end on the same hash', () => {
    fc.assert(
      fc.property(plays, (moves) => {
        expect(hashGame(play(moves, () => {}))).toBe(hashGame(play(moves, () => {})))
      }),
      { numRuns: 20 },
    )
  })

  test('never end a restart early', () => {
    fc.assert(
      fc.property(plays, (moves) => {
        play(moves, (before, game) => {
          if (game.time !== before.time) return
          for (const entry of before.nodes) {
            const now = game.nodes.find((candidate) => candidate.id === entry.id)
            if (entry.life._tag === 'Restarting' && entry.life.left > 0 && now)
              expect(now.life._tag === 'Restarting' || now.service._tag === 'Shut').toBe(true)
          }
        })
      }),
      { numRuns: 1_000 },
    )
  })
})

describe('rules found by the models in verification/', () => {
  test('guidance opens on the first day of every quarter, and only then', () => {
    let game: Game = { ...preseedGame() }
    game = { ...game, quarter: firstQuarter(game, 1) }
    expect(guidanceOpen(game)).toBe(true)
    const set = setGuidance(game, 1, 1)
    if (Result.isFailure(set)) throw new Error('guidance refused')
    game = set.success
    expect(guidanceOpen(game)).toBe(false)
    const later = { ...game, time: game.time + QUARTER_SECONDS }
    const next = { ...later, quarter: advanceQuarter(later, solveFlow(later)) }
    expect(next.quarter?.index).toBe(2)
    expect(guidanceOpen(next)).toBe(true)
    expect(guidanceOpen({ ...next, time: next.time + GUIDANCE_WINDOW })).toBe(false)
  })

  test('a round is answered only while it is on the table', () => {
    const game: Game = { ...preseedGame(), users: 1e9 }
    expect(Result.isFailure(raise(game))).toBe(true)
    const offered = { ...game, round: { _tag: 'Offered' } as const }
    const first = raise(offered)
    if (Result.isFailure(first)) throw new Error('raise refused')
    expect(Result.isFailure(raise(first.success))).toBe(true)
  })
})

describe('the random generator', () => {
  test('is the exact 31-bit LCG, with its full period', () => {
    let seed = 1
    let exact = 1n
    for (let index = 0; index < 100_000; index += 1) {
      seed = nextRandom(seed)[1]
      exact = (exact * 1_103_515_245n + 12_345n) % 2_147_483_648n
      expect(seed).toBe(Number(exact))
    }
  })
})
