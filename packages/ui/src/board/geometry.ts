import type { ComponentId } from '@quorum/simulation/catalog'
import type { GameNode } from '@quorum/simulation/state'
import type { Layout } from '../components/shared.ts'
import { LAYOUTS } from './layouts.ts'
import { CARD_W, heightOf, rowMid } from './size.ts'

export type Placed = Pick<GameNode, 'type' | 'x' | 'y'>

export {
  CARD_W,
  FOOT,
  HEAD,
  PORT_R,
  ROW,
  SLOT_H,
  SLOT_W,
  heightOf,
  rowMid,
  rowTop,
  slotLeft,
  slotTop,
} from './size.ts'

export type { Layout }

export const layoutOf = (type: ComponentId): Layout => LAYOUTS[type]

export type Pt = Readonly<{ x: number; y: number }>

export const outPort = (node: Placed): Pt => ({
  x: node.x + CARD_W,
  y: node.y + rowMid(layoutOf(node.type).outRow ?? 0),
})
export const inPort = (node: Placed): Pt => ({
  x: node.x,
  y: node.y + rowMid(layoutOf(node.type).inRow ?? 0),
})

export const BACKWARD_STUB_PX = 16
const BEND = 6

export const gap = (a: Pt, b: Pt): number => Math.hypot(b.x - a.x, b.y - a.y)

export type Route = ReadonlyArray<Pt>

export const route = (a: Pt, b: Pt, lane: number): Route => {
  const x = Math.round((a.x + b.x) / 2)
  return smooth(
    b.x - a.x > 8
      ? [a, { x, y: a.y }, { x, y: b.y }, b]
      : [
          a,
          { x: a.x + BACKWARD_STUB_PX, y: a.y },
          { x: a.x + BACKWARD_STUB_PX, y: lane },
          { x: b.x - BACKWARD_STUB_PX, y: lane },
          { x: b.x - BACKWARD_STUB_PX, y: b.y },
          b,
        ],
  )
}

export const smooth = (corners: Route): Route => {
  const points = corners.filter((point, index) => {
    const previous = corners[index - 1]
    return !previous || gap(previous, point) > 0.5
  })
  const first = points[0]
  if (!first) return []
  const path: Array<Pt> = [first]
  for (let index = 1; index < points.length - 1; index += 1) {
    const before = points[index - 1]
    const corner = points[index]
    const after = points[index + 1]
    if (!before || !corner || !after) continue
    const r = Math.min(BEND, gap(before, corner) / 2, gap(corner, after) / 2)
    const start = {
      x: corner.x + ((before.x - corner.x) / gap(before, corner)) * r,
      y: corner.y + ((before.y - corner.y) / gap(before, corner)) * r,
    }
    const end = {
      x: corner.x + ((after.x - corner.x) / gap(corner, after)) * r,
      y: corner.y + ((after.y - corner.y) / gap(corner, after)) * r,
    }
    for (let step = 0; step <= 4; step += 1) {
      const t = step / 4
      const u = 1 - t
      path.push({
        x: u * u * start.x + 2 * u * t * corner.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * corner.y + t * t * end.y,
      })
    }
  }
  const last = points[points.length - 1]
  if (last && points.length > 1) path.push(last)
  return path
}

export const CARD_CLEARANCE_PX = 24

export type Box = Readonly<{ x: number; y: number; w: number; h: number }>

export const boxOf = (node: Placed): Box => ({
  x: node.x,
  y: node.y,
  w: CARD_W,
  h: heightOf(node.type),
})

export const crowds = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w + CARD_CLEARANCE_PX &&
  b.x < a.x + a.w + CARD_CLEARANCE_PX &&
  a.y < b.y + b.h + CARD_CLEARANCE_PX &&
  b.y < a.y + a.h + CARD_CLEARANCE_PX

export const freeSpot = (
  others: ReadonlyArray<Box>,
  box: Box,
): Readonly<{ x: number; y: number }> => {
  const x = Math.round(box.x / 8) * 8
  const y = Math.round(box.y / 8) * 8
  const xs = new Set([x])
  const ys = new Set([y])
  for (const other of others) {
    xs.add(Math.ceil((other.x + other.w + CARD_CLEARANCE_PX) / 8) * 8)
    xs.add(Math.floor((other.x - box.w - CARD_CLEARANCE_PX) / 8) * 8)
    ys.add(Math.ceil((other.y + other.h + CARD_CLEARANCE_PX) / 8) * 8)
    ys.add(Math.floor((other.y - box.h - CARD_CLEARANCE_PX) / 8) * 8)
  }
  let best = { x, y }
  let bestCost = Number.POSITIVE_INFINITY
  for (const cx of xs) {
    for (const cy of ys) {
      const cost = Math.abs(cy - y) + 3 * Math.abs(cx - x)
      if (cost >= bestCost) continue
      const at = { ...box, x: cx, y: cy }
      if (others.some((other) => crowds(at, other))) continue
      best = { x: cx, y: cy }
      bestCost = cost
    }
  }
  return best
}
