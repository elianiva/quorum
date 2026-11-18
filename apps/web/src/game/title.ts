/* The title screen: the clock-in splash, then the menu.

   The menu reads as an on-call runbook pinned to the board's canvas. Every
   choice is one line on a bus wire, numbered so a digit jumps to it; the line
   that holds the focus fills with ink and lights its node on the wire. The
   company's readout sits beside the index, with Continue as the first focus.

   Keyboard: arrows move (lists wrap, grids move by position and stop at their
   edges), Enter or Space opens, Esc or Backspace goes back. Every page
   remembers the line that had the focus, so coming back lands where you left. */
import { copyIn, copy, eraWords, localized } from '@/i18n/messages.ts'
import * as Effect from 'effect/Effect'
import { Mount } from 'foldkit'
import { DISCLAIMER_URL, SOURCE_URL, WIKI_URL } from '@/platform/analytics.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Download,
  Lock,
  RefreshCw,
  Settings,
  Trash2,
  type IconNode,
} from 'lucide'
import { css, cx } from '@quorum/styled-system/css'
import { icon } from '@quorum/ui/primitives/icon'
import { githubMark } from '@quorum/ui/primitives/github'
import { button } from '@quorum/ui/primitives/button'
import { inputClass } from '@quorum/ui/primitives/input'
import { Kbd } from '@quorum/ui/primitives/kbd'
import { progress } from '@quorum/ui/primitives/progress'
import { switch_ } from '@quorum/ui/primitives/switch'
import * as VolumeSlider from '@quorum/ui/primitives/slider'
import { companyMark } from '@/components/company-mark.ts'
import { languagePicker } from '@/i18n/picker.ts'
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
import { browserFamilyOf, onIos } from '../platform/pwa.ts'
import { play } from './sound.ts'

type Page = typeof MenuPage.Type | 'main' | 'save'

const depthOf = (page: Page): number => (page === 'main' ? 0 : page === 'save' ? 2 : 1)

/* ==========================================================================
   Keyboard and focus
   ========================================================================== */

/* Lines carry data-nav; the kit's controls inside a setting are stops too. */
const NAV = '[data-nav], .qm-setting :is([role="switch"], [role="slider"], button)'

const keyOf = (element: HTMLElement): string | undefined =>
  element.dataset.key ?? (element.id || undefined)

const shown = (element: HTMLElement) =>
  element.getClientRects().length > 0 && !(element as HTMLButtonElement).disabled

/* The page's stops in reading order. A tab row is one stop: the chosen tab. */
const stopsOf = (root: ParentNode, from: Element | null): ReadonlyArray<HTMLElement> =>
  [...root.querySelectorAll<HTMLElement>(`.qm-page :is(${NAV})`)].filter(
    (element) =>
      shown(element) &&
      (element.getAttribute('role') !== 'tab' ||
        element.getAttribute('aria-selected') === 'true' ||
        element === from),
  )

/* A grid moves by where its cells sit, not by their order. */
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

/* The line that last held the focus on each page, by its data-key. */
const remembered = new Map<string, string>()
let lastDepth = -1
let revealed = false

const pageKeyOf = (element: Element | null): string | null =>
  element?.closest<HTMLElement>('.qm-page')?.dataset.memory ?? null

const move = (to: HTMLElement | undefined) => {
  if (!to) return
  to.focus()
  play('hover')
}

export const MenuDriver = Mount.define('MenuDriver', {
  messages: [Message.Synced],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.altKey || event.metaKey || event.ctrlKey || event.defaultPrevented) return
          if (element.querySelector('.qm-connect')) return
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

          if (active?.getAttribute('role') === 'slider') {
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
                (tabs.indexOf(active) + (key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length
              ]
            if (next && next !== active) {
              next.focus()
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
            /* The edge of a grid: sideways stops, up and down leave it. */
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

          /* Enter and Space press the focused control here, before the board's
             own key listener can claim Space for pausing. */
          if (
            (key === 'Enter' || key === ' ') &&
            active &&
            (active instanceof HTMLButtonElement || active.getAttribute('role') === 'button')
          ) {
            event.preventDefault()
            event.stopPropagation()
            /* The kit's switch flips itself on Space's keyup. */
            if (!(key === ' ' && active.getAttribute('role') === 'switch')) active.click()
            return
          }

          if (key === 'Escape' || key === 'Backspace') {
            const back = element.querySelector<HTMLElement>('[data-back]')
            if (back) {
              event.preventDefault()
              event.stopPropagation()
              back.click()
            }
            return
          }

          if (/^[1-9]$/.test(key)) {
            const line = element.querySelector<HTMLElement>(`[data-hotkey="${key}"]`)
            if (line && shown(line)) {
              event.preventDefault()
              event.stopPropagation()
              line.focus()
              line.click()
            }
          }
        }
        const onFocusIn = (event: Event) => {
          const target = event.target instanceof HTMLElement ? event.target : null
          const page = pageKeyOf(target)
          const stop = target?.closest<HTMLElement>(NAV)
          const key = stop ? keyOf(stop) : undefined
          if (page && key) remembered.set(page, key)
        }
        const onPointerOver = (event: Event) => {
          if (!(event instanceof PointerEvent) || event.pointerType !== 'mouse') return
          const line = event.target instanceof Element ? event.target.closest(NAV) : null
          if (!line) return
          const from = event.relatedTarget instanceof Node ? event.relatedTarget : null
          if (from && line.contains(from)) return
          play('hover')
        }
        const onClick = (event: Event) => {
          if (event.target instanceof Element && event.target.closest('button')) play('choose')
        }
        window.addEventListener('keydown', onKeyDown, true)
        element.addEventListener('focusin', onFocusIn)
        element.addEventListener('pointerover', onPointerOver)
        element.addEventListener('click', onClick)
        return () => {
          window.removeEventListener('keydown', onKeyDown, true)
          element.removeEventListener('focusin', onFocusIn)
          element.removeEventListener('pointerover', onPointerOver)
          element.removeEventListener('click', onClick)
        }
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.as(Message.Synced())),
})

/* A page arrives from the side its depth says: deeper slides in from the
   right, back from the left. The focus lands on the remembered line, else on
   the page's first choice. */
export const PageMounted = Mount.define('PageMounted', {
  messages: [Message.Synced],
  execute: ({ element }) =>
    Effect.sync(() => {
      const depth = Number(element.getAttribute('data-depth') ?? '0')
      element.setAttribute(
        'data-enter',
        lastDepth < 0 ? (revealed ? 'fade' : 'first') : depth >= lastDepth ? 'deeper' : 'back',
      )
      lastDepth = depth
      revealed = true
      const memory = element.getAttribute('data-memory') ?? ''
      const key = remembered.get(memory)
      const stops = [...element.querySelectorAll<HTMLElement>(NAV)].filter(shown)
      const target =
        (key ? stops.find((stop) => keyOf(stop) === key) : undefined) ??
        stops.find((stop) => stop.hasAttribute('data-first')) ??
        stops.find((stop) => stop.getAttribute('aria-checked') === 'true') ??
        stops.find((stop) => stop.getAttribute('role') !== 'tab' && !stop.closest('.qm-steps')) ??
        stops[0]
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'nearest' })
      return Message.Synced()
    }),
})

export const WallClock = Mount.define('WallClock', {
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

/* ==========================================================================
   Parts
   ========================================================================== */

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

const wordmark = (className: string, h: HtmlBuilder<Message>): Html =>
  h.svg(
    [
      h.ViewBox('0 0 720 194'),
      h.Class(cx('qm-mark', className)),
      h.Role('img'),
      h.AriaLabel('Quorum'),
    ],
    [
      ...GLYPHS.flatMap(({ at, paths }, letter) =>
        paths.map((d) =>
          h.path([
            h.D(d),
            h.Transform(`translate(${at} 0)`),
            h.PathLength('1'),
            h.Style({ '--i': `${letter}` }),
          ]),
        ),
      ),
      h.circle([h.Cx('89'), h.Cy('180'), h.R('14')]),
    ],
  )

const glyph = (node: IconNode, h: HtmlBuilder<Message>) => icon(h, node, 'qm-icon')

const hidden = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
})

type Line = Readonly<{
  key: string
  label: string
  detail?: string | undefined
  figure?: Html | string | undefined
  lead?: Html | undefined
  message: Message | null
  hotkey?: number | undefined
  first?: boolean
  danger?: boolean
  pick?: 'radio' | 'checkbox' | undefined
  checked?: boolean
  index?: number
}>

/* One choice on the bus. A line without a message stays focusable so a
   keyboard or screen reader still reads what it offers; it just does nothing. */
const line = (r: Line, h: HtmlBuilder<Message>): Html =>
  h.button(
    [
      h.Key(r.key),
      h.Type('button'),
      h.DataAttribute('nav', ''),
      h.DataAttribute('key', r.key),
      ...(r.first ? [h.DataAttribute('first', '')] : []),
      ...(r.hotkey
        ? [h.DataAttribute('hotkey', `${r.hotkey}`), h.AriaKeyshortcuts(`${r.hotkey}`)]
        : []),
      ...(r.message ? [h.OnClick(r.message)] : [h.AriaDisabled(true)]),
      ...(r.pick ? [h.Role(r.pick), h.AriaChecked(r.checked === true)] : []),
      h.Style({ '--i': `${r.index ?? 0}` }),
      h.Class(cx('qm-line', r.danger && 'is-danger', !r.hotkey && !r.pick && !r.lead && 'is-bare')),
    ],
    [
      r.hotkey
        ? h.span([h.Class('qm-num'), h.AriaHidden(true)], [`${r.hotkey}`.padStart(2, '0')])
        : r.pick
          ? h.span(
              [h.Class(cx('qm-tick', `is-${r.pick}`)), h.AriaHidden(true)],
              [r.checked ? glyph(Check, h) : ''],
            )
          : (r.lead ?? h.empty),
      h.span(
        [h.Class('qm-text')],
        [
          h.span([h.Class('qm-label')], [r.label]),
          r.detail ? h.span([h.Class('qm-detail')], [r.detail]) : h.empty,
        ],
      ),
      r.figure === undefined ? h.empty : h.span([h.Class('qm-figure')], [r.figure]),
    ],
  )

/* A record that only reads: a history entry. It still takes the focus so the
   arrows walk the list and a screen reader reads each one. */
const record = (
  r: Readonly<{ key: string; label: string; detail: string; figure: string }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.li(
    [
      h.Key(r.key),
      h.Tabindex(-1),
      h.DataAttribute('nav', ''),
      h.DataAttribute('key', r.key),
      h.Class('qm-line is-record is-bare'),
    ],
    [
      h.span(
        [h.Class('qm-text')],
        [h.span([h.Class('qm-label')], [r.label]), h.span([h.Class('qm-detail')], [r.detail])],
      ),
      h.span([h.Class('qm-figure')], [r.figure]),
    ],
  )

type TileState = 'done' | 'next' | 'open' | 'locked'

const tile = (
  r: Readonly<{
    key: string
    label: string
    detail?: string | undefined
    figure?: string | undefined
    state?: TileState
    message?: Message | undefined
    pick?: 'radio' | 'checkbox'
    checked?: boolean
    mark?: Html
  }>,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  const state = r.state ?? 'open'
  return h.button(
    [
      h.Key(r.key),
      h.Type('button'),
      h.DataAttribute('nav', ''),
      h.DataAttribute('key', r.key),
      ...(state === 'next' ? [h.DataAttribute('first', '')] : []),
      ...(r.message ? [h.OnClick(r.message)] : [h.AriaDisabled(true)]),
      ...(r.pick ? [h.Role(r.pick), h.AriaChecked(r.checked === true)] : []),
      ...(state === 'done' || state === 'locked'
        ? [h.AriaDescription(state === 'done' ? t.title.earned : t.title.notYet)]
        : []),
      h.Class(cx('qm-tile', `is-${state}`, r.checked && 'is-on')),
    ],
    [
      h.span(
        [h.Class('qm-tile-head')],
        [
          r.mark ?? h.empty,
          h.span([h.Class('qm-tile-name')], [r.label]),
          h.span(
            [h.Class('qm-tile-state'), h.AriaHidden(true)],
            [
              r.pick
                ? h.span(
                    [h.Class(cx('qm-tick', `is-${r.pick}`))],
                    [r.checked ? glyph(Check, h) : ''],
                  )
                : state === 'done'
                  ? glyph(Check, h)
                  : state === 'locked'
                    ? glyph(Lock, h)
                    : state === 'next'
                      ? glyph(ChevronRight, h)
                      : '',
            ],
          ),
        ],
      ),
      r.detail ? h.span([h.Class('qm-tile-detail')], [r.detail]) : h.empty,
      r.figure ? h.span([h.Class('qm-tile-figure')], [r.figure]) : h.empty,
    ],
  )
}

const section = (
  title: string,
  body: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
  grid = false,
): Html =>
  h.section(
    [h.Key(`section-${title}`), h.Class('qm-section')],
    [
      h.h2([h.Class('qm-eyebrow')], [title]),
      grid
        ? h.div([h.Class('qm-grid'), h.DataAttribute('grid', '')], body)
        : h.div([h.Class('qm-bus')], body),
    ],
  )

const note = (text: string, h: HtmlBuilder<Message>): Html =>
  h.p([h.Key(`note-${text}`), h.Class('qm-note')], [text])

/* ==========================================================================
   Main page
   ========================================================================== */

/* The company as the board reads it: name, era, how far to the next raise,
   and the four vitals in mono. Continue sits under it and takes the focus. */
const readout = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const game = model.board.game
  const file = currentFile(model)
  const ledger = ledgerOf(model)
  const era = eraOf(game)
  const share = Math.round(Math.min(1, game.users / era.raiseAt) * 100)
  const vital = (label: string, value: string, extra = '') =>
    h.div(
      [h.Class('qm-vital')],
      [
        h.dt([], [label]),
        h.dd([], [value, extra ? h.span([h.Class('qm-vital-of')], [extra]) : h.empty]),
      ],
    )
  return h.section(
    [h.Class('qm-readout'), h.AriaLabel(file?.name ?? t.title.company)],
    [
      h.div(
        [h.Class('qm-readout-head')],
        [
          file ? companyMark(file.logo, 'qm-logo', h) : h.empty,
          h.div(
            [h.Class('qm-readout-title')],
            [
              h.span([h.Class('qm-readout-name')], [file?.name ?? eraWords(t, game).name]),
              h.span(
                [h.Class('qm-readout-era')],
                [`${eraWords(t, game).name} · ${clock(game.time)}`],
              ),
            ],
          ),
        ],
      ),
      progress({ value: share, label: eraWords(t, game).name, className: 'qm-raise' }, h),
      h.dl(
        [h.Class('qm-vitals')],
        [
          vital(t.hud.cash, money(game.cash)),
          vital(t.hud.users, compact(game.users)),
          vital('Apdex', game.apdex.toFixed(2), ` / ${era.apdexTarget.toFixed(2)}`),
          vital(t.hud.latency, ms(ledger.latency)),
        ],
      ),
      button(
        {
          onClick: Message.Continued(),
          size: 'lg',
          className: 'qm-cta',
          attributes: [
            h.DataAttribute('nav', ''),
            h.DataAttribute('key', 'continue'),
            h.DataAttribute('first', ''),
          ],
        },
        [h.span([], [t.title.continueText]), glyph(ChevronRight, h)],
        h,
      ),
    ],
  )
}

/* With no company yet, the hero has one thing to say: start one. */
const firstRun = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.section(
    [h.Class('qm-readout is-empty')],
    [
      button(
        {
          onClick: Message.MenuChosen({ menu: 'found' }),
          size: 'lg',
          className: 'qm-cta',
          attributes: [
            h.DataAttribute('nav', ''),
            h.DataAttribute('key', 'start'),
            h.DataAttribute('first', ''),
          ],
        },
        [h.span([], [t.title.startACompany]), glyph(ChevronRight, h)],
        h,
      ),
    ],
  )
}

const notices = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const out: Array<Html> = []
  if (model.pwa.updateReady)
    out.push(
      line(
        {
          key: 'pwa-update',
          label: t.pwa.updateReady,
          detail: t.pwa.updateReadyDetail,
          figure: glyph(RefreshCw, h),
          message: Message.PwaUpdateChosen(),
        },
        h,
      ),
    )
  if (!model.pwa.installed && !model.prefs.pwaPromptSeen && model.saves.companies.length > 0) {
    out.push(
      line(
        {
          key: 'pwa-install',
          label: t.pwa.installQuorum,
          detail: model.pwa.installable
            ? t.pwa.installPrompt
            : t.pwa.installHelp[browserFamilyOf()],
          figure: glyph(Download, h),
          message: model.pwa.installable ? Message.PwaInstallChosen() : null,
        },
        h,
      ),
    )
    if (onIos()) out.push(note(t.pwa.moveNote, h))
    out.push(
      line({ key: 'pwa-not-now', label: t.pwa.notNow, message: Message.PwaPromptDismissed() }, h),
    )
  }
  return out.length === 0 ? [] : [section(t.pwa.app, out, h)]
}

const mainIndex = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const count = model.saves.companies.length
  const passed = SANDBOX_IDS.filter((id) => model.passed.includes(id)).length
  const solved = CHALLENGES.filter((entry) => model.founder.completed.includes(entry.id)).length
  let n = 0
  const next = () => ++n
  const go = (menu: typeof MenuPage.Type) => Message.MenuChosen({ menu })
  const company = [
    ...(hasCompany(model)
      ? [line({ key: 'new', label: t.title.newCompany, message: go('found'), hotkey: next() }, h)]
      : []),
    line(
      {
        key: 'import',
        label: t.title.importACompany,
        message: Message.CompanyFileAsked(),
        hotkey: next(),
      },
      h,
    ),
    ...(count > 0
      ? [
          line(
            {
              key: 'companies',
              label: t.title.companies,
              figure: `${count}`,
              message: go('companies'),
              hotkey: next(),
            },
            h,
          ),
        ]
      : []),
  ]
  const practice = [
    line(
      {
        key: 'sandbox',
        label: t.title.sandbox,
        figure: `${passed}/${SANDBOX_IDS.length}`,
        message: go('sandbox'),
        hotkey: next(),
      },
      h,
    ),
    line(
      {
        key: 'challenges',
        label: t.title.challenges,
        figure: `${solved}/${CHALLENGES.length}`,
        message: go('challenges'),
        hotkey: next(),
      },
      h,
    ),
  ]
  const founder = [
    line(
      {
        key: 'achievements',
        label: t.title.achievements,
        figure: `${model.founder.achievements.length}/${ACHIEVEMENT_IDS.length}`,
        message: go('achievements'),
        hotkey: next(),
      },
      h,
    ),
    line(
      {
        key: 'legacy',
        label: t.title.legacyShop,
        figure: `${model.founder.legacy}`,
        message: go('legacy'),
        hotkey: next(),
      },
      h,
    ),
    line(
      {
        key: 'history',
        label: t.title.history,
        figure: `${model.founder.history.length}`,
        message: go('history'),
        hotkey: next(),
      },
      h,
    ),
  ]
  return h.nav(
    [h.Class('qm-index'), h.AriaLabel(t.title.mainMenu)],
    [
      ...notices(model, h),
      section(t.title.company, company, h),
      section(t.title.practice, practice, h),
      section(t.title.founder, founder, h),
    ],
  )
}

const mainPage = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('qm-main')],
    [
      h.div(
        [h.Class('qm-hero')],
        [
          h.h1([h.Class('qm-hero-title')], [wordmark('is-hero', h)]),
          hasCompany(model) ? readout(model, h) : firstRun(h),
        ],
      ),
      mainIndex(model, h),
    ],
  )

/* ==========================================================================
   Pages
   ========================================================================== */

const FOUND_STEPS: ReadonlyArray<FoundStep> = ['company', 'venture', 'mutators']

const foundSteps = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const label: Record<FoundStep, string> = {
    company: t.title.company,
    venture: t.title.venture,
    mutators: t.title.mutators,
  }
  const at = FOUND_STEPS.indexOf(model.foundStep)
  return h.ol(
    [
      h.Key('steps'),
      h.Class('qm-steps'),
      h.AriaLabel(t.title.newCompany),
      h.DataAttribute('grid', ''),
    ],
    FOUND_STEPS.map((step, index) =>
      h.li(
        [h.Key(step)],
        [
          h.button(
            [
              h.Type('button'),
              h.DataAttribute('nav', ''),
              h.DataAttribute('key', `step-${step}`),
              ...(step === model.foundStep ? [h.AriaCurrent('step')] : []),
              h.Class(cx('qm-step', index < at && 'is-past')),
              h.OnClick(Message.FoundStepChosen({ step })),
            ],
            [
              h.span([h.Class('qm-step-num'), h.AriaHidden(true)], [`${index + 1}`]),
              h.span([], [label[step]]),
            ],
          ),
        ],
      ),
    ),
  )
}

const companyStep = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  return [
    h.label(
      [h.Key('name'), h.Class('qm-field')],
      [
        h.span([h.Class('qm-eyebrow')], [t.title.companyName]),
        h.input([
          h.Class(cx(inputClass, 'qm-input')),
          h.Type('text'),
          h.Value(model.draft.name),
          h.Placeholder(t.title.nameYourCompany),
          h.Maxlength(MAX_COMPANY_NAME),
          h.Autocomplete('off'),
          h.Spellcheck(false),
          h.DataAttribute('nav', ''),
          h.DataAttribute('key', 'name'),
          h.DataAttribute('first', ''),
          h.OnInput((name) => Message.CompanyNameChanged({ name })),
        ]),
      ],
    ),
    section(
      t.title.logo,
      LOGOS.map((logo) =>
        tile(
          {
            key: `logo-${logo.id}`,
            label: t.logos[logo.id],
            mark: companyMark(logo.id, 'qm-logo is-small', h),
            pick: 'radio',
            checked: model.draft.logo === logo.id,
            message: Message.LogoChosen({ logo: logo.id }),
          },
          h,
        ),
      ),
      h,
      true,
    ),
  ]
}

const ventureStep = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const founding = foundingOf(model.founder)
  return [
    section(
      t.title.venture,
      VENTURE_IDS.map((id) => {
        const def = localized(VENTURES[id], t.catalog.ventures[id])
        return tile(
          {
            key: id,
            label: def.name,
            detail: def.summary,
            figure: `×${def.legacy.toFixed(1)}`,
            pick: 'radio',
            checked: id === founding.venture,
            message: Message.VentureChosen({ id }),
          },
          h,
        )
      }),
      h,
      true,
    ),
  ]
}

const mutatorStep = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const founding = foundingOf(model.founder)
  return [
    section(
      t.title.mutators,
      MUTATOR_IDS.map((id) =>
        tile(
          {
            key: id,
            label: t.catalog.mutators[id].name,
            detail: t.catalog.mutators[id].rule,
            figure: `+${Math.round(MUTATORS[id].legacy * 100)}%`,
            pick: 'checkbox',
            checked: founding.mutators.includes(id),
            message: Message.MutatorToggled({ id }),
          },
          h,
        ),
      ),
      h,
      true,
    ),
  ]
}

const foundBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const step: Record<FoundStep, () => ReadonlyArray<Html>> = {
    company: () => companyStep(model, h),
    venture: () => ventureStep(model, h),
    mutators: () => mutatorStep(model, h),
  }
  return [foundSteps(model, h), ...step[model.foundStep]()]
}

/* The founding form's foot: the company as it will be founded, then the one
   action this step needs. */
const foundFoot = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const founding = foundingOf(model.founder)
  const ahead: Record<FoundStep, Readonly<{ label: string; step: FoundStep }> | null> = {
    company: { label: t.title.venture, step: 'venture' },
    venture: { label: t.title.mutators, step: 'mutators' },
    mutators: null,
  }
  const next = ahead[model.foundStep]
  return h.footer(
    [h.Class('qm-foot')],
    [
      h.div(
        [h.Class('qm-preview'), h.AriaLive('polite')],
        [
          companyMark(model.draft.logo, 'qm-logo', h),
          h.span(
            [h.Class('qm-text')],
            [
              h.span([h.Class('qm-label')], [nameOr(model.draft.name)]),
              h.span(
                [h.Class('qm-detail')],
                [t.title.legacy2(startEra(founding), legacyMultiplier(founding).toFixed(2))],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('qm-foot-actions')],
        next
          ? [
              button(
                {
                  onClick: Message.FoundStepChosen({ step: next.step }),
                  size: 'lg',
                  className: 'qm-cta',
                  attributes: [h.DataAttribute('nav', ''), h.DataAttribute('key', 'next')],
                },
                [h.span([], [`${t.title.next}: ${next.label}`]), glyph(ChevronRight, h)],
                h,
              ),
            ]
          : [
              button(
                {
                  onClick: Message.PreseedStarted(),
                  size: 'lg',
                  variant: 'outline',
                  className: 'qm-cta',
                  attributes: [
                    h.DataAttribute('nav', ''),
                    h.DataAttribute('key', 'preseed'),
                    h.AriaDescription(t.title.skipsGarage),
                    h.Title(t.title.skipsGarage),
                  ],
                },
                [t.title.startInPreSeed],
                h,
              ),
              button(
                {
                  onClick: Message.CompanyFounded(),
                  size: 'lg',
                  className: 'qm-cta',
                  attributes: [h.DataAttribute('nav', ''), h.DataAttribute('key', 'found')],
                },
                [h.span([], [t.title.found(nameOr(model.draft.name))]), glyph(ChevronRight, h)],
                h,
              ),
            ],
      ),
    ],
  )
}

const dateOf = (file: CompanyFile): string =>
  new Date(file.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const fileLine = (file: CompanyFile, h: HtmlBuilder<Message>) => {
  const t = copy(h)
  return `${t.catalog.ventures[file.venture].name} · ${t.title.eraUsersTime(t.catalog.eras[file.stage]?.name ?? '', compact(file.users), clock(file.time))}`
}

const companiesBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  if (model.saves.companies.length === 0) return [note(t.title.noCompaniesSavedYet, h)]
  return [
    h.div(
      [h.Class('qm-bus')],
      recent(model.saves.companies).map((file, index) =>
        line(
          {
            key: file.id,
            lead: companyMark(file.logo, 'qm-logo is-small', h),
            label: file.name,
            detail: fileLine(file, h),
            figure:
              file.online !== null
                ? `${t.room.onlineMark} · ${file.online.code}`
                : file.id === model.saves.current
                  ? t.title.current
                  : dateOf(file),
            message: Message.CompanyChosen({ id: file.id }),
            index,
          },
          h,
        ),
      ),
    ),
  ]
}

const saveBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const file = model.saves.companies.find((entry) => entry.id === model.saveFocus)
  if (!file) return []
  const isCurrent = file.id === model.saves.current
  const started = new Date(file.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return [
    h.div(
      [h.Class('qm-file')],
      [
        companyMark(file.logo, 'qm-logo is-large', h),
        h.dl(
          [h.Class('qm-vitals is-file')],
          [
            h.div(
              [h.Class('qm-vital')],
              [h.dt([], [t.title.venture]), h.dd([], [t.catalog.ventures[file.venture].name])],
            ),
            h.div(
              [h.Class('qm-vital')],
              [h.dt([], [t.hud.users]), h.dd([], [compact(file.users)])],
            ),
            h.div(
              [h.Class('qm-vital')],
              [h.dt([], [t.title.mutators]), h.dd([], [`${file.mutators.length}`])],
            ),
          ],
        ),
      ],
    ),
    h.div(
      [h.Class('qm-bus')],
      [
        line(
          {
            key: 'open',
            label: isCurrent ? t.title.continueText : t.title.openCompany,
            detail: `${t.catalog.eras[file.stage]?.name ?? ''} · ${clock(file.time)} · ${t.title.started(started)}`,
            figure: glyph(ChevronRight, h),
            message: Message.CompanyOpened({ id: file.id }),
            first: true,
          },
          h,
        ),
        ...(model.saveConfirm._tag === 'Confirming'
          ? [
              line(
                {
                  key: 'delete-yes',
                  label: t.title.deleteForever,
                  detail: t.title.theCompanyAndItsDesignAre,
                  figure: glyph(Trash2, h),
                  message: Message.CompanyDeleteConfirmed(),
                  danger: true,
                },
                h,
              ),
              line(
                {
                  key: 'delete-no',
                  label: t.title.keepCompany,
                  message: Message.CompanyDeleteCancelled(),
                },
                h,
              ),
            ]
          : [
              line(
                {
                  key: 'delete',
                  label: t.title.deleteCompany,
                  figure: glyph(Trash2, h),
                  message: Message.CompanyDeleteAsked(),
                },
                h,
              ),
            ]),
      ],
    ),
  ]
}

const sandboxBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const next = SANDBOX_IDS.find((id) => !model.passed.includes(id) && sandboxOpen(id, model.passed))
  return [
    ...TRACKS.map((track) => {
      const passed = track.sandboxes.filter((id) => model.passed.includes(id)).length
      return section(
        `${t.catalog.eras[track.stage]?.name ?? ''} · ${passed}/${track.sandboxes.length}`,
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
              message: open ? Message.GuidedStarted({ id }) : undefined,
            },
            h,
          )
        }),
        h,
        true,
      )
    }),
    h.div(
      [h.Key('free'), h.Class('qm-bus')],
      [
        line(
          {
            key: 'free',
            label: t.title.freeSandbox,
            figure: glyph(ChevronRight, h),
            message: Message.FreeSandboxStarted(),
          },
          h,
        ),
      ],
    ),
  ]
}

const challengesBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const done = model.founder.completed
  const drill = model.today ? dailyDrill(model.today) : null
  const challenge = (id: string, label: string, detail: string, legacy: number) =>
    line(
      {
        key: id,
        label,
        detail,
        figure: done.includes(id)
          ? glyph(Check, h)
          : legacy > 0
            ? t.title.legacy(legacy)
            : undefined,
        message: Message.ChallengeStarted({ id }),
      },
      h,
    )
  return [
    ...(drill
      ? [section(t.title.dailyDrill, [challenge(drill.id, t.title.dailyDrill, drill.brief, 0)], h)]
      : []),
    ...ERAS.flatMap((era, stage) => {
      const list = CHALLENGES.filter((entry) => entry.era === stage)
      if (list.length === 0) return []
      const solved = list.filter((entry) => done.includes(entry.id)).length
      return [
        section(
          `${t.catalog.eras[stage]?.name ?? era.name} · ${solved}/${list.length}`,
          list.map((entry) =>
            challenge(
              entry.id,
              t.catalog.challenges[entry.id]!.name,
              t.catalog.challenges[entry.id]!.brief,
              entry.legacy,
            ),
          ),
          h,
        ),
      ]
    }),
  ]
}

const legacyBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  return [
    h.div(
      [h.Class('qm-bus')],
      PERK_IDS.map((id) => {
        const def = localized(PERKS[id], t.catalog.perks[id])
        const price = perkPrice(model.founder, id)
        const level = levelOf(model.founder, id)
        return line(
          {
            key: id,
            label: def.name,
            detail: def.effect,
            lead: h.span(
              [h.Class('qm-pips'), h.AriaLabel(`${level}/${def.costs.length}`), h.Role('img')],
              def.costs.map((_, index) => h.span([h.Class(index < level ? 'is-on' : '')], [])),
            ),
            figure: price === null ? glyph(Check, h) : t.title.legacy(price),
            message:
              price !== null && model.founder.legacy >= price ? Message.PerkBought({ id }) : null,
          },
          h,
        )
      }),
    ),
  ]
}

const historyBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  if (model.founder.history.length === 0) return [note(t.title.noExitsYet, h)]
  return [
    h.ol(
      [h.Class('qm-bus')],
      model.founder.history
        .map((entry, index) => {
          const exit = t.catalog.exits[entry.exit].name
          const venture = t.catalog.ventures[entry.founding.venture].name
          return record(
            {
              key: `h${index}`,
              label: entry.name || `${exit} · ${venture}`,
              detail: `${entry.name ? `${exit} · ` : ''}${venture} · ${t.title.eraUsersTime(t.catalog.eras[entry.stage]?.name ?? '', compact(entry.peak), clock(entry.time))}`,
              figure: `+${entry.legacy}`,
            },
            h,
          )
        })
        .toReversed(),
    ),
  ]
}

const achievementsBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const earned = model.founder.achievements
  return [
    progress(
      {
        value: Math.round((earned.length / ACHIEVEMENT_IDS.length) * 100),
        label: t.title.achievements,
        className: 'qm-meter',
      },
      h,
    ),
    h.div(
      [h.Class('qm-grid is-dense'), h.DataAttribute('grid', '')],
      [...ACHIEVEMENT_IDS]
        .sort((a, b) => Number(earned.includes(b)) - Number(earned.includes(a)))
        .map((id) => {
          const isEarned = earned.includes(id)
          return h.div(
            [
              h.Key(id),
              h.Tabindex(-1),
              h.DataAttribute('nav', ''),
              h.DataAttribute('key', id),
              h.Role('group'),
              h.AriaLabel(
                `${t.catalog.achievements[id].name}. ${t.catalog.achievements[id].condition}. ${isEarned ? t.title.earned : t.title.notYet}`,
              ),
              h.Class(cx('qm-tile is-badge', isEarned ? 'is-done' : 'is-locked')),
            ],
            [
              h.span(
                [h.Class('qm-tile-head')],
                [
                  h.span([h.Class('qm-tile-name')], [t.catalog.achievements[id].name]),
                  h.span(
                    [h.Class('qm-tile-state'), h.AriaHidden(true)],
                    [glyph(isEarned ? Check : Lock, h)],
                  ),
                ],
              ),
              h.span([h.Class('qm-tile-detail')], [t.catalog.achievements[id].condition]),
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
      return h.div(
        [h.Key('volume'), h.Class('qm-setting is-volume')],
        [
          h.submodel({
            slotId: 'volume',
            model: model.volumeSlider,
            view: VolumeSlider.view,
            toParentMessage: (message) => Message.VolumeSliderChanged({ message }),
            viewInputs: VolumeSlider.styledViewInputs(
              {
                value: model.prefs.volume,
                label: setting.label,
                formatValue: (value) => `${value}%`,
                isDisabled: model.prefs.muted,
                thumbClass: 'qm-thumb',
              },
              h,
            ),
          }),
        ],
      )
    case 'toggle':
      return h.div(
        [h.Key(setting.id), h.Class('qm-setting')],
        [
          switch_(
            {
              id: `menu-${setting.id}`,
              label: setting.label,
              isChecked: setting.isOn,
              onToggle: () => setting.message,
              className: 'qm-switch',
              wrapperClass: 'qm-switch-row',
              textClass: css({ flex: '1 1 0%', minWidth: '0' }),
              labelClass: 'qm-label',
            },
            h,
          ),
        ],
      )
    case 'language':
      return h.div(
        [h.Key('language'), h.Class('qm-setting is-split')],
        [
          h.span([h.Class('qm-label')], [t.panels.language]),
          languagePicker(model.prefs.locale, model.languagePicker, h),
        ],
      )
    case 'action':
      return line(
        {
          key: setting.id,
          label: setting.label,
          figure: glyph(setting.glyph, h),
          message: setting.message,
        },
        h,
      )
  }
}

const settingsBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const sections = settingsSections(model, t)
  const active = sections.find((part) => part.id === model.settingsSection) ?? sections[0]!
  const pwa: Array<Html> = []
  if (!model.pwa.installed) {
    pwa.push(
      line(
        {
          key: 'pwa-install-setting',
          label: t.pwa.installQuorum,
          detail: model.pwa.installable
            ? t.pwa.installDetail
            : t.pwa.installHelp[browserFamilyOf()],
          figure: glyph(Download, h),
          message: model.pwa.installable ? Message.PwaInstallChosen() : null,
        },
        h,
      ),
    )
    if (onIos()) pwa.push(note(t.pwa.moveNote, h))
  }
  if (model.pwa.updateReady)
    pwa.push(
      line(
        {
          key: 'pwa-update-setting',
          label: t.pwa.updateReady,
          detail: t.pwa.updateReadyDetail,
          figure: glyph(RefreshCw, h),
          message: Message.PwaUpdateChosen(),
        },
        h,
      ),
    )
  return [
    h.div(
      [h.Key('tabs'), h.Class('qm-tabs'), h.Role('tablist'), h.AriaLabel(t.panels.settings)],
      sections.map((part) =>
        h.button(
          [
            h.Key(part.id),
            h.Type('button'),
            h.Role('tab'),
            h.Id(`menu-tab-${part.id}`),
            h.AriaSelected(part.id === active.id),
            h.AriaControls('menu-tab-panel'),
            h.Tabindex(part.id === active.id ? 0 : -1),
            ...(part.id === active.id ? [h.DataAttribute('first', '')] : []),
            h.DataAttribute('nav', ''),
            h.DataAttribute('key', `tab-${part.id}`),
            h.Class('qm-tab'),
            h.OnClick(Message.SettingsSectionChosen({ section: part.id })),
          ],
          [part.label],
        ),
      ),
    ),
    h.div(
      [
        h.Key(`panel-${active.id}`),
        h.Id('menu-tab-panel'),
        h.Role('tabpanel'),
        h.AriaLabelledBy(`menu-tab-${active.id}`),
        h.Class('qm-bus is-settings'),
      ],
      active.rows.map((setting) => settingRow(setting, model, h)),
    ),
    ...(pwa.length > 0 ? [section(t.pwa.app, pwa, h)] : []),
  ]
}

type PageDef = Readonly<{
  title: string
  body: (model: Model, h: HtmlBuilder<Message>) => ReadonlyArray<Html>
  figure?: (model: Model, h: HtmlBuilder<Message>) => string
}>

const legacyFigure = (model: Model, h: HtmlBuilder<Message>) =>
  copy(h).title.legacy(model.founder.legacy)

const pagesOf = (model: Model, h: HtmlBuilder<Message>): Record<Exclude<Page, 'main'>, PageDef> => {
  const t = copy(h)
  return {
    found: { title: t.title.newCompany, body: foundBody, figure: legacyFigure },
    companies: {
      title: t.title.companies,
      body: companiesBody,
      figure: (m) => `${m.saves.companies.length}`,
    },
    save: {
      title:
        model.saves.companies.find((entry) => entry.id === model.saveFocus)?.name ??
        t.title.company,
      body: saveBody,
    },
    sandbox: {
      title: t.title.sandbox,
      body: sandboxBody,
      figure: (m) =>
        `${SANDBOX_IDS.filter((id) => m.passed.includes(id)).length}/${SANDBOX_IDS.length}`,
    },
    challenges: { title: t.title.challenges, body: challengesBody, figure: legacyFigure },
    legacy: { title: t.title.legacyShop, body: legacyBody, figure: legacyFigure },
    history: {
      title: t.title.history,
      body: historyBody,
      figure: (m) => `${m.founder.history.length}`,
    },
    achievements: {
      title: t.title.achievements,
      body: achievementsBody,
      figure: (m) => `${m.founder.achievements.length}/${ACHIEVEMENT_IDS.length}`,
    },
    settings: { title: t.title.settings, body: settingsBody },
  }
}

const pageOf = (model: Model): Page => {
  const page = menuOf(model.route)
  return page === 'companies' && model.saveFocus !== null ? 'save' : page
}

const subPage = (model: Model, page: Exclude<Page, 'main'>, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const def = pagesOf(model, h)[page]
  return h.div(
    [h.Class('qm-sub')],
    [
      h.header(
        [h.Class('qm-sub-head')],
        [
          button(
            {
              onClick:
                page === 'save' ? Message.CompanyClosed() : Message.MenuChosen({ menu: 'main' }),
              variant: 'ghost',
              className: 'qm-back',
              attributes: [h.DataAttribute('back', ''), h.AriaKeyshortcuts('Escape')],
            },
            [
              glyph(ChevronLeft, h),
              h.span([], [page === 'save' ? t.title.companies : t.title.back]),
            ],
            h,
          ),
          h.h1([h.Class('qm-sub-title')], [def.title]),
          def.figure ? h.span([h.Class('qm-sub-figure')], [def.figure(model, h)]) : h.empty,
        ],
      ),
      h.div([h.Class('qm-sub-body')], def.body(model, h)),
      page === 'found' ? foundFoot(model, h) : h.empty,
    ],
  )
}

const screen = (model: Model, h: HtmlBuilder<Message>): Html => {
  const page = pageOf(model)
  const memory =
    page === 'save'
      ? `save-${model.saveFocus}`
      : page === 'found'
        ? `found-${model.foundStep}`
        : page
  return h.div(
    [
      h.Key(memory),
      h.Class(cx('qm-page', page === 'main' ? 'is-main' : 'is-sub')),
      h.DataAttribute('page', page),
      h.DataAttribute('memory', memory),
      h.DataAttribute('depth', `${depthOf(page)}`),
      h.OnMount(PageMounted()),
    ],
    [page === 'main' ? mainPage(model, h) : subPage(model, page, h)],
  )
}

/* ==========================================================================
   Frame: the tool bar, the dock, the connecting status
   ========================================================================== */

const toolLink = (
  r: Readonly<{ href: string; label: string; body: ReadonlyArray<Html>; wide?: boolean }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.a(
    [
      h.Href(r.href),
      h.Target('_blank'),
      h.Rel('noreferrer noopener'),
      h.AriaLabel(r.label),
      h.Title(r.label),
      h.Class(cx('qm-tool', r.wide && 'is-wide')),
    ],
    r.body,
  )

const toolbar = (model: Model, page: Page, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const release = import.meta.env.VITE_SENTRY_RELEASE
  const build = release === undefined || release === '' ? 'dev' : release.slice(0, 7)
  return h.header(
    [h.Class('qm-bar')],
    [
      page === 'main'
        ? h.span([], [])
        : h.span([h.Class('qm-crumb'), h.AriaHidden(true)], [wordmark('is-small', h)]),
      h.nav(
        [h.Class('qm-tools'), h.AriaLabel(t.title.taskbar)],
        [
          toolLink(
            {
              href: build === 'dev' ? SOURCE_URL : `${SOURCE_URL}/commit/${release}`,
              label: `${t.title.build} ${build}`,
              body: [h.span([h.Class('qm-build')], [build])],
              wide: true,
            },
            h,
          ),
          toolLink(
            {
              href: 'https://github.com/elianiva/quorum/issues',
              label: t.title.feedback,
              body: [
                h.span([h.Class('qm-tool-label')], [t.title.feedback]),
                glyph(ArrowUpRight, h),
              ],
              wide: true,
            },
            h,
          ),
          toolLink(
            {
              href: 'https://ko-fi.com/elianiva',
              label: t.title.supportOnKofi,
              body: [glyph(Coffee, h)],
            },
            h,
          ),
          toolLink(
            {
              href: SOURCE_URL,
              label: t.title.openSourceOnGitHub,
              body: [githubMark(h, 'qm-icon')],
            },
            h,
          ),
        ],
      ),
    ],
  )
}

const dock = (model: Model, page: Page, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const keys: ReadonlyArray<readonly [string, string]> = [
    ['↑↓', t.title.select],
    [t.title.enter, t.title.open],
    ...(page === 'main' ? [] : ([[t.title.esc, t.title.back]] as const)),
  ]
  return h.footer(
    [h.Class('qm-dock')],
    [
      h.div(
        [h.Class('qm-keys'), h.AriaHidden(true)],
        keys.map(([key, label]) =>
          h.span([h.Class('qm-key')], [Kbd({}, [key], h), h.span([], [label])]),
        ),
      ),
      h.a(
        [
          h.Class('qm-disclaimer'),
          h.Href(DISCLAIMER_URL),
          h.Target('_blank'),
          h.Rel('noreferrer noopener'),
        ],
        [t.title.quorumIsAGameAndSimplifies],
      ),
      h.nav(
        [h.Class('qm-dock-tools'), h.AriaLabel(t.title.settings)],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('qm-tool is-wide'),
              h.AriaPressed(page === 'settings' ? 'true' : 'false'),
              h.OnClick(Message.MenuChosen({ menu: page === 'settings' ? 'main' : 'settings' })),
            ],
            [glyph(Settings, h), h.span([h.Class('qm-tool-label')], [t.title.settings])],
          ),
          toolLink(
            {
              href: WIKI_URL,
              label: t.title.wiki,
              body: [glyph(BookOpen, h), h.span([h.Class('qm-tool-label')], [t.title.wiki])],
              wide: true,
            },
            h,
          ),
          h.span([h.Class('qm-clock'), h.OnMount(WallClock())], ['--:--']),
        ],
      ),
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
      challenge ? (t.catalog.challenges[challenge.id]?.name ?? challenge.name) : '',
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

/* On the way to the board: the session it opens, and a line that fills. */
const connectStatus = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const [host, detail] = sessionOf(model)
  return h.div(
    [h.Key('connect'), h.Class('qm-connect'), h.Role('status')],
    [
      h.div(
        [h.Class('qm-connect-card')],
        [
          h.span([h.Class('qm-connect-host')], [`$ ssh ${host}`]),
          h.span([h.Class('qm-detail')], [detail]),
          h.span([h.Class('qm-connect-line'), h.AriaHidden(true)], []),
          h.span([h.Class('qm-connect-ok')], [t.title.connected]),
        ],
      ),
    ],
  )
}

const menu = (model: Model, h: HtmlBuilder<Message>): Html => {
  const page = pageOf(model)
  return h.div(
    [h.Key('menu'), h.Class('qm'), h.OnMount(MenuDriver())],
    [
      toolbar(model, page, h),
      screen(model, h),
      dock(model, page, h),
      connecting(model.boot) ? connectStatus(model, h) : h.empty,
    ],
  )
}

/* ==========================================================================
   Clock-in splash
   ========================================================================== */

/* The shift starts here: the wordmark draws itself, the wall clock runs, and
   one button clocks in. Any key does the same, so the focus starts on it. */
const splash = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const clocking = model.boot._tag === 'Clocking'
  return h.div(
    [h.Key('splash'), h.Class(cx('qm-splash', clocking && 'is-in'))],
    [
      h.h1([h.Class('qm-splash-title')], [wordmark('is-splash', h)]),
      h.span([h.Class('qm-splash-clock'), h.OnMount(WallClock()), h.AriaHidden(true)], ['--:--']),
      h.div(
        [h.Class('qm-splash-action')],
        [
          button(
            {
              onClick: Message.ClockedIn(),
              size: 'lg',
              isAutofocus: true,
              isDisabled: clocking,
              className: 'qm-cta qm-clockin',
            },
            [
              clocking ? glyph(Check, h) : h.empty,
              h.span([], [clocking ? t.title.clockedIn : t.title.clockIn]),
            ],
            h,
          ),
          h.span([h.Class('qm-splash-line'), h.AriaHidden(true)], []),
        ],
      ),
      h.p([h.Class(hidden), h.AriaLive('polite')], [clocking ? t.title.clockedIn : '']),
    ],
  )
}

export const titleScreen = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.main(
    [h.Class('title-screen qm-root')],
    [titleIsOpen(model.boot) ? menu(model, h) : splash(model, h)],
  )
