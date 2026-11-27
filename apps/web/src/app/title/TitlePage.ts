import { Command, Component, Mount, Router, Subscription } from '@effect/ui'
import type { View } from '@effect/ui'
import { Html } from '@effect/ui/html'
import type { H } from '@effect/ui/html/Html'
import { Effect, Queue, Result, Schema, Stream } from 'effect'
import { cx, css } from '@quorum/styled-system/css'
import { kbdClass } from '@quorum/ui/primitives/kbd'
import {
  buyPerk,
  chooseVenture,
  founded,
  foundingOf,
  toggleMutator,
} from '@quorum/simulation/founder'
import { foundCompany } from '@quorum/simulation/founding'
import { preseedGame } from '@quorum/simulation/company'
import { solveFlow } from '@quorum/simulation/solve'
import { ArrowUpRight, BookOpen, Coffee } from 'lucide'
import { siGithub } from 'simple-icons'
import { copyIn } from '../../i18n/messages.ts'
import { refusalIn } from '../../i18n/refusal.ts'
import { Locale } from '../../i18n/index.ts'
import { fileOf, fileFor, newSaveId, withFile, MAX_COMPANY_NAME, nameOr } from '../../game/saves.ts'
import { Game } from '@quorum/simulation/state'
import { savesOf } from '../../game/saves-machine.ts'
import { pwaStep } from '../../game/pwa-machine.ts'
import { step as confirmDeleteStep } from '../../game/confirm-delete-machine.ts'
import { volumeIn } from '../../game/prefs-schema.ts'
import { DISCLAIMER_URL, SOURCE_URL, WIKI_URL } from '../../platform/analytics.ts'
import { watchPwa } from '../../platform/pwa.ts'
import * as S from '../../game/title-styles.ts'
import { AppRoute } from '../routes.ts'
import { icon } from '../ui/icon.ts'
import { play } from '../../game/sound.ts'
import {
  ApplySettings,
  ClearNotice,
  CopySaveText,
  CopyStateJson,
  DeleteCompany,
  DownloadSaveFile,
  ImportCompanyFile,
  ImportSaveFile,
  InstallPwa,
  LoadCompany,
  LoadFounder,
  LoadLocale,
  LoadPassed,
  LoadPrefs,
  LoadSaves,
  OpenPrivacy,
  PasteSave,
  StartCompany,
  WriteFounder,
  WritePrefs,
  newSaveJson,
  nextSeed,
} from './commands.ts'
import { MenuChoice, TitleMessage } from './messages.ts'
import { initialTitle, currentOf, TitleModel } from './model.ts'
import {
  FocusFirst,
  fromOf,
  mainPage,
  memoryOf,
  pageOf,
  subPage,
  trailOf,
  type Page,
} from './pages.ts'
import { TreeCamera } from './camera.ts'
import { WallClock } from './Splash.ts'

const STAGE = css({
  height: '100dvh',
  width: '100%',
  overflow: 'hidden',
  backgroundColor: 'background',
  color: 'foreground',
  userSelect: 'none',
})

const githubMark = <Msg>(h: H<Msg>): View.Content<Msg> =>
  h.svg
    .class(css({ width: '16px', height: '16px', flexShrink: '0' }))
    .attr('viewBox', '0 0 24 24')
    .attr('fill', 'currentColor')
    .attr('aria-hidden', 'true')
    .children(h.path.attr('d', siGithub.path).children())

const toolbar = (h: H<TitleMessage>, t: ReturnType<typeof copyIn>): View.Content<TitleMessage> => {
  const release: string | undefined = import.meta.env.VITE_SENTRY_RELEASE
  const build = release === undefined || release === '' ? 'dev' : release.slice(0, 7)
  const tools: ReadonlyArray<View.Content<TitleMessage>> = [
    h.a
      .class(cx(S.TOOL, 'is-wide'))
      .attr('href', build === 'dev' ? SOURCE_URL : `${SOURCE_URL}/commit/${release}`)
      .attr('target', '_blank')
      .attr('rel', 'noreferrer noopener')
      .attr('aria-label', `${t.title.build} ${build}`)
      .attr('title', `${t.title.build} ${build}`)
      .children(h.span.class(S.BUILD).children(build)),
    h.a
      .class(cx(S.TOOL, 'is-wide'))
      .attr('href', `${SOURCE_URL}/issues`)
      .attr('target', '_blank')
      .attr('rel', 'noreferrer noopener')
      .attr('aria-label', t.title.feedback)
      .attr('title', t.title.feedback)
      .children(
        h.span.class(S.TOOL_LABEL).children(t.title.feedback),
        icon(h, ArrowUpRight, S.ICON),
      ),
    h.a
      .class(S.TOOL)
      .attr('href', 'https://ko-fi.com/elianiva')
      .attr('target', '_blank')
      .attr('rel', 'noreferrer noopener')
      .attr('aria-label', t.title.supportOnKofi)
      .attr('title', t.title.supportOnKofi)
      .children(icon(h, Coffee, S.ICON)),
    h.a
      .class(S.TOOL)
      .attr('href', SOURCE_URL)
      .attr('target', '_blank')
      .attr('rel', 'noreferrer noopener')
      .attr('aria-label', t.title.openSourceOnGitHub)
      .attr('title', t.title.openSourceOnGitHub)
      .children(githubMark(h)),
  ]
  return h.header.class(S.BAR).children(
    h.span.children(),
    h.nav
      .class(S.TOOLS)
      .attr('aria-label', t.title.taskbar)
      .children(...tools),
  )
}

const dock = (
  h: H<TitleMessage>,
  t: ReturnType<typeof copyIn>,
  locale: Locale,
  page: Page,
): View.Content<TitleMessage> => {
  const keys: ReadonlyArray<readonly [string, string]> = [
    ['↑↓', t.title.select],
    [t.title.enter, t.title.open],
    ...(page === 'main' ? [] : ([[t.title.esc, t.title.back]] as const)),
  ]
  return h.footer.class(S.DOCK).children(
    h.div
      .class(S.KEYS)
      .attr('aria-hidden', 'true')
      .children(
        ...keys.map(([key, label]) =>
          h.span.class(S.KEY).children(h.kbd.class(kbdClass).children(key), h.span.children(label)),
        ),
      ),
    h.a
      .class(S.DISCLAIMER)
      .attr('href', DISCLAIMER_URL)
      .attr('target', '_blank')
      .attr('rel', 'noreferrer noopener')
      .children(t.title.quorumIsAGameAndSimplifies),
    h.nav.class(S.DOCK_TOOLS).children(
      h.a
        .class(cx(S.TOOL, 'is-wide'))
        .attr('href', WIKI_URL)
        .attr('target', '_blank')
        .attr('rel', 'noreferrer noopener')
        .attr('aria-label', t.title.wiki)
        .attr('title', t.title.wiki)
        .children(icon(h, BookOpen, S.ICON), h.span.class(S.TOOL_LABEL).children(t.title.wiki)),
      h.span.class(S.CLOCK).onMount(WallClock({ locale })).children('--:--'),
    ),
  )
}

const column = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: ReturnType<typeof copyIn>,
  menu: MenuChoice,
  page: Page,
  depth: number,
  last: number,
): View.Content<TitleMessage> => {
  const from = fromOf(model, page)
  return h.div
    .key(depth === 0 ? 'root' : memoryOf(model, page))
    .class(
      cx(
        S.PAGE,
        page === 'main' ? 'is-main' : 'is-sub',
        (page === 'settings' || page === 'companies') && 'is-list',
        depth === last && 'is-active',
      ),
    )
    .style({ '--d': `${depth}` })
    .attr('data-page', page)
    .attr('data-memory', memoryOf(model, page))
    .attr('data-depth', `${depth}`)
    .attr('data-from', from === null ? undefined : from)
    .onMount(FocusFirst({}))
    .children(page === 'main' ? mainPage(h, model, menu, t) : subPage(h, model, page, t))
}

const screen = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: ReturnType<typeof copyIn>,
  menu: MenuChoice,
): View.Content<TitleMessage> => {
  const page = pageOf(model, menu)
  const trail = trailOf(page)
  return h.div
    .class(S.STAGE)
    .onMount(TreeCamera({}))
    .children(
      h.div
        .class(S.WORLD)
        .attr('data-depth', `${trail.length - 1}`)
        .children(
          h.svg.key('wires').class(S.WIRES).attr('aria-hidden', 'true').children(),
          h.div
            .key('ghosts')
            .class(S.GHOSTS)
            .attr('aria-hidden', 'true')
            .attr('inert', '')
            .children(),
          ...trail.map((entry, depth) => column(h, model, t, menu, entry, depth, trail.length - 1)),
        ),
    )
}

/* The keyboard the dock advertises: arrows walk the open column, Enter and
   Space press the line that holds the focus, Escape goes back, and a digit
   jumps to the line carrying it. A grid moves by where its cells sit. */
const NAV = '[data-nav], .qm-setting :is([role="switch"], [role="slider"], button)'
const ACTIVE = '.qm-page.is-active'

const shown = (element: HTMLElement) =>
  element.getClientRects().length > 0 && !(element as HTMLButtonElement).disabled

const stopsOf = (root: ParentNode, from: Element | null): ReadonlyArray<HTMLElement> =>
  [...root.querySelectorAll<HTMLElement>(`${ACTIVE} :is(${NAV})`)].filter(
    (element) =>
      shown(element) &&
      (element.getAttribute('role') !== 'tab' ||
        element.getAttribute('aria-selected') === 'true' ||
        element === from),
  )

const nearest = (
  cells: ReadonlyArray<HTMLElement>,
  from: HTMLElement,
  key: string,
): HTMLElement | null => {
  const box = from.getBoundingClientRect()
  const x = box.left + box.width / 2
  const y = box.top + box.height / 2
  const slack = 2
  let best: HTMLElement | null = null
  let bestScore = Infinity
  for (const cell of cells) {
    if (cell === from) continue
    const at = cell.getBoundingClientRect()
    const ahead =
      key === 'ArrowDown'
        ? at.top >= box.bottom - slack
        : key === 'ArrowUp'
          ? at.bottom <= box.top + slack
          : key === 'ArrowRight'
            ? at.left >= box.right - slack && at.top < box.bottom && at.bottom > box.top
            : at.right <= box.left + slack && at.top < box.bottom && at.bottom > box.top
    if (!ahead) continue
    const dx = Math.abs(at.left + at.width / 2 - x)
    const dy = Math.abs(at.top + at.height / 2 - y)
    const score = key === 'ArrowDown' || key === 'ArrowUp' ? dy * 2 + dx : dx * 2 + dy
    if (score < bestScore) {
      bestScore = score
      best = cell
    }
  }
  return best
}

const SCALE = [0, 2, 4, 7, 9, 12]
const pitchOf = (line: Element): number => {
  const page = line.closest('.qm-page')
  const stops = page ? [...page.querySelectorAll(NAV)] : []
  const index = Math.max(0, stops.indexOf(line))
  return 2 ** (SCALE[index % SCALE.length]! / 12)
}

const move = (to: HTMLElement | undefined) => {
  if (!to) return
  to.focus({ preventScroll: true })
  play('hover', pitchOf(to))
}

const MenuDriver = Mount.make('TitleMenuDriver', {}, (element: HTMLElement) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const onKeyDown = (event: KeyboardEvent) => {
            if (event.altKey || event.metaKey || event.ctrlKey || event.defaultPrevented) return
            const target = event.target instanceof HTMLElement ? event.target : null
            if (target && target !== document.body && !element.contains(target)) return
            if (
              target?.closest('[role="listbox"]') ||
              target?.getAttribute('aria-expanded') === 'true'
            )
              return
            const key = event.key
            const vertical = key === 'ArrowDown' || key === 'ArrowUp'
            const arrow = vertical || key === 'ArrowLeft' || key === 'ArrowRight'
            const active = target && target !== document.body ? target : null
            const stops = stopsOf(element, active)
            const at = active ? stops.indexOf(active) : -1
            const linear = (step: number) => {
              if (stops.length === 0) return
              event.preventDefault()
              event.stopPropagation()
              move(stops[at < 0 ? 0 : (at + step + stops.length) % stops.length])
            }

            if (active instanceof HTMLInputElement && active.type === 'text') {
              if (key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                active.blur()
              } else if (vertical || key === 'Enter') linear(key === 'ArrowUp' ? -1 : 1)
              return
            }

            if (active?.getAttribute('role') === 'slider' && key !== 'Escape') {
              if (vertical) linear(key === 'ArrowUp' ? -1 : 1)
              return
            }

            if (active?.getAttribute('role') === 'tab' && !vertical && arrow) {
              event.preventDefault()
              const tabs = [
                ...(active.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []),
              ]
              const next =
                tabs[
                  (tabs.indexOf(active) + (key === 'ArrowLeft' ? -1 : 1) + tabs.length) %
                    tabs.length
                ]
              if (next && next !== active) {
                next.focus({ preventScroll: true })
                next.click()
              }
              return
            }

            const grid = active?.closest<HTMLElement>('[data-grid]')
            if (grid && active && arrow) {
              const cells = [...grid.querySelectorAll<HTMLElement>(NAV)].filter(shown)
              const next = nearest(cells, active, key)
              event.preventDefault()
              event.stopPropagation()
              if (next) return move(next)
              if (!vertical) return
              const first = stops.indexOf(cells[0]!)
              const last = stops.indexOf(cells[cells.length - 1]!)
              const out =
                key === 'ArrowDown'
                  ? (stops[last + 1] ?? stops[0])
                  : (stops[first - 1] ?? stops.at(-1))
              return move(out)
            }

            if (vertical) return linear(key === 'ArrowUp' ? -1 : 1)

            if ((key === 'Enter' || key === ' ') && active === null) return linear(0)

            if (
              (key === 'Enter' || key === ' ') &&
              active &&
              (active instanceof HTMLButtonElement || active.getAttribute('role') === 'button')
            ) {
              event.preventDefault()
              event.stopPropagation()
              active.click()
              return
            }

            if (key === 'ArrowRight' && active?.hasAttribute('data-branch')) {
              event.preventDefault()
              event.stopPropagation()
              active.click()
              return
            }

            if (key === 'Escape' || key === 'Backspace' || key === 'ArrowLeft') {
              const back = element.querySelector<HTMLElement>(`${ACTIVE} [data-back]`)
              if (back) {
                event.preventDefault()
                event.stopPropagation()
                back.click()
              }
              return
            }

            if (/^[1-9]$/.test(key)) {
              const line = element.querySelector<HTMLElement>(`${ACTIVE} [data-hotkey="${key}"]`)
              if (line && shown(line)) {
                event.preventDefault()
                event.stopPropagation()
                line.focus({ preventScroll: true })
                line.click()
              }
            }
          }
          const onPointerOver = (event: Event) => {
            if (!(event instanceof PointerEvent) || event.pointerType !== 'mouse') return
            const line = event.target instanceof Element ? event.target.closest(NAV) : null
            if (!line) return
            const from = event.relatedTarget instanceof Node ? event.relatedTarget : null
            if (from && line.contains(from)) return
            play('hover', pitchOf(line))
          }
          const onClick = (event: Event) => {
            if (event.target instanceof Element && event.target.closest('button')) play('choose')
          }
          window.addEventListener('keydown', onKeyDown, true)
          element.addEventListener('pointerover', onPointerOver)
          element.addEventListener('click', onClick)
          return () => {
            window.removeEventListener('keydown', onKeyDown, true)
            element.removeEventListener('pointerover', onPointerOver)
            element.removeEventListener('click', onClick)
          }
        }),
        (cleanup) => Effect.sync(cleanup),
      )
      return yield* Effect.never
    }),
  ).pipe(Effect.as(Component.noop)),
)

const savedCompany = (model: TitleModel, index: ReturnType<typeof savesOf>, game: Game) => {
  const file = index.companies.find((entry) => entry.id === index.lastPlayed)
  return file === undefined ? null : currentOf(file, game, solveFlow(game).latency)
}

const startCommand = (model: TitleModel, preseed: boolean) => {
  const founder = founded(model.founder)
  const founding = foundingOf(model.founder)
  const seed = nextSeed(model.current?.seed ?? null)
  const game = preseed
    ? { ...preseedGame(seed), founding }
    : foundCompany(seed, founding, model.founder.keep)
  const now = Date.now()
  const file = fileFor({
    id: newSaveId(savesOf(model.saves).companies, game.seed),
    name: nameOr(model.draft.name),
    logo: model.draft.logo,
    founding,
    game,
    now,
  })
  const index = {
    lastPlayed: file.id,
    companies: withFile(savesOf(model.saves), file).companies,
  }
  return StartCompany.make({
    id: file.id,
    index,
    json: newSaveJson(game),
    founder,
    current: currentOf(file, game, solveFlow(game).latency),
  })
}

export const TitlePage = Html.component({
  name: 'TitlePage',
  props: Schema.Struct({ menu: MenuChoice }),
  model: TitleModel,
  message: TitleMessage,
}).make({
  init: ($) =>
    $.set(initialTitle()).run(
      LoadSaves.make(),
      LoadFounder.make(),
      LoadPrefs.make(),
      LoadPassed.make(),
    ),

  update: {
    SavesLoaded: ($, { index }) => {
      const next = $.set({
        ...$.model,
        saves: { _tag: 'Ready', index },
        current: null,
      })
      const file = fileOf(index, index.lastPlayed)
      return file === null ? next : next.run(LoadCompany.make({ id: file.id, open: false, index }))
    },

    FounderLoaded: ($, { founder, today }) => $.evolve({ founder, today }),

    PrefsLoaded: ($, { prefs }) => $.evolve({ prefs }),

    SandboxLoaded: ($, { passed }) => $.evolve({ passed }),

    PwaChanged: ($, { installable, installed }) =>
      $.evolve({
        pwa: pwaStep($.model.pwa, { _tag: 'Snapshot', installable, installed }),
      }),

    MenuChosen: ($, { menu }) =>
      $.run(
        Router.push(
          AppRoute,
          menu === 'main' ? AppRoute.Title() : AppRoute.Menu({ params: { menu } }),
        ).pipe(Command.asNoop),
      ),

    Continued: ($) => {
      const index = savesOf($.model.saves)
      const file = fileOf(index, index.lastPlayed)
      return file === null
        ? $.evolve({})
        : $.run(LoadCompany.make({ id: file.id, open: true, index }))
    },

    CompanyChosen: ($, { id }) =>
      fileOf(savesOf($.model.saves), id) === null
        ? $.evolve({})
        : $.evolve({ saveFocus: id, saveConfirm: { _tag: 'List' } }),

    CompanyClosed: ($) => $.evolve({ saveFocus: null, saveConfirm: { _tag: 'List' } }),

    CompanyOpened: ($, { id }) => {
      const index = savesOf($.model.saves)
      return fileOf(index, id) === null
        ? $.evolve({})
        : $.run(LoadCompany.make({ id, open: true, index }))
    },

    CompanyLoaded: ($, { game, index, open }) => {
      const current = savedCompany($.model, index, game)
      const next = $.set({
        ...$.model,
        saves: { _tag: 'Ready', index },
        current,
        saveFocus: null,
        saveConfirm: { _tag: 'List' },
        notice: null,
      })
      return open ? next.run(Router.push(AppRoute, AppRoute.Company()).pipe(Command.asNoop)) : next
    },

    CompanyUnread: ($) => {
      const message = copyIn($.model.prefs.locale).toasts.companyUnread
      return $.evolve({ notice: message }).run(ClearNotice.make({ message }))
    },

    CompanyDeleteAsked: ($) =>
      $.model.saveFocus === null
        ? $.evolve({})
        : $.evolve({
            saveConfirm: confirmDeleteStep($.model.saveConfirm, {
              _tag: 'Asked',
              id: $.model.saveFocus,
            }),
          }),

    CompanyDeleteCancelled: ($) =>
      $.evolve({
        saveConfirm: confirmDeleteStep($.model.saveConfirm, { _tag: 'Cancelled' }),
      }),

    CompanyDeleteConfirmed: ($) => {
      const id = $.model.saveFocus
      if (id === null) return $.evolve({})
      const saves = savesOf($.model.saves)
      if (fileOf(saves, id) === null) return $.evolve({})
      const without = {
        ...saves,
        lastPlayed: saves.lastPlayed === id ? null : saves.lastPlayed,
        companies: saves.companies.filter((file) => file.id !== id),
      }
      const next = $.set({
        ...$.model,
        saves: { _tag: 'Ready', index: without },
        current: $.model.current?.id === id ? null : $.model.current,
        saveFocus: null,
        saveConfirm: { _tag: 'List' },
      })
      return next.run(DeleteCompany.make({ id, index: without }))
    },

    CompanyDeleted: ($) => $.evolve({}),

    CompanyImported: ($, { index, current }) =>
      $.set({
        ...$.model,
        saves: { _tag: 'Ready', index },
        current,
        saveFocus: null,
        saveConfirm: { _tag: 'List' },
        notice: null,
      }).run(Router.push(AppRoute, AppRoute.Company()).pipe(Command.asNoop)),

    SaveImported: ($, { index, current }) =>
      $.set({
        ...$.model,
        saves: { _tag: 'Ready', index },
        current,
        saveFocus: null,
        saveConfirm: { _tag: 'List' },
        notice: null,
      }).run(Router.push(AppRoute, AppRoute.Company()).pipe(Command.asNoop)),

    ImportFailed: ($, { message }) =>
      $.evolve({ notice: message }).run(ClearNotice.make({ message })),

    CompanyFileAsked: ($) =>
      $.run(
        ImportCompanyFile.make({
          index: savesOf($.model.saves),
          logo: $.model.draft.logo,
          locale: $.model.prefs.locale,
        }),
      ),

    CompanyNameChanged: ($, { name }) =>
      $.evolve({ draft: { ...$.model.draft, name: name.slice(0, MAX_COMPANY_NAME) } }),

    LogoChosen: ($, { logo }) => $.evolve({ draft: { ...$.model.draft, logo } }),

    VentureChosen: ($, { id }) => {
      const result = chooseVenture($.model.founder, id)
      if (Result.isFailure(result)) {
        return $.evolve({ notice: refusalIn(copyIn($.model.prefs.locale), result.failure) })
      }
      const founder = result.success
      return $.evolve({ founder }).run(WriteFounder.make({ founder }))
    },

    MutatorToggled: ($, { id }) => {
      const result = toggleMutator($.model.founder, id)
      if (Result.isFailure(result)) {
        return $.evolve({ notice: refusalIn(copyIn($.model.prefs.locale), result.failure) })
      }
      const founder = result.success
      return $.evolve({ founder }).run(WriteFounder.make({ founder }))
    },

    FoundStepChosen: ($, { step }) => $.evolve({ foundStep: step }),

    CompanyFounded: ($) => $.run(startCommand($.model, false)),

    PreseedStarted: ($) => $.run(startCommand($.model, true)),

    CompanyStarted: ($, { index, current }) =>
      $.set({
        ...$.model,
        saves: { _tag: 'Ready', index },
        current,
        founder: founded($.model.founder),
        draft: { name: '', logo: $.model.draft.logo },
        foundStep: 'company',
        saveFocus: null,
        saveConfirm: { _tag: 'List' },
        notice: null,
      }).run(Router.push(AppRoute, AppRoute.Company()).pipe(Command.asNoop)),

    PerkBought: ($, { id }) => {
      const result = buyPerk($.model.founder, id)
      if (Result.isFailure(result)) {
        const message = refusalIn(copyIn($.model.prefs.locale), result.failure)
        return $.evolve({ notice: message }).run(ClearNotice.make({ message }))
      }
      const founder = result.success
      return $.evolve({ founder }).run(WriteFounder.make({ founder }))
    },

    GuidedStarted: ($, { id }) =>
      $.run(
        Router.push(AppRoute, AppRoute.Sandbox({ params: { sandbox: id } })).pipe(Command.asNoop),
      ),

    FreeSandboxStarted: ($) =>
      $.run(
        Router.push(AppRoute, AppRoute.Sandbox({ params: { sandbox: 'free' } })).pipe(
          Command.asNoop,
        ),
      ),

    ChallengeStarted: ($, { id }) =>
      $.run(
        Router.push(AppRoute, AppRoute.Challenge({ params: { challenge: id } })).pipe(
          Command.asNoop,
        ),
      ),

    SettingsSectionChosen: ($, { section }) =>
      $.evolve({ settingsOpen: true, settingsSection: section }),

    SettingsSectionClosed: ($) => $.evolve({ settingsOpen: false }),

    LocaleChosen: ($, { locale }) => {
      const prefs = { ...$.model.prefs, locale }
      return $.evolve({ prefs }).run(
        WritePrefs.make({ prefs }),
        ApplySettings.make({ prefs }),
        LoadLocale.make({ locale }),
      )
    },

    MuteToggled: ($) => {
      const prefs = { ...$.model.prefs, muted: !$.model.prefs.muted }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }), ApplySettings.make({ prefs }))
    },

    VolumeChanged: ($, { volume }) => {
      const prefs = { ...$.model.prefs, volume: volumeIn(volume) }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }), ApplySettings.make({ prefs }))
    },

    AutoPauseToggled: ($) => {
      const prefs = { ...$.model.prefs, autoPause: !$.model.prefs.autoPause }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }), ApplySettings.make({ prefs }))
    },

    BlurPauseToggled: ($) => {
      const prefs = { ...$.model.prefs, blurPause: !$.model.prefs.blurPause }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }), ApplySettings.make({ prefs }))
    },

    EasyModeToggled: ($) => {
      const prefs = { ...$.model.prefs, easyMode: !$.model.prefs.easyMode }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }), ApplySettings.make({ prefs }))
    },

    AgentAccessToggled: ($) => {
      const prefs = { ...$.model.prefs, agentAccess: !$.model.prefs.agentAccess }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }), ApplySettings.make({ prefs }))
    },

    MotionToggled: ($) => {
      const prefs = {
        ...$.model.prefs,
        motion: $.model.prefs.motion === 'reduce' ? ('system' as const) : ('reduce' as const),
      }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }), ApplySettings.make({ prefs }))
    },

    AnalyticsToggled: ($) => {
      const prefs = { ...$.model.prefs, analytics: !$.model.prefs.analytics }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }), ApplySettings.make({ prefs }))
    },

    TextToggled: ($) => {
      const prefs = {
        ...$.model.prefs,
        text: $.model.prefs.text === 'large' ? ('normal' as const) : ('large' as const),
      }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }), ApplySettings.make({ prefs }))
    },

    ThemeToggled: ($) => {
      const prefs = {
        ...$.model.prefs,
        theme: $.model.prefs.theme === 'dark' ? ('light' as const) : ('dark' as const),
      }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }), ApplySettings.make({ prefs }))
    },

    SaveExported: ($) =>
      $.run(CopySaveText.make({ index: savesOf($.model.saves), locale: $.model.prefs.locale })),

    SaveDownloaded: ($) =>
      $.run(DownloadSaveFile.make({ index: savesOf($.model.saves), locale: $.model.prefs.locale })),

    SaveImportAsked: ($) =>
      $.run(
        PasteSave.make({
          index: savesOf($.model.saves),
          logo: $.model.draft.logo,
          locale: $.model.prefs.locale,
        }),
      ),

    SaveFileAsked: ($) =>
      $.run(
        ImportSaveFile.make({
          index: savesOf($.model.saves),
          logo: $.model.draft.logo,
          locale: $.model.prefs.locale,
        }),
      ),

    StateCopied: ($) =>
      $.run(CopyStateJson.make({ index: savesOf($.model.saves), locale: $.model.prefs.locale })),

    PrivacyOpened: ($) => $.run(OpenPrivacy.make()),

    PwaInstallChosen: ($) =>
      $.evolve({ pwa: pwaStep($.model.pwa, { _tag: 'Prompted' }) }).run(InstallPwa.make()),

    PwaInstallOutcome: ($, { outcome }) => {
      const prefs = { ...$.model.prefs, pwaPromptSeen: true }
      return $.set({
        ...$.model,
        prefs,
        pwa:
          outcome === 'accepted'
            ? pwaStep($.model.pwa, { _tag: 'Accepted' })
            : pwaStep($.model.pwa, { _tag: outcome === 'dismissed' ? 'Dismissed' : 'Unavailable' }),
      }).run(WritePrefs.make({ prefs }))
    },

    PwaPromptDismissed: ($) => {
      const prefs = { ...$.model.prefs, pwaPromptSeen: true }
      return $.evolve({ prefs }).run(WritePrefs.make({ prefs }))
    },

    Noticed: ($, { message }) => $.evolve({ notice: message }).run(ClearNotice.make({ message })),

    NoticeCleared: ($, { message }) =>
      $.model.notice === message ? $.evolve({ notice: null }) : $.evolve({}),

    Synced: ($) => $.evolve({}),
  },

  subscriptions: () => [
    Subscription.make(
      'pwa',
      Stream.callback<TitleMessage>((queue) =>
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.sync(() =>
              watchPwa((snapshot) =>
                Queue.offerUnsafe(
                  queue,
                  TitleMessage.PwaChanged({
                    installable: snapshot.installable,
                    installed: snapshot.installed,
                  }),
                ),
              ),
            ),
            (stop) => Effect.sync(stop),
          )
          return yield* Effect.never
        }),
      ),
    ),
  ],

  view: (h, model) => {
    const t = copyIn(model.prefs.locale)
    const menu = h.props.menu
    const page = pageOf(model, menu)
    return h.div.class(STAGE).children(
      h.main.class(cx('title-screen', S.ROOT)).children(
        h.div
          .class(S.FRAME)
          .onMount(MenuDriver({}))
          .children(toolbar(h, t), screen(h, model, t, menu), dock(h, t, model.prefs.locale, page)),
      ),
    )
  },
})
