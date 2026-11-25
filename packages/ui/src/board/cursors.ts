import type { RegionId } from '@quorum/simulation/state'
import type { SeatActivity } from '@quorum/simulation/room'

export type SeatCursor = Readonly<{
  seat: string
  name: string
  colour: string
  x: number
  y: number
  region: RegionId
  activity: SeatActivity | null
}>

export const CURSOR_DELAY_MS = 80

export const CURSOR_GAP_MS = 300

const KEEP_MS = 2_000

type Sample = Readonly<{ x: number; y: number; t: number }>

type Track = Readonly<{
  seat: string
  name: string
  colour: string
  region: RegionId
  activity: SeatActivity | null
  samples: ReadonlyArray<Sample>
}>

const at = (samples: ReadonlyArray<Sample>, time: number): Sample => {
  const first = samples[0]
  const last = samples[samples.length - 1]
  if (!first || !last) return { x: 0, y: 0, t: time }
  if (time <= first.t) return first
  if (time >= last.t) return last
  let index = 0
  while (index + 2 < samples.length && (samples[index + 1]?.t ?? Infinity) < time) index += 1
  const p1 = samples[index] ?? last
  const p2 = samples[index + 1] ?? last
  const p0 = samples[index - 1] ?? p1
  const p3 = samples[index + 2] ?? p2
  const span = p2.t - p1.t
  const u = span > 0 ? (time - p1.t) / span : 1
  const uu = u * u
  const uuu = uu * u
  const q1 = -uuu + 2 * uu - u
  const q2 = 3 * uuu - 5 * uu + 2
  const q3 = -3 * uuu + 4 * uu + u
  const q4 = uuu - uu
  return {
    x: (p0.x * q1 + p1.x * q2 + p2.x * q3 + p3.x * q4) / 2,
    y: (p0.y * q1 + p1.y * q2 + p2.y * q3 + p3.y * q4) / 2,
    t: time,
  }
}

export class CursorTracks {
  private readonly tracks = new Map<string, Track>()

  move(cursor: SeatCursor, now: number): void {
    const track = this.tracks.get(cursor.seat)
    const last = track?.samples[track.samples.length - 1]
    const samples =
      track === undefined || last === undefined || now - last.t > CURSOR_GAP_MS
        ? [{ x: cursor.x, y: cursor.y, t: now }]
        : last.x === cursor.x && last.y === cursor.y
          ? track.samples
          : [...track.samples, { x: cursor.x, y: cursor.y, t: now }]
    this.tracks.set(cursor.seat, {
      seat: cursor.seat,
      name: cursor.name,
      colour: cursor.colour,
      region: cursor.region,
      activity: cursor.activity,
      samples: samples.filter((sample) => now - sample.t <= KEEP_MS),
    })
  }

  remove(seat: string): void {
    this.tracks.delete(seat)
  }

  clear(): void {
    this.tracks.clear()
  }

  play(now: number): ReadonlyArray<SeatCursor> {
    const time = now - CURSOR_DELAY_MS
    return [...this.tracks.values()].map((track) => {
      const point = at(track.samples, time)
      return {
        seat: track.seat,
        name: track.name,
        colour: track.colour,
        region: track.region,
        activity: track.activity,
        x: point.x,
        y: point.y,
      }
    })
  }
}

export type CursorCamera = Readonly<{ x: number; y: number; scale: number }>

type CursorElement = {
  root: HTMLDivElement
  label: HTMLSpanElement
  who: HTMLSpanElement
  what: HTMLSpanElement
  mark: SVGPathElement
  name: string
  colour: string
  doing: string | null
}

export class CursorOverlay {
  private readonly tracks = new CursorTracks()
  private readonly elements = new Map<string, CursorElement>()
  private root: HTMLDivElement | null = null

  mount(host: HTMLElement): void {
    if (this.root !== null) return
    const root = document.createElement('div')
    root.setAttribute('aria-hidden', 'true')
    root.style.cssText =
      'position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;contain:strict'
    host.append(root)
    this.root = root
  }

  move(cursor: SeatCursor, now: number): void {
    this.tracks.move(cursor, now)
  }

  remove(seat: string): void {
    this.tracks.remove(seat)
    this.elements.get(seat)?.root.remove()
    this.elements.delete(seat)
  }

  clear(): void {
    this.tracks.clear()
    for (const element of this.elements.values()) element.root.remove()
    this.elements.clear()
  }

  tick(
    now: number,
    camera: CursorCamera,
    region: RegionId,
    activityOf: (activity: SeatActivity) => string,
  ): void {
    const shown = new Set<string>()
    for (const cursor of this.tracks.play(now)) {
      if (cursor.region !== region) continue
      shown.add(cursor.seat)
      const element = this.element(cursor, activityOf)
      element.root.style.display = 'block'
      element.root.style.transform = `translate3d(${camera.x + cursor.x * camera.scale - 3}px, ${
        camera.y + cursor.y * camera.scale - 1.5
      }px, 0)`
    }
    for (const [seat, element] of this.elements) {
      if (shown.has(seat)) continue
      element.root.style.display = 'none'
    }
  }

  destroy(): void {
    this.clear()
    this.root?.remove()
    this.root = null
  }

  private element(
    cursor: SeatCursor,
    activityOf: (activity: SeatActivity) => string,
  ): CursorElement {
    const doing = cursor.activity === null ? null : activityOf(cursor.activity)
    const known = this.elements.get(cursor.seat)
    if (known) {
      if (known.name !== cursor.name) {
        known.name = cursor.name
        known.who.textContent = cursor.name
      }
      if (known.doing !== doing) {
        known.doing = doing
        known.what.textContent = doing ?? ''
        known.what.style.display = doing === null ? 'none' : 'block'
      }
      if (known.colour !== cursor.colour) {
        known.colour = cursor.colour
        known.label.style.background = cursor.colour
        known.mark.setAttribute('fill', cursor.colour)
      }
      return known
    }
    const root = document.createElement('div')
    root.style.cssText =
      'position:absolute;left:0;top:0;display:none;pointer-events:none;will-change:transform'
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '18')
    svg.setAttribute('height', '18')
    svg.setAttribute('viewBox', '0 0 20 20')
    svg.style.cssText = 'display:block;filter:drop-shadow(0 1px 2px rgb(0 0 0 / 0.28))'
    const mark = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    mark.setAttribute('d', 'M3 1.5 L17 10.4 L10.3 11.7 L7.2 18.1 Z')
    mark.setAttribute('fill', cursor.colour)
    mark.setAttribute('stroke', '#ffffff')
    mark.setAttribute('stroke-width', '1.4')
    mark.setAttribute('stroke-linejoin', 'round')
    svg.append(mark)
    const label = document.createElement('span')
    label.style.cssText =
      'position:absolute;left:12px;top:16px;display:flex;max-width:224px;flex-direction:column;border-radius:7px;padding:3px 7px;color:#ffffff;font:600 11px/1.35 Geist,system-ui,sans-serif;white-space:nowrap'
    label.style.background = cursor.colour
    const who = document.createElement('span')
    who.textContent = cursor.name
    who.style.cssText = 'overflow:hidden;text-overflow:ellipsis'
    const what = document.createElement('span')
    what.textContent = doing ?? ''
    what.style.cssText =
      'display:block;overflow:hidden;text-overflow:ellipsis;font-size:10px;font-weight:500;opacity:0.82'
    what.style.display = doing === null ? 'none' : 'block'
    label.append(who, what)
    root.append(svg, label)
    this.root?.append(root)
    const element = {
      root,
      label,
      who,
      what,
      mark,
      name: cursor.name,
      colour: cursor.colour,
      doing,
    }
    this.elements.set(cursor.seat, element)
    return element
  }
}
