import { POOL_LIMITS } from '@quorum/simulation/catalog'
import { expect, test } from 'vitest'
import { POOL_SLIDER_STEPS, poolFromSlider, sliderFromPool } from './pool-scale.ts'

test('the pool slider spans the pool limits and spends equal travel on each decade', () => {
  expect(poolFromSlider(0)).toBe(POOL_LIMITS.min)
  expect(poolFromSlider(POOL_SLIDER_STEPS)).toBe(POOL_LIMITS.max)
  expect(sliderFromPool(10) - sliderFromPool(1)).toBeCloseTo(
    sliderFromPool(100) - sliderFromPool(10),
    -1,
  )
})

test('a worker count survives the trip through the slider', () => {
  for (const workers of [1, 5, 16, 40, 96, 250, 400])
    expect(poolFromSlider(sliderFromPool(workers))).toBeGreaterThanOrEqual(workers - 1)
})
