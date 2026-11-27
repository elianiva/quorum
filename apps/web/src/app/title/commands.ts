import { Command } from '@effect/ui'
import { encodeText } from '@quorum/simulation/codec'
import { newGame } from '@quorum/simulation/company'
import { Founder } from '@quorum/simulation/founder'
import { solveFlow } from '@quorum/simulation/solve'
import { Effect, Result, Schema } from 'effect'
import { Locale } from '../../i18n/index.ts'
import { loadLocale } from '../../i18n/messages.ts'
import { copyIn } from '../../i18n/messages.ts'
import { setAgentAccess } from '../../game/agent-room.ts'
import { companyDb, deleteCompany, readCompany, writeCompany } from '../../game/company-files.ts'
import { EMPTY_HISTORY } from '../../game/history.ts'
import { LogoId } from '../../game/logos.ts'
import { Prefs } from '../../game/prefs-schema.ts'
import { decodeSave, readSaveFile, SAVE_FORMAT, saveFileName } from '../../game/save-file.ts'
import { saveJson } from '../../game/save-file.ts'
import {
  CompanyFile,
  fileFor,
  newSaveId,
  refreshed,
  SaveIndex,
  withFile,
} from '../../game/saves.ts'
import { setMuted, setVolume } from '../../game/sound.ts'
import { FOUNDER_KEY, PREFS_KEY, SAVE_INDEX_KEY, writeStored } from '../../game/storage.ts'
import { PRIVACY_URL, setAnalyticsEnabled, trackInstallPrompt } from '../../platform/analytics.ts'
import { promptInstall } from '../../platform/pwa.ts'
import { loadFounder, loadPassed, loadPrefs, loadSaves, today } from './data.ts'
import { TitleMessage } from './messages.ts'
import { currentOf, CurrentCompany } from './model.ts'

export const LoadSaves = Command.make('LoadSaves', {}, () =>
  Effect.sync(() => TitleMessage.SavesLoaded({ index: loadSaves() })),
)

export const LoadFounder = Command.make('LoadFounder', {}, () =>
  Effect.sync(() => {
    const founder = loadFounder()
    writeStored(FOUNDER_KEY, JSON.stringify(founder))
    return TitleMessage.FounderLoaded({ founder, today: today() })
  }),
)

export const LoadPrefs = Command.make('LoadPrefs', {}, () =>
  Effect.sync(() => {
    const prefs = loadPrefs()
    applySettings(prefs)
    return TitleMessage.PrefsLoaded({ prefs })
  }),
)

export const LoadSandbox = Command.make('LoadSandbox', {}, () =>
  Effect.sync(() => TitleMessage.SandboxLoaded({ passed: loadPassed() })),
)

export const LoadPassed = LoadSandbox

export const LoadCompany = Command.make(
  'LoadCompany',
  { args: { id: Schema.String, open: Schema.Boolean, index: SaveIndex } },
  ({ id, open, index }) =>
    Effect.promise(async () => {
      const read = await readCompany(companyDb(), id)
      if (read.json === null) return TitleMessage.CompanyUnread({ id, open })
      const parsed = readSaveFile(read.json)
      if (Result.isFailure(parsed)) return TitleMessage.CompanyUnread({ id, open })
      const next: SaveIndex = open ? { ...index, lastPlayed: id } : index
      if (open) writeStored(SAVE_INDEX_KEY, JSON.stringify(next))
      return TitleMessage.CompanyLoaded({ id, open, game: parsed.success.game, index: next })
    }),
)

const emptyInbox = {
  mail: [],
  mutes: [],
  filter: true,
  bucket: 0,
  sample: 'random',
} as const

export const newSaveJson = (game: Parameters<typeof solveFlow>[0]): string =>
  JSON.stringify(
    saveJson({
      game,
      revealed: [],
      pending: [],
      dashboard: EMPTY_HISTORY,
      inbox: emptyInbox,
    }),
  )

export const WriteCompany = Command.make(
  'WriteCompany',
  {
    args: {
      id: Schema.String,
      index: SaveIndex,
      json: Schema.String,
    },
  },
  ({ id, index, json }) =>
    Effect.promise(async () => {
      await writeCompany(companyDb(), id, json)
      writeStored(SAVE_INDEX_KEY, JSON.stringify(index))
      return TitleMessage.Synced()
    }),
)

export const WriteIndex = Command.make('WriteIndex', { args: { index: SaveIndex } }, ({ index }) =>
  Effect.sync(() => {
    writeStored(SAVE_INDEX_KEY, JSON.stringify(index))
    return TitleMessage.Synced()
  }),
)

export const WriteFounder = Command.make(
  'WriteFounder',
  { args: { founder: Founder } },
  ({ founder }) =>
    Effect.sync(() => {
      writeStored(FOUNDER_KEY, JSON.stringify(founder))
      return TitleMessage.Synced()
    }),
)

export const WritePrefs = Command.make('WritePrefs', { args: { prefs: Prefs } }, ({ prefs }) =>
  Effect.sync(() => {
    writeStored(PREFS_KEY, JSON.stringify(prefs))
    return TitleMessage.Synced()
  }),
)

const applySettings = (prefs: Prefs): void => {
  setMuted(prefs.muted)
  setVolume(prefs.volume)
  setAgentAccess(prefs.agentAccess)
  setAnalyticsEnabled(prefs.analytics)
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.lang = prefs.locale
  if (prefs.motion === 'reduce') root.dataset['motion'] = 'reduce'
  else delete root.dataset['motion']
  if (prefs.text === 'large') root.dataset['text'] = '150'
  else delete root.dataset['text']
  root.classList.toggle('dark', prefs.theme === 'dark')
}

export const ApplySettings = Command.make(
  'ApplySettings',
  { args: { prefs: Prefs } },
  ({ prefs }) =>
    Effect.sync(() => {
      applySettings(prefs)
      return TitleMessage.Synced()
    }),
)

export const LoadLocale = Command.make('LoadLocale', { args: { locale: Locale } }, ({ locale }) =>
  Effect.promise(async () => {
    await loadLocale(locale)
    return TitleMessage.Synced()
  }),
)

export const DeleteCompany = Command.make(
  'DeleteCompany',
  { args: { id: Schema.String, index: SaveIndex } },
  ({ id, index }) =>
    Effect.promise(async () => {
      await deleteCompany(companyDb(), id)
      writeStored(SAVE_INDEX_KEY, JSON.stringify(index))
      return TitleMessage.CompanyDeleted({ id })
    }),
)

export const StartCompany = Command.make(
  'StartCompany',
  {
    args: {
      id: Schema.String,
      index: SaveIndex,
      json: Schema.String,
      founder: Founder,
      current: CurrentCompany,
    },
  },
  ({ id, index, json, founder, current }) =>
    Effect.promise(async () => {
      await writeCompany(companyDb(), id, json)
      writeStored(SAVE_INDEX_KEY, JSON.stringify(index))
      writeStored(FOUNDER_KEY, JSON.stringify(founder))
      return TitleMessage.CompanyStarted({ index, current })
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

const importInto = async (
  index: SaveIndex,
  logo: LogoId,
  locale: Locale,
  text: string | null,
  asNew: boolean,
): Promise<TitleMessage> => {
  if (text === null) return TitleMessage.Synced()
  const decoded = decodeSave(text)
  if (Result.isFailure(decoded)) return TitleMessage.ImportFailed({ message: decoded.failure })
  const read = readSaveFile(decoded.success)
  if (Result.isFailure(read)) return TitleMessage.ImportFailed({ message: read.failure })
  const game = read.success.game
  const now = Date.now()
  const held = asNew ? null : (index.companies.find((file) => file.id === index.lastPlayed) ?? null)
  const file =
    held === null
      ? fileFor({
          id: newSaveId(index.companies, game.seed),
          name: copyIn(locale).title.importedCompany,
          logo,
          founding: game.founding,
          game,
          now,
        })
      : refreshed(held, game, now)
  const next: SaveIndex = { ...withFile(index, file), lastPlayed: file.id }
  const wrote = await writeCompany(companyDb(), file.id, JSON.stringify(read.success.file))
  writeStored(SAVE_INDEX_KEY, JSON.stringify(next))
  if (!wrote) return TitleMessage.ImportFailed({ message: copyIn(locale).toasts.saveFailed })
  return TitleMessage.CompanyImported({
    index: next,
    current: currentOf(file, game, solveFlow(game).latency),
  })
}

export const ImportCompanyFile = Command.make(
  'ImportCompanyFile',
  { args: { index: SaveIndex, logo: LogoId, locale: Locale } },
  ({ index, logo, locale }) =>
    Effect.promise(async () => importInto(index, logo, locale, await pickSaveText(), true)),
)

export const ImportSaveFile = Command.make(
  'ImportSaveFile',
  { args: { index: SaveIndex, logo: LogoId, locale: Locale } },
  ({ index, logo, locale }) =>
    Effect.promise(async () => importInto(index, logo, locale, await pickSaveText(), false)),
)

export const PasteSave = Command.make(
  'PasteSave',
  { args: { index: SaveIndex, logo: LogoId, locale: Locale } },
  ({ index, logo, locale }) =>
    Effect.gen(function* () {
      const text = window.prompt('Paste a save (QSV1:…)')
      return yield* Effect.promise(() => importInto(index, logo, locale, text, false))
    }),
)

const currentSave = async (index: SaveIndex) => {
  const id = index.lastPlayed
  if (id === null) return null
  const file = index.companies.find((entry) => entry.id === id)
  if (file === undefined) return null
  const read = await readCompany(companyDb(), id)
  if (read.json === null) return null
  const parsed = readSaveFile(read.json)
  if (Result.isFailure(parsed)) return null
  return { file, json: read.json, save: parsed.success }
}

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const CopySaveText = Command.make(
  'CopySaveText',
  { args: { index: SaveIndex, locale: Locale } },
  ({ index, locale }) =>
    Effect.promise(async () => {
      const held = await currentSave(index)
      const t = copyIn(locale)
      if (held === null) return TitleMessage.Noticed({ message: t.toasts.noCompanyToExport })
      const text = encodeText('QSV1:', { format: SAVE_FORMAT, save: held.save.file })
      return (await copyText(text))
        ? TitleMessage.Noticed({ message: t.toasts.copiedSave })
        : TitleMessage.Noticed({ message: t.toasts.clipboardBlocked })
    }),
)

export const DownloadSaveFile = Command.make(
  'DownloadSaveFile',
  { args: { index: SaveIndex, locale: Locale } },
  ({ index, locale }) =>
    Effect.promise(async () => {
      const held = await currentSave(index)
      if (held === null)
        return TitleMessage.Noticed({ message: copyIn(locale).toasts.noCompanyToExport })
      const text = encodeText('QSV1:', { format: SAVE_FORMAT, save: held.save.file })
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = saveFileName(held.file.name)
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      return TitleMessage.Synced()
    }),
)

export const CopyStateJson = Command.make(
  'CopyStateJson',
  { args: { index: SaveIndex, locale: Locale } },
  ({ index, locale }) =>
    Effect.promise(async () => {
      const held = await currentSave(index)
      const t = copyIn(locale)
      if (held === null) return TitleMessage.Noticed({ message: t.toasts.noCompanyToExport })
      return (await copyText(JSON.stringify(held.save.file, null, 2)))
        ? TitleMessage.Noticed({ message: t.toasts.copiedState })
        : TitleMessage.Noticed({ message: t.toasts.clipboardBlocked })
    }),
)

export const ClearNotice = Command.make(
  'ClearNotice',
  { args: { message: Schema.String } },
  ({ message }) =>
    Effect.sleep('3500 millis').pipe(Effect.as(TitleMessage.NoticeCleared({ message }))),
)

export const OpenPrivacy = Command.make('OpenPrivacy', {}, () =>
  Effect.sync(() => {
    window.location.assign(PRIVACY_URL)
    return TitleMessage.Synced()
  }),
)

export const InstallPwa = Command.make('InstallPwa', {}, () =>
  Effect.promise(async () => {
    const outcome = await promptInstall()
    trackInstallPrompt(outcome)
    return TitleMessage.PwaInstallOutcome({ outcome })
  }),
)

/* The first Company's game seed, used when nothing has been played yet. */
export const nextSeed = (seed: number | null): number => (seed ?? newGame().seed) + 7919

export type { CompanyFile, CurrentCompany, SaveIndex }
