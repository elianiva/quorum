import { DILATION_SPEEDS, STEP_SECONDS } from '@quorum/simulation/catalog'
import { Game } from '@quorum/simulation/state'
import { perkLevel } from '@quorum/simulation/founding'

export const TICK_MS = 250

const MAX_TICK_STEPS = 100

export const maxStepsPerTick = (speed: number): number =>
  Math.max(MAX_TICK_STEPS, Math.ceil((2 * TICK_MS * speed) / (1_000 * STEP_SECONDS)))

export const SAVE_EVERY_MS = 5_000

export const SAMPLE_EVERY = 10

export const SPEEDS = [0.5, 1, 3, 10] as const

export const speedsOf = (game: Game): ReadonlyArray<number> => [
  ...SPEEDS,
  ...(DILATION_SPEEDS[perkLevel(game, 'time-dilation')] ?? []),
]
