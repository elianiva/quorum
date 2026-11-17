import type { ComponentId } from '@quorum/simulation/catalog'
import { LAYOUTS } from './layouts.ts'

export const CARD_W = 216
export const HEAD = 36
export const ROW = 24
export const FOOT = 44
export const PORT_R = 6

export const rowTop = (index: number): number => HEAD + 4 + index * ROW
export const rowMid = (index: number): number => rowTop(index) + ROW / 2

export const heightOf = (type: ComponentId): number => {
  const layout = LAYOUTS[type]
  return rowTop(layout.rows) + (layout.footer ? FOOT : 6)
}
