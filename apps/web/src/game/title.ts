/* The title screen: the clock-in splash, then the menu.

   The menu is a tree on a canvas. The root column holds the wordmark, the
   company's readout and the index; opening a line grows its page as a column
   to the right, wired to the line it came from, and the camera pans to it.
   Every choice is one line on a bus wire, numbered so a digit jumps to it; the
   line that holds the focus fills with ink and lights its node on the wire.

   Keyboard: arrows move (lists wrap, grids move by position and stop at their
   edges), Enter, Space or → opens, Esc, Backspace or ← goes back. Every page
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
import { savesOf } from './saves-machine.ts'
import { pwaInstallable, pwaInstalled } from './pwa-machine.ts'
import { menuOf, type MenuPage } from './route.ts'
import { browserFamilyOf, onIos } from '../platform/pwa.ts'
import { play } from './sound.ts'

/* `save` is a company under Companies; `setting` a section under Settings. */
type Page = typeof MenuPage.Type | 'main' | 'save' | 'setting'

/* ==========================================================================
   Keyboard and focus
   ========================================================================== */

/* Lines carry data-nav; the kit's controls inside a setting are stops too. */
const NAV = '[data-nav], .qm-setting :is([role="switch"], [role="slider"], button)'

const keyOf = (element: HTMLElement): string | undefined =>
  element.dataset.key ?? (element.id || undefined)

const shown = (element: HTMLElement) =>
  element.getClientRects().length > 0 && !(element as HTMLButtonElement).disabled

/* The open column: the tree's deepest page, where the keyboard works. */
const ACTIVE = '.qm-page.is-active'

/* The page's stops in reading order. A tab row is one stop: the chosen tab. */
const stopsOf = (root: ParentNode, from: Element | null): ReadonlyArray<HTMLElement> =>
  [...root.querySelectorAll<HTMLElement>(`${ACTIVE} :is(${NAV})`)].filter(
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
let revealed = false

const pageKeyOf = (element: Element | null): string | null =>
  element?.closest<HTMLElement>('.qm-page')?.dataset.memory ?? null

/* Each line rings a step higher down its column, on a pentatonic scale, so
   walking a list plays it like a keyboard. */
const SCALE = [0, 2, 4, 7, 9, 12]
const pitchOf = (line: Element): number => {
  const page = line.closest('.qm-page')
  const stops = page ? [...page.querySelectorAll(NAV)] : []
  const index = Math.max(0, stops.indexOf(line))
  return 2 ** (SCALE[index % SCALE.length]! / 12)
}

const stillMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.documentElement.dataset['motion'] === 'reduce'

const move = (to: HTMLElement | undefined) => {
  if (!to) return
  to.focus({ preventScroll: true })
  play('hover', pitchOf(to))
}

const MenuDriver = Mount.define('MenuDriver', {
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

          /* A slider keeps its arrows; Esc still goes back. */
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
                (tabs.indexOf(active) + (key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length
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

          /* → opens the focused branch, as Enter does. */
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
          play('hover', pitchOf(line))
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

/* The focus lands on the page's remembered line, else on its first choice. */
const focusPage = (page: HTMLElement) => {
  const key = remembered.get(page.dataset.memory ?? '')
  const stops = [...page.querySelectorAll<HTMLElement>(NAV)].filter(shown)
  const target =
    (key ? stops.find((stop) => keyOf(stop) === key) : undefined) ??
    stops.find((stop) => stop.hasAttribute('data-first')) ??
    stops.find((stop) => stop.getAttribute('aria-checked') === 'true') ??
    stops.find((stop) => stop.getAttribute('role') !== 'tab' && !stop.closest('.qm-phase-head')) ??
    stops[0]
  target?.focus({ preventScroll: true })
}

/* The root draws itself in on the first reveal after clocking in; a branch
   grows out of its wire. Only the open column takes the focus. */
const PageMounted = Mount.define('PageMounted', {
  messages: [Message.Synced],
  execute: ({ element }) =>
    Effect.sync(() => {
      element.setAttribute(
        'data-enter',
        element.getAttribute('data-depth') !== '0' ? 'branch' : revealed ? 'fade' : 'first',
      )
      revealed = true
      /* A phase body opens inside the active column, so it takes the focus
         for the fields it just revealed. */
      if (
        element instanceof HTMLElement &&
        (element.classList.contains('is-active') || element.classList.contains('qm-phase-body'))
      )
        focusPage(element)
      return Message.Synced()
    }),
})

const SVG = 'http://www.w3.org/2000/svg'
const LEAVE_MS = 160
const SETTLE_MS = 900
/* How long a packet takes down a new wire, the request that opens a branch. */
const PACKET_MS = 340

/* Room the camera keeps between a column and the stage's top and bottom. */
const MARGIN = 24
/* How long a pan mode outlives its last input. An open branch holds its
   mode until both steps, across then down, finish. */
const PANNING_MS = 160
const OPEN_MS = 520
/* A finger's fling: the speed it keeps each frame, and how much of a drag
   past the ends the canvas follows. */
const FRICTION = 0.95
const RUBBER = 0.35

/* How the camera reaches its next place: 'open' for a branch that appears,
   across then down, 'glide' to settle in one move, 'step' for a wheel notch
   or a focus move, 'track' to follow a trackpad or a finger 1:1 with no
   easing at all. */
type Pan = 'open' | 'glide' | 'step' | 'track'

/* The camera over the canvas. The view sets the open column's depth and CSS
   pans across to it; this mount does the rest: it hangs each branch level with
   the line it grew from, draws the wires, pans up and down (to frame a column
   that opens, under the wheel or a finger, and to follow the focus), lets a
   closed column fade where it stood, and gives the focus back to the open one.
   Positions are read relative to the world, so a pan in flight never feeds
   back into where the camera goes next. */
const TreeCamera = Mount.define('TreeCamera', {
  messages: [Message.Synced],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const world = element.querySelector<HTMLElement>('.qm-world')!
        const stage = world.parentElement!
        const wires = world.querySelector<SVGSVGElement>('.qm-wires')!
        const ghosts = world.querySelector<HTMLElement>('.qm-ghosts')!
        const columns = () =>
          [...world.querySelectorAll<HTMLElement>(':scope > .qm-page')].sort(
            (a, b) => Number(a.dataset.depth) - Number(b.dataset.depth),
          )
        const at = (node: Element) => {
          const box = node.getBoundingClientRect()
          const origin = world.getBoundingClientRect()
          return {
            top: box.top - origin.top,
            bottom: box.bottom - origin.top,
            left: box.left - origin.left,
            right: box.right - origin.left,
          }
        }

        const anchorOf = (column: HTMLElement): Element | null => {
          const parent = columns().find(
            (other) => Number(other.dataset.depth) === Number(column.dataset.depth) - 1,
          )
          if (!parent) return null
          const from = column.dataset.from
          return (
            (from ? parent.querySelector(`[data-key="${CSS.escape(from)}"]`) : null) ??
            parent.querySelector('.qm-hero-title .qm-mark, .qm-sub-head') ??
            parent
          )
        }
        const headOf = (column: HTMLElement): Element =>
          column.firstElementChild?.firstElementChild ?? column

        /* A branch hangs with its head level with the line it grew from. */
        const place = () => {
          for (const column of columns()) {
            const anchor = anchorOf(column)
            if (!anchor) continue
            const line = at(anchor)
            const head = at(headOf(column))
            const top = at(column).top
            const y = (line.top + line.bottom) / 2 - (head.top - top + (head.bottom - head.top) / 2)
            column.style.top = `${Math.round(y)}px`
          }
        }

        const draw = () => {
          const live = new Set<string>()
          for (const column of columns()) {
            const anchor = anchorOf(column)
            const id = column.dataset.memory ?? ''
            if (!anchor) continue
            live.add(id)
            const from = at(anchor)
            const head = at(headOf(column))
            const x1 = from.right + 6
            const y1 = (from.top + from.bottom) / 2
            const x2 = at(column).left - 4
            const y2 = (head.top + head.bottom) / 2
            const xm = x1 + (x2 - x1) / 2
            const r = Math.min(10, Math.abs(y2 - y1) / 2, (x2 - x1) / 4)
            const dir = y2 >= y1 ? 1 : -1
            const d =
              r < 0.5
                ? `M${x1} ${y1}H${x2}`
                : `M${x1} ${y1}H${xm - r}Q${xm} ${y1} ${xm} ${y1 + dir * r}` +
                  `V${y2 - dir * r}Q${xm} ${y2} ${xm + r} ${y2}H${x2}`
            let wire = wires.querySelector<SVGGElement>(`[data-wire="${CSS.escape(id)}"]`)
            if (!wire) {
              wire = document.createElementNS(SVG, 'g')
              wire.dataset.wire = id
              wire.setAttribute('class', 'qm-wire')
              const path = document.createElementNS(SVG, 'path')
              path.setAttribute('pathLength', '1')
              const tip = document.createElementNS(SVG, 'circle')
              tip.setAttribute('r', '3.5')
              tip.setAttribute('class', 'qm-tip')
              wire.append(path, tip)
              /* A packet runs ahead of the stroke and pings the branch when
                 it lands. */
              if (!stillMotion()) {
                const packet = document.createElementNS(SVG, 'circle')
                packet.setAttribute('r', '4')
                packet.setAttribute('class', 'qm-packet')
                wire.append(packet)
                wire.classList.add('is-sending')
                wire.dataset.born = `${performance.now()}`
              }
              wires.append(wire)
            }
            const path = wire.querySelector('path')!
            path.setAttribute('d', d)
            const tip = wire.querySelector('.qm-tip')!
            tip.setAttribute('cx', `${x2}`)
            tip.setAttribute('cy', `${y2}`)
            const packet = wire.querySelector('.qm-packet')
            if (packet) {
              const t = Math.min(1, (performance.now() - Number(wire.dataset.born)) / PACKET_MS)
              const eased = 1 - (1 - t) ** 3
              const point = path.getPointAtLength(path.getTotalLength() * eased)
              packet.setAttribute('cx', `${point.x}`)
              packet.setAttribute('cy', `${point.y}`)
              path.style.strokeDashoffset = `${1 - eased}`
              if (t >= 1) {
                packet.remove()
                wire.classList.replace('is-sending', 'is-hit')
                play('settle')
              }
            }
          }
          for (const wire of wires.querySelectorAll<SVGGElement>('[data-wire]'))
            if (!live.has(wire.dataset.wire ?? '') && !wire.classList.contains('is-leaving')) {
              wire.classList.add('is-leaving')
              setTimeout(() => wire.remove(), LEAVE_MS)
            }
        }

        /* The camera's height over the world: 0 puts the world's top at the
           stage's top. */
        let cameraY = 0
        let openKey = ''
        let panTimer = 0
        let fling = 0
        const aim = (y: number, pan: Pan) => {
          if (pan !== 'track') {
            cancelAnimationFrame(fling)
            fling = 0
          }
          cameraY = pan === 'track' ? y : Math.round(y)
          clearTimeout(panTimer)
          if (pan === 'glide') delete world.dataset.pan
          else {
            world.dataset.pan = pan
            panTimer = window.setTimeout(
              () => delete world.dataset.pan,
              pan === 'open' ? OPEN_MS : PANNING_MS,
            )
          }
          world.style.setProperty('--camera-y', `${cameraY}px`)
        }
        /* The camera heights that show the open column's top and its bottom.
           When it fits, every height between them shows all of it. */
        const range = () => {
          const open = world.querySelector<HTMLElement>(ACTIVE)
          if (!open) return null
          const box = at(open)
          const height = element.clientHeight
          return {
            head: box.top,
            tail: box.bottom,
            top: MARGIN - box.top,
            bottom: height - MARGIN - box.bottom,
            fits: box.bottom - box.top <= height - 2 * MARGIN,
          }
        }
        /* A column that fits holds still once all of it shows, as a page that
           fits does not scroll; until then it may pan into view. A tall one
           may keep a height the camera already holds above its head, so
           opening a branch never nudges it. Neither climbs further past the
           head. */
        const clampY = (y: number) => {
          const r = range()
          if (!r) return y
          if (r.fits) {
            const stage = element.clientHeight
            const shown = r.head + cameraY >= MARGIN && r.tail + cameraY <= stage - MARGIN
            if (shown) return cameraY
          }
          const low = Math.min(r.top, r.bottom)
          const high = Math.max(Math.max(r.top, r.bottom), cameraY)
          return Math.min(high, Math.max(low, y))
        }
        /* The open column sits in the middle of the stage. A branch opens
           level with the line it grew from, so the camera keeps its height
           and only slides across; it drops or rises only when the new
           column's head is off the stage. */
        const frame = () => {
          const open = world.querySelector<HTMLElement>(ACTIVE)
          const r = range()
          if (!open || !r) return
          const key = open.dataset.memory ?? ''
          const fresh = key !== openKey
          openKey = key
          if (!fresh) return aim(clampY(cameraY), 'glide')
          const head = r.head + cameraY
          const onStage = head >= MARGIN && head <= element.clientHeight - MARGIN
          aim(onStage ? cameraY : r.top, 'open')
        }
        /* Keep the focused line on screen, panning no further than it needs. */
        const follow = (target: Element) => {
          const open = world.querySelector(ACTIVE)
          if (!open?.contains(target)) return
          const box = at(target)
          const height = element.clientHeight
          const top = box.top + cameraY
          const bottom = box.bottom + cameraY
          if (top >= MARGIN && bottom <= height - MARGIN) return
          const y = top < MARGIN ? MARGIN - box.top : height - MARGIN - box.bottom
          aim(clampY(y), 'step')
        }

        /* Lines move while a page enters or reflows: redraw every frame until
           things settle. */
        let raf = 0
        let until = 0
        /* A column's top is set in the same task it appears, and the browser
           lays it out after: frame on the next frame so the camera aims at
           where the column really sits. */
        let pendingFrame = 0
        const reframe = () => {
          cancelAnimationFrame(pendingFrame)
          pendingFrame = requestAnimationFrame(() => {
            place()
            frame()
          })
        }
        const settle = () => {
          until = performance.now() + SETTLE_MS
          if (raf) return
          const tick = () => {
            place()
            draw()
            raf = performance.now() < until ? requestAnimationFrame(tick) : 0
          }
          raf = requestAnimationFrame(tick)
        }

        const observer = new MutationObserver((records) => {
          let closed = false
          for (const record of records) {
            if (record.target !== world) continue
            for (const node of record.removedNodes) {
              if (!(node instanceof HTMLElement) || !node.classList.contains('qm-page')) continue
              closed = true
              const ghost = node.cloneNode(true) as HTMLElement
              ghost.classList.remove('is-active')
              ghost.removeAttribute('data-enter')
              for (const marked of ghost.querySelectorAll('[id]')) marked.removeAttribute('id')
              ghost.classList.add('is-leaving')
              ghosts.append(ghost)
              setTimeout(() => ghost.remove(), LEAVE_MS)
            }
          }
          place()
          reframe()
          /* Closing a column takes the focus with it: hand it to the open one. */
          const open = world.querySelector<HTMLElement>(ACTIVE)
          const lost = document.activeElement === null || document.activeElement === document.body
          if (closed && open && lost) focusPage(open)
          settle()
        })
        observer.observe(world, { childList: true, subtree: true })
        const resize = new ResizeObserver(() => {
          place()
          frame()
          settle()
        })
        resize.observe(element)

        const onFocus = (event: FocusEvent) => {
          const target = event.target
          if (target instanceof Element) requestAnimationFrame(() => follow(target))
        }
        /* A trackpad sends a stream of small deltas, with its own momentum
           after the fingers lift: follow it 1:1. A mouse wheel sends notches
           of 100px or so, or lines: ease across each one. */
        const onWheel = (event: WheelEvent) => {
          if (event.ctrlKey) return
          event.preventDefault()
          const unit =
            event.deltaMode === WheelEvent.DOM_DELTA_LINE
              ? 16
              : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                ? element.clientHeight
                : 1
          const notch =
            event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || Math.abs(event.deltaY) >= 50
          aim(clampY(cameraY - event.deltaY * unit), notch ? 'step' : 'track')
        }
        /* A finger drags the canvas 1:1, stretches past the ends, and flings:
           it keeps its speed and slows down, as a native list does. */
        let touchY: number | null = null
        let touchAt = 0
        let velocity = 0
        const onTouchStart = (event: TouchEvent) => {
          cancelAnimationFrame(fling)
          fling = 0
          velocity = 0
          touchY = event.touches.length === 1 ? event.touches[0]!.clientY : null
          touchAt = event.timeStamp
        }
        const onTouchMove = (event: TouchEvent) => {
          if (touchY === null || event.touches.length !== 1) return
          const y = event.touches[0]!.clientY
          event.preventDefault()
          const dy = y - touchY
          const dt = Math.max(1, event.timeStamp - touchAt)
          velocity = 0.8 * (dy / dt) + 0.2 * velocity
          const next = cameraY + dy
          const inside = clampY(next)
          aim(next === inside ? next : cameraY + dy * RUBBER, 'track')
          touchY = y
          touchAt = event.timeStamp
        }
        const onTouchEnd = () => {
          if (touchY === null) return
          touchY = null
          const inside = clampY(cameraY)
          if (inside !== cameraY) return aim(inside, 'glide')
          let v = velocity * 16
          let last = performance.now()
          const coast = (now: number) => {
            v *= FRICTION ** ((now - last) / 16)
            last = now
            const want = cameraY + v
            const next = clampY(want)
            aim(next, 'track')
            fling = Math.abs(v) > 0.2 && next === want ? requestAnimationFrame(coast) : 0
          }
          if (Math.abs(v) > 1) fling = requestAnimationFrame(coast)
        }
        stage.addEventListener('focusin', onFocus)
        stage.addEventListener('wheel', onWheel, { passive: false })
        stage.addEventListener('touchstart', onTouchStart, { passive: true })
        stage.addEventListener('touchmove', onTouchMove, { passive: false })
        stage.addEventListener('touchend', onTouchEnd)
        stage.addEventListener('touchcancel', onTouchEnd)

        /* The first frame lands without a pan. */
        world.classList.add('is-still')
        place()
        frame()
        requestAnimationFrame(() => requestAnimationFrame(() => world.classList.remove('is-still')))
        settle()
        return () => {
          observer.disconnect()
          resize.disconnect()
          stage.removeEventListener('focusin', onFocus)
          stage.removeEventListener('wheel', onWheel)
          stage.removeEventListener('touchstart', onTouchStart)
          stage.removeEventListener('touchmove', onTouchMove)
          stage.removeEventListener('touchend', onTouchEnd)
          stage.removeEventListener('touchcancel', onTouchEnd)
          cancelAnimationFrame(raf)
          cancelAnimationFrame(pendingFrame)
          cancelAnimationFrame(fling)
          clearTimeout(panTimer)
        }
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.as(Message.Synced())),
})

const WallClock = Mount.define('WallClock', {
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
  branch?: boolean
  open?: boolean
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
      ...(r.branch ? [h.DataAttribute('branch', '')] : []),
      ...(r.hotkey
        ? [h.DataAttribute('hotkey', `${r.hotkey}`), h.AriaKeyshortcuts(`${r.hotkey}`)]
        : []),
      ...(r.message ? [h.OnClick(r.message)] : [h.AriaDisabled(true)]),
      ...(r.pick ? [h.Role(r.pick), h.AriaChecked(r.checked === true)] : []),
      h.Style({ '--i': `${r.index ?? 0}` }),
      h.Class(
        cx(
          'qm-line',
          r.danger && 'is-danger',
          r.open && 'is-open',
          !r.hotkey && !r.pick && !r.lead && 'is-bare',
        ),
      ),
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
const firstRun = (open: boolean, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.section(
    [h.Class('qm-readout is-empty')],
    [
      button(
        {
          onClick: Message.MenuChosen({ menu: 'found' }),
          size: 'lg',
          className: cx('qm-cta', open && 'is-open'),
          attributes: [
            h.DataAttribute('nav', ''),
            h.DataAttribute('key', 'start'),
            h.DataAttribute('first', ''),
            h.DataAttribute('branch', ''),
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
  if (
    !pwaInstalled(model.pwa.install) &&
    !model.prefs.pwaPromptSeen &&
    savesOf(model.saves).companies.length > 0
  ) {
    out.push(
      line(
        {
          key: 'pwa-install',
          label: t.pwa.installQuorum,
          detail: pwaInstallable(model.pwa.install)
            ? t.pwa.installPrompt
            : t.pwa.installHelp[browserFamilyOf()],
          figure: glyph(Download, h),
          message: pwaInstallable(model.pwa.install) ? Message.PwaInstallChosen() : null,
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
  const count = savesOf(model.saves).companies.length
  const passed = SANDBOX_IDS.filter((id) => model.passed.includes(id)).length
  const solved = CHALLENGES.filter((entry) => model.founder.completed.includes(entry.id)).length
  let n = 0
  const next = () => ++n
  const open = menuOf(model.route)
  const to = (menu: typeof MenuPage.Type) => ({
    message: Message.MenuChosen({ menu }),
    branch: true,
    open: open === menu,
  })
  const company = [
    ...(hasCompany(model)
      ? [line({ key: 'new', label: t.title.newCompany, ...to('found'), hotkey: next() }, h)]
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
              ...to('companies'),
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
        ...to('sandbox'),
        hotkey: next(),
      },
      h,
    ),
    line(
      {
        key: 'challenges',
        label: t.title.challenges,
        figure: `${solved}/${CHALLENGES.length}`,
        ...to('challenges'),
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
        ...to('achievements'),
        hotkey: next(),
      },
      h,
    ),
    line(
      {
        key: 'legacy',
        label: t.title.legacyShop,
        figure: `${model.founder.legacy}`,
        ...to('legacy'),
        hotkey: next(),
      },
      h,
    ),
    line(
      {
        key: 'history',
        label: t.title.history,
        figure: `${model.founder.history.length}`,
        ...to('history'),
        hotkey: next(),
      },
      h,
    ),
  ]
  const system = [
    line(
      {
        key: 'settings',
        label: t.title.settings,
        lead: glyph(Settings, h),
        ...to('settings'),
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
      section(t.title.system, system, h),
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
          hasCompany(model) ? readout(model, h) : firstRun(menuOf(model.route) === 'found', h),
        ],
      ),
      mainIndex(model, h),
    ],
  )

/* ==========================================================================
   Pages
   ========================================================================== */

const FOUND_STEPS: ReadonlyArray<FoundStep> = ['company', 'venture', 'mutators']

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
    h.div(
      [h.Class('qm-grid'), h.DataAttribute('grid', '')],
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
    ),
  ]
}

const mutatorStep = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const founding = foundingOf(model.founder)
  return [
    h.div(
      [h.Class('qm-grid'), h.DataAttribute('grid', '')],
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
    ),
  ]
}

const stageBody = (model: Model, step: FoundStep, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  step === 'company'
    ? companyStep(model, h)
    : step === 'venture'
      ? ventureStep(model, h)
      : mutatorStep(model, h)

/* The founding form is one trunk with three stations on it. A station already
   answered keeps its value on the line, so the whole company stays readable
   while you work on the next part. The open station hangs its fields off the
   trunk; the one ahead waits as a bare node. */
const foundStages = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const at = FOUND_STEPS.indexOf(model.foundStep)
  const founding = foundingOf(model.founder)
  const venture = localized(VENTURES[founding.venture], t.catalog.ventures[founding.venture])
  const picked = founding.mutators.map((id) => t.catalog.mutators[id].name)
  const label: Record<FoundStep, string> = {
    company: t.title.company,
    venture: t.title.venture,
    mutators: t.title.mutators,
  }
  const value: Record<FoundStep, string | null> = {
    company: nameOr(model.draft.name),
    venture: `${venture.name} ×${venture.legacy.toFixed(1)}`,
    mutators:
      picked.length === 0
        ? null
        : `${picked.slice(0, 2).join(' · ')}${picked.length > 2 ? ` +${picked.length - 2}` : ''}`,
  }
  return h.ol(
    [h.Key('stages'), h.Class('qm-phases'), h.AriaLabel(t.title.newCompany)],
    FOUND_STEPS.map((step, index) => {
      const open = index === at
      const done = index < at
      const head = [
        h.span(
          [h.Class('qm-phase-node'), h.AriaHidden(true)],
          [done ? glyph(Check, h) : `${index + 1}`],
        ),
        h.span([h.Class('qm-phase-label')], [label[step]]),
        /* Only a station already answered carries its value. */
        done && value[step] ? h.span([h.Class('qm-phase-value')], [value[step]!]) : h.empty,
        open
          ? h.empty
          : h.span([h.Class('qm-phase-go'), h.AriaHidden(true)], [glyph(ChevronRight, h)]),
      ]
      return h.li(
        [h.Key(step), h.Class(cx('qm-phase', open && 'is-open', done && 'is-done'))],
        [
          /* The open station is not a control: it is where you are. */
          open
            ? h.div([h.Class('qm-phase-head'), h.AriaCurrent('step')], head)
            : h.button(
                [
                  h.Type('button'),
                  h.DataAttribute('nav', ''),
                  h.DataAttribute('key', `step-${step}`),
                  h.OnClick(Message.FoundStepChosen({ step })),
                  h.Class('qm-phase-head'),
                ],
                head,
              ),
          open
            ? h.div([h.Class('qm-phase-body'), h.OnMount(PageMounted())], stageBody(model, step, h))
            : h.empty,
        ],
      )
    }),
  )
}

const foundBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => [
  foundStages(model, h),
]

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
  if (savesOf(model.saves).companies.length === 0) return [note(t.title.noCompaniesSavedYet, h)]
  return [
    h.div(
      [h.Class('qm-bus')],
      recent(savesOf(model.saves).companies).map((file, index) =>
        line(
          {
            key: file.id,
            lead: companyMark(file.logo, 'qm-logo is-small', h),
            label: file.name,
            detail: fileLine(file, h),
            figure:
              file.online !== null
                ? `${t.room.onlineMark} · ${file.online.code}`
                : file.id === savesOf(model.saves).lastPlayed
                  ? t.title.current
                  : dateOf(file),
            message: Message.CompanyChosen({ id: file.id }),
            branch: true,
            open: model.saveFocus === file.id,
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
  const file = savesOf(model.saves).companies.find((entry) => entry.id === model.saveFocus)
  if (!file) return []
  const isCurrent = file.id === savesOf(model.saves).lastPlayed
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
      [h.Class('qm-grid'), h.DataAttribute('grid', '')],
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
  const pwa: Array<Html> = []
  if (!pwaInstalled(model.pwa.install)) {
    pwa.push(
      line(
        {
          key: 'pwa-install-setting',
          label: t.pwa.installQuorum,
          detail: pwaInstallable(model.pwa.install)
            ? t.pwa.installDetail
            : t.pwa.installHelp[browserFamilyOf()],
          figure: glyph(Download, h),
          message: pwaInstallable(model.pwa.install) ? Message.PwaInstallChosen() : null,
        },
        h,
      ),
    )
    if (onIos()) pwa.push(note(t.pwa.moveNote, h))
  }
  return [
    h.div(
      [h.Key('sections'), h.Class('qm-bus')],
      sections.map((part) =>
        line(
          {
            key: `section-${part.id}`,
            label: part.label,
            message: Message.SettingsSectionOpened({ section: part.id }),
            branch: true,
            open: model.settingsOpen && part.id === model.settingsSection,
          },
          h,
        ),
      ),
    ),
    ...(pwa.length > 0 ? [section(t.pwa.app, pwa, h)] : []),
  ]
}

/* One section of Settings, as its own column under the section list. */
const settingBody = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const sections = settingsSections(model, copy(h))
  const open = sections.find((part) => part.id === model.settingsSection) ?? sections[0]!
  return [
    h.div(
      [h.Key(`rows-${open.id}`), h.Class('qm-bus is-settings')],
      open.rows.map((setting) => settingRow(setting, model, h)),
    ),
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
      figure: (m) => `${savesOf(m.saves).companies.length}`,
    },
    save: {
      title:
        savesOf(model.saves).companies.find((entry) => entry.id === model.saveFocus)?.name ??
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
    setting: {
      title:
        settingsSections(model, t).find((part) => part.id === model.settingsSection)?.label ??
        t.title.settings,
      body: settingBody,
    },
  }
}

const pageOf = (model: Model): Page => {
  const page = menuOf(model.route)
  return page === 'companies' && model.saveFocus !== null
    ? 'save'
    : page === 'settings' && model.settingsOpen
      ? 'setting'
      : page
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
                page === 'save'
                  ? Message.CompanyClosed()
                  : page === 'setting'
                    ? Message.SettingsSectionClosed()
                    : Message.MenuChosen({ menu: 'main' }),
              variant: 'ghost',
              className: 'qm-back',
              attributes: [h.DataAttribute('back', ''), h.AriaKeyshortcuts('Escape')],
            },
            [
              glyph(ChevronLeft, h),
              h.span(
                [],
                [
                  page === 'save'
                    ? t.title.companies
                    : page === 'setting'
                      ? t.title.settings
                      : t.title.back,
                ],
              ),
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

/* The pages from the root to the open one: the tree's open branch. */
const trailOf = (page: Page): ReadonlyArray<Page> =>
  page === 'main'
    ? ['main']
    : page === 'save'
      ? ['main', 'companies', 'save']
      : page === 'setting'
        ? ['main', 'settings', 'setting']
        : ['main', page]

/* The line each page grows from, by its data-key. Settings opens from the
   dock, so it hangs from the wordmark. */
const fromOf = (model: Model, page: Page): string | null =>
  page === 'main' || page === 'settings'
    ? null
    : page === 'save'
      ? model.saveFocus
      : page === 'setting'
        ? `section-${model.settingsSection}`
        : page === 'found'
          ? hasCompany(model)
            ? 'new'
            : 'start'
          : page

/* The founding column stays one column while its stations change, so the
   camera does not re-frame on every step. */
const memoryOf = (model: Model, page: Page): string =>
  page === 'save'
    ? `save-${model.saveFocus}`
    : page === 'setting'
      ? `setting-${model.settingsSection}`
      : page === 'found'
        ? 'found'
        : page

/* One column per page on the open branch. The root keeps its key, so it stays
   put while branches grow and close beside it. */
const column = (
  model: Model,
  page: Page,
  depth: number,
  open: boolean,
  h: HtmlBuilder<Message>,
) => {
  const memory = memoryOf(model, page)
  const from = fromOf(model, page)
  return h.div(
    [
      h.Key(depth === 0 ? 'root' : memory),
      h.Class(
        cx(
          'qm-page',
          page === 'main' ? 'is-main' : 'is-sub',
          (page === 'settings' || page === 'companies') && 'is-list',
          open && 'is-active',
        ),
      ),
      h.Style({ '--d': `${depth}` }),
      h.DataAttribute('page', page),
      h.DataAttribute('memory', memory),
      h.DataAttribute('depth', `${depth}`),
      ...(from === null ? [] : [h.DataAttribute('from', from)]),
      h.OnMount(PageMounted()),
    ],
    [page === 'main' ? mainPage(model, h) : subPage(model, page, h)],
  )
}

const screen = (model: Model, h: HtmlBuilder<Message>): Html => {
  const trail = trailOf(pageOf(model))
  return h.div(
    [h.Key('stage'), h.Class('qm-stage'), h.OnMount(TreeCamera())],
    [
      h.div(
        [h.Class('qm-world'), h.DataAttribute('depth', `${trail.length - 1}`)],
        [
          h.svg([h.Key('wires'), h.Class('qm-wires'), h.AriaHidden(true)], []),
          h.div([h.Key('ghosts'), h.Class('qm-ghosts'), h.AriaHidden(true), h.Inert(true)], []),
          ...trail.map((page, depth) => column(model, page, depth, depth === trail.length - 1, h)),
        ],
      ),
    ],
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

const toolbar = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const release = import.meta.env.VITE_SENTRY_RELEASE
  const build = release === undefined || release === '' ? 'dev' : release.slice(0, 7)
  return h.header(
    [h.Class('qm-bar')],
    [
      h.span([], []),
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
        [h.Class('qm-dock-tools')],
        [
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
      toolbar(h),
      screen(model, h),
      dock(model, page, h),
      connecting(model.boot) ? connectStatus(model, h) : h.empty,
    ],
  )
}

/* ==========================================================================
   Clock-in splash
   ========================================================================== */

/* The shift starts here: a wall badge reader with the badge hanging out of its
   slot. A click, or any key, slides the badge in, the LED turns green, and the
   reader steps back for the menu. */
const splash = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const clocking = model.boot._tag === 'Clocking'
  return h.div(
    [h.Key('splash'), h.Class('reader-splash')],
    [
      h.h1([h.Class(hidden)], ['Quorum']),
      h.div(
        [h.Class(cx('reader', clocking && 'is-in'))],
        [
          h.div(
            [h.Class('reader-body')],
            [
              ...['is-tl', 'is-tr', 'is-bl', 'is-br'].map((at) =>
                h.span([h.Class(cx('reader-screw', at))], []),
              ),
              h.div(
                [h.Class('reader-screen'), h.AriaLive('polite')],
                [
                  h.span([h.Class('reader-time'), h.OnMount(WallClock())], ['--:--']),
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
                        h.path([
                          h.D(d),
                          h.Fill('none'),
                          h.Stroke('currentColor'),
                          h.StrokeWidth('22'),
                        ]),
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
      ),
      h.p([h.Class('reader-hint'), h.AriaHidden(true)], [t.title.clockInHint]),
    ],
  )
}

export const titleScreen = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.main(
    [h.Class('title-screen qm-root')],
    [titleIsOpen(model.boot) ? menu(model, h) : splash(model, h)],
  )
