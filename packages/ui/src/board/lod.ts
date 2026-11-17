export const ROWS_GONE_BELOW_ZOOM = 0.3
export const ROWS_FULL_AT_ZOOM = 0.38
export const CHIP_GONE_AT_ZOOM = 0.36
export const CHIP_FADE_ZOOM_SPAN = 0.06

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export const rowsAt = (zoom: number): number =>
  clamp01((zoom - ROWS_GONE_BELOW_ZOOM) / (ROWS_FULL_AT_ZOOM - ROWS_GONE_BELOW_ZOOM))

export const chipAt = (zoom: number): number =>
  clamp01((CHIP_GONE_AT_ZOOM - zoom) / CHIP_FADE_ZOOM_SPAN)
