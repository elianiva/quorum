import { Arbitrary, Effect, Result, Schema } from 'effect'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import * as Actions from '../src/actions.ts'
import {
  COMPONENT_IDS,
  COMPONENTS,
  FEATURE_IDS,
  IAC_TOOLS,
  INSIGHT_POOLS,
  RESEARCH,
  RESEARCH_IDS,
  SYNC_MODES,
} from '../src/catalog.ts'
import * as Mirrors from '../src/mirror.ts'
import * as Work from '../src/work.ts'
import * as Hire from '../src/hire-machine.ts'
import * as Study from '../src/study-machine.ts'
import * as WorkItem from '../src/work-item-machine.ts'
import * as Mirror from '../src/mirror-machine.ts'
import * as DataMove from '../src/data-move-machine.ts'
import { preseedGame } from '../src/company.ts'
import * as Autoscaler from '../src/autoscaler-machine.ts'
import * as Breaker from '../src/breaker-machine.ts'
import * as Bridge from '../src/bridge-machine.ts'
import * as Drill from '../src/drill-machine.ts'
import * as EraRound from '../src/era-round-machine.ts'
import * as Incident from '../src/incident-machine.ts'
import * as NodeService from '../src/node-service-machine.ts'
import * as Quarter from '../src/quarter-machine.ts'
import { applyAction, RESPONSES, type ReplayAction } from '../src/replay.ts'
import { setGuidance } from '../src/actions.ts'
import { solveFlow } from '../src/solve.ts'
import { Game } from '../src/state.ts'
import { step } from '../src/step.ts'

/*
 * Every Component, in every combination: random Designs of all Components, answered and stepped.
 * After each move the Game must still be a valid Game, every figure finite, and every machine
 * must have moved along an edge it declares (verification/README.md).
 */

const valid = Schema.is(Game)

/** The states a machine may move to from `from`, found by sending it a few hundred random events. */
const edges = <S extends { _tag: string }, E>(
  states: Schema.Constraint,
  events: Schema.Constraint,
  stepFn: (state: S, event: E) => S,
) => {
  const sample = <T>(schema: Schema.Constraint) =>
    Effect.runSync(
      Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: 400, seed: 1 }),
    ) as Array<T>
  const all = sample<S>(states)
  const sent = sample<E>(events)
  const table = new Set<string>()
  for (const from of all)
    for (const event of sent) table.add(`${from._tag}>${stepFn(from, event)._tag}`)
  return (before: S, after: S): boolean =>
    before._tag === after._tag || table.has(`${before._tag}>${after._tag}`)
}

const bridgeOk = edges(Bridge.BridgeState, Bridge.BridgeEvent, Bridge.step)
const roundOk = edges(EraRound.EraRound, EraRound.EraRoundEvent, EraRound.step)
const drillOk = edges(Drill.DrillPhase, Drill.DrillEvent, Drill.step)
const quarterOk = edges(Quarter.QuarterPhase, Quarter.QuarterEvent, Quarter.step)
const serviceOk = edges(NodeService.NodeService, NodeService.NodeServiceEvent, NodeService.step)
const scalerOk = edges(Autoscaler.Autoscaler, Autoscaler.AutoscalerEvent, Autoscaler.step)
const fuseOk = edges(Breaker.Breaker, Breaker.BreakerEvent, Breaker.step)
const hireOk = edges(Hire.HirePhase, Hire.HireEvent, Hire.step)
const studyOk = edges(Study.StudyPhase, Study.StudyEvent, Study.step)
const blockOk = edges(WorkItem.WorkBlock, WorkItem.WorkBlockEvent, WorkItem.step)
const mirrorOk = edges(Mirror.MirrorSync, Mirror.MirrorEvent, Mirror.step)
const moveOk = edges(DataMove.DataMovePhase, DataMove.DataMoveEvent, DataMove.step)
const incidentOk = edges(Incident.IncidentPhase, Incident.IncidentEvent, Incident.step)

type Move =
  | { kind: 'place'; type: number; x: number; region: number }
  | { kind: 'link'; from: number; to: number }
  | { kind: 'unlink'; from: number; to: number }
  | { kind: 'sell'; node: number }
  | { kind: 'drain'; node: number }
  | { kind: 'act'; node: number; action: ReplayAction['_tag']; direction: 1 | -1; response: number }
  | { kind: 'wait'; seconds: number }
  | { kind: 'shortfall'; days: number }
  | { kind: 'round'; raise: boolean }
  | { kind: 'guidance'; level: number }
  | { kind: 'drill' }
  | { kind: 'chaos'; on: boolean }

const move: fc.Arbitrary<Move> = fc.oneof(
  {
    weight: 5,
    arbitrary: fc.record({
      kind: fc.constant('place' as const),
      type: fc.nat(COMPONENT_IDS.length - 1),
      x: fc.nat(900),
      region: fc.nat(3),
    }),
  },
  {
    weight: 6,
    arbitrary: fc.record({ kind: fc.constant('link' as const), from: fc.nat(60), to: fc.nat(60) }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('unlink' as const),
      from: fc.nat(60),
      to: fc.nat(60),
    }),
  },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('sell' as const), node: fc.nat(60) }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('drain' as const), node: fc.nat(60) }) },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('act' as const),
      node: fc.nat(60),
      action: fc.constantFrom('Restart', 'Replace', 'FailOver', 'Throttle', 'Resize', 'Respond'),
      direction: fc.constantFrom(1, -1),
      response: fc.nat(RESPONSES.length - 1),
    }),
  },
  {
    weight: 8,
    arbitrary: fc.record({
      kind: fc.constant('wait' as const),
      seconds: fc.constantFrom(0.1, 0.1, 1, 60, 600),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('shortfall' as const),
      days: fc.constantFrom(0.5, 1.5, 2.5, 3.5),
    }),
  },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('round' as const), raise: fc.boolean() }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('guidance' as const), level: fc.nat(2) }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('drill' as const) }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('chaos' as const), on: fc.boolean() }) },
)

/** A Company with every Research done, every region open, Cash to spare and a few Users. */
const start = (): Game => {
  let game: Game = { ...preseedGame(), users: 3_000, cash: 1e9, researched: [...RESEARCH_IDS] }
  for (const region of ['eu', 'apac', 'sa'] as const) {
    const opened = Actions.openRegion(game, region)
    if (Result.isSuccess(opened)) game = opened.success
  }
  return game
}

const take = (game: Game, result: Actions.Action): Game =>
  Result.isSuccess(result) ? result.success : game

const apply = (game: Game, m: Move): Game => {
  const nodes = game.nodes
  const id = (n: number) => nodes[n % nodes.length]?.id ?? ''
  switch (m.kind) {
    case 'place': {
      const type = COMPONENT_IDS[m.type]!
      return take(
        game,
        Actions.place(
          game,
          type,
          100 + m.x,
          100 + (nodes.length % 9) * 60,
          (['na', 'eu', 'apac', 'sa'] as const)[m.region],
        ),
      )
    }
    case 'link':
      return take(game, Actions.connect(game, id(m.from), id(m.to)))
    case 'unlink':
      return Actions.disconnect(game, id(m.from), id(m.to))
    case 'sell':
      return take(game, Actions.sell(game, id(m.node)))
    case 'drain':
      return take(game, Actions.drain(game, id(m.node)))
    case 'act': {
      const target = id(m.node)
      const action: ReplayAction =
        m.action === 'Resize'
          ? { _tag: 'Resize', node: target, direction: m.direction }
          : m.action === 'Respond'
            ? { _tag: 'Respond', response: RESPONSES[m.response]! }
            : { _tag: m.action, node: target }
      return applyAction(game, action)
    }
    case 'wait':
      return step(game, m.seconds).game
    case 'shortfall':
      return { ...game, cash: -m.days * solveFlow(game).burn * 1_440 }
    case 'round':
      return take(game, m.raise ? Actions.raise(game) : Actions.decline(game))
    case 'guidance':
      return take(game, setGuidance(game, m.level, m.level))
    case 'drill':
      return take(game, Actions.runDrill(game))
    case 'chaos':
      return take(game, Actions.setChaos(game, m.on))
  }
}

const check = (before: Game, after: Game, m: Move) => {
  const at = `after ${JSON.stringify(m)}`
  expect(valid(after), `a valid Game ${at}`).toBe(true)
  for (const figure of [after.cash, after.users, after.equity, after.time, after.data])
    expect(Number.isFinite(figure), `finite figures ${at}`).toBe(true)
  expect(bridgeOk(before.bridge, after.bridge), `bridge edge ${at}`).toBe(true)
  expect(roundOk(before.round, after.round), `round edge ${at}`).toBe(true)
  // A new drill starts from Running; only the same drill must follow an edge.
  if (before.drill && after.drill && before.drill.startedAt === after.drill.startedAt)
    expect(drillOk(before.drill, after.drill), `drill edge ${at}`).toBe(true)
  if (before.quarter && after.quarter)
    expect(quarterOk(before.quarter.phase, after.quarter.phase), `quarter edge ${at}`).toBe(true)
  if (before.incident && after.incident && before.incident.startedAt === after.incident.startedAt)
    expect(incidentOk(before.incident.phase, after.incident.phase), `incident edge ${at}`).toBe(
      true,
    )
  for (const node of after.nodes) {
    const old = before.nodes.find((entry) => entry.id === node.id)
    if (old) {
      expect(serviceOk(old.service, node.service), `service edge of ${node.id} ${at}`).toBe(true)
      expect(scalerOk(old.scaler, node.scaler), `scaler edge of ${node.id} ${at}`).toBe(true)
    }
    // A Shut Node is Stopped: it serves nothing and bills nothing.
    if (node.service._tag === 'Shut')
      expect(node.life._tag, `Shut is Stopped ${at}`).toBe('Stopped')
  }
  for (const link of after.links) {
    const old = before.links.find((entry) => entry.from === link.from && entry.to === link.to)
    if (old) expect(fuseOk(old.fuse, link.fuse), `fuse edge ${at}`).toBe(true)
  }
}

describe('every Component in every combination', () => {
  test('every Component can be placed and stepped alone', () => {
    let game = start()
    for (const type of COMPONENT_IDS) {
      if (COMPONENTS[type].fixed) continue
      const placed = Actions.place(game, type, 300, 300)
      if (Result.isSuccess(placed)) game = placed.success
    }
    for (let index = 0; index < 5; index += 1) game = step(game, 1).game
    expect(valid(game)).toBe(true)
    expect(game.nodes.length).toBeGreaterThan(COMPONENT_IDS.length / 2)
  })

  test('random Designs of all Components keep the Game valid and every machine on its edges', () => {
    fc.assert(
      fc.property(fc.array(move, { minLength: 10, maxLength: 60 }), (moves) => {
        let game = start()
        for (const m of moves) {
          const before = game
          game = apply(game, m)
          check(before, game, m)
        }
      }),
      { numRuns: 300 },
    )
  }, 120_000)
})

/* The Team, the Studies and the Mirrors: every move a Seat makes on them, with the figures they keep. */

type TeamMove =
  | { kind: 'study'; id: number; first: boolean }
  | { kind: 'moveStudy'; id: number; index: number }
  | { kind: 'hire' }
  | { kind: 'layoff'; who: number }
  | { kind: 'item'; action: 'approve' | 'later' | 'cancel' | 'prioritize' | 'rush'; item: number }
  | { kind: 'feature'; id: number }
  | { kind: 'spike' }
  | {
      kind: 'mirror'
      action: 'tool' | 'sync' | 'start' | 'apply' | 'refresh' | 'repair' | 'stop'
      value: number
      region: number
    }
  | { kind: 'wait'; seconds: number }

const teamMove: fc.Arbitrary<TeamMove> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('study' as const),
      id: fc.nat(RESEARCH_IDS.length - 1),
      first: fc.boolean(),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('moveStudy' as const),
      id: fc.nat(RESEARCH_IDS.length - 1),
      index: fc.nat(5),
    }),
  },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('hire' as const) }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('layoff' as const), who: fc.nat(10) }) },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('item' as const),
      action: fc.constantFrom('approve', 'later', 'cancel', 'prioritize', 'rush'),
      item: fc.nat(10),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('feature' as const),
      id: fc.nat(FEATURE_IDS.length - 1),
    }),
  },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('spike' as const) }) },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('mirror' as const),
      action: fc.constantFrom('tool', 'sync', 'start', 'apply', 'refresh', 'repair', 'stop'),
      value: fc.nat(3),
      region: fc.nat(3),
    }),
  },
  {
    weight: 8,
    arbitrary: fc.record({
      kind: fc.constant('wait' as const),
      seconds: fc.constantFrom(0.1, 1, 60, 600, 1_440),
    }),
  },
)

/** The Research and everything it requires, so the start itself obeys the rule. */
const closure = (
  ids: ReadonlyArray<(typeof RESEARCH_IDS)[number]>,
): Array<(typeof RESEARCH_IDS)[number]> => {
  const done = new Set<(typeof RESEARCH_IDS)[number]>()
  const visit = (id: (typeof RESEARCH_IDS)[number]): void => {
    if (done.has(id)) return
    done.add(id)
    RESEARCH[id].requires.forEach(visit)
  }
  ids.forEach(visit)
  return [...done]
}

/** A late Company with no Research done, Insight to study with, Cash, and the Infra-as-code tools open. */
const teamStart = (): Game => {
  const base = start()
  const pools = Object.fromEntries(INSIGHT_POOLS.map((pool) => [pool, 1e6])) as Game['pools']
  return {
    ...base,
    stage: 5,
    users: 50_000,
    pools,
    researched: closure(['infra-as-code', 'gitops']),
  }
}

const teamApply = (game: Game, m: TeamMove): Game => {
  const regions = ['na', 'eu', 'apac', 'sa'] as const
  const item =
    game.backlog[m.kind === 'item' ? m.item % Math.max(1, game.backlog.length) : 0]?.id ?? -1
  switch (m.kind) {
    case 'study':
      return take(game, Actions.study(game, RESEARCH_IDS[m.id]!, m.first))
    case 'moveStudy':
      return take(game, Actions.moveStudyTo(game, RESEARCH_IDS[m.id]!, m.index))
    case 'hire':
      return take(game, Work.hire(game))
    case 'layoff':
      return take(
        game,
        Work.layoff(game, game.engineers[m.who % Math.max(1, game.engineers.length)]?.id ?? ''),
      )
    case 'item':
      return take(
        game,
        m.action === 'approve'
          ? Work.approveBlock(game, item)
          : m.action === 'later'
            ? Work.laterBlock(game, item)
            : m.action === 'cancel'
              ? Work.cancelItem(game, item)
              : m.action === 'prioritize'
                ? Work.prioritizeItem(game, item)
                : Work.rushItem(game, item),
      )
    case 'feature':
      return take(game, Work.queueFeature(game, FEATURE_IDS[m.id]!))
    case 'spike':
      return take(game, Work.queueSpike(game))
    case 'mirror': {
      const region = regions[m.region]!
      switch (m.action) {
        case 'tool':
          return take(game, Mirrors.pickIacTool(game, IAC_TOOLS[m.value % IAC_TOOLS.length]!))
        case 'sync':
          return take(
            game,
            Mirrors.setSyncMode(
              game,
              m.value === 0 ? null : SYNC_MODES[m.value % SYNC_MODES.length]!,
            ),
          )
        case 'start':
          return take(game, Mirrors.startMirror(game, region, regions[(m.region + 1) % 4]!))
        case 'apply':
          return take(game, Mirrors.applyMirror(game, region, m.value === 1))
        case 'refresh':
          return take(game, Mirrors.refreshMirror(game, region))
        case 'repair':
          return take(game, Mirrors.repairMirror(game, region))
        case 'stop':
          return take(game, Mirrors.stopMirror(game, region))
      }
    }
    // eslint-disable-next-line no-fallthrough
    case 'wait':
      return step(game, m.seconds).game
  }
}

const teamCheck = (before: Game, after: Game, m: TeamMove) => {
  const at = `after ${JSON.stringify(m)}`
  expect(valid(after), `a valid Game ${at}`).toBe(true)
  const unique = (ids: ReadonlyArray<unknown>) => new Set(ids).size === ids.length
  expect(unique(after.researched), `Research done once ${at}`).toBe(true)
  for (const id of after.researched)
    for (const needed of RESEARCH[id].requires)
      expect(after.researched.includes(needed), `${id} needs ${needed} ${at}`).toBe(true)
  expect(unique(after.studies.map((entry) => entry.id)), `one Study per Research ${at}`).toBe(true)
  for (const entry of after.studies)
    expect(after.researched.includes(entry.id), `${entry.id} is queued and done ${at}`).toBe(false)
  expect(
    unique([...after.hires.map((h) => h.id), ...after.engineers.map((e) => e.id)]),
    `one engineer per hire ${at}`,
  ).toBe(true)
  expect(unique(after.backlog.map((entry) => entry.id)), `one item per id ${at}`).toBe(true)
  for (const entry of after.backlog) {
    expect(entry.spent, `spent is within cost ${at}`).toBeLessThanOrEqual(entry.cost + 1e-6)
    if (entry.block._tag === 'Blocked')
      expect(entry.spent, `a Blocked item has no work ${at}`).toBeLessThanOrEqual(1e-9)
  }
  for (const hire of after.hires) {
    const old = before.hires.find((entry) => entry.id === hire.id)
    if (old) expect(hireOk(old.phase, hire.phase), `hire edge ${at}`).toBe(true)
  }
  for (const entry of after.studies) {
    const old = before.studies.find((candidate) => candidate.id === entry.id)
    if (old) expect(studyOk(old.phase, entry.phase), `study edge ${at}`).toBe(true)
  }
  for (const entry of after.backlog) {
    const old = before.backlog.find((candidate) => candidate.id === entry.id)
    if (old) expect(blockOk(old.block, entry.block), `block edge ${at}`).toBe(true)
  }
  for (const mirror of after.mirrors ?? []) {
    const old = before.mirrors?.find((entry) => entry.region === mirror.region)
    if (old) expect(mirrorOk(old.sync, mirror.sync), `mirror edge ${at}`).toBe(true)
  }
  for (const key of ['reshard', 'engineChange'] as const) {
    const was = before[key]
    const now = after[key]
    if (was && now) expect(moveOk(was.phase, now.phase), `${key} edge ${at}`).toBe(true)
  }
}

describe('the Team, the Studies and the Mirrors', () => {
  test('random moves keep every engineer, item and Study single, and every machine on its edges', () => {
    fc.assert(
      fc.property(fc.array(teamMove, { minLength: 10, maxLength: 60 }), (moves) => {
        let game = teamStart()
        for (const m of moves) {
          const before = game
          game = teamApply(game, m)
          teamCheck(before, game, m)
        }
      }),
      { numRuns: 300 },
    )
  }, 120_000)
})
