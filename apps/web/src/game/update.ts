import { AppRoute, onBoard, urlOf, urlToAppRoute } from './route.ts'
import { DEFAULT_LOGO } from './logos.ts'
import * as MenuControl from './menu.ts'
import { initStackPicker } from './stack-picker.ts'
import {
  CheckRoom,
  LoadFounder,
  LoadSaves,
  AppendLog,
  ConnectBoard,
  LoadPrefs,
  LoadSandboxStore,
  PlaySound,
  PushUrl,
  ReplaceUrl,
} from './commands.ts'
import { Message } from './message.ts'
import { bootStep } from './boot-machine.ts'
import { contextOf, diffOf, line } from './telemetry.ts'
import { cueNode, noticed } from './reveal.ts'
import { cueOf } from './cues.ts'
import { emptyFounder } from '@quorum/simulation/founder'
import { freshBoard, milestones, sync, withOverlay, type UpdateResult } from './update/shared.ts'
import { isExited } from './company-machine.ts'
import { isSending, isSent } from './survey-machine.ts'
import { ledgerOf, Model, halted, EMPTY_PALETTE, EMPTY_ROOM, EMPTY_SURVEY } from './model.ts'
import { nameOf } from '../platform/room-socket.ts'
import { newGame } from '@quorum/simulation/company'
import { type Ledger } from '@quorum/simulation/ledger'
import { type LogEntry } from './playlog.ts'
import { companiesHandlers } from './update/companies.ts'
import { sessionHandlers } from './update/session.ts'
import { shellHandlers } from './update/shell.ts'
import { clockHandlers } from './update/clock.ts'
import { keysHandlers } from './update/keys.ts'
import { canvasHandlers } from './update/canvas.ts'
import { optionsHandlers } from './update/options.ts'
import { tradeoffHandlers } from './update/tradeoff.ts'
import { incidentsHandlers } from './update/incidents.ts'
import { mirrorsHandlers } from './update/mirrors.ts'
import { exitHandlers } from './update/exit.ts'
import { teamHandlers } from './update/team.ts'
import { paletteHandlers } from './update/palette.ts'
import { panelsHandlers } from './update/panels.ts'
import { saveHandlers } from './update/save.ts'
import { roomHandlers } from './update/room.ts'
import { pwaHandlers } from './update/pwa.ts'
import { pwaSnapshot } from '../platform/pwa.ts'
import { pwaFrom } from './pwa-machine.ts'

export { TICK_MS, speedsOf } from './update/constant.ts'

export const initialModel = (): Model => {
  const seatName = nameOf()
  const pwa = pwaSnapshot()
  return Model.make({
    route: AppRoute.Title(),
    boot: { _tag: 'Ready' },
    panel: 'none',
    shopSlot: 'cpu',
    shopFamily: 'general',
    shopMode: 'instance',
    shopQuery: '',
    shopSort: 'recommended',
    palette: EMPTY_PALETTE,
    toast: null,
    toastSeq: 0,
    board: freshBoard(newGame()),
    room: { ...EMPTY_ROOM, name: seatName, draft: seatName },
    parkedCompany: null,
    companyPhase: { _tag: 'None' },
    saves: { _tag: 'Loading' },
    draft: { name: '', logo: DEFAULT_LOGO },
    foundStep: 'company',
    saveFocus: null,
    saveConfirm: { _tag: 'List' },
    exitConfirm: null,
    founder: emptyFounder(),
    survey: EMPTY_SURVEY,
    passed: [],
    freeBoard: null,
    today: '',
    prefs: {
      locale: 'en',
      seenTradeoffs: [],
      muted: false,
      volume: 100,
      autoPause: false,
      blurPause: true,
      easyMode: false,
      motion: 'system',
      text: 'normal',
      theme: 'light',
      agentAccess: false,
      analytics: true,
      pwaPromptSeen: false,
    },
    pwa: { install: pwaFrom(pwa), online: pwa.online, updated: pwa.updated },
    settingsSection: 'sound',
    settingsOpen: false,
    runtimePicker: initStackPicker(),
    frameworkPicker: initStackPicker(),
    moreMenu: MenuControl.init('more-menu'),
  })
}

export const init = (url: Readonly<{ pathname: string }>): UpdateResult => {
  const route = urlToAppRoute(url)
  const base = initialModel()
  return {
    model: {
      ...base,
      route,
      ...(AppRoute.guards.Room(route)
        ? {
            panel: 'room' as const,
            room: { ...base.room, phase: { _tag: 'Connecting' as const, code: route.params.room } },
          }
        : {}),
      boot: onBoard(route) ? { _tag: 'Ready' } : { _tag: 'Shut' },
    },
    commands: [
      LoadSaves.make(),
      LoadSandboxStore.make(),
      LoadPrefs.make(),
      LoadFounder.make(),
      ...(AppRoute.guards.Room(route) ? [CheckRoom.make({ code: route.params.room })] : []),
      ...(url.pathname === urlOf(route) ? [] : [ReplaceUrl.make({ url: urlOf(route) })]),
    ],
  }
}

const QUIET = new Set([
  'Ticked',
  'Synced',
  'Navigated',
  'NodeSampleChosen',
  'ToastCleared',
  'AlertsAcknowledged',
  'Saved',
  'SavesLoaded',
  'CompanyLoaded',
  'CompanyUnread',
  'CompanyDeleted',
  'RuntimePickerChanged',
  'FrameworkPickerChanged',
  'PreviewComputed',
  'SurveyChanged',
  'PwaChanged',
  'PaletteQueryChanged',
  'PaletteMoved',
  'PaletteHighlighted',
])

const quiet = (model: Model, message: Message, after: Model): boolean =>
  QUIET.has(message._tag) ||
  (message._tag === 'DashboardChanged' &&
    (message.message._tag === 'Hovered' || message.message._tag === 'PostmortemChosen')) ||
  (message._tag === 'ResearchChanged' && message.message._tag === 'SheetResized') ||
  ((message._tag === 'TeamChanged' || message._tag === 'ResearchChanged') &&
    message.message._tag === 'DragChanged' &&
    after.board.game === model.board.game)

const fieldsOf = (message: Message): Record<string, unknown> =>
  Object.fromEntries(Object.entries(message).filter(([key]) => key !== '_tag'))

const surveyOf = (model: Model, after: Model, message: Message): Record<string, unknown> => {
  const exited = isExited(model.companyPhase) ? model.companyPhase : null
  if (
    message._tag !== 'SurveySent' ||
    !exited ||
    !isSending(model.survey.phase) ||
    !isSent(after.survey.phase)
  )
    return {}
  return {
    survey: {
      exit: exited.row.exit,
      stage: exited.row.stage,
      payout: exited.row.payout,
      legacy: exited.row.legacy,
      issues_chars: model.survey.issues.trim().length,
      likes_chars: model.survey.likes.trim().length,
      locale: model.prefs.locale,
    },
  }
}

const logged = (model: Model, message: Message, result: UpdateResult): UpdateResult => {
  const logs: Array<LogEntry> = []
  const after = result.model
  const time = after.board.game.time
  const raised = after.toast && after.toast.id !== model.toast?.id ? after.toast : null
  if (!quiet(model, message, after)) {
    const ledger: Ledger = ledgerOf(model)
    const refused =
      raised?.tone === 'warn' && after.board.game === model.board.game ? raised.message : undefined
    logs.push(
      line(time, message._tag, {
        ...fieldsOf(message),
        ...surveyOf(model, after, message),
        ...(refused ? { refused } : {}),
        diff: diffOf(model.board.game, after.board.game),
        ...(after.panel !== model.panel ? { panel: after.panel } : {}),
        context: contextOf(model, ledger),
      }),
    )
  }
  if (raised) logs.push(line(time, 'Toast', { message: raised.message, tone: raised.tone }))
  if (logs.length === 0) return result
  return { ...result, commands: [...(result.commands ?? []), AppendLog.make({ entries: logs })] }
}

const withUrl = (model: Model, message: Message, result: UpdateResult): UpdateResult => {
  const url = urlOf(result.model.route)
  if (message._tag === 'ChangedUrl' || url === urlOf(model.route)) return result
  const moved = (result.commands ?? []).some(
    (command) => command.name === 'PushUrl' || command.name === 'ReplaceUrl',
  )
  if (moved) return result
  return { ...result, commands: [...(result.commands ?? []), PushUrl.make({ url })] }
}

const ROUNDS = new Set(['RoundRaised', 'RoundDeclined', 'CheatRound'])

const boardChanged = (before: Model, after: Model): boolean =>
  before.board.game !== after.board.game ||
  before.prefs.locale !== after.prefs.locale ||
  before.board.region !== after.board.region ||
  before.board.selected !== after.board.selected ||
  before.board.selection !== after.board.selection ||
  before.board.flow !== after.board.flow ||
  before.board.clipboard !== after.board.clipboard ||
  before.founder.playbooks !== after.founder.playbooks ||
  before.board.nodeHistory !== after.board.nodeHistory ||
  halted(before) !== halted(after) ||
  (before.panel === 'research') !== (after.panel === 'research') ||
  cueNode(before) !== cueNode(after) ||
  (onBoard(after.route) && !onBoard(before.route))

const withBoard = (model: Model, result: UpdateResult): UpdateResult => {
  if (!boardChanged(model, result.model)) return result
  const commands = result.commands ?? []
  const fit = commands.some((command) => command.name === 'FitBoard')
  return {
    ...result,
    commands: [
      ...commands.filter((command) => command.name !== 'FitBoard'),
      sync(result.model, fit),
    ],
  }
}

const connect = (model: Model, result: UpdateResult): UpdateResult =>
  onBoard(model.route) || !onBoard(result.model.route) || model.prefs.motion === 'reduce'
    ? result
    : {
        model: withOverlay(
          { ...result.model, boot: bootStep(result.model.boot, { _tag: 'BoardOpened' }) },
          'boot',
          true,
        ),
        commands: [...(result.commands ?? []), ConnectBoard.make({})],
      }

function handle(model: Model, message: Message): UpdateResult {
  return Message.match(message, {
    ...companiesHandlers(model),
    ...sessionHandlers(model),
    ...shellHandlers(model),
    ...clockHandlers(model),
    ...keysHandlers(model, route),
    ...canvasHandlers(model, route),
    ...optionsHandlers(model),
    ...tradeoffHandlers(model, route),
    ...incidentsHandlers(model),
    ...mirrorsHandlers(model),
    ...exitHandlers(model),
    ...teamHandlers(model),
    ...panelsHandlers(model, route),
    ...paletteHandlers(model, route),
    ...saveHandlers(model, route),
    ...roomHandlers(model),
    ...pwaHandlers(model),
  })
}

function route(model: Model, message: Message): UpdateResult {
  const handled = handle(model, message)
  const result = { ...handled, model: noticed(handled.model, message) }
  if (result.model.prefs.muted || result.commands?.some((command) => command.name === 'PlaySound'))
    return result
  const cue = cueOf(model, message, result.model)
  return cue ? { ...result, commands: [...(result.commands ?? []), PlaySound.make(cue)] } : result
}

export const update = (model: Model, message: Message): UpdateResult => {
  if (model.boot._tag === 'Connecting' && message._tag === 'KeyPressed') return { model }
  const result = connect(model, withUrl(model, message, route(model, message)))
  const moved = ROUNDS.has(message._tag) && result.model.board.game.stage !== model.board.game.stage
  return logged(
    model,
    message,
    withBoard(model, moved ? milestones(model, result, [], ledgerOf(result.model)) : result),
  )
}
