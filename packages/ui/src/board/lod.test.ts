import { expect, test } from 'vitest'
import {
  CHIP_GONE_AT_ZOOM,
  ROWS_FULL_AT_ZOOM,
  ROWS_GONE_BELOW_ZOOM,
  chipAt,
  rowsAt,
} from './lod.ts'

test('up close, a card shows its rows and no chip', () => {
  expect(rowsAt(1)).toBe(1)
  expect(chipAt(1)).toBe(0)
  expect(rowsAt(ROWS_FULL_AT_ZOOM)).toBe(1)
})

test('rows fade out as the board zooms out, and are gone at the lowest zoom', () => {
  expect(rowsAt(ROWS_FULL_AT_ZOOM)).toBeGreaterThan(
    rowsAt((ROWS_FULL_AT_ZOOM + ROWS_GONE_BELOW_ZOOM) / 2),
  )
  expect(rowsAt(ROWS_GONE_BELOW_ZOOM)).toBe(0)
  expect(rowsAt(0.05)).toBe(0)
})

test('below the chip zoom a card is a chip, and above it a whole card', () => {
  expect(chipAt(CHIP_GONE_AT_ZOOM)).toBe(0)
  expect(chipAt(CHIP_GONE_AT_ZOOM + 0.1)).toBe(0)
  expect(chipAt(CHIP_GONE_AT_ZOOM - 0.03)).toBeCloseTo(0.5)
  expect(chipAt(ROWS_GONE_BELOW_ZOOM)).toBe(1)
  expect(chipAt(0.1)).toBe(1)
})

test('the chip and the card cross over, never both gone and never both whole', () => {
  for (const zoom of [0.2, 0.28, 0.3, 0.32, 0.36, 0.5, 1]) {
    expect(chipAt(zoom) + (1 - chipAt(zoom))).toBeCloseTo(1)
    expect(chipAt(zoom)).toBeGreaterThanOrEqual(0)
    expect(chipAt(zoom)).toBeLessThanOrEqual(1)
  }
  expect(rowsAt(ROWS_GONE_BELOW_ZOOM)).toBe(0)
  expect(chipAt(ROWS_GONE_BELOW_ZOOM)).toBe(1)
})
