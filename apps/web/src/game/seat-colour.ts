const NEAR_GOLDEN_ANGLE_DEGREES = 137.5

export const seatColour = (index: number): string =>
  `oklch(0.6 0.15 ${Math.round((30 + index * NEAR_GOLDEN_ANGLE_DEGREES) % 360)})`
