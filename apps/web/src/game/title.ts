import { copyIn, type Messages } from '@/i18n/messages.ts'
import { copy, localized, eraWords } from '@/i18n/messages.ts'
import * as Effect from 'effect/Effect'
import { Mount } from 'foldkit'
import { DISCLAIMER_URL, SOURCE_URL, WIKI_URL } from '@/platform/analytics.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Download,
  FlaskConical,
  Hash,
  FolderOpen,
  RefreshCw,
  Rocket,
  ScrollText,
  Smile,
  Store,
  Target,
  Timer,
  Trash2,
  Lock,
  Settings,
  Trophy,
  Users,
  Wallet,
} from 'lucide'
import { css, cx } from '@quorum/styled-system/css'
import { icon } from '@quorum/ui/primitives/icon'
import { githubMark } from '@quorum/ui/primitives/github'
import { companyMark } from '@/components/company-mark.ts'
import { connecting, titleIsOpen } from './boot-machine.ts'
import {
  ACHIEVEMENT_IDS,
  ERAS,
  MUTATORS,
  MUTATOR_IDS,
  PERKS,
  PERK_IDS,
  VENTURES,
  VENTURE_IDS,
} from '@quorum/simulation/catalog'
import { foundingOf, levelOf, perkPrice } from '@quorum/simulation/founder'
import { legacyMultiplier, startEra } from '@quorum/simulation/founding'
import { CHALLENGES, challengeById, dailyDrill } from '@quorum/simulation/challenges'
import { eraOf } from '@quorum/simulation/lookups'
import { SANDBOX_IDS, TRACKS, sandboxOpen } from '@quorum/simulation/sandbox'
import { clock, compact, money, ms } from '@quorum/ui/game/format'
import { Message } from './message.ts'
import { PrefsMessage } from './prefs.ts'
import { settingsSections, type Setting } from './settings.ts'
import {
  boardChallenge,
  boardSandbox,
  currentFile,
  hasCompany,
  ledgerOf,
  type FoundStep,
  type Model,
} from './model.ts'
import { LOGOS } from './logos.ts'
import { MAX_COMPANY_NAME, nameOr, recent, type CompanyFile } from './saves.ts'
import { menuOf, type MenuPage } from './route.ts'
import { supportedLocales } from '../i18n/index.ts'
import { browserFamilyOf, onIos } from '../platform/pwa.ts'
import { play } from './sound.ts'

type Page = typeof MenuPage.Type | 'main' | 'save'

let lastPage: Page = 'main'

const rowsOf = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('.menu-list [data-row], .menu-footer [data-row]')].filter(
    (row) => !(row instanceof HTMLButtonElement && row.disabled),
  )

const walkOf = (root: ParentNode): ReadonlyArray<HTMLElement> => {
  const rows = rowsOf(root)
  const chosen = rows.find(
    (row) => row.dataset.tab !== undefined && row.getAttribute('aria-pressed') === 'true',
  )
  if (!chosen) return rows
  return rows.filter((row) => row.dataset.tab === undefined || row === chosen)
}

/* A tile grid reads in two dimensions, so the arrow keys move by where the
   tiles sit, not by the order they happen to be in. */
const nearestCell = (
  cells: ReadonlyArray<HTMLElement>,
  from: HTMLElement,
  key: string,
): HTMLElement | null => {
  const box = from.getBoundingClientRect()
  const centreX = box.left + box.width / 2
  const centreY = box.top + box.height / 2
  const step = 2
  const ahead = cells
    .filter((cell) => cell !== from)
    .map((cell) => {
      const at = cell.getBoundingClientRect()
      return { cell, x: at.left + at.width / 2, y: at.top + at.height / 2, at }
    })
    .filter(({ at }) =>
      key === 'ArrowDown'
        ? at.top >= box.bottom - step
        : key === 'ArrowUp'
          ? at.bottom <= box.top + step
          : key === 'ArrowRight'
            ? at.left >= box.right - step
            : at.right <= box.left + step,
    )
  ahead.sort(
    (a, b) =>
      Math.abs(a.y - centreY) +
      Math.abs(a.x - centreX) / 2 -
      (Math.abs(b.y - centreY) + Math.abs(b.x - centreX) / 2),
  )
  return ahead[0]?.cell ?? null
}

export const MenuDriver = Mount.define('MenuDriver', {
  messages: [Message.Synced],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.altKey || event.metaKey || event.ctrlKey) return
          const target = event.target
          if (target instanceof Element && target !== document.body && !element.contains(target))
            return
          if (element.querySelector('.menu-term')) return
          if (target instanceof HTMLInputElement) {
            if (event.key === 'Escape') {
              event.preventDefault()
              if (target.type !== 'range') {
                target.blur()
                return
              }
              const rows = walkOf(element)
              const at = rows.indexOf(target)
              rows[(at + 1) % rows.length]?.focus()
              return
            }
            if (event.key !== 'Enter' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
              return
            event.preventDefault()
            const rows = walkOf(element)
            const at = rows.indexOf(target)
            const step = event.key === 'ArrowUp' ? -1 : 1
            const next = rows[at < 0 ? 0 : (at + step + rows.length) % rows.length]
            next?.focus()
            return
          }
          play('tick')
          const tab = target instanceof Element ? target.closest('[data-tab]') : null
          if (
            tab instanceof HTMLElement &&
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
          ) {
            event.preventDefault()
            const tabs = [...element.querySelectorAll<HTMLElement>('.menu-tabs [data-tab]')]
            const step = event.key === 'ArrowLeft' ? -1 : 1
            const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length]
            if (next && next !== tab) {
              next.focus()
              next.click()
              play('hover')
            }
            return
          }
          const rows = walkOf(element)
          const active =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
          const grid = active?.closest('[data-grid]')
          if (
            grid &&
            active &&
            ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)
          ) {
            const next = nearestCell(
              [...grid.querySelectorAll<HTMLElement>('[data-row]')],
              active,
              event.key,
            )
            if (next) {
              event.preventDefault()
              next.focus()
              play('hover')
              return
            }
            /* The edge of a grid is the edge of its section: sideways stops
               there, and up and down carry on into the list. */
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              return
            }
          }
          const chosen = element.querySelector<HTMLElement>(
            '.menu-tabs [data-tab][aria-pressed="true"]',
          )
          const at =
            active?.dataset.tab !== undefined
              ? chosen
                ? rows.indexOf(chosen)
                : -1
              : active
                ? rows.indexOf(active)
                : -1
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const step = event.key === 'ArrowDown' ? 1 : -1
            const next = rows[at < 0 ? 0 : (at + step + rows.length) % rows.length]
            if (next && next !== rows[at]) {
              next.focus()
              play('hover')
            }
          } else if (['Escape', 'Backspace', 'ArrowLeft'].includes(event.key)) {
            const back = element.querySelector<HTMLElement>('[data-back]')
            if (back) {
              event.preventDefault()
              back.click()
            }
          } else if (
            event.key === 'ArrowRight' ||
            ((event.key === 'Enter' || event.key === ' ') && at < 0)
          ) {
            event.preventDefault()
            if (at < 0) rows[0]?.focus()
            else rows[at]?.click()
          }
        }
        const onPointerOver = (event: Event) => {
          if (!(event instanceof PointerEvent) || event.pointerType === 'touch') return
          const row = event.target instanceof Element ? event.target.closest('[data-row]') : null
          if (!(row instanceof HTMLElement)) return
          const from = event.relatedTarget instanceof Node ? event.relatedTarget : null
          if (from && row.contains(from)) return
          play('hover')
        }
        const onClick = (event: Event) => {
          if (event.target instanceof Element && event.target.closest('button')) play('choose')
        }
        /* Only a list with more below it fades at its edge and lifts its
           section headers; a short list keeps its last row at full strength. */
        const lists = () => [...element.querySelectorAll<HTMLElement>('.menu-list')]
        const measure = () => {
          for (const list of lists())
            list.classList.toggle('is-long', list.scrollHeight > list.clientHeight + 2)
        }
        const resize = new ResizeObserver(measure)
        let watched: HTMLElement | null = null
        const watch = () => {
          const list = element.querySelector<HTMLElement>('.menu-list')
          if (list !== watched) {
            watched = list
            resize.disconnect()
            if (list) resize.observe(list)
          }
          measure()
        }
        watch()
        const mutation = new MutationObserver(watch)
        mutation.observe(element, { childList: true, subtree: true })
        window.addEventListener('keydown', onKeyDown)
        element.addEventListener('pointerover', onPointerOver)
        element.addEventListener('click', onClick)
        return () => {
          window.removeEventListener('keydown', onKeyDown)
          element.removeEventListener('pointerover', onPointerOver)
          element.removeEventListener('click', onClick)
          mutation.disconnect()
          resize.disconnect()
        }
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.as(Message.Synced())),
})

export const PageMounted = Mount.define('PageMounted', {
  messages: [Message.Synced],
  execute: ({ element }) =>
    Effect.sync(() => {
      const page = (element.getAttribute('data-page') ?? 'main') as Page
      const rows = walkOf(element.parentElement ?? element)
      const from = page === 'main' ? rows.find((row) => row.dataset.to === lastPage) : undefined
      lastPage = page
      /* Continue is the row a returning player wants, so it takes the focus
         before anything else on the page. */
      const first =
        rows.find((row) => row.classList.contains('is-primary')) ??
        rows.find((row) => !('back' in row.dataset)) ??
        rows[0]
      ;(from ?? first)?.focus({ preventScroll: true })
      return Message.Synced()
    }),
})

const GLYPHS: ReadonlyArray<{ at: number; paths: ReadonlyArray<string> }> = [
  { at: 0, paths: ['M89 11V150', 'M50 11a39 39 0 1 0 0.01 0'] },
  { at: 120, paths: ['M11 0V50a39 39 0 0 0 78 0', 'M89 0V100'] },
  { at: 240, paths: ['M50 11a39 39 0 1 0 0.01 0'] },
  { at: 360, paths: ['M11 0V100', 'M11 50a39 39 0 0 1 39-39H60'] },
  { at: 440, paths: ['M11 0V50a39 39 0 0 0 78 0', 'M89 0V100'] },
  {
    at: 560,
    paths: ['M11 0V100', 'M11 45a34.5 34.5 0 0 1 69 0V100', 'M80 45a34.5 34.5 0 0 1 69 0V100'],
  },
]

const glyphPaths = (
  paths: ReadonlyArray<string>,
  at: number,
  delay: number,
  h: HtmlBuilder<Message>,
) =>
  paths.map((d) =>
    h.path([
      h.D(d),
      h.Transform(`translate(${at} 0)`),
      h.PathLength('1'),
      h.Style({ 'animation-delay': `${delay}ms` }),
    ]),
  )

const wordmark = (h: HtmlBuilder<Message>): Html =>
  h.svg(
    [h.ViewBox('0 0 720 194'), h.Class('menu-wordmark'), h.Role('img'), h.AriaLabel('Quorum')],
    [
      ...GLYPHS.flatMap(({ at, paths }, letter) => glyphPaths(paths, at, 300 + letter * 70, h)),
      h.circle([h.Cx('89'), h.Cy('180'), h.R('14')]),
    ],
  )

type Row = Readonly<{
  key: string
  label: string
  detail?: string | undefined
  side?: Html | string | undefined
  mark?: Html
  message: Message | null
  big?: boolean
  primary?: boolean
  to?: Page
  pressed?: boolean
  pick?: 'radio' | 'checkbox'
  checked?: boolean
  record?: boolean
  danger?: boolean
}>

const percentRow = (
  r: Readonly<{ key: string; label: string; value: number; onInput: (value: number) => Message }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Key(r.key), h.Class('menu-row is-range')],
    [
      h.span([h.Class('menu-label')], [h.span([], [r.label])]),
      h.input([
        h.Type('range'),
        h.Class('menu-range'),
        h.DataAttribute('row', ''),
        h.Style({ '--fill': `${r.value}%` }),
        h.Min('0'),
        h.Max('100'),
        h.Step('5'),
        h.Value(`${r.value}`),
        h.AriaLabel(r.label),
        h.OnInput((value) => r.onInput(Number(value))),
      ]),
      h.span([h.Class('menu-side')], [`${Math.round(r.value)}%`]),
    ],
  )

const row = (r: Row, h: HtmlBuilder<Message>): Html => {
  const body = [
    r.pick
      ? h.span(
          [h.Class(`menu-pick is-${r.pick}${r.checked ? ' is-on' : ''}`), h.AriaHidden(true)],
          [],
        )
      : h.empty,
    r.mark ?? h.empty,
    h.span(
      [h.Class('menu-label')],
      [h.span([], [r.label]), r.detail ? h.span([h.Class('menu-detail')], [r.detail]) : h.empty],
    ),
    r.side === undefined
      ? h.empty
      : typeof r.side === 'string'
        ? h.span([h.Class('menu-side')], [r.side])
        : h.span([h.Class('menu-side')], [r.side]),
  ]
  const className = `menu-row ${r.big ? 'is-big' : ''} ${r.primary ? 'is-primary' : ''} ${r.danger ? 'is-danger' : ''}`
  if (r.record)
    return h.div(
      [h.Key(r.key), h.Tabindex(-1), h.DataAttribute('row', ''), h.Class(`${className} is-record`)],
      body,
    )
  return h.button(
    [
      h.Key(r.key),
      h.Type('button'),
      h.Disabled(r.message === null),
      ...(r.message ? [h.OnClick(r.message)] : []),
      h.DataAttribute('row', ''),
      ...(r.to ? [h.DataAttribute('to', r.to)] : []),
      ...(r.pressed === undefined ? [] : [h.AriaPressed(r.pressed ? 'true' : 'false')]),
      ...(r.pick === undefined ? [] : [h.Role(r.pick), h.AriaChecked(r.checked === true)]),
      h.Class(className),
    ],
    body,
  )
}

const plate = (glyph: Parameters<typeof icon>[1], tone: string, h: HtmlBuilder<Message>): Html =>
  h.span([h.Class(`menu-plate is-${tone}`)], [icon(h, glyph, 'menu-icon')])

const done = (h: HtmlBuilder<Message>) => icon(h, Check, cx('menu-icon', css({ color: 'ok' })))
const locked = (h: HtmlBuilder<Message>) => icon(h, Lock, 'menu-icon')

const group = (text: string, h: HtmlBuilder<Message>): Html =>
  h.h2([h.Key(`group-${text}`), h.Class('menu-group')], [text])

const note = (text: string, h: HtmlBuilder<Message>): Html =>
  h.p([h.Key(`note-${text}`), h.Class('menu-note')], [text])

const divider = (h: HtmlBuilder<Message>): Html =>
  h.div([h.Key('divider'), h.Class('menu-rule'), h.AriaHidden(true)], [])

const installPromptRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  if (model.pwa.installed || model.prefs.pwaPromptSeen || model.saves.companies.length === 0)
    return []
  const family = browserFamilyOf()
  return [
    note(t.pwa.installPrompt, h),
    row(
      {
        key: 'pwa-install',
        label: t.pwa.installQuorum,
        detail: model.pwa.installable ? t.pwa.installDetail : t.pwa.installHelp[family],
        side: icon(h, Download, 'menu-icon'),
        message: model.pwa.installable ? Message.PwaInstallChosen() : null,
        record: !model.pwa.installable,
      },
      h,
    ),
    ...(onIos() ? [note(t.pwa.moveNote, h)] : []),
    row({ key: 'pwa-not-now', label: t.pwa.notNow, message: Message.PwaPromptDismissed() }, h),
  ]
}

/* The menu's main page reads as the board does: two cards of choices, with
   the company on the left because that is where play resumes. */
const startRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)

  const game = model.board.game
  const file = currentFile(model)
  const current = hasCompany(model) ? file : null
  const count = model.saves.companies.length
  return [
    ...(model.pwa.updateReady
      ? [
          row(
            {
              key: 'pwa-update',
              label: t.pwa.updateReady,
              detail: t.pwa.updateReadyDetail,
              side: icon(h, RefreshCw, 'menu-icon'),
              message: Message.PwaUpdateChosen(),
            },
            h,
          ),
        ]
      : []),
    ...installPromptRows(model, h),
    ...(current
      ? [
          row(
            {
              key: 'continue',
              mark: companyMark(current.logo, 'menu-logo-mini', h),
              label: t.title.continueText,
              detail: `${current.name} · ${t.title.eraUsersTime(eraWords(t, game).name, compact(game.users), clock(game.time))}`,
              message: Message.Continued(),
              big: true,
              primary: true,
              side: icon(h, ChevronRight, 'menu-icon'),
            },
            h,
          ),
        ]
      : []),
    row(
      {
        key: 'new',
        label: current ? t.title.newCompany : t.title.startACompany,
        mark: plate(Building2, 'blue', h),
        message: Message.MenuChosen({ menu: 'found' }),
        big: !current,
        to: 'found',
      },
      h,
    ),
    row(
      {
        key: 'preseed',
        label: t.title.startInPreSeed,
        detail: t.title.skipsGarage,
        mark: plate(Rocket, 'amber', h),
        message: Message.PreseedStarted(),
      },
      h,
    ),
    row(
      {
        key: 'import',
        label: t.title.importACompany,
        mark: plate(Download, 'green', h),
        message: Message.CompanyFileAsked(),
      },
      h,
    ),
    ...(count > 0
      ? [
          row(
            {
              key: 'companies',
              label: t.title.companies,
              detail: t.title.savedCount(count),
              mark: plate(FolderOpen, 'purple', h),
              message: Message.MenuChosen({ menu: 'companies' }),
              to: 'companies',
            },
            h,
          ),
        ]
      : []),
  ]
}

const founderRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const earned = model.founder.achievements.length
  const exits = model.founder.history.length
  return [
    row(
      {
        key: 'achievements',
        label: t.title.achievements,
        mark: plate(Trophy, 'green', h),
        side: `${earned}/${ACHIEVEMENT_IDS.length}`,
        message: Message.MenuChosen({ menu: 'achievements' }),
        to: 'achievements',
      },
      h,
    ),
    row(
      {
        key: 'legacy',
        label: t.title.legacyShop,
        mark: plate(Store, 'green', h),
        side: `${model.founder.legacy}`,
        message: Message.MenuChosen({ menu: 'legacy' }),
        to: 'legacy',
      },
      h,
    ),
    row(
      {
        key: 'history',
        label: t.title.history,
        mark: plate(ScrollText, 'green', h),
        detail: exits === 0 ? t.title.noExitsYet : undefined,
        side: exits > 0 ? `${exits}` : undefined,
        message: Message.MenuChosen({ menu: 'history' }),
        to: 'history',
      },
      h,
    ),
  ]
}

const practiceRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const passed = SANDBOX_IDS.filter((id) => model.passed.includes(id)).length
  const solved = CHALLENGES.filter((entry) => model.founder.completed.includes(entry.id)).length
  return [
    row(
      {
        key: 'sandbox',
        label: t.title.sandbox,
        detail: t.title.freeSandbox,
        mark: plate(FlaskConical, 'purple', h),
        side: passed > 0 ? `${passed}/${SANDBOX_IDS.length}` : undefined,
        message: Message.MenuChosen({ menu: 'sandbox' }),
        to: 'sandbox',
      },
      h,
    ),
    row(
      {
        key: 'challenges',
        label: t.title.challenges,
        mark: plate(Target, 'pink', h),
        side: solved > 0 ? `${solved}/${CHALLENGES.length}` : undefined,
        message: Message.MenuChosen({ menu: 'challenges' }),
        to: 'challenges',
      },
      h,
    ),
  ]
}

const tile = (
  r: Readonly<{
    key: string
    label: string
    detail?: string | undefined
    state: 'done' | 'next' | 'open' | 'locked'
    message?: Message
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Key(r.key),
      h.Type('button'),
      h.DataAttribute('row', ''),
      h.Class(`menu-tile is-${r.state}`),
      ...(r.message ? [h.OnClick(r.message)] : [h.AriaDisabled(true)]),
    ],
    [
      h.span([h.Class('menu-tile-name')], [r.label]),
      r.detail ? h.span([h.Class('menu-tile-detail')], [r.detail]) : h.empty,
      h.span(
        [h.Class('menu-tile-mark'), h.AriaHidden(true)],
        [
          r.state === 'done'
            ? done(h)
            : r.state === 'locked'
              ? locked(h)
              : r.state === 'next'
                ? '›'
                : '',
        ],
      ),
    ],
  )

const sandboxRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const next = SANDBOX_IDS.find((id) => !model.passed.includes(id) && sandboxOpen(id, model.passed))
  return [
    ...TRACKS.flatMap((track) => {
      const passed = track.sandboxes.filter((id) => model.passed.includes(id)).length
      const era = t.catalog.eras[track.stage]?.name ?? ''
      return [
        group(`${era} · ${passed}/${track.sandboxes.length}`, h),
        h.div(
          [h.Class('menu-grid'), h.DataAttribute('grid', '')],
          track.sandboxes.map((id) => {
            const open = sandboxOpen(id, model.passed)
            return tile(
              {
                key: id,
                label: t.catalog.guided[id].name,
                detail: t.catalog.guided[id].objectives[0]?.goal,
                state: model.passed.includes(id)
                  ? 'done'
                  : id === next
                    ? 'next'
                    : open
                      ? 'open'
                      : 'locked',
                ...(open ? { message: Message.GuidedStarted({ id }) } : {}),
              },
              h,
            )
          }),
        ),
      ]
    }),
    divider(h),
    row({ key: 'free', label: t.title.freeSandbox, message: Message.FreeSandboxStarted() }, h),
  ]
}

/* A tile for one choice among a grid: a venture, a mutator, or a logo. The
   mark says whether the choice takes one or many, and the foot says what it
   costs or pays. */
const choiceTile = (
  r: Readonly<{
    key: string
    label: string
    detail?: string | undefined
    value?: string | undefined
    mark?: Html
    pick: 'radio' | 'checkbox'
    checked: boolean
    message: Message
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Key(r.key),
      h.Type('button'),
      h.Role(r.pick),
      h.AriaChecked(r.checked),
      h.DataAttribute('row', ''),
      h.Class(`menu-tile is-choice ${r.checked ? 'is-on' : ''}`),
      h.OnClick(r.message),
    ],
    [
      r.mark ?? h.empty,
      h.span(
        [h.Class('menu-tile-head')],
        [
          h.span(
            [h.Class(`menu-pick is-${r.pick}${r.checked ? ' is-on' : ''}`), h.AriaHidden(true)],
            [],
          ),
          h.span([h.Class('menu-tile-name')], [r.label]),
          r.value ? h.span([h.Class('menu-tile-value')], [r.value]) : h.empty,
        ],
      ),
      r.detail ? h.span([h.Class('menu-tile-detail')], [r.detail]) : h.empty,
    ],
  )

const FOUND_STEPS: ReadonlyArray<FoundStep> = ['company', 'venture', 'mutators']

const foundSteps = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const label: Record<FoundStep, string> = {
    company: t.title.company,
    venture: t.title.venture,
    mutators: t.title.mutators,
  }
  return h.div(
    [
      h.Key('found-steps'),
      h.Class('menu-tabs is-steps'),
      h.Role('group'),
      h.AriaLabel(t.title.newCompany),
    ],
    FOUND_STEPS.map((step, index) =>
      h.button(
        [
          h.Key(`step-${step}`),
          h.Type('button'),
          h.DataAttribute('row', ''),
          h.DataAttribute('tab', step),
          h.Class(`menu-tab ${step === model.foundStep ? 'is-on' : ''}`),
          h.AriaPressed(step === model.foundStep ? 'true' : 'false'),
          h.OnClick(Message.FoundStepChosen({ step })),
        ],
        [h.span([h.Class('menu-step-number')], [`${index + 1}`]), h.span([], [label[step]])],
      ),
    ),
  )
}

const companyStep = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  return [
    /* The company as it will read on the title screen: a badge in the same
       moulded plastic as the clock-in card, which names its holder Founder. */
    h.div(
      [h.Class('menu-badge'), h.AriaHidden(true)],
      [
        companyMark(model.draft.logo, 'menu-badge-mark', h),
        h.span([h.Class('menu-badge-name')], [nameOr(model.draft.name)]),
        h.span([h.Class('menu-badge-line')], [t.title.founder]),
      ],
    ),
    h.div(
      [h.Class('menu-name')],
      [
        h.label(
          [h.Class('menu-field')],
          [
            h.span([h.Class('menu-field-label')], [t.title.companyName]),
            h.input([
              h.Class('menu-input'),
              h.Type('text'),
              h.Value(model.draft.name),
              h.Placeholder(t.title.nameYourCompany),
              h.Maxlength(MAX_COMPANY_NAME),
              h.Autocomplete('off'),
              h.Spellcheck(false),
              h.AriaLabel(t.title.companyName),
              h.DataAttribute('row', ''),
              h.OnInput((name) => Message.CompanyNameChanged({ name })),
            ]),
          ],
        ),
        note(t.title.saveInBrowser, h),
      ],
    ),
    group(t.title.logo, h),
    h.div(
      [h.Class('menu-choices is-logos'), h.DataAttribute('grid', '')],
      LOGOS.map((logo) =>
        choiceTile(
          {
            key: `logo-${logo.id}`,
            label: t.logos[logo.id],
            mark: companyMark(logo.id, 'menu-choice-mark', h),
            pick: 'radio',
            checked: model.draft.logo === logo.id,
            message: Message.LogoChosen({ logo: logo.id }),
          },
          h,
        ),
      ),
    ),
  ]
}

const ventureStep = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const founding = foundingOf(model.founder)
  return [
    h.div(
      [h.Class('menu-choices'), h.DataAttribute('grid', '')],
      VENTURE_IDS.map((id) => {
        const def = localized(VENTURES[id], t.catalog.ventures[id])
        return choiceTile(
          {
            key: id,
            label: def.name,
            detail: def.summary,
            value: `×${def.legacy.toFixed(1)}`,
            pick: 'radio',
            checked: id === founding.venture,
            message: Message.VentureChosen({ id }),
          },
          h,
        )
      }),
    ),
  ]
}

const mutatorStep = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const founding = foundingOf(model.founder)
  return [
    h.div(
      [h.Class('menu-choices'), h.DataAttribute('grid', '')],
      MUTATOR_IDS.map((id) =>
        choiceTile(
          {
            key: id,
            label: t.catalog.mutators[id].name,
            detail: t.catalog.mutators[id].rule,
            value: `+${Math.round(MUTATORS[id].legacy * 100)}%`,
            pick: 'checkbox',
            checked: founding.mutators.includes(id),
            message: Message.MutatorToggled({ id }),
          },
          h,
        ),
      ),
    ),
  ]
}

const foundRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const step: Record<FoundStep, () => ReadonlyArray<Html>> = {
    company: () => companyStep(model, h),
    venture: () => ventureStep(model, h),
    mutators: () => mutatorStep(model, h),
  }
  return [foundSteps(model, h), ...step[model.foundStep]()]
}

const foundFooter = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const founding = foundingOf(model.founder)
  const next: Record<FoundStep, Readonly<{ label: string; step: FoundStep }> | null> = {
    company: { label: t.title.venture, step: 'venture' },
    venture: { label: t.title.mutators, step: 'mutators' },
    mutators: null,
  }
  const ahead = next[model.foundStep]
  return h.div(
    [h.Class('menu-footer')],
    [
      ahead
        ? row(
            {
              key: 'next',
              mark: companyMark(model.draft.logo, 'menu-logo-mini', h),
              label: `${t.title.next}: ${ahead.label}`,
              message: Message.FoundStepChosen({ step: ahead.step }),
              big: true,
            },
            h,
          )
        : row(
            {
              key: 'found',
              mark: companyMark(model.draft.logo, 'menu-logo-mini', h),
              label: t.title.found(nameOr(model.draft.name)),
              detail: t.title.legacy2(startEra(founding), legacyMultiplier(founding).toFixed(2)),
              message: Message.CompanyFounded(),
              big: true,
            },
            h,
          ),
    ],
  )
}

const companyRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  return [
    ...recent(model.saves.companies).map((file) =>
      row(
        {
          key: file.id,
          mark: companyMark(file.logo, 'menu-logo-mini', h),
          label: file.name,
          detail: `${t.catalog.ventures[file.venture].name} · ${t.title.eraUsersTime(t.catalog.eras[file.stage]?.name ?? '', compact(file.users), clock(file.time))}`,
          side:
            file.online !== null
              ? `${t.room.onlineMark} · ${file.online.code}`
              : file.id === model.saves.current
                ? t.title.current
                : dateOf(file),
          message: Message.CompanyChosen({ id: file.id }),
        },
        h,
      ),
    ),
    ...(model.saves.companies.length === 0 ? [note(t.title.noCompaniesSavedYet, h)] : []),
  ]
}

const dateOf = (file: CompanyFile): string =>
  new Date(file.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const saveRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)

  const file = model.saves.companies.find((entry) => entry.id === model.saveFocus)
  if (!file) return []
  return [
    h.div(
      [h.Class('menu-file')],
      [
        companyMark(file.logo, 'menu-logo-big', h),
        h.div(
          [h.Class('menu-file-text')],
          [
            h.span([h.Class('menu-file-name')], [file.name]),
            h.span(
              [h.Class('menu-detail')],
              [
                `${t.catalog.ventures[file.venture].name} · ${t.title.eraUsersTime(t.catalog.eras[file.stage]?.name ?? '', compact(file.users), clock(file.time))}`,
              ],
            ),
            h.span(
              [h.Class('menu-detail')],
              [
                file.mutators.length > 0 ? `${t.title.mutatorCount(file.mutators.length)} · ` : '',
                t.title.started(
                  new Date(file.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }),
                ),
              ],
            ),
          ],
        ),
      ],
    ),
    row(
      {
        key: 'open',
        label: file.id === model.saves.current ? t.title.continueText : t.title.openCompany,
        side: file.id === model.saves.current ? t.title.current : undefined,
        message: Message.CompanyOpened({ id: file.id }),
        big: true,
      },
      h,
    ),
    ...(model.saveConfirm._tag === 'Confirming'
      ? [
          row(
            {
              key: 'delete',
              label: t.title.deleteForever,
              detail: t.title.theCompanyAndItsDesignAre,
              message: Message.CompanyDeleteConfirmed(),
              danger: true,
            },
            h,
          ),
          row(
            {
              key: 'keep',
              label: t.title.keepCompany,
              message: Message.CompanyDeleteCancelled(),
            },
            h,
          ),
        ]
      : [
          row(
            {
              key: 'delete',
              label: t.title.deleteCompany,
              side: icon(h, Trash2, 'menu-icon'),
              message: Message.CompanyDeleteAsked(),
            },
            h,
          ),
        ]),
  ]
}

const challengeRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)

  const founder = model.founder
  const drill = model.today ? dailyDrill(model.today) : null
  const challenge = (id: string, name: string, detail: string, legacy: number) =>
    row(
      {
        key: id,
        label: name,
        detail,
        side: founder.completed.includes(id)
          ? done(h)
          : legacy > 0
            ? t.title.legacy(legacy)
            : undefined,
        message: Message.ChallengeStarted({ id }),
      },
      h,
    )
  return [
    ...(drill ? [challenge(drill.id, t.title.dailyDrill, drill.brief, 0)] : []),
    ...ERAS.flatMap((era, stage) => {
      const list = CHALLENGES.filter((entry) => entry.era === stage)
      return list.length === 0
        ? []
        : [
            group(t.catalog.eras[stage]?.name ?? era.name, h),
            ...list.map((entry) =>
              challenge(
                entry.id,
                t.catalog.challenges[entry.id]!.name,
                t.catalog.challenges[entry.id]!.brief,
                entry.legacy,
              ),
            ),
          ]
    }),
  ]
}

const legacyRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  return PERK_IDS.map((id) => {
    const def = localized(PERKS[id], t.catalog.perks[id])
    const price = perkPrice(model.founder, id)
    return row(
      {
        key: id,
        label: `${def.name} ${levelOf(model.founder, id)}/${def.costs.length}`,
        detail: def.effect,
        side: price === null ? done(h) : t.title.legacy(price),
        message:
          price !== null && model.founder.legacy >= price ? Message.PerkBought({ id }) : null,
      },
      h,
    )
  })
}

const historyRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  return model.founder.history.length === 0
    ? [note(t.title.noExitsYet, h)]
    : model.founder.history
        .map((entry, index) =>
          row(
            {
              key: `h${index}`,
              label:
                entry.name ||
                `${t.catalog.exits[entry.exit].name} · ${t.catalog.ventures[entry.founding.venture].name}`,
              detail: `${entry.name ? `${t.catalog.exits[entry.exit].name} · ` : ''}${t.catalog.ventures[entry.founding.venture].name} · ${t.title.eraUsersTime(t.catalog.eras[entry.stage]?.name ?? '', compact(entry.peak), clock(entry.time))}`,
              side: `+${entry.legacy}`,
              message: null,
              record: true,
            },
            h,
          ),
        )
        .toReversed()
}

const achievementRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const earned = model.founder.achievements.length
  const share = Math.round((earned / ACHIEVEMENT_IDS.length) * 100)
  return [
    h.div(
      [h.Class('menu-meter')],
      [
        h.span([h.Class('menu-meter-count')], [`${earned}/${ACHIEVEMENT_IDS.length}`]),
        h.span(
          [h.Class('menu-meter-track'), h.AriaHidden(true)],
          [h.span([h.Class('menu-meter-fill'), h.Style({ width: `${share}%` })], [])],
        ),
      ],
    ),
    h.div(
      [h.Class('menu-grid is-achievements')],
      ACHIEVEMENT_IDS.map((id) => {
        const isEarned = model.founder.achievements.includes(id)
        return h.div(
          [
            h.Key(id),
            h.Class(`menu-tile is-achievement ${isEarned ? 'is-earned' : 'is-locked'}`),
            h.AriaLabel(
              `${t.catalog.achievements[id].name}. ${t.catalog.achievements[id].condition}. ${isEarned ? t.title.earned : t.title.notYet}`,
            ),
          ],
          [
            h.span([h.Class('menu-tile-name')], [t.catalog.achievements[id].name]),
            h.span([h.Class('menu-tile-detail')], [t.catalog.achievements[id].condition]),
            h.span(
              [h.Class('menu-tile-mark'), h.AriaHidden(true)],
              [isEarned ? done(h) : locked(h)],
            ),
          ],
        )
      }),
    ),
  ]
}

const settingRow = (setting: Setting, model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  switch (setting.kind) {
    case 'volume':
      return percentRow(
        {
          key: 'volume',
          label: setting.label,
          value: setting.value,
          onInput: (volume) =>
            Message.PrefsChanged({ message: PrefsMessage.VolumeChanged({ volume }) }),
        },
        h,
      )
    case 'toggle':
      return row(
        {
          key: setting.id,
          label: setting.label,
          side: setting.isOn ? t.title.on : t.title.off,
          message: setting.message,
          pressed: setting.isOn,
        },
        h,
      )
    case 'language': {
      const at = supportedLocales.findIndex(({ value }) => value === model.prefs.locale)
      const next = supportedLocales[(at + 1) % supportedLocales.length]!
      return row(
        {
          key: 'language',
          label: setting.label,
          side: supportedLocales[at]?.label ?? '',
          message: Message.PrefsChanged({
            message: PrefsMessage.LocaleChosen({ locale: next.value }),
          }),
        },
        h,
      )
    }
    case 'action':
      return row(
        {
          key: setting.id,
          label: setting.label,
          side: icon(h, setting.glyph, 'menu-icon'),
          message: setting.message,
        },
        h,
      )
  }
}

const settingsTabs = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [h.Key('settings-tabs'), h.Class('menu-tabs'), h.Role('group'), h.AriaLabel(t.panels.settings)],
    settingsSections(model, t).map((part) =>
      h.button(
        [
          h.Key(`tab-${part.id}`),
          h.Type('button'),
          h.DataAttribute('row', ''),
          h.DataAttribute('tab', part.id),
          h.Class(`menu-tab ${part.id === model.settingsSection ? 'is-on' : ''}`),
          h.AriaPressed(part.id === model.settingsSection ? 'true' : 'false'),
          h.OnClick(Message.SettingsSectionChosen({ section: part.id })),
        ],
        [part.label],
      ),
    ),
  )
}

const settingsRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const sections = settingsSections(model, t)
  const active = sections.find((part) => part.id === model.settingsSection) ?? sections[0]!
  return [
    settingsTabs(model, h),
    ...active.rows.map((setting) => settingRow(setting, model, h)),
    ...pwaSettingsRows(model, h),
  ]
}

const pwaSettingsRows = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  if (model.pwa.installed && !model.pwa.updateReady) return []
  const family = browserFamilyOf()
  return [
    group(t.pwa.app, h),
    ...(model.pwa.installed
      ? []
      : [
          row(
            {
              key: 'pwa-install-setting',
              label: t.pwa.installQuorum,
              detail: model.pwa.installable ? t.pwa.installDetail : t.pwa.installHelp[family],
              side: icon(h, Download, 'menu-icon'),
              message: model.pwa.installable ? Message.PwaInstallChosen() : null,
              record: !model.pwa.installable,
            },
            h,
          ),
          ...(onIos() ? [note(t.pwa.moveNote, h)] : []),
        ]),
    ...(model.pwa.updateReady
      ? [
          row(
            {
              key: 'pwa-update-setting',
              label: t.pwa.updateReady,
              detail: t.pwa.updateReadyDetail,
              side: icon(h, RefreshCw, 'menu-icon'),
              message: Message.PwaUpdateChosen(),
            },
            h,
          ),
        ]
      : []),
  ]
}

const pagesOf = (
  t: Messages,
): Record<
  Page,
  Readonly<{ title: string; rows: (model: Model, h: HtmlBuilder<Message>) => ReadonlyArray<Html> }>
> => ({
  main: { title: '', rows: startRows },
  found: { title: t.title.newCompany, rows: foundRows },
  companies: { title: t.title.companies, rows: companyRows },
  save: { title: t.title.company, rows: saveRows },
  sandbox: { title: t.title.sandbox, rows: sandboxRows },
  challenges: { title: t.title.challenges, rows: challengeRows },
  legacy: { title: t.title.legacyShop, rows: legacyRows },
  history: { title: t.title.history, rows: historyRows },
  achievements: { title: t.title.achievements, rows: achievementRows },
  settings: { title: t.title.settings, rows: settingsRows },
})

const pageOf = (model: Model): Page => {
  const page = menuOf(model.route)
  return page === 'companies' && model.saveFocus !== null ? 'save' : page
}

/* A card's header: the tint the board gives a Node type, its title, and one
   figure on the right. On a page below the menu, the way back leads. */
/* A page below the menu: the way back, the page's name, and one figure. */
const pageHead = (
  args: Readonly<{
    title: string
    figure?: string | undefined
    back?: 'main' | 'companies'
  }>,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return h.header(
    [h.Class('menu-page-head')],
    [
      h.button(
        [
          h.Key('back'),
          h.Type('button'),
          h.Class('menu-back'),
          h.DataAttribute('back', ''),
          h.AriaLabel(t.title.back),
          h.OnClick(Message.MenuChosen({ menu: args.back ?? 'main' })),
        ],
        [icon(h, ChevronLeft, 'menu-icon'), h.span([], [t.title.back])],
      ),
      h.h2([h.Class('menu-page-title')], [args.title]),
      args.figure ? h.span([h.Class('menu-page-figure')], [args.figure]) : h.empty,
    ],
  )
}

/* A group of choices: a small caption, then the buttons on the canvas. */
const block = (title: string, rows: ReadonlyArray<Html>, h: HtmlBuilder<Message>): Html =>
  rows.length === 0
    ? h.empty
    : h.section(
        [h.Class('menu-block')],
        [
          h.h2([h.Class('menu-section')], [title]),
          h.nav([h.Class('menu-list'), h.AriaLabel(title), h.DataAttribute('grid', '')], rows),
        ],
      )

const hint = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [h.Class('menu-hint'), h.AriaHidden(true)],
    [
      ['↑↓', t.title.select],
      [t.title.enter, t.title.open],
      [t.title.esc, t.title.back],
    ].map(([key, label]) => h.span([], [h.kbd([], [key ?? '']), h.span([], [label ?? ''])])),
  )
}

/* The founder's company, read the way the board reads it: the same card, the
   same four vitals, so the menu and the game share one instrument. */
const status = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const file = currentFile(model)
  const ledger = ledgerOf(model)
  const era = eraWords(t, game)
  const target = eraOf(game).apdexTarget
  const share = Math.min(1, game.users / eraOf(game).raiseAt)
  const vital = (label: string, value: string, note: string, glyph: Parameters<typeof icon>[1]) =>
    h.div(
      [h.Class('menu-vital')],
      [
        h.span([h.Class('menu-vital-label')], [icon(h, glyph, 'menu-icon'), h.span([], [label])]),
        h.span([h.Class('menu-vital-value')], [value]),
        h.span([h.Class('menu-vital-note')], [note]),
      ],
    )
  return h.aside(
    [h.Class('menu-hud')],
    [
      h.header(
        [h.Class('menu-hud-head')],
        [
          ...(file
            ? [
                companyMark(file.logo, 'menu-hud-logo', h),
                h.span([h.Class('menu-hud-name')], [file.name]),
              ]
            : [h.span([h.Class('menu-hud-name')], [era.name])]),
          h.span([h.Class('menu-hud-time')], [clock(game.time)]),
        ],
      ),
      h.div(
        [h.Class('menu-hud-bar'), h.AriaHidden(true)],
        [h.span([h.Style({ width: `${Math.round(share * 100)}%` })], [])],
      ),
      h.div(
        [h.Class('menu-hud-body')],
        [
          vital(t.hud.cash, money(game.cash), '', Wallet),
          vital(t.hud.users, compact(game.users), '', Users),
          vital('Apdex', game.apdex.toFixed(2), `/ ${target.toFixed(2)}`, Smile),
          vital(t.hud.latency, ms(ledger.latency), '', Timer),
        ],
      ),
    ],
  )
}

export const ReaderClock = Mount.define('ReaderClock', {
  messages: [Message.Synced],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const show = () =>
          (element.textContent = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }))
        show()
        return setInterval(show, 1000)
      }),
      (timer) => Effect.sync(() => clearInterval(timer)),
    ).pipe(Effect.as(Message.Synced())),
})

const taskbar = (model: Model, page: Page, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const tool = (
    menu: typeof MenuPage.Type,
    label: string,
    glyph: Parameters<typeof icon>[1],
    extra = '',
  ) =>
    h.button(
      [
        h.Key(menu),
        h.Type('button'),
        h.Title(label),
        h.AriaLabel(label),
        h.AriaPressed(page === menu ? 'true' : 'false'),
        h.OnClick(Message.MenuChosen({ menu: page === menu ? 'main' : menu })),
      ],
      [
        icon(h, glyph, 'menu-icon'),
        h.span([h.Class('menu-dock-label')], [label]),
        extra ? h.span([h.Class('menu-figure')], [extra]) : h.empty,
      ],
    )
  return h.nav(
    [h.Class('menu-dock'), h.AriaLabel(t.title.taskbar)],
    [
      hint(h),
      tool('settings', t.title.settings, Settings),
      h.a(
        [
          h.Href(WIKI_URL),
          h.Target('_blank'),
          h.Rel('noreferrer noopener'),
          h.Title(t.title.wiki),
          h.AriaLabel(t.title.wiki),
        ],
        [icon(h, BookOpen, 'menu-icon'), h.span([h.Class('menu-dock-label')], [t.title.wiki])],
      ),
      h.span([h.Class('menu-clock'), h.OnMount(ReaderClock())], ['--:--']),
    ],
  )
}

const sessionOf = (model: Model): readonly [string, string] => {
  const t = copyIn(model.prefs.locale)

  const game = model.board.game
  const challengeRun = boardChallenge(model.board)
  if (challengeRun) {
    const challenge = challengeById(challengeRun.id)
    return [
      `drill@${challengeRun.id.replace(':', '-')}`,
      challenge
        ? `${t.catalog.challenges[challenge.id]?.name ?? challenge.name} · ${t.catalog.challenges[challenge.id]?.brief ?? challenge.brief}`
        : '',
    ]
  }
  const sandbox = boardSandbox(model.board)
  if (sandbox)
    return [
      `you@sandbox-${sandbox.id ?? 'free'}`,
      sandbox.id ? t.catalog.guided[sandbox.id].name : t.title.freeSandbox,
    ]
  return [
    'oncall@prod',
    t.title.eraUsersTime(eraWords(t, game).name, compact(game.users), clock(game.time)),
  ]
}

const terminal = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const [host, line] = sessionOf(model)
  return h.div(
    [h.Key('term'), h.Class('menu-term'), h.AriaLive('polite')],
    [
      h.p([], [h.b([], [`$ ssh ${host}`])]),
      h.p([], [line]),
      h.p([h.Class(css({ color: 'ok' }))], [t.title.connected]),
      h.span([h.Class('menu-caret')], []),
    ],
  )
}

const screenFigure = (model: Model, page: Page, h: HtmlBuilder<Message>): string | undefined => {
  const t = copy(h)
  switch (page) {
    case 'found':
    case 'challenges':
    case 'legacy':
      return t.title.legacy(model.founder.legacy)
    case 'companies':
      return `${model.saves.companies.length}`
    default:
      return undefined
  }
}

/* The main menu, laid out as the board lays out its Nodes: two cards of
   choices on the canvas, the company first because play resumes there. */
const mainPage = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [h.Class('menu-main'), h.DataAttribute('page', 'main')],
    [
      block(t.title.company, startRows(model, h), h),
      block(t.title.practice, practiceRows(model, h), h),
      block(t.title.founder, founderRows(model, h), h),
    ],
  )
}

const pageCard = (model: Model, page: Page, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [h.Class('menu-body'), h.DataAttribute('page', page)],
    [
      pageHead(
        {
          title: pagesOf(t)[page].title,
          back: page === 'save' ? 'companies' : 'main',
          figure: screenFigure(model, page, h),
        },
        h,
      ),
      h.nav(
        [
          h.Key(page === 'save' ? `save-${model.saveFocus}` : page),
          h.Class('menu-list'),
          h.AriaLabel(pagesOf(t)[page].title),
          h.DataAttribute('page', page),
        ],
        pagesOf(t)[page].rows(model, h),
      ),
      page === 'found' ? foundFooter(model, h) : h.empty,
    ],
  )
}

const screen = (model: Model, h: HtmlBuilder<Message>): Html => {
  const page = pageOf(model)
  return h.div(
    [
      h.Key(page),
      h.Class(`menu-page ${page === 'main' ? 'is-main' : 'is-page'}`),
      h.DataAttribute('page', page),
      h.OnMount(PageMounted()),
    ],
    [
      h.h1(
        [
          h.Class(
            css({
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: '0',
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              borderWidth: '0',
            }),
          ),
        ],
        ['Quorum'],
      ),
      page === 'main' ? mainPage(model, h) : pageCard(model, page, h),
    ],
  )
}

const disclaimer = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.a(
    [
      h.Class('menu-disclaimer'),
      h.Href(DISCLAIMER_URL),
      h.Target('_blank'),
      h.Rel('noreferrer noopener'),
    ],
    [t.title.quorumIsAGameAndSimplifies],
  )
}

/* The top band: the wordmark on the left, the playtest tools on the right, in
   the same white pill the board floats over its canvas. */
const strip = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const release = import.meta.env.VITE_SENTRY_RELEASE
  const build = release === undefined || release === '' ? 'dev' : release.slice(0, 7)
  return h.header(
    [h.Class('menu-band')],
    [
      h.span([h.Class('menu-brand')], [wordmark(h)]),
      h.nav(
        [h.Class('menu-tools'), h.AriaLabel(t.title.taskbar)],
        [
          h.a(
            [
              h.Href(build === 'dev' ? SOURCE_URL : `${SOURCE_URL}/commit/${release}`),
              h.Target('_blank'),
              h.Rel('noreferrer noopener'),
              h.Title(`${t.title.build} ${build}`),
              h.AriaLabel(`${t.title.build} ${build}`),
            ],
            [
              icon(h, Hash, 'menu-icon'),
              h.span([h.Class('menu-tool-label')], [`${t.title.build} ${build}`]),
            ],
          ),
          h.a(
            [
              h.Href('https://github.com/elianiva/quorum/issues'),
              h.Target('_blank'),
              h.Rel('noreferrer noopener'),
            ],
            [
              h.span([h.Class('menu-live')], []),
              h.span([h.Class('menu-tool-label')], [t.title.feedback]),
              icon(h, ArrowUpRight, 'menu-icon'),
            ],
          ),
          h.a(
            [
              h.Href('https://ko-fi.com/elianiva'),
              h.Target('_blank'),
              h.Rel('noreferrer noopener'),
              h.AriaLabel(t.title.supportOnKofi),
            ],
            [icon(h, Coffee, 'menu-icon'), h.span([h.Class('menu-tool-label')], [t.title.support])],
          ),
          h.a(
            [
              h.Href(SOURCE_URL),
              h.Target('_blank'),
              h.Rel('noreferrer noopener'),
              h.Title(t.title.openSourceOnGitHub),
              h.AriaLabel(t.title.openSourceOnGitHub),
            ],
            [githubMark(h, 'menu-icon')],
          ),
        ],
      ),
    ],
  )
}

const room = (model: Model, h: HtmlBuilder<Message>): Html => {
  const page = pageOf(model)
  return h.div(
    [h.Key('menu'), h.Class('menu'), h.OnMount(MenuDriver())],
    [
      strip(h),
      h.div(
        [h.Class('menu-stage')],
        [hasCompany(model) && page === 'main' ? status(model, h) : h.empty, screen(model, h)],
      ),
      taskbar(model, page, h),
      disclaimer(h),
      connecting(model.boot) ? terminal(model, h) : h.empty,
    ],
  )
}

const reader = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [h.Key('reader'), h.Class(`reader ${model.boot._tag === 'Clocking' ? 'is-in' : ''}`)],
    [
      h.h1(
        [
          h.Class(
            css({
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: '0',
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              borderWidth: '0',
            }),
          ),
        ],
        ['Quorum'],
      ),
      h.div(
        [h.Class('reader-body')],
        [
          ...[
            css({ top: '3', left: '3' }),
            css({ top: '3', right: '3' }),
            css({ bottom: '3', left: '3' }),
            css({ bottom: '3', right: '3' }),
          ].map((at) => h.span([h.Class(cx('reader-screw', at))], [])),
          h.div(
            [h.Class('reader-screen'), h.AriaLive('polite')],
            [
              h.span([h.Class('reader-time'), h.OnMount(ReaderClock())], ['--:--']),
              h.span(
                [h.Class('reader-status')],
                [
                  h.span([h.Class('reader-status-out')], [t.title.insertBadge]),
                  h.span([h.Class('reader-status-in')], [t.title.clockedIn]),
                ],
              ),
            ],
          ),
          h.span([h.Class('reader-led')], []),
          h.span([h.Class('reader-slot')], []),
        ],
      ),
      h.div(
        [h.Class('reader-well')],
        [
          h.button(
            [
              h.Type('button'),
              h.AriaLabel(t.title.clockIn),
              h.OnClick(Message.ClockedIn()),
              h.Class('reader-card'),
            ],
            [
              h.svg(
                [h.ViewBox('0 0 100 194'), h.Class('reader-card-mark'), h.AriaHidden(true)],
                [
                  ...GLYPHS[0]!.paths.map((d) =>
                    h.path([h.D(d), h.Fill('none'), h.Stroke('currentColor'), h.StrokeWidth('22')]),
                  ),
                  h.circle([h.Fill('var(--signal)'), h.Cx('89'), h.Cy('180'), h.R('14')]),
                ],
              ),
              h.span([h.Class('reader-card-chip')], []),
              h.span([h.Class('reader-card-name')], [t.title.founder]),
            ],
          ),
        ],
      ),
    ],
  )
}

export const titleScreen = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.main(
    [
      h.Class(
        cx(
          'title-screen',
          css({
            position: 'relative',
            display: 'grid',
            height: '100%',
            placeItems: 'center',
            overflow: 'hidden',
            backgroundColor: 'page',
            color: 'foreground',
          }),
        ),
      ),
    ],
    [
      titleIsOpen(model.boot)
        ? room(model, h)
        : h.div(
            [h.Class('reader-splash')],
            [
              reader(model, h),
              h.p([h.Class('reader-hint'), h.AriaHidden(true)], [copy(h).title.clockInHint]),
            ],
          ),
    ],
  )
