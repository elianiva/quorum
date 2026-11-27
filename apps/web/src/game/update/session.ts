import { Actions } from '../board-actions.ts'
import { Work } from '../board-actions.ts'
import { AppRoute, onBoard, urlOf, urlToAppRoute } from '../route.ts'
import { COMPONENTS, KINDS, STEP_SECONDS, TASKS } from '@quorum/simulation/catalog'
import { EMPTY_HISTORY } from '../history.ts'
import { completeChallenge } from '@quorum/simulation/founder'
import { Game } from '@quorum/simulation/state'
import {
  Model,
  SandboxStore,
  hasCompany,
  offCompany,
  boardChallenge,
  boardSandbox,
  parkedCompanyOf,
  type Board,
  type ChallengeRun,
  type SandboxRun,
} from '../model.ts'
import {
  NO_TOTALS,
  advanceRun,
  beginRun,
  challengeById,
  resultOf,
  responseAllowed,
  stepsOf,
  type Challenge,
} from '@quorum/simulation/challenges'
import { Option, Result, Schema } from 'effect'
import { SIM_VERSION } from '@quorum/simulation/version'
import { maxStepsPerTick } from './constant.ts'
import { WriteFounder, AppendLog, FitBoard, ReplaceUrl, WriteSandboxStore } from '../commands.ts'
import { bigBoard, stressBoard } from '@quorum/ui/board/stress'
import { boxOf, freeSpot, type Box } from '@quorum/ui/board/geometry'
import { challengeStep } from '../challenge-machine.ts'
import { designOf, type ReplayAction, type Response } from '@quorum/simulation/replay'
import { leaveExited } from './companies.ts'
import { freeSandbox, GUIDED, sandboxOf, START } from '@quorum/simulation/sandbox'
import {
  freshBoard,
  say,
  saveCommands,
  withOverlay,
  withToast,
  act,
  storeOf,
  type AnyCommand,
  type MessageCases,
  type UpdateResult,
} from './shared.ts'
import { isFinalEra } from '@quorum/simulation/lookups'
import { line } from '../telemetry.ts'
import { newGame } from '@quorum/simulation/company'
import { normalizeOrdinals } from '@quorum/simulation/labels'
import { reasonIn } from '../../i18n/refusal.ts'
import { copyIn } from '../../i18n/messages.ts'
import { savedIndex } from '../saves.ts'
import { savesOf, withSaves } from '../saves-machine.ts'
import { sessionStep } from '../session-machine.ts'
import { isExited } from '../company-machine.ts'
import { clockStep } from '../clock-machine.ts'
import { roomStep } from '../room-machine.ts'
import { type GameUrl } from '../route.ts'

const open = (model: Model, route: AppRoute): UpdateResult =>
  AppRoute.match(route, {
    Title: (): UpdateResult => ({ model: { ...model, route } }),
    Menu: ({ params: { menu } }): UpdateResult => ({
      model: {
        ...model,
        route,
        ...(menu === 'companies' ? {} : { saveFocus: null, saveConfirm: { _tag: 'List' } }),
      },
    }),
    Company: (): UpdateResult => (hasCompany(model) ? continued(model) : { model }),
    Sandbox: ({ params: { sandbox } }): UpdateResult =>
      sandbox === 'free'
        ? enterSandbox(model, model.freeBoard ?? freeSandbox(), { id: null, progress: START })
        : enterSandbox(model, GUIDED[sandbox].start(), { id: sandbox, progress: START }),
    Challenge: ({ params: { challenge } }): UpdateResult => {
      const entry = challengeById(challenge)
      return entry ? enterChallenge(model, challenge) : { model }
    },
    Room: ({ params: { room } }): UpdateResult => ({
      model: {
        ...model,
        route,
        panel: 'room',
        room: {
          ...model.room,
          phase: roomStep(model.room.phase, { _tag: 'Connecting', code: room }),
          seats: [],
          speed: 1,
          vote: { _tag: 'Idle' },
        },
      },
    }),
    NotFound: (): UpdateResult => ({ model }),
  })

export const visit = (model: Model, url: GameUrl): UpdateResult => {
  const route = urlToAppRoute(url)
  if (urlOf(route) === urlOf(model.route)) return { model }
  const left = onBoard(model.route) ? leaveBoard(model) : { model }
  const opened = open(left.model, route)
  const landed = urlOf(opened.model.route)
  return {
    model: opened.model,
    commands: [
      ...(left.commands ?? []),
      ...(opened.commands ?? []),
      ...(landed === urlOf(route) ? [] : [ReplaceUrl.make({ url: landed })]),
    ],
  }
}

const parseStore = Schema.decodeUnknownOption(Schema.fromJsonString(SandboxStore))

const heldCompany = (model: Model): Board | null =>
  offCompany(model) ? model.parkedCompany : (model.parkedCompany ?? model.board)

const enterSandbox = (model: Model, game: Game, run: SandboxRun): UpdateResult => {
  const board = freshBoard(game)
  const next: Model = {
    ...model,
    route: AppRoute.Sandbox({ params: { sandbox: run.id ?? 'free' } }),
    toast: null,
    panel: 'none',
    parkedCompany: heldCompany(model),
    board: {
      ...board,
      session: sessionStep(board.session, { _tag: 'SandboxOpened', run }),
    },
  }
  return {
    model: next,
    commands: [
      FitBoard.make({}),
      AppendLog.make({
        entries: [line(game.time, 'SandboxStarted', { sandbox: run.id ?? 'free' })],
      }),
    ],
  }
}

const replaceFree = (model: Model, game: Game, text: string): UpdateResult => {
  if (boardSandbox(model.board)?.id !== null) return { model }
  const normalized = normalizeOrdinals(game)
  const next: Model = {
    ...model,
    freeBoard: normalized,
    board: {
      ...model.board,
      game: normalized,
      selected: null,
      flow: { _tag: 'Idle' },
      undo: [],
      redo: [],
      change: { _tag: 'Idle' },
      whatIfsAt: -1,
      nodeHistory: {},
      nodeSample: null,
      dashboard: { ...model.board.dashboard, history: EMPTY_HISTORY },
      clock: { ...model.board.clock, savedAt: game.time, sampledAt: game.time },
    },
  }
  return withToast(next, text, 'plain', [
    FitBoard.make({}),
    WriteSandboxStore.make({ store: storeOf(next) }),
  ])
}

const tuneFree = (model: Model, game: Game): UpdateResult => {
  if (boardSandbox(model.board)?.id !== null) return { model }
  const next: Model = { ...model, board: { ...model.board, game, whatIfsAt: -1 } }
  return { model: next }
}

const DEMAND_STEPS = [100, 250, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000]

export const afterRound = (game: Game): Model['panel'] => (isFinalEra(game) ? 'end' : 'era')

const spreadOut = (game: Game): Game => {
  const settled = new Map<string, Array<Box>>()
  const taken = (region: string) => settled.get(region) ?? []
  for (const node of game.nodes.filter((entry) => COMPONENTS[entry.type].fixed))
    settled.set(node.region, [...taken(node.region), boxOf(node)])
  let next = game
  for (const node of game.nodes.filter((entry) => !COMPONENTS[entry.type].fixed)) {
    const spot = freeSpot(taken(node.region), boxOf(node))
    settled.set(node.region, [...taken(node.region), { ...boxOf(node), ...spot }])
    if (spot.x !== node.x || spot.y !== node.y) next = Actions.move(next, node.id, spot.x, spot.y)
  }
  return next
}

const boardOf = (challenge: Challenge): Game =>
  spreadOut({ ...challenge.start(), users: challenge.demand[0]?.users ?? 0 })

export const enterChallenge = (model: Model, id: string): UpdateResult => {
  const challenge = challengeById(id)
  if (!challenge) return { model }
  const game = boardOf(challenge)
  const next: Model = {
    ...model,
    route: AppRoute.Challenge({ params: { challenge: id } }),
    toast: null,
    panel: 'none',
    parkedCompany: heldCompany(model),
    board: {
      ...freshBoard(game),
      session: sessionStep(freshBoard(game).session, {
        _tag: 'ChallengeOpened',
        run: { _tag: 'Building', id, totals: NO_TOTALS },
      }),
    },
  }
  return {
    model: next,
    commands: [
      FitBoard.make({}),
      AppendLog.make({ entries: [line(game.time, 'ChallengeStarted', { challenge: id })] }),
    ],
  }
}

const startRun = (model: Model, run: ChallengeRun): UpdateResult => {
  const challenge = challengeById(run.id)
  if (!challenge || run._tag !== 'Building') return { model }
  const replay = {
    v: 1 as const,
    challenge: run.id,
    simVersion: SIM_VERSION,
    design: designOf(model.board.game),
    actions: [],
  }
  return Result.match(beginRun(challenge, replay), {
    onFailure: (reason) => withToast(model, reasonIn(say(model), reason), 'warn'),
    onSuccess: (game) => {
      const next: Model = {
        ...model,
        panel: 'none',
        board: {
          ...model.board,
          game,
          session: sessionStep(model.board.session, {
            _tag: 'ChallengeUpdated',
            run: challengeStep(run, { _tag: 'Run', board: model.board.game, replay }),
          }),
          flow: { _tag: 'Idle' },
          selected: null,
          whatIfsAt: -1,
          clock: {
            ...model.board.clock,
            carry: 0,
            mode: clockStep(model.board.clock.mode, { _tag: 'Resumed' }),
          },
        },
      }
      return { model: next }
    },
  })
}

const runSteps = (
  model: Model,
  run: ChallengeRun,
  all: boolean,
  elapsedMs = 0,
): Readonly<{ model: Model; done: boolean }> => {
  const challenge = challengeById(run.id)
  if (!challenge || run._tag !== 'Running') return { model, done: false }
  const most = (maxStepsPerTick(model.board.clock.speed) * STEP_SECONDS) / challenge.stepSeconds
  const owed = all
    ? Number.POSITIVE_INFINITY
    : Math.min(
        model.board.clock.carry +
          (elapsedMs * model.board.clock.speed) / (1_000 * challenge.stepSeconds),
        most,
      )
  const total = stepsOf(challenge)
  let game = model.board.game
  let totals = run.totals
  let taken = 0
  while (totals.step < total && taken + 1 <= owed) {
    const next = advanceRun(challenge, run.replay, game, totals)
    game = next.game
    totals = next.totals
    taken += 1
  }
  return {
    model: {
      ...model,
      board: {
        ...model.board,
        game,
        session: sessionStep(model.board.session, {
          _tag: 'ChallengeUpdated',
          run: challengeStep(run, { _tag: 'Ticked', totals }),
        }),
        clock: { ...model.board.clock, carry: all ? 0 : owed - taken },
      },
    },
    done: totals.step >= total,
  }
}

const finishRun = (model: Model): UpdateResult => {
  const run = boardChallenge(model.board)
  const challenge = run ? challengeById(run.id) : undefined
  if (!run || !challenge || run._tag !== 'Running') return { model }
  const result = resultOf(challenge, model.board.game, run.totals)
  const first = result.passed && !model.founder.completed.includes(run.id)
  const founder = result.passed
    ? completeChallenge(model.founder, run.id, challenge.legacy)
    : model.founder
  const next: Model = {
    ...model,
    founder,
    panel: 'challenge',
    board: {
      ...model.board,
      session: sessionStep(model.board.session, {
        _tag: 'ChallengeUpdated',
        run: challengeStep(run, { _tag: 'Finished', result }),
      }),
    },
  }
  const commands: Array<AnyCommand> = [
    AppendLog.make({
      entries: [line(model.board.game.time, 'ChallengeRun', { challenge: run.id, ...result })],
    }),
  ]
  if (founder !== model.founder) commands.push(WriteFounder.make({ founder }))
  return first && challenge.legacy > 0
    ? withToast(next, say(model).toasts.firstCompletion(challenge.legacy), 'ok', commands)
    : { model: next, commands }
}

export const runTick = (model: Model, run: ChallengeRun, elapsedMs: number): UpdateResult => {
  const ran = runSteps(model, run, false, elapsedMs)
  return ran.done ? finishRun(ran.model) : { model: ran.model }
}

export const logRunAction = (model: Model, action: ReplayAction): UpdateResult | null => {
  const run = boardChallenge(model.board)
  if (run?._tag !== 'Running') return null
  return {
    model: {
      ...model,
      board: {
        ...model.board,
        session: sessionStep(model.board.session, {
          _tag: 'ChallengeUpdated',
          run: challengeStep(run, { _tag: 'ActionLogged', action }),
        }),
      },
    },
  }
}

export const logResponse = (model: Model, response: Response): UpdateResult | null => {
  const run = boardChallenge(model.board)
  if (run?._tag !== 'Running') return null
  const challenge = challengeById(run.id)
  const action: ReplayAction = { _tag: 'Respond', response }
  if (challenge && !responseAllowed(challenge, action))
    return withToast(model, say(model).toasts.challengeForbids, 'warn')
  return logRunAction(model, action)
}

export const companyBoard = (model: Model): Board =>
  model.parkedCompany ? { ...model.parkedCompany, whatIfsAt: -1 } : freshBoard(newGame())

const leaveChallenge = (model: Model): UpdateResult => ({
  model: {
    ...model,
    route: AppRoute.Menu({ params: { menu: 'challenges' } }),
    panel: 'none',
    board: {
      ...companyBoard(model),
      session: sessionStep(model.board.session, { _tag: 'Closed' }),
    },
    parkedCompany: null,
  },
})

export const continued = (model: Model): UpdateResult => {
  const next: Model = {
    ...model,
    route: AppRoute.Company(),
    panel: 'none',
    board: {
      ...model.board,
      clock: {
        ...model.board.clock,
        mode: clockStep(model.board.clock.mode, { _tag: 'Resumed' }),
      },
    },
  }
  return {
    model: next,
    commands: [AppendLog.make({ entries: [line(model.board.game.time, 'SessionResumed', {})] })],
  }
}

export const leaveBoard = (model: Model): UpdateResult => {
  if (isExited(model.companyPhase)) return leaveExited(model, 'found')
  if (boardChallenge(model.board)) return leaveChallenge(model)
  if (!boardSandbox(model.board)) {
    const left = withOverlay(
      withOverlay(
        {
          ...model,
          route: AppRoute.Title(),
          panel: 'none',
          saves: withSaves(
            model.saves,
            savedIndex(savesOf(model.saves), model.board.game, Date.now()),
          ),
          board: { ...model.board, flow: { _tag: 'Idle' }, screenshot: false },
        },
        'palette',
        false,
      ),
      'boot',
      false,
    )
    return {
      model: withOverlay(left, 'menu', false),
      commands: saveCommands(model),
    }
  }
  const free = boardSandbox(model.board)
  const freeBoard = free?.id === null ? model.board.game : model.freeBoard
  const next: Model = {
    ...model,
    route: AppRoute.Menu({ params: { menu: 'sandbox' } }),
    panel: 'none',
    board: {
      ...companyBoard(model),
      screenshot: false,
      session: sessionStep(model.board.session, { _tag: 'Closed' }),
    },
    parkedCompany: null,
    freeBoard,
  }
  return { model: next, commands: [WriteSandboxStore.make({ store: storeOf(next) })] }
}

type SessionTag =
  | 'SandboxStoreLoaded'
  | 'ChallengeStarted'
  | 'ChallengeRan'
  | 'ChallengeFinished'
  | 'ChallengeRebuilt'
  | 'FixChosen'
  | 'GuidedStarted'
  | 'FreeSandboxStarted'
  | 'FreeSandboxReset'
  | 'StressBoardLoaded'
  | 'CompanyCopied'
  | 'DemandStepped'
  | 'MixChosen'
  | 'LeverStepped'

export const sessionHandlers = (model: Model): MessageCases<UpdateResult, SessionTag> => ({
  SandboxStoreLoaded: ({ json }) =>
    Option.match(json === null ? Option.none() : parseStore(json), {
      onNone: () => (model.route._tag === 'Sandbox' ? open(model, model.route) : { model }),
      onSome: (store) => {
        const loaded: Model = { ...model, passed: store.passed, freeBoard: store.free }
        return model.route._tag === 'Sandbox' ? open(loaded, model.route) : { model: loaded }
      },
    }),

  ChallengeStarted: ({ id }) => enterChallenge(model, id),

  ChallengeRan: () => {
    const run = boardChallenge(model.board)
    return run ? startRun(model, run) : { model }
  },

  ChallengeFinished: () => {
    const run = boardChallenge(model.board)
    if (run?._tag !== 'Running') return { model }
    return finishRun(runSteps(model, run, true).model)
  },

  ChallengeRebuilt: () => {
    const run = boardChallenge(model.board)
    if (!run || run._tag === 'Building') return { model }
    const next: Model = {
      ...model,
      panel: 'none',
      board: {
        ...model.board,
        game: run.board,
        whatIfsAt: -1,
        session: sessionStep(model.board.session, {
          _tag: 'ChallengeUpdated',
          run: challengeStep(run, { _tag: 'Rebuilt' }),
        }),
      },
    }
    return { model: next }
  },

  FixChosen: ({ fix, on }) =>
    act(model, `${TASKS[fix].name} ${on ? 'on' : 'off'}`, Work.setFix(model.board.game, fix, on), {
      undoable: true,
    }),

  GuidedStarted: ({ id }) => enterSandbox(model, GUIDED[id].start(), { id, progress: START }),

  FreeSandboxStarted: () =>
    enterSandbox(model, model.freeBoard ?? freeSandbox(), { id: null, progress: START }),

  FreeSandboxReset: () => replaceFree(model, freeSandbox(), say(model).toasts.sandboxReset),

  StressBoardLoaded: ({ big }) =>
    big
      ? replaceFree(model, bigBoard(), say(model).toasts.bigBoardLoaded)
      : replaceFree(model, stressBoard(), say(model).toasts.stressBoardLoaded),

  CompanyCopied: () =>
    parkedCompanyOf(model) && hasCompany(model)
      ? replaceFree(model, sandboxOf(parkedCompanyOf(model)!.game), say(model).toasts.designCopied)
      : withToast(model, say(model).toasts.noCompanyToCopy, 'plain'),

  DemandStepped: ({ direction }) => {
    const index = DEMAND_STEPS.findIndex((users) => users >= model.board.game.users)
    const at = index === -1 ? DEMAND_STEPS.length - 1 : index
    const users =
      DEMAND_STEPS[Math.max(0, Math.min(DEMAND_STEPS.length - 1, at + direction))] ?? 1_000
    return tuneFree(model, { ...model.board.game, users })
  },

  MixChosen: ({ stage }) => tuneFree(model, { ...model.board.game, stage }),

  LeverStepped: ({ kind, direction }) =>
    act(
      model,
      (direction > 0 ? copyIn('en').changes.leverRaised : copyIn('en').changes.leverLowered)(
        KINDS[kind].label,
      ),
      direction > 0
        ? Work.queueLever(model.board.game, kind)
        : Work.removeLever(model.board.game, kind),
    ),
})
