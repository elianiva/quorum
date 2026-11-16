import { expect, test } from 'vitest'
import { newGame } from '@quorum/simulation/company'
import { perSecond } from './per-second.ts'

const game = newGame()

test('a Step inside the same sim second reuses the figure', () => {
  const cached = perSecond<number>()
  let runs = 0
  const read = (time: number, key = 'a') => cached({ ...game, time }, key, () => (runs += 1))
  read(10)
  read(10.1)
  read(10.9)
  expect(runs).toBe(1)
  read(11)
  expect(runs).toBe(2)
})

test('a move while the clock is stopped computes the figure again', () => {
  const cached = perSecond<number>()
  let runs = 0
  cached({ ...game, time: 10 }, 'a', () => (runs += 1))
  cached({ ...game, time: 10, cash: game.cash + 1 }, 'a', () => (runs += 1))
  expect(runs).toBe(2)
})

test('each key keeps its own figure', () => {
  const cached = perSecond<string>()
  const at = { ...game, time: 10 }
  expect(cached(at, 'eu', () => 'eu')).toBe('eu')
  expect(cached(at, 'apac', () => 'apac')).toBe('apac')
  expect(cached(at, 'eu', () => 'other')).toBe('eu')
})
