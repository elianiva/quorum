import { Graphics } from 'pixi.js'
import { type Box, type Pt, type Route } from './geometry.ts'
import type { Wire } from './routing.ts'
import { traceOf } from './paths.ts'

export const OFF_PATH_ALPHA = 0.3
export const QUIET_BELT_ALPHA = 0.12
export const CHEVRON_MIN_ZOOM = 0.5
export const PLACE_LIFT_PX = 24

const keys = new WeakMap<object, string>()

export const linkKey = (link: Readonly<{ from: string; to: string }>): string => {
  let key = keys.get(link)
  if (key === undefined) {
    key = `${link.from}>${link.to}`
    keys.set(link, key)
  }
  return key
}

export class BeltView {
  readonly body = new Graphics()
  travel = 0
  wire: Wire | null = null
  private bodyFor: unknown = null
  private bodyRail = -1
  private bodyFill = -1
  private bodyWidth = -1
  private mouthPieces: unknown = null
  private mouthWidth = -1
  private mouthOff = false
  private mouthList: ReadonlyArray<Mouth> = []
  private boxFor: unknown = null
  private box = { x0: 0, y0: 0, x1: 0, y1: 0 }

  constructor() {
    this.body.context.batchMode = 'batch'
  }

  show(visible: boolean, alpha: number): void {
    this.body.visible = visible
    this.body.alpha = alpha
  }

  destroy(): void {
    this.body.destroy()
  }

  onScreen(pieces: ReadonlyArray<Route>, view: Box): boolean {
    if (pieces !== this.boxFor) {
      this.boxFor = pieces
      const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
      for (const piece of pieces)
        for (const point of piece) {
          box.x0 = Math.min(box.x0, point.x)
          box.y0 = Math.min(box.y0, point.y)
          box.x1 = Math.max(box.x1, point.x)
          box.y1 = Math.max(box.y1, point.y)
        }
      this.box = box
    }
    const box = this.box
    return (
      box.x1 >= view.x && box.x0 <= view.x + view.w && box.y1 >= view.y && box.y0 <= view.y + view.h
    )
  }

  mouthsFor(pieces: ReadonlyArray<Route>, width: number, off: boolean): ReadonlyArray<Mouth> {
    if (pieces !== this.mouthPieces || width !== this.mouthWidth || off !== this.mouthOff) {
      const list: Array<Mouth> = []
      mouthsOf(pieces, width, off, list)
      this.mouthPieces = pieces
      this.mouthWidth = width
      this.mouthOff = off
      this.mouthList = list
    }
    return this.mouthList
  }

  draw(pieces: ReadonlyArray<Route>, rail: number, body: number, width: number): void {
    if (
      pieces === this.bodyFor &&
      rail === this.bodyRail &&
      body === this.bodyFill &&
      width === this.bodyWidth
    )
      return
    this.bodyFor = pieces
    this.bodyRail = rail
    this.bodyFill = body
    this.bodyWidth = width
    this.body.clear()
    for (const piece of pieces) traceOf(this.body, piece)
    this.body.stroke({ color: rail, width: width + 2, join: 'round', alpha: 0.9 })
    for (const piece of pieces) traceOf(this.body, piece)
    this.body.stroke({ color: body, width, join: 'round' })
  }
}

export type Mouth = Readonly<{ x: number; y: number; across: boolean; width: number; off: boolean }>

export const mouthsOf = (
  pieces: ReadonlyArray<Route>,
  width: number,
  off: boolean,
  out: Array<Mouth>,
): void => {
  const add = (at: Pt | undefined, along: Pt | undefined): void => {
    if (!at || !along) return
    const across = Math.abs(at.y - along.y) > Math.abs(at.x - along.x)
    out.push({ x: at.x, y: at.y, across, width, off })
  }
  pieces.forEach((piece, index) => {
    if (index > 0) add(piece[0], piece[1])
    if (index < pieces.length - 1) add(piece.at(-1), piece.at(-2))
  })
}

const PORTAL_JOIN = 7
const PORTAL_DEPTH = 2.5

export const portalsOf = (
  mouths: ReadonlyArray<Mouth>,
): ReadonlyArray<Readonly<{ x0: number; y0: number; x1: number; y1: number; off: boolean }>> => {
  const rows = new Map<string, Array<Mouth>>()
  for (const mouth of mouths) {
    const key = mouth.across ? `h${Math.round(mouth.y)}` : `v${Math.round(mouth.x)}`
    const row = rows.get(key) ?? []
    row.push(mouth)
    rows.set(key, row)
  }
  const out: Array<{ x0: number; y0: number; x1: number; y1: number; off: boolean }> = []
  for (const row of rows.values()) {
    const across = (row[0] as Mouth).across
    const along = (mouth: Mouth): number => (across ? mouth.x : mouth.y)
    row.sort((a, b) => along(a) - along(b))
    let run: { start: number; end: number; at: number; off: boolean } | null = null
    const flush = (): void => {
      if (!run) return
      const half = PORTAL_DEPTH / 2
      out.push(
        across
          ? { x0: run.start, y0: run.at - half, x1: run.end, y1: run.at + half, off: run.off }
          : { x0: run.at - half, y0: run.start, x1: run.at + half, y1: run.end, off: run.off },
      )
    }
    for (const mouth of row) {
      const start = along(mouth) - mouth.width / 2 - 1
      const end = along(mouth) + mouth.width / 2 + 1
      if (run && start - run.end < PORTAL_JOIN) {
        run.end = Math.max(run.end, end)
        run.off &&= mouth.off
        continue
      }
      flush()
      run = { start, end, at: across ? mouth.y : mouth.x, off: mouth.off }
    }
    flush()
  }
  return out
}
