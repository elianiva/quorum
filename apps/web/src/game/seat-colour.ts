/** One hue step shy of the golden angle, so neighbouring Seats land far apart on the wheel. */
const HUE_STEP = 137.5

/** The colour of one Seat, by its index: a Room holds 20, so each gets its own hue. */
export const seatColour = (index: number): string =>
  `oklch(0.6 0.15 ${Math.round((30 + index * HUE_STEP) % 360)})`
