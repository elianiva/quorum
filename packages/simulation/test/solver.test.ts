import { expect, test } from 'vitest'
import { link, newGame, node } from '../src/company.ts'
import { restarting } from '../src/life.ts'
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

// A router notices a failed App Server late: a Load Balancer at its next health check, and DNS
// when its TTL runs out. So the same Nodes solve differently just after the failure and later.
test.each([
  { router: 'lb', early: 101, late: 160 },
  { router: 'dns', early: 101, late: 900 },
] as const)(
  'a Design the solver already holds moves to the new time: $router',
  ({ router, early, late }) => {
    const start = newGame(1)
    const design: Game = {
      ...start,
      sandbox: true,
      users: 50_000,
      researched: [...start.researched, 'health-checks'],
      nodes: [
        node('users', 'users', 0, 0),
        node('router', router, 100, 0),
        node('a', 'server', 200, 0),
        { ...node('b', 'server', 200, 100), life: restarting(600, 'failure', 0), downAt: 100 },
        node('db', 'database', 300, 0),
      ],
      links: [
        link('users', 'router'),
        link('router', 'a'),
        link('router', 'b'),
        link('a', 'db'),
        link('b', 'db'),
      ],
    }
    // Another Design in between makes the solver compile this one from its blocks.
    solveFlow({ ...start, users: 10 })
    const expected = solveFlow({ ...design, time: late })

    // The same Nodes and Links at other times: the Design is not compiled again, only moved.
    const before = solveFlow({ ...design, time: early })
    expect(before.nodes['b']?.inbound).not.toBe(expected.nodes['b']?.inbound)
    expect(solveFlow({ ...design, time: late })).toEqual(expected)
  },
)
