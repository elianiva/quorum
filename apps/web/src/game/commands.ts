import { Locale } from '../i18n/index.ts'
import { copyIn } from '../i18n/messages.ts'
import { nameIn } from '../i18n/refusal.ts'
import { activityIn } from './presence.ts'
import * as Effect from 'effect/Effect'
import { Schema } from 'effect'
import { Command } from '@effect/ui'
import { fitBoard, focusBoard, repaintBoards, setBoard, zoomBoard } from '@quorum/ui/board/board'
import { solveFlow } from '@quorum/simulation/solve'
import { compute } from '@quorum/ui/board/compute'
import { nodeOrdinals } from '@quorum/simulation/labels'
import { regionView } from '@quorum/simulation/regions'
import { ComponentId, Game, RegionId } from '@quorum/simulation/state'
import { Message } from './message.ts'
import { Founder } from '@quorum/simulation/founder'
import {
  Motion,
  Prefs,
  Reveal,
  SandboxStore,
  TextSize,
  Theme,
  Tone,
  TradeoffOption,
} from './model.ts'
import { refreshed, SaveIndex } from './saves.ts'
import {
  BROKEN_SAVE_KEY,
  FOUNDER_KEY,
  holdCompanyFiles,
  PREFS_KEY,
  SANDBOX_KEY,
  SAVE_INDEX_KEY,
  readStored,
  removeStored,
  writeStored,
} from './storage.ts'
import {
  companyDb,
  deleteCompany,
  pruneCompanies,
  readCompany,
  writeCompany,
} from './company-files.ts'
import { History } from './history.ts'
import { SavedInbox } from './inbox.ts'
import { saveJson } from './save-file.ts'
import { play, setMuted, setVolume, SOUND_NAMES } from './sound.ts'
import { pruneAgentRooms, setAgentAccess } from './agent-room.ts'
import { appendLog, clearLog, downloadLog, LogEntry } from './playlog.ts'
import { linkPreviewOf } from './link-preview.ts'
import { forward, setAnalyticsEnabled } from '../platform/analytics.ts'
import { SurveySubmission } from '@quorum/rpc'
import { ClientMessage } from '@quorum/simulation/room'
import { Sample } from '@quorum/simulation/state'
import { ApiRpc } from '@/platform/rpc.ts'
import { annotateSpan, reportSurveyFailure, setSentryConsent, traced } from '../platform/sentry.ts'
import { send as sendRoom } from '../platform/room-socket.ts'

const navigate = (method: 'pushState' | 'replaceState', url: string): Effect.Effect<void> =>
  Effect.sync(() => {
    window.history[method]({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

const pushUrl = (url: string): Effect.Effect<void> => navigate('pushState', url)
const replaceUrl = (url: string): Effect.Effect<void> => navigate('replaceState', url)
const load = (href: string): Effect.Effect<void> => Effect.sync(() => window.location.assign(href))

const StampArg = Schema.NullOr(
  Schema.Array(
    Schema.Struct({
      type: ComponentId,
      dx: Schema.Finite,
      dy: Schema.Finite,
      ghost: Schema.Boolean,
    }),
  ),
)

export const SyncBoard = Command.make(
  'SyncBoard',
  {
    args: {
      game: Game,
      locale: Locale,
      selected: Schema.NullOr(Schema.String),
      selection: Schema.Array(Schema.String),
      placing: Schema.NullOr(ComponentId),
      stamp: StampArg,
      history: Schema.Record(Schema.String, Schema.Array(Schema.Finite)),
      region: RegionId,
      paused: Schema.Boolean,
      speed: Schema.Finite,
      suspended: Schema.Boolean,
      cue: Schema.NullOr(Schema.String),
      fit: Schema.Boolean,
      focus: Schema.NullOr(Schema.String),
    },
  },
  ({
    game,
    locale,
    selected,
    selection,
    placing,
    stamp,
    history,
    region,
    paused,
    speed,
    suspended,
    cue,
    fit,
    focus,
  }) =>
    Effect.sync(() => {
      setBoard('board', {
        locale,
        translate: (text) => nameIn(copyIn(locale), text),
        translateActivity: (activity) => activityIn(locale, activity),
        game: regionView(game, region),
        ordinals: nodeOrdinals(game),
        ledger: { ...solveFlow(game), bottleneck: null },
        selected,
        selection,
        placing,
        stamp,
        history,
        region,
        paused,
        speed,
        suspended,
        cue,
        linkCheck: (from, to) => linkPreviewOf(game, locale, from, to),
      })
      if (fit) fitBoard('board')
      if (focus) focusBoard('board', focus)
    }).pipe(Effect.as(Message.Synced())),
)

export const ComputePreview = Command.make(
  'ComputePreview',
  { args: { game: Game, nodeId: Schema.String, option: TradeoffOption } },
  ({ game, nodeId, option }) =>
    Effect.promise(() =>
      traced('compute.preview', {}, () => compute('preview', { game, nodeId, option })),
    ).pipe(
      Effect.map((preview) =>
        preview
          ? Message.PreviewComputed({
              nodeId,
              option,
              preview: { ...preview, burn: [...preview.burn] },
            })
          : Message.Synced(),
      ),
    ),
)

export const ComputeWhatIfs = Command.make(
  'ComputeWhatIfs',
  { args: { game: Game, nodeId: Schema.String, at: Schema.Finite } },
  ({ game, nodeId, at }) =>
    Effect.promise(() =>
      traced('compute.whatIf', {}, () => compute('whatIf', { game, nodeId })),
    ).pipe(
      Effect.map((rows) =>
        rows === undefined
          ? Message.Synced()
          : Message.WhatIfsFound({ nodeId, at, rows: rows.map((row) => ({ ...row })) }),
      ),
    ),
)

export const PushUrl = Command.make('PushUrl', { args: { url: Schema.String } }, ({ url }) =>
  pushUrl(url).pipe(Effect.as(Message.Navigated())),
)

export const ReplaceUrl = Command.make('ReplaceUrl', { args: { url: Schema.String } }, ({ url }) =>
  replaceUrl(url).pipe(Effect.as(Message.Navigated())),
)

export const LoadUrl = Command.make('LoadUrl', { args: { href: Schema.String } }, ({ href }) =>
  load(href).pipe(Effect.as(Message.Navigated())),
)

export const FitBoard = Command.make('FitBoard', { args: {} }, () =>
  Effect.sync(() => fitBoard('board')).pipe(Effect.as(Message.Synced())),
)

export const ZoomBoard = Command.make(
  'ZoomBoard',
  { args: { direction: Schema.Literals([1, -1]) } },
  ({ direction }) =>
    Effect.sync(() => zoomBoard('board', direction)).pipe(Effect.as(Message.Synced())),
)

export const PublishRoom = Command.make(
  'PublishRoom',
  {
    args: {
      name: Schema.String,
      game: Game,
      samples: Schema.Array(Sample),
      wall: Schema.Finite,
    },
  },
  ({ name, game, samples, wall }) =>
    Effect.gen(function* () {
      const rpc = yield* ApiRpc
      return yield* rpc.roomPublish({ name, game, samples, wall })
    }).pipe(
      Effect.match({
        onSuccess: ({ code, token }) => Message.RoomPublished({ code, token }),
        onFailure: (error) => Message.RoomPublishFailed({ message: error.message }),
      }),
      Effect.provide(ApiRpc.layer),
    ),
)

export const CheckRoom = Command.make('CheckRoom', { args: { code: Schema.String } }, ({ code }) =>
  Effect.gen(function* () {
    const rpc = yield* ApiRpc
    return yield* rpc.roomInfo({ code })
  }).pipe(
    Effect.match({
      onSuccess: (info) => Message.RoomChecked({ code, exists: info.exists }),
      onFailure: () => Message.RoomChecked({ code, exists: true }),
    }),
    Effect.provide(ApiRpc.layer),
  ),
)

export const SendRoom = Command.make(
  'SendRoom',
  { args: { message: ClientMessage } },
  ({ message }) => Effect.sync(() => sendRoom(message)).pipe(Effect.as(Message.RoomSent())),
)

export const LoadSaves = Command.make('LoadSaves', { args: {} }, () =>
  Effect.sync(() => Message.SavesLoaded({ index: readStored(SAVE_INDEX_KEY), now: Date.now() })),
)

export const PruneSaves = Command.make(
  'PruneSaves',
  { args: { index: SaveIndex, held: Schema.Array(Schema.String) } },
  ({ index, held }) =>
    Effect.promise(async () => {
      holdCompanyFiles(held)
      pruneAgentRooms(new Set(index.companies.map((file) => file.id)))
      await pruneCompanies(companyDb(), index)
      return Message.Synced()
    }),
)

export const LoadCompany = Command.make(
  'LoadCompany',
  { args: { id: Schema.String, open: Schema.Boolean } },
  ({ id, open }) =>
    Effect.promise(async () => {
      const read = await readCompany(companyDb(), id)
      return read.unread
        ? Message.CompanyUnread({ id, open })
        : Message.CompanyLoaded({ id, open, json: read.json })
    }),
)

export const WriteCompany = Command.make(
  'WriteCompany',
  {
    args: {
      id: Schema.String,
      index: SaveIndex,
      game: Game,
      revealed: Schema.Array(Reveal),
      pending: Schema.Array(Reveal),
      dashboard: History,
      inbox: SavedInbox,
      closing: Schema.optionalKey(Schema.Boolean),
    },
  },
  ({ id, index, game, revealed, pending, dashboard, inbox, closing }) =>
    Effect.promise(async () => {
      const file = index.companies.find((entry) => entry.id === id)
      if (!file) return Message.SaveFailed()
      const stamped = refreshed(file, game, Date.now())
      const json = JSON.stringify(saveJson({ game, revealed, pending, dashboard, inbox }))
      const wrote = await traced('save.write', {}, () => {
        annotateSpan({ 'save.bytes': json.length })
        return writeCompany(companyDb(), id, json, closing)
      })
      return wrote &&
        writeStored(
          SAVE_INDEX_KEY,
          JSON.stringify({
            ...index,
            companies: index.companies.map((entry) => (entry.id === id ? stamped : entry)),
          }),
        )
        ? Message.Saved()
        : Message.SaveFailed()
    }),
)

export const DeleteCompany = Command.make(
  'DeleteCompany',
  { args: { id: Schema.String, index: SaveIndex } },
  ({ id, index }) =>
    Effect.promise(async () => {
      await deleteCompany(companyDb(), id)
      writeStored(SAVE_INDEX_KEY, JSON.stringify(index))
      return Message.CompanyDeleted({ id })
    }),
)

export const KeepBrokenSave = Command.make(
  'KeepBrokenSave',
  { args: { json: Schema.String, reason: Schema.String } },
  ({ json, reason }) =>
    Effect.sync(() => {
      console.error('The save could not be read:', reason)
      writeStored(BROKEN_SAVE_KEY, json)
      return Message.Synced()
    }),
)

export const ClearBrokenSave = Command.make('ClearBrokenSave', { args: {} }, () =>
  Effect.sync(() => {
    removeStored(BROKEN_SAVE_KEY)
    return Message.Synced()
  }),
)

export const LoadSandboxStore = Command.make('LoadSandboxStore', { args: {} }, () =>
  Effect.sync(() => Message.SandboxStoreLoaded({ json: readStored(SANDBOX_KEY) })),
)

export const WriteSandboxStore = Command.make(
  'WriteSandboxStore',
  { args: { store: SandboxStore } },
  ({ store }) =>
    Effect.sync(() => {
      writeStored(SANDBOX_KEY, JSON.stringify(store))
      return Message.Synced()
    }),
)

export const LoadPrefs = Command.make('LoadPrefs', { args: {} }, () =>
  Effect.sync(() => Message.PrefsLoaded({ json: readStored(PREFS_KEY) })),
)

export const WritePrefs = Command.make('WritePrefs', { args: { prefs: Prefs } }, ({ prefs }) =>
  Effect.sync(() => {
    writeStored(PREFS_KEY, JSON.stringify(prefs))
    return Message.Synced()
  }),
)

export type Settings = Readonly<{
  muted: boolean
  volume: number
  motion: Motion
  locale: Locale
  agentAccess: boolean
  text: TextSize
  theme: Theme
  analytics: boolean
}>

export const applySettings = (root: HTMLElement, settings: Settings): void => {
  setMuted(settings.muted)
  setVolume(settings.volume)
  setAgentAccess(settings.agentAccess)
  setAnalyticsEnabled(settings.analytics)
  setSentryConsent(settings.analytics)
  root.lang = settings.locale
  if (settings.motion === 'reduce') root.dataset['motion'] = 'reduce'
  else delete root.dataset['motion']
  if (settings.text === 'large') root.dataset['text'] = '150'
  else delete root.dataset['text']
  root.classList.toggle('dark', settings.theme === 'dark')
}

export const ApplySettings = Command.make(
  'ApplySettings',
  {
    args: {
      muted: Schema.Boolean,
      volume: Schema.Finite,
      motion: Motion,
      locale: Locale,
      agentAccess: Schema.Boolean,
      analytics: Schema.Boolean,
      text: TextSize,
      theme: Theme,
    },
  },
  (settings) =>
    Effect.sync(() => {
      const root = document.documentElement
      const wasDark = root.classList.contains('dark')
      applySettings(root, settings)
      if (wasDark !== (settings.theme === 'dark')) repaintBoards()
      return Message.Synced()
    }),
)

export const FocusInspector = Command.make('FocusInspector', { args: {} }, () =>
  Effect.sync(() => {
    document
      .querySelector<HTMLElement>(
        '[data-inspector] :is(button, [href], input, select, [tabindex]):not([disabled])',
      )
      ?.focus()
    return Message.Synced()
  }),
)

export const FocusDashboard = Command.make(
  'FocusDashboard',
  { args: { focus: Schema.optionalKey(Schema.String) } },
  ({ focus }) =>
    Effect.promise(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
      document.querySelector<HTMLElement>('[data-scroll="dashboard"]')?.focus()
      if (focus !== undefined)
        document.querySelector<HTMLElement>(`[data-panel="${focus}"]`)?.scrollIntoView({
          block: 'start',
        })
      return Message.Synced()
    }),
)

export const ToggleFullscreen = Command.make('ToggleFullscreen', { args: {} }, () =>
  Effect.promise(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {}
    return Message.Synced()
  }),
)

export const TOAST_MS: Record<Tone, number> = {
  plain: 2600,
  ok: 2600,
  warn: 5200,
  danger: 7000,
  primary: 3400,
}

export const ClearToast = Command.make(
  'ClearToast',
  { args: { id: Schema.Finite, after: Schema.Finite } },
  ({ id, after }) =>
    Effect.sleep(`${Math.round(after)} millis`).pipe(Effect.as(Message.ToastCleared({ id }))),
)

export const RevealTitle = Command.make('RevealTitle', { args: {} }, () =>
  Effect.sleep('1100 millis').pipe(Effect.as(Message.TitleRevealed())),
)

export const ConnectBoard = Command.make('ConnectBoard', { args: {} }, () =>
  Effect.sleep('1200 millis').pipe(Effect.as(Message.Connected())),
)

export const AppendLog = Command.make(
  'AppendLog',
  { args: { entries: Schema.Array(LogEntry) } },
  ({ entries }) =>
    Effect.sync(() => {
      appendLog(entries)
      forward(entries)
    }).pipe(Effect.as(Message.Synced())),
)

export const ExportLog = Command.make('ExportLog', { args: {} }, () =>
  Effect.sync(() => downloadLog()).pipe(Effect.as(Message.Synced())),
)

export const ClearLog = Command.make('ClearLog', { args: {} }, () =>
  Effect.sync(() => clearLog()).pipe(Effect.as(Message.Synced())),
)

export const PlaySound = Command.make(
  'PlaySound',
  { args: { sound: Schema.Literals(SOUND_NAMES), pitch: Schema.Finite, spatial: Schema.Boolean } },
  ({ sound, pitch, spatial }) =>
    Effect.sync(() => play(sound, pitch, spatial)).pipe(Effect.as(Message.Synced())),
)

export const LoadFounder = Command.make('LoadFounder', { args: {} }, () =>
  Effect.sync(() => {
    const deviceId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    const fresh = { deviceId, today: new Date().toISOString().slice(0, 10) }
    return Message.FounderLoaded({ json: readStored(FOUNDER_KEY), ...fresh })
  }),
)

export const WriteFounder = Command.make(
  'WriteFounder',
  { args: { founder: Founder } },
  ({ founder }) =>
    Effect.sync(() => {
      writeStored(FOUNDER_KEY, JSON.stringify(founder))
      return Message.Synced()
    }),
)

export const CopyText = Command.make(
  'CopyText',
  { args: { text: Schema.String, done: Schema.String, blocked: Schema.String } },
  ({ text, done, blocked }) =>
    Effect.promise(async () => {
      try {
        await navigator.clipboard.writeText(text)
        return Message.ToastRaised({ message: done, tone: 'ok' })
      } catch {
        return Message.ToastRaised({ message: blocked, tone: 'warn' })
      }
    }),
)

export const AskSaveImport = Command.make('AskSaveImport', { args: {} }, () =>
  Effect.sync(() => Message.SaveImported({ text: window.prompt('Paste a save (QSV1:…)') })),
)

export const DownloadSave = Command.make(
  'DownloadSave',
  { args: { text: Schema.String, name: Schema.String } },
  ({ text, name }) =>
    Effect.sync(() => {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      return Message.Synced()
    }),
)

const pickSaveText = (): Promise<string | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.hidden = true
    input.accept = '.txt,.json,text/plain,application/json'
    const done = (text: string | null): void => {
      input.remove()
      resolve(text)
    }
    input.addEventListener('cancel', () => done(null))
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return done(null)
      void file.text().then(done, () => done(null))
    })
    document.body.append(input)
    input.click()
  })

export const PickSaveFile = Command.make(
  'PickSaveFile',
  { args: { as: Schema.Literals(['save', 'company']) } },
  ({ as }) =>
    Effect.promise(async () => {
      const text = await pickSaveText()
      return as === 'company' ? Message.CompanyImported({ text }) : Message.SaveImported({ text })
    }),
)

export const AskPlaybook = Command.make('AskPlaybook', { args: {} }, () =>
  Effect.sync(() => Message.PlaybookImported({ text: window.prompt('Paste a Playbook (QPB1:…)') })),
)

export const SubmitSurvey = Command.make(
  'SubmitSurvey',
  { args: { submission: SurveySubmission } },
  ({ submission }) =>
    Effect.gen(function* () {
      const rpc = yield* ApiRpc
      return yield* rpc.surveySubmit(submission)
    }).pipe(
      Effect.tapError((error) => Effect.sync(() => reportSurveyFailure(error, submission.exit))),
      Effect.match({
        onSuccess: () => Message.SurveySent(),
        onFailure: (error) =>
          Message.SurveyFailed({
            message: error.message,
            offline: error._tag !== 'ApiError',
          }),
      }),
      Effect.provide(ApiRpc.layer),
    ),
)
