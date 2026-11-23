import { Graphics } from 'pixi.js'
import { type BuildGroup, type ComponentId } from '@quorum/simulation/catalog'
import { type Game, type GameNode } from '@quorum/simulation/state'
import { CARD_W, HEAD, INSET, KEY_H, keyTop, layoutOf, type Pt } from './geometry.ts'
import { footerOf } from './card.ts'
import { GROUP_SHAPES } from '../game/icons.ts'
import { type Palette, mix, gradient } from './palette.ts'
import { silhouette, badgeShape } from './shapes.ts'

export const footerRect = (type: ComponentId) => ({
  x: INSET,
  y: keyTop(type),
  w: CARD_W - INSET * 2,
  h: KEY_H,
})

export const BADGE_X = 20
export const BADGE_Y = 13
export const BADGE_R = 16
export const TITLE_X = 48

const plateShape = (g: Graphics, group: BuildGroup, x: number, y: number, r: number): Graphics =>
  GROUP_SHAPES[group] === 'chip'
    ? g.roundRect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8, r * 0.3)
    : badgeShape(g, group, x, y, r)

export const medallion = (g: Graphics, group: BuildGroup, tone: number, colors: Palette): void => {
  const plate = BADGE_R + 5.5
  plateShape(g, group, BADGE_X, BADGE_Y + 1.5, plate + 0.5).fill({
    color: colors.shade,
    alpha: 0.08,
  })
  plateShape(g, group, BADGE_X, BADGE_Y, plate).fill(colors.card)
  plateShape(g, group, BADGE_X, BADGE_Y, plate).stroke({
    color: mix(colors.border, tone, 0.5),
    width: 1.5,
  })
  badgeShape(g, group, BADGE_X, BADGE_Y, BADGE_R).fill(
    gradient(mix(tone, 0xffffff, 0.2), mix(tone, 0x000000, 0.1)),
  )
}

export const headerBand = (g: Graphics, group: BuildGroup, hue: number, colors: Palette): void => {
  silhouette(g, group, 0, 0, CARD_W, HEAD, 0, true).fill(
    gradient(
      mix(mix(colors.card, 0xffffff, 0.4), hue, 0.14),
      mix(mix(colors.card, colors.shade, 0.08), hue, 0.24),
    ),
  )
  g.moveTo(20, 0.5)
    .lineTo(CARD_W - 20, 0.5)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.55 })
  g.moveTo(0, HEAD)
    .lineTo(CARD_W, HEAD)
    .stroke({ color: mix(colors.border, hue, 0.35), width: 1, alpha: 0.8 })
  g.moveTo(10, HEAD + 1)
    .lineTo(CARD_W - 10, HEAD + 1)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.32 })
}

export const screw = (
  g: Graphics,
  cx: number,
  cy: number,
  colors: Palette,
  empty = false,
): void => {
  g.circle(cx, cy, 3).fill({ color: colors.shade, alpha: 0.22 })
  if (empty) {
    g.circle(cx, cy, 2.2).stroke({ color: colors.shade, width: 0.8, alpha: 0.28 })
    return
  }
  const steel = mix(colors.muted, colors.card, 0.45)
  g.circle(cx, cy, 2.4).fill(gradient(mix(steel, 0xffffff, 0.35), mix(steel, 0x000000, 0.38)))
  g.circle(cx, cy, 2.4).stroke({
    color: mix(colors.shade, 0x000000, 0.25),
    width: 0.7,
    alignment: 1,
  })
  g.moveTo(cx - 1.4, cy + 0.8)
    .lineTo(cx + 1.4, cy - 0.8)
    .stroke({ color: mix(colors.shade, 0x000000, 0.4), width: 0.9 })
}

export const recess = (
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  colors: Palette,
  fill = colors.well,
): void => {
  g.roundRect(x, y + 1, w, h, r).fill({ color: mix(colors.card, 0xffffff, 0.25), alpha: 0.7 })
  g.roundRect(x, y, w, h, r).fill(gradient(mix(fill, colors.shade, 0.08), fill))
  g.roundRect(x, y, w, h, r).stroke({ color: colors.shade, width: 1, alignment: 1, alpha: 0.14 })
  g.moveTo(x + r, y + 1.5)
    .lineTo(x + w - r, y + 1.5)
    .stroke({ color: colors.shade, width: 1, alpha: 0.08 })
}

export const pipsWidth = (total: number): number => total * (total > 5 ? 5.5 : 7) - 2

export const pips = (
  g: Graphics,
  x: number,
  y: number,
  filled: number,
  total: number,
  on: number,
  off: number,
): void => {
  const w = total > 5 ? 3.5 : 5
  const step = w + 2
  for (let index = 0; index < total; index += 1) {
    const at = x + index * step
    g.poly([at + 2, y, at + w + 2, y, at + w, y + 9, at, y + 9]).fill(index < filled ? on : off)
  }
}

export const inFooter = (node: GameNode, point: Pt): boolean => {
  if (!layoutOf(node.type).footer) return false
  const rect = footerRect(node.type)
  const x = point.x - node.x
  const y = point.y - node.y
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

export const holds = (game: Game, node: GameNode): boolean => {
  const footer = footerOf(game, node)
  return !!footer && footer.enabled && (footer.glyph === 'resize' || footer.glyph === 'more')
}
