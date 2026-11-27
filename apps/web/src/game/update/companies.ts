import type { Refusal } from '@quorum/simulation/action-kit'
import { AppRoute, routeOfMenu, urlOf } from '../route.ts'
import { Option, Result, Schema } from 'effect'
import {
  DeleteCompany,
  LoadCompany,
  KeepBrokenSave,
  WriteFounder,
  AppendLog,
  FitBoard,
  PruneSaves,
  ReplaceUrl,
} from '../commands.ts'
import { Founder, founded, foundingOf, recordExit } from '@quorum/simulation/founder'
import { Game } from '@quorum/simulation/state'
import {
  MAX_COMPANY_NAME,
  fileFor,
  fileOf,
  nameOr,
  newSaveId,
  refreshedIndex,
  withFile,
  withoutFile,
  SaveIndex,
  CompanyFile,
  EMPTY_SAVE_INDEX,
} from '../saves.ts'
import { savesOf, savesStep, withSaves } from '../saves-machine.ts'
import { foundCompany } from '@quorum/simulation/founding'
import {
  freshBoard,
  say,
  saveCommands,
  withToast,
  type AnyCommand,
  type MessageCases,
  type UpdateResult,
} from './shared.ts'
import { historyOfSave } from '../history.ts'
import { inboxOfSave } from '../inbox.ts'
import { readSaveFile } from '../save-file.ts'
import { ipoExit } from '@quorum/simulation/exit'
import {
  ledgerOf,
  Model,
  currentFile,
  EMPTY_SURVEY,
  offCompany,
  type Board,
  type Menu,
} from '../model.ts'
import { companyIdOf, isOpen, isPlaying, opened, step } from '../company-machine.ts'
import { line } from '../telemetry.ts'
import { newGame, preseedGame } from '@quorum/simulation/company'
import { normalizeOrdinals } from '@quorum/simulation/labels'
import { challengeById } from '@quorum/simulation/challenges'
import { continued, enterChallenge } from './session.ts'
import { step as confirmDeleteStep } from '../confirm-delete-machine.ts'
import { refusalIn } from '../../i18n/refusal.ts'
import { disclosureOfSave, revealAtStart } from '../reveal.ts'
import { solveFlow } from '@quorum/simulation/solve'

const startCompany = (
  model: Model,
  game: Game,
  panel: Model['panel'],
  file: CompanyFile,
): UpdateResult => {
  const fresh: Model = {
    ...model,
    route: AppRoute.Company(),
    companyPhase: opened(model.companyPhase, file.id),
    toast: null,
    panel,
    parkedCompany: null,
    saves: {
      _tag: 'Ready',
      index: { lastPlayed: file.id, companies: withFile(savesOf(model.saves), file).companies },
    },
    draft: { name: '', logo: model.draft.logo },
    saveFocus: null,
    saveConfirm: { _tag: 'List' },
    board: freshBoard(game),
  }
  const next = revealAtStart(fresh, ledgerOf(fresh))
  return {
    model: next,
    commands: [
      ...saveCommands(next),
      FitBoard({}),
      AppendLog({
        entries: [
          line(game.time, 'CompanyStarted', {
            stage: game.stage,
            seed: game.seed,
            venture: game.founding.venture,
            mutators: game.founding.mutators,
            first: savesOf(model.saves).companies.length === 0,
            viewport:
              typeof window === 'undefined' ? null : [window.innerWidth, window.innerHeight],
            agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
          }),
        ],
      }),
    ],
  }
}

const parseFounder = Schema.decodeUnknownOption(Schema.fromJsonString(Founder))

const StoredIndex = Schema.Struct({
  current: Schema.optionalKey(Schema.NullOr(Schema.String)),
  lastPlayed: Schema.optionalKey(Schema.NullOr(Schema.String)),
  companies: Schema.Array(Schema.Unknown),
})

const decodeIndex = Schema.decodeUnknownOption(Schema.fromJsonString(StoredIndex))
const HasId = Schema.Struct({ id: Schema.String })
const decodeCompanyFile = Schema.decodeUnknownOption(CompanyFile)

export const parseIndex = (text: string) =>
  Option.map(decodeIndex(text), (stored) => {
    const companies = stored.companies.flatMap((entry) =>
      Option.match(decodeCompanyFile(entry), { onNone: () => [], onSome: (file) => [file] }),
    )
    const lastPlayed = stored.lastPlayed ?? stored.current ?? null
    const index: SaveIndex = {
      lastPlayed: companies.some((file) => file.id === lastPlayed) ? lastPlayed : null,
      companies,
    }
    const held = stored.companies.flatMap((entry) =>
      Option.isNone(decodeCompanyFile(entry)) && Schema.is(HasId)(entry) ? [entry.id] : [],
    )
    return { index, held, skipped: companies.length < stored.companies.length }
  })

const titleIfBoard = (model: Model): UpdateResult =>
  model.route._tag === 'Company'
    ? {
        model: { ...model, route: AppRoute.Title() },
        commands: [ReplaceUrl({ url: urlOf(AppRoute.Title()) })],
      }
    : { model }

const dropped = (
  model: Model,
  id: string,
  kept: Readonly<{ json: string; reason: string }> | null,
  warn: boolean,
): UpdateResult => {
  const saves = withoutFile(savesOf(model.saves), id)
  const back = titleIfBoard({
    ...model,
    saves: withSaves(model.saves, saves),
    saveFocus: null,
    saveConfirm: { _tag: 'List' },
    companyPhase: step(model.companyPhase, { _tag: 'Failed', id }),
  })
  const commands: ReadonlyArray<AnyCommand> = [
    ...(kept === null ? [] : [KeepBrokenSave(kept)]),
    DeleteCompany({ id, index: saves }),
    ...(back.commands ?? []),
  ]
  if (!warn) return { model: back.model, commands }
  const said =
    kept === null ? say(model).toasts.companyMissing : say(model).toasts.unreadableCompany
  return withToast(back.model, said, 'warn', commands)
}

const applyCompany = (
  model: Model,
  id: string,
  game: Game,
  file: unknown,
  open: boolean,
): UpdateResult => {
  const loaded = step(model.companyPhase, { _tag: 'Loaded', id })
  if (!isOpen(loaded) || loaded.id !== id) return { model }
  const played = normalizeOrdinals(game)
  const inbox = inboxOfSave(file)
  const aside = offCompany(model)
  const held = aside ? (model.parkedCompany ?? model.board) : model.board
  const companyBoard: Board = {
    ...freshBoard(played),
    session: held.session,
    surface: held.surface,
    clipboard: held.clipboard,
    screenshot: held.screenshot,
    disclosure: disclosureOfSave(file),
    dashboard: {
      ...freshBoard(played).dashboard,
      range: held.dashboard.range,
      groups: held.dashboard.groups,
      compare: held.dashboard.compare,
      table: held.dashboard.table,
      history: historyOfSave(file),
    },
    game: played,
    inbox,
    clock: { ...held.clock, savedAt: played.time, sampledAt: played.time },
    whatIfsAt: -1,
  }
  const next: Model = {
    ...model,
    companyPhase: loaded,
    saves: withSaves(model.saves, { ...savesOf(model.saves), lastPlayed: id }),
    route: open && !aside ? AppRoute.Company() : model.route,
    panel: open && !aside ? 'none' : model.panel,
    saveFocus: null,
    saveConfirm: { _tag: 'List' },
    board: aside ? model.board : companyBoard,
    parkedCompany: aside ? companyBoard : model.parkedCompany,
  }
  return {
    model: { ...next, saves: withSaves(next.saves, refreshedIndex(savesOf(next.saves), played)) },
  }
}

export const changeFounder = (
  model: Model,
  change: Result.Result<Founder, Refusal>,
  done?: string,
): UpdateResult =>
  Result.match(change, {
    onFailure: (refusal) => withToast(model, refusalIn(say(model), refusal), 'warn'),
    onSuccess: (founder) => {
      const next: Model = { ...model, founder }
      const commands = [WriteFounder({ founder })]
      return done ? withToast(next, done, 'ok', commands) : { model: next, commands }
    },
  })

const found = (model: Model): UpdateResult => {
  const founder = founded(model.founder)
  const founding = foundingOf(model.founder)
  const game = foundCompany(model.board.game.seed + 7919, founding, model.founder.keep)
  const now = Date.now()
  const file = fileFor({
    id: newSaveId(savesOf(model.saves).companies, game.seed),
    name: nameOr(model.draft.name),
    logo: model.draft.logo,
    founding,
    game,
    now,
  })
  const started = startCompany({ ...model, founder }, game, game.stage >= 1 ? 'era' : 'none', file)
  return {
    ...started,
    commands: [...(started.commands ?? []), WriteFounder({ founder })],
  }
}

export const leaveExited = (model: Model, menu: Menu): UpdateResult => ({
  model: {
    ...model,
    route: routeOfMenu(menu),
    panel: 'none',
    companyPhase: step(model.companyPhase, { _tag: 'Closed' }),
    saves: withSaves(model.saves, { ...savesOf(model.saves), lastPlayed: null }),
    saveFocus: null,
    saveConfirm: { _tag: 'List' },
    survey: EMPTY_SURVEY,
    board: freshBoard(newGame(model.board.game.seed)),
  },
})

export const listed = (model: Model, game: Game): Readonly<{ game: Game; founder: Founder }> => {
  const ipo = ipoExit(game, solveFlow(game), currentFile(model)?.name ?? '')
  return { game: ipo.game, founder: recordExit(model.founder, ipo) }
}

type CompaniesTag =
  | 'SavesLoaded'
  | 'CompanyLoaded'
  | 'CompanyUnread'
  | 'CompanyNameChanged'
  | 'LogoChosen'
  | 'CompanyChosen'
  | 'CompanyClosed'
  | 'CompanyOpened'
  | 'CompanyDeleteAsked'
  | 'CompanyDeleteCancelled'
  | 'CompanyDeleteConfirmed'
  | 'CompanyDeleted'
  | 'FounderLoaded'
  | 'Saved'
  | 'SaveFailed'
  | 'CompanyFounded'
  | 'PreseedStarted'

const loadedSaves = (model: Model, index: string | null): UpdateResult => {
  if (index === null) {
    const back = titleIfBoard(model)
    return {
      ...back,
      model: {
        ...back.model,
        saves: savesStep(model.saves, { _tag: 'Loaded', index: EMPTY_SAVE_INDEX }),
      },
    }
  }
  const read = Option.getOrNull(parseIndex(index))
  if (!read) {
    const back = titleIfBoard(model)
    return withToast(back.model, say(model).toasts.unreadableList, 'warn', [
      KeepBrokenSave({ json: index, reason: 'The company list is not a save index.' }),
      ...(back.commands ?? []),
    ])
  }
  const parsed = read.index
  const keep = read.skipped
    ? [KeepBrokenSave({ json: index, reason: 'Some companies in the list could not be read.' })]
    : []
  const loaded: Model = {
    ...model,
    saves: { _tag: 'Ready', index: parsed },
    companyPhase: step(model.companyPhase, {
      _tag: 'SavesLoaded',
      current: parsed.lastPlayed,
    }),
  }
  if (parsed.lastPlayed === null) {
    const back = titleIfBoard(loaded)
    return {
      ...back,
      commands: [...keep, PruneSaves({ index: parsed, held: read.held }), ...(back.commands ?? [])],
    }
  }
  return {
    model: loaded,
    commands: [
      ...keep,
      PruneSaves({ index: parsed, held: read.held }),
      LoadCompany({ id: parsed.lastPlayed, open: model.route._tag === 'Company' }),
    ],
  }
}

export const companiesHandlers = (model: Model): MessageCases<UpdateResult, CompaniesTag> => ({
  SavesLoaded: ({ index }) => loadedSaves(model, index),
  CompanyLoaded: ({ id, open, json }) => {
    if (json === null) return dropped(model, id, null, open)
    const read = readSaveFile(json)
    if (Result.isFailure(read)) return dropped(model, id, { json, reason: read.failure }, true)
    return applyCompany(model, id, read.success.game, read.success.file, open)
  },
  CompanyUnread: ({ id, open }) => {
    const back = titleIfBoard({
      ...model,
      companyPhase: step(model.companyPhase, { _tag: 'Failed', id }),
    })
    return open
      ? withToast(back.model, say(model).toasts.companyUnread, 'warn', back.commands ?? [])
      : back
  },

  CompanyNameChanged: ({ name }) => ({
    model: { ...model, draft: { ...model.draft, name: name.slice(0, MAX_COMPANY_NAME) } },
  }),

  LogoChosen: ({ logo }) => ({ model: { ...model, draft: { ...model.draft, logo } } }),

  CompanyChosen: ({ id }) =>
    fileOf(savesOf(model.saves), id)
      ? { model: { ...model, saveFocus: id, saveConfirm: { _tag: 'List' } } }
      : { model },

  CompanyClosed: () => ({
    model: {
      ...model,
      route: AppRoute.Menu({ menu: 'companies' }),
      saveFocus: null,
      saveConfirm: { _tag: 'List' },
    },
  }),

  CompanyOpened: ({ id }) => {
    if (fileOf(savesOf(model.saves), id) === null) return { model }
    const phase = model.companyPhase
    if (isPlaying(phase) && phase.id === id)
      return continued({ ...model, saveFocus: null, saveConfirm: { _tag: 'List' } })
    return {
      model: {
        ...model,
        companyPhase: step(phase, { _tag: 'Open', id }),
        saveFocus: null,
        saveConfirm: { _tag: 'List' },
      },
      commands: [LoadCompany({ id, open: true })],
    }
  },

  CompanyDeleteAsked: () =>
    model.saveFocus === null
      ? { model }
      : {
          model: {
            ...model,
            saveConfirm: confirmDeleteStep(model.saveConfirm, {
              _tag: 'Asked',
              id: model.saveFocus,
            }),
          },
        },

  CompanyDeleteCancelled: () => ({
    model: {
      ...model,
      saveConfirm: confirmDeleteStep(model.saveConfirm, { _tag: 'Cancelled' }),
    },
  }),

  CompanyDeleteConfirmed: () => {
    const id = model.saveFocus
    if (id === null || fileOf(savesOf(model.saves), id) === null) return { model }
    const saves = withoutFile(savesOf(model.saves), id)
    const current = savesOf(model.saves).lastPlayed === id || companyIdOf(model.companyPhase) === id
    const next: Model = {
      ...model,
      saves: withSaves(model.saves, saves),
      saveFocus: null,
      saveConfirm: confirmDeleteStep(model.saveConfirm, { _tag: 'Confirmed' }),
      ...(current
        ? {
            companyPhase: step(model.companyPhase, { _tag: 'Deleted', id }),
            board: freshBoard(newGame(model.board.game.seed)),
            panel: 'none' as const,
          }
        : {}),
    }
    return { model: next, commands: [DeleteCompany({ id, index: saves })] }
  },

  CompanyDeleted: () => ({ model }),

  FounderLoaded: ({ json, deviceId, today }) => {
    const loaded = Option.getOrElse(
      json === null ? Option.none() : parseFounder(json),
      () => model.founder,
    )
    const founder = loaded.deviceId ? loaded : { ...loaded, deviceId }
    const next: Model = { ...model, founder, today }
    const commands: Array<AnyCommand> = loaded.deviceId ? [] : [WriteFounder({ founder })]
    if (model.route._tag !== 'Challenge') return { model: next, commands }
    const entry = challengeById(model.route.challenge)
    if (entry) {
      const opened = enterChallenge(next, entry.id)
      return { ...opened, commands: [...commands, ...(opened.commands ?? [])] }
    }
    const menu = AppRoute.Menu({ menu: 'challenges' })
    return {
      model: { ...next, route: menu },
      commands: [...commands, ReplaceUrl({ url: urlOf(menu) })],
    }
  },

  Saved: () => ({ model }),

  SaveFailed: () => withToast(model, say(model).toasts.saveFailed, 'warn'),

  CompanyFounded: () => found(model),

  PreseedStarted: () => {
    const founding = foundingOf(model.founder)
    const game = { ...preseedGame(model.board.game.seed + 7919), founding }
    const now = Date.now()
    const file = fileFor({
      id: newSaveId(savesOf(model.saves).companies, game.seed),
      name: nameOr(model.draft.name),
      logo: model.draft.logo,
      founding,
      game,
      now,
    })
    return startCompany(model, game, 'era', file)
  },
})
