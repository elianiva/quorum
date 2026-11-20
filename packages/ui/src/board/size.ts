import type { ComponentId } from '@quorum/simulation/catalog'
import { LAYOUTS } from './layouts.ts'

export const CARD_W = 216
export const HEAD = 36
export const ROW = 24
export const FOOT = 44
export const PORT_R = 6

export const rowTop = (index: number): number => HEAD + 4 + index * ROW
export const rowMid = (index: number): number => rowTop(index) + ROW / 2

export const SLOT_W = 58
export const SLOT_H = 58
export const SLOT_GAP = 8
export const SLOT_STRIP = 72

export const slotTop = (type: ComponentId): number => rowTop(LAYOUTS[type].rows) + FOOT + 4

export const slotLeft = (index: number): number =>
  (CARD_W - (SLOT_W * 3 + SLOT_GAP * 2)) / 2 + index * (SLOT_W + SLOT_GAP)

export const heightOf = (type: ComponentId): number => {
  const layout = LAYOUTS[type]
  return rowTop(layout.rows) + (layout.footer ? FOOT : 6) + (layout.slots ? SLOT_STRIP : 0)
}
