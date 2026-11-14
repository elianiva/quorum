import { expect, test } from 'vitest'
import { newGame } from '../src/company.ts'
import { bottleneckOf, solveFlow } from '../src/solve.ts'
import type { Game } from '../src/state.ts'

test('a solve that throws part-way does not leave the Bottleneck search on its blocks', () => {
  const game: Game = { ...newGame(1), users: 1_000 }
  const bottleneck = bottleneckOf(game)
  expect(bottleneck).not.toBeNull()

  // The server row is written with no capacity, then the write throws at the unknown runtime.
  const broken = {
    ...game,
    nodes: game.nodes.map((node) =>
      node.type === 'server' ? { ...node, size: 0, workers: 0, runtime: 'unknown' } : node,
    ),
  } as Game
  solveFlow(game)
  expect(() => solveFlow(broken)).toThrow()
  expect(bottleneckOf(game)).toBe(bottleneck)
})
