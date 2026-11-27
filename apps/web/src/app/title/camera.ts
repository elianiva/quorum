import { Component, Mount } from '@effect/ui'
import { Effect } from 'effect'
import { play } from '../../game/sound.ts'

const ACTIVE = '.qm-page.is-active'
const NAV = '[data-nav]'
const SVG = 'http://www.w3.org/2000/svg'
const LEAVE_MS = 160
const SETTLE_MS = 900
const PACKET_MS = 340
const MARGIN = 24
const PANNING_MS = 160
const OPEN_MS = 520
const FRICTION = 0.95
const RUBBER = 0.35

type Pan = 'open' | 'glide' | 'step' | 'track'

const stillMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.documentElement.dataset['motion'] === 'reduce'

const shown = (element: HTMLElement) => element.getClientRects().length > 0

/* The focus lands on the page's first choice when a column closes. */
const focusPage = (page: HTMLElement) => {
  const stops = [...page.querySelectorAll<HTMLElement>(NAV)].filter(shown)
  const target = stops.find((stop) => stop.hasAttribute('data-first')) ?? stops[0]
  target?.focus({ preventScroll: true })
}

export const TreeCamera = Mount.make('TreeCamera', {}, (element: HTMLElement) =>
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
      const clampY = (y: number) => {
        const r = range()
        if (!r) return y
        if (r.fits) {
          const stageHeight = element.clientHeight
          const visible = r.head + cameraY >= MARGIN && r.tail + cameraY <= stageHeight - MARGIN
          if (visible) return cameraY
        }
        const low = Math.min(r.top, r.bottom)
        const high = Math.max(Math.max(r.top, r.bottom), cameraY)
        return Math.min(high, Math.max(low, y))
      }
      const frame = () => {
        const open = world.querySelector<HTMLElement>(ACTIVE)
        const r = range()
        if (!open || !r) return
        const key = open.dataset.memory ?? ''
        const fresh = key !== openKey
        openKey = key
        if (!fresh) return aim(clampY(cameraY), 'glide')
        const stageHeight = element.clientHeight
        const head = r.head + cameraY
        const tail = r.tail + cameraY
        if (head >= MARGIN && tail <= stageHeight - MARGIN) return aim(cameraY, 'open')
        aim(r.fits && head >= MARGIN ? r.bottom : r.top, 'open')
      }
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

      let raf = 0
      let until = 0
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
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey) return
        event.preventDefault()
        const unit =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? element.clientHeight
              : 1
        const notch = event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || Math.abs(event.deltaY) >= 50
        aim(clampY(cameraY - event.deltaY * unit), notch ? 'step' : 'track')
      }
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
  ).pipe(Effect.as(Component.noop)),
)
