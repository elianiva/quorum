import type { ComponentId } from '@quorum/simulation/catalog'
import { LAYOUTS } from './layouts.ts'

export const CARD_W = 216
export const HEAD = 36
export const ROW = 24
export const INSET = 6
export const KEY_H = 31
export const PORT_R = 6

export const rowTop = (index: number): number => HEAD + INSET + index * ROW
export const rowMid = (index: number): number => rowTop(index) + ROW / 2

export const SLOT_W = 56
export const SLOT_H = 52
export const SLOT_GAP = 11
export const BAY_H = SLOT_H + 14

export const panelBottom = (type: ComponentId): number => rowTop(LAYOUTS[type].rows)
export const bayTop = (type: ComponentId): number => panelBottom(type) + INSET
export const slotTop = (type: ComponentId): number => bayTop(type) + 7

export const slotLeft = (index: number): number =>
  (CARD_W - (SLOT_W * 3 + SLOT_GAP * 2)) / 2 + index * (SLOT_W + SLOT_GAP)

const bodyBottom = (type: ComponentId): number =>
  LAYOUTS[type].slots ? bayTop(type) + BAY_H : panelBottom(type)

export const keyTop = (type: ComponentId): number => bodyBottom(type) + INSET

export const heightOf = (type: ComponentId): number =>
  LAYOUTS[type].footer ? keyTop(type) + KEY_H + 2 + INSET : bodyBottom(type) + INSET
