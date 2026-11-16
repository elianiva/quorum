import { expect, test } from 'vitest'
import { hitGroups } from './hit-groups.ts'

test('a short series keeps one target per category', () => {
  expect(hitGroups(3, 240)).toEqual([
    { from: 0, to: 0, index: 0 },
    { from: 1, to: 1, index: 1 },
    { from: 2, to: 2, index: 2 },
  ])
})

test('a long series shares targets, and every category is covered once', () => {
  const groups = hitGroups(720, 240)
  expect(groups).toHaveLength(240)
  expect(groups[0]).toEqual({ from: 0, to: 2, index: 1 })
  expect(groups.flatMap((group) => [group.from, group.to]).at(-1)).toBe(719)
  for (let at = 1; at < groups.length; at += 1)
    expect(groups[at]!.from).toBe(groups[at - 1]!.to + 1)
})

test('an uneven tail gets a shorter last target', () => {
  expect(hitGroups(7, 3)).toEqual([
    { from: 0, to: 2, index: 1 },
    { from: 3, to: 5, index: 4 },
    { from: 6, to: 6, index: 6 },
  ])
})
