import { POOL_LIMITS } from '@quorum/simulation/catalog'

export const POOL_SLIDER_STEPS = 1000

export const poolFromSlider = (position: number): number =>
  Math.round(
    POOL_LIMITS.min * (POOL_LIMITS.max / POOL_LIMITS.min) ** (position / POOL_SLIDER_STEPS),
  )

export const sliderFromPool = (workers: number): number =>
  Math.round(
    (Math.log(Math.max(POOL_LIMITS.min, workers) / POOL_LIMITS.min) /
      Math.log(POOL_LIMITS.max / POOL_LIMITS.min)) *
      POOL_SLIDER_STEPS,
  )
