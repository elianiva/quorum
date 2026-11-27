import { Actions, planIn } from '../board-actions.ts'
import { EMPTY_HISTORY } from '../history.ts'
import { EMPTY_INBOX, savedInbox } from '../inbox.ts'
import { EMPTY_RESEARCH } from '../research.ts'
import { earnAchievements } from '@quorum/simulation/founder'
import { Game } from '@quorum/simulation/state'
import { applyIntents, type Intent } from '@quorum/simulation/room'
import type { Action } from '@quorum/simulation/action-kit'
import { Message } from '../message.ts'
import {
  Model,
  SandboxStore,
  halted,
  offCompany,
  placingOf,
  playingId,
  roomLive,
  roomCode,
  onlineFileOf,
  stampedPlaybook,
  boardChallenge,
  ANNOTATION_GROUPS,
  type Board,
  type Tone,
} from '../model.ts'
import { Result } from 'effect'
import { StepEvent } from '@quorum/simulation/events'
import { type IssuedCommand, type UpdateReturn } from '../step.ts'
import {
  WriteCompany,
  WriteFounder,
  AppendLog,
  ClearToast,
  PlaySound,
  SendRoom,
  SyncBoard,
  TOAST_MS,
} from '../commands.ts'
import { beginChange, figuresOf, pushUndo, snapshotOf, type Reversal } from '../feedback.ts'
import { copyIn, type Messages } from '../../i18n/messages.ts'
import { countStats, detectAchievements } from '@quorum/simulation/achievements'
import { cueNode } from '../reveal.ts'
import { offerOf } from '../offer.ts'
import { eraReachedOf, line } from '../telemetry.ts'
import { fileOf, refreshedIndex } from '../saves.ts'
import { savesOf } from '../saves-machine.ts'
import { overlayClose, overlayOpen } from '../clock-machine.ts'
import { ghostReason } from '@quorum/simulation/playbook'
import { initTeam } from '../team.ts'
import { nodeLabel, normalizeOrdinals } from '@quorum/simulation/labels'
import { onBoard } from '../route.ts'
import { reasonIn, refusalIn } from '../../i18n/refusal.ts'
import { solveFlow } from '@quorum/simulation/solve'
import { type AchievementId } from '@quorum/simulation/catalog'
import { type Ledger } from '@quorum/simulation/ledger'

export type UpdateResult = UpdateReturn<Model, Message>

export type AnyCommand = IssuedCommand<Message>

export type Dispatch = (model: Model, message: Message) => UpdateResult

export type MessageCases<Output, Tags extends Message['_tag']> = {
  readonly [Tag in Tags]: (value: Extract<Message, { _tag: Tag }>) => Output
}

export const freshBoard = (game: Game): Board => ({
  game: normalizeOrdinals(game),
  session: { _tag: 'Company' },
  surface: { _tag: 'Starting' },
  region: 'na',
  selected: null,
  selection: [],
  flow: { _tag: 'Idle' },
  clipboard: null,
  buildGroup: null,
  team: initTeam(),
  research: EMPTY_RESEARCH,
  insightHelp: false,
  clock: {
    speed: 1,
    mode: { _tag: 'Running' },
    carry: 0,
    savedAt: game.time,
    unsavedMs: 0,
    sampledAt: game.time,
  },
  change: { _tag: 'Idle' },
  tradeoff: { _tag: 'Closed' },
  disclosure: { _tag: 'Idle', revealed: [] },
  undo: [],
  redo: [],
  whatIfsAt: -1,
  screenshot: false,
  whatIfs: null,
  nodeHistory: {},
  nodeSample: null,
  inbox: EMPTY_INBOX,
  dashboard: {
    history: EMPTY_HISTORY,
    range: 360,
    hover: null,
    postmortem: null,
    groups: [...ANNOTATION_GROUPS],
    compare: true,
    table: false,
    kind: null,
    service: null,
    region: null,
  },
  lastGoal: '',
  lastBottleneck: '',
  alertQuiet: [],
  researchOffer: null,
})

export const milestones = (
  before: Model,
  result: UpdateResult,
  events: ReadonlyArray<StepEvent>,
  ledger: Ledger,
): UpdateResult => {
  const after = result.model
  if (!onBoard(after.route) || offCompany(after)) return result
  const commands: Array<AnyCommand> = [...(result.commands ?? [])]
  const stats = countStats(after.founder.stats, events)
  const earned = detectAchievements(
    {
      before: before.board.game,
      after: after.board.game,
      ledger,
      previousLedger: solveFlow(before.board.game),
      events,
      stats,
    },
    after.founder.achievements,
  )
  let next = after
  if (stats !== after.founder.stats && events.some((event) => event._tag === 'IncidentResolved'))
    next = { ...next, founder: { ...next.founder, stats } }
  const [achieved, earnedCommands] = achieve(next, earned)
  next = achieved
  commands.push(...earnedCommands)
  if (next.founder !== after.founder && earnedCommands.length === 0)
    commands.push(WriteFounder.make({ founder: next.founder }))
  if (!next.prefs.muted) {
    if (after.board.game.stage > before.board.game.stage)
      commands.push(PlaySound.make({ sound: 'era', pitch: 1, spatial: false }))
    else if (events.some((event) => event._tag === 'IncidentStarted'))
      commands.push(PlaySound.make({ sound: 'incident', pitch: 1, spatial: false }))
  }
  const time = after.board.game.time
  if (after.board.game.stage > before.board.game.stage)
    commands.push(
      AppendLog.make({ entries: [line(time, 'EraReached', eraReachedOf(after, ledger))] }),
    )
  const researched = after.board.game.researched.filter(
    (id) => !before.board.game.researched.includes(id),
  )
  if (researched.length > 0)
    commands.push(
      AppendLog.make({
        entries: [
          line(time, 'ResearchCompleted', { ids: researched, era: after.board.game.stage }),
        ],
      }),
    )
  return next === after && commands.length === (result.commands ?? []).length
    ? result
    : { model: next, commands }
}

export const say = (model: Model): Messages => copyIn(model.prefs.locale)

export const withOverlay = (
  model: Model,
  cause: 'palette' | 'menu' | 'boot',
  open: boolean,
): Model => ({
  ...model,
  board: {
    ...model.board,
    clock: {
      ...model.board.clock,
      mode: open
        ? overlayOpen(model.board.clock.mode, cause)
        : overlayClose(model.board.clock.mode, cause),
    },
  },
})

export const closePanel = (model: Model): Model => {
  const panel = model.panel === 'settings' && onBoard(model.route) ? 'menu' : 'none'
  return withOverlay({ ...model, panel, exitConfirm: null }, 'menu', panel === 'menu')
}

const loadHistories = new WeakMap<
  Model['board']['nodeHistory'],
  Record<string, ReadonlyArray<number>>
>()
const loadHistoryOf = (
  history: Model['board']['nodeHistory'],
): Record<string, ReadonlyArray<number>> => {
  const known = loadHistories.get(history)
  if (known) return known
  const loads = Object.fromEntries(
    Object.entries(history).map(([id, samples]) => [
      id,
      samples.map((sample) => sample.utilization),
    ]),
  )
  loadHistories.set(history, loads)
  return loads
}

export const sync = (model: Model, fit: boolean, focus: string | null = null): AnyCommand =>
  SyncBoard.make({
    fit,
    focus,
    game: model.board.game,
    locale: model.prefs.locale,
    selected: model.board.selected,
    selection: model.board.selection,
    placing: placingOf(model),
    stamp: stampOf(model),
    history: loadHistoryOf(model.board.nodeHistory),
    region: model.board.region,
    paused: halted(model),
    speed: model.board.clock.speed,
    suspended: model.panel === 'research',
    cue: cueNode(model),
  })

export const savePayloadOf = (model: Model, board: Board = model.board) => ({
  game: board.game,
  revealed: board.disclosure.revealed,
  pending:
    board.disclosure._tag === 'Queued' || board.disclosure._tag === 'Cueing'
      ? board.disclosure.pending
      : [],
  dashboard: board.dashboard.history,
  inbox: savedInbox(board.inbox),
})

const saveOf = (model: Model, closing = false): AnyCommand | null => {
  const id = playingId(model)
  if (id === null || !fileOf(savesOf(model.saves), id)) return null
  const code = roomCode(model)
  if (code !== null && onlineFileOf(model, code) === null) return null
  const board = offCompany(model) ? model.parkedCompany : model.board
  if (board === null) return null
  return WriteCompany.make({
    id,
    index: refreshedIndex(savesOf(model.saves), board.game),
    ...savePayloadOf(model, board),
    ...(closing ? { closing } : {}),
  })
}

export const saveCommands = (model: Model, closing = false): ReadonlyArray<AnyCommand> => {
  const command = saveOf(model, closing)
  return command === null ? [] : [command]
}

const stampOf = (model: Model) => {
  const playbook = stampedPlaybook(model)
  if (!playbook) return null
  return playbook.nodes.map((node) => ({
    type: node.type,
    dx: node.dx,
    dy: node.dy,
    ghost: ghostReason(model.board.game, node, model.board.region) !== null,
  }))
}

export const toasted = (model: Model, message: string, tone: Tone): [Model, AnyCommand] => {
  const previous = model.toast
  const repeat = previous !== null && previous.message === message && previous.tone === tone
  const id = model.toastSeq + 1
  const count = repeat && previous !== null ? previous.count + 1 : 1
  return [
    { ...model, toast: { id, message, tone, count }, toastSeq: id },
    ClearToast.make({ id, after: TOAST_MS[tone] }),
  ]
}

export const withToast = (
  model: Model,
  message: string,
  tone: Tone,
  extra: ReadonlyArray<AnyCommand> = [],
): UpdateResult => {
  const [next, clear] = toasted(model, message, tone)
  return { model: next, commands: [clear, ...extra] }
}

export type ActOptions = Readonly<{
  undoable?: boolean
  patch?: (model: Model, game: Game) => Partial<Board>
  panel?: (game: Game) => Model['panel']
  note?: (game: Game) => readonly [string, Tone] | null
}>

export type ActTarget = Action | Game | Intent | ReadonlyArray<Action | Game | Intent>

const isIntent = (target: Action | Game | Intent): target is Intent =>
  typeof target === 'object' && target !== null && 'ns' in target && 'args' in target

const intentsOf = (target: ActTarget): ReadonlyArray<Intent> | null => {
  const batch = Array.isArray(target) ? target : [target]
  const plans = batch.map((entry) => (isIntent(entry) ? entry : planIn(entry)))
  return plans.some((plan) => plan === null) ? null : (plans as ReadonlyArray<Intent>)
}

const appliedOf = (target: Action | Game): Action =>
  Result.isResult(target) ? (target as Action) : Result.succeed(target as Game)

export const act = (
  model: Model,
  label: string,
  target: ActTarget,
  options: ActOptions = {},
): UpdateResult => {
  const intents = intentsOf(target)
  if (intents === null && roomLive(model))
    return withToast(model, say(model).room.notAvailable, 'warn')
  const action =
    intents === null ? appliedOf(target as Action | Game) : applyIntents(model.board.game, intents)
  return Result.match(action, {
    onFailure: (refusal) => {
      const offer = offerOf(refusal)
      return offer === null
        ? withToast(model, refusalIn(say(model), refusal), 'warn')
        : { model: { ...model, board: { ...model.board, researchOffer: offer } } }
    },
    onSuccess: (applied) => {
      if (applied === model.board.game) return { model }
      const challenge = boardChallenge(model.board)
      if (challenge && challenge._tag !== 'Building')
        return withToast(model, say(model).toasts.rebuildToChange, 'warn')
      const game = Actions.acknowledge(applied)
      const measured = beginChange(model.board, label, figuresOf(solveFlow(model.board.game)))
      const next: Model = {
        ...model,
        panel: options.panel?.(game) ?? model.panel,
        board: {
          ...measured,
          ...options.patch?.(model, game),
          game,
          whatIfsAt: -1,
          ...(options.undoable
            ? pushUndo(
                model.board,
                snapshotOf(
                  label,
                  model.board.game,
                  game.cash - model.board.game.cash,
                  model.board.game.time,
                ),
              )
            : {}),
        },
      }
      const note = options.note?.(game)
      const sent =
        intents !== null && roomLive(model)
          ? SendRoom.make({ message: { _tag: 'Intents', id: model.room.seq, intents } })
          : null
      const stamped =
        sent === null ? next : { ...next, room: { ...next.room, seq: next.room.seq + 1 } }
      const result = note ? withToast(stamped, note[0], note[1]) : { model: stamped }
      return sent === null ? result : { ...result, commands: [...(result.commands ?? []), sent] }
    },
  })
}

export const reverse = (
  model: Model,
  reversal: Reversal | string,
  verb: 'Undid' | 'Redid',
): UpdateResult => {
  if (typeof reversal === 'string') return withToast(model, reasonIn(say(model), reversal), 'plain')
  if (roomLive(model)) return withToast(model, say(model).room.notAvailable, 'warn')
  const challenge = boardChallenge(model.board)
  if (challenge && challenge._tag !== 'Building')
    return withToast(model, say(model).toasts.rebuildToChange, 'warn')
  const measured = beginChange(
    model.board,
    `${verb} ${reversal.label}`,
    figuresOf(solveFlow(model.board.game)),
  )
  const next: Model = {
    ...model,
    board: {
      ...measured,
      game: reversal.game,
      undo: reversal.undo,
      redo: reversal.redo,
      whatIfsAt: -1,
    },
  }
  const t = say(model).toasts
  return withToast(
    next,
    verb === 'Undid' ? t.undid(reversal.label) : t.redid(reversal.label),
    'plain',
  )
}

export const nodeName = (game: Game, id: string): string => {
  const node = game.nodes.find((entry) => entry.id === id)
  return node ? nodeLabel(game, node) : 'A Node'
}

export const percent = (share: number): string => `${Math.round(share * 100)}%`

export const achieve = (
  model: Model,
  ids: ReadonlyArray<AchievementId>,
): readonly [Model, ReadonlyArray<AnyCommand>] => {
  const fresh = ids.filter((id) => !model.founder.achievements.includes(id))
  if (fresh.length === 0) return [model, []]
  let next: Model = { ...model, founder: earnAchievements(model.founder, fresh) }
  const commands: Array<AnyCommand> = [WriteFounder.make({ founder: next.founder })]
  for (const id of fresh) {
    const [raised, clear] = toasted(
      next,
      say(next).toasts.achievement(say(next).catalog.achievements[id].name),
      'primary',
    )
    next = raised
    commands.push(clear)
  }
  if (!next.prefs.muted)
    commands.push(PlaySound.make({ sound: 'achievement', pitch: 1, spatial: false }))
  commands.push(
    AppendLog.make({
      entries: fresh.map((id) => line(next.board.game.time, 'AchievementEarned', { id })),
    }),
  )
  return [next, commands]
}

export const storeOf = (model: Model): SandboxStore => ({
  passed: model.passed,
  free: model.freeBoard,
})
