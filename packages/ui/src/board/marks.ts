import { Graphics } from 'pixi.js'
import { gap, type Route } from './geometry.ts'
import { type PacketShape } from '../game/packets.ts'
import { lengthOf } from './paths.ts'

export const BELT = 7
export const SPLITTER_W = 12
export const CHEVRON_GAP_PX = 14
export const CHEVRON_HALF = 1.6
export const CHEVRON_DEPTH = 1.4
export const beltSpeed = (rate: number): number => 22 + 16 * Math.log2(1 + rate)

export const packetAt = (
  g: Graphics,
  shape: PacketShape,
  x: number,
  y: number,
  r: number,
): Graphics => {
  switch (shape) {
    case 'circle':
      return g.circle(x, y, r)
    case 'square':
      return g.rect(x - r, y - r, r * 2, r * 2)
    case 'triangle':
      return g.poly([x, y - r * 1.3, x + r * 1.2, y + r, x - r * 1.2, y + r])
    case 'diamond':
      return g.poly([x, y - r * 1.35, x + r * 1.1, y, x, y + r * 1.35, x - r * 1.1, y])
  }
}

export const arrowAt = (
  g: Graphics,
  x: number,
  y: number,
  ux: number,
  uy: number,
  size: number,
): Graphics => {
  const nx = -uy
  const ny = ux
  return g.poly([
    x + ux * size,
    y + uy * size,
    x - ux * size * 0.7 + nx * size * 0.85,
    y - uy * size * 0.7 + ny * size * 0.85,
    x - ux * size * 0.7 - nx * size * 0.85,
    y - uy * size * 0.7 - ny * size * 0.85,
  ])
}

export const pointAndDirection = (
  path: Route,
  t: number,
): Readonly<{ x: number; y: number; ux: number; uy: number }> => {
  const length = lengthOf(path)
  let left = length * Math.max(0, Math.min(1, t))
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1]
    const b = path[index]
    if (!a || !b) continue
    const span = gap(a, b)
    if (span === 0) continue
    if (left <= span) {
      const k = left / span
      return {
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        ux: (b.x - a.x) / span,
        uy: (b.y - a.y) / span,
      }
    }
    left -= span
  }
  const last = path[path.length - 1] ?? { x: 0, y: 0 }
  const before = path[path.length - 2] ?? last
  const span = gap(before, last) || 1
  return { x: last.x, y: last.y, ux: (last.x - before.x) / span, uy: (last.y - before.y) / span }
}
