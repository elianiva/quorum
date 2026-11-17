import { test } from 'vitest'
import { resize, setRuntime } from './actions.ts'
import { link, node, preseedGame } from './company.ts'
import { previewOf } from './preview.ts'
import { bottleneckOf, solveFlow } from './solve.ts'
import type { Game, GameLink, GameNode } from './state.ts'

const bigBoard = (): Game => {
  const nodes: Array<GameNode> = [node('users', 'users', 0, 0), node('lb', 'lb', 100, 0)]
  const links: Array<GameLink> = [link('users', 'lb')]
  for (let group = 0; group < 6; group += 1) {
    const lb = `lb${group}`
    const pooler = `pool${group}`
    const database = `db${group}`
    nodes.push(
      node(lb, 'lb', 200, group * 100),
      node(pooler, 'pooler', 400, group * 100),
      node(database, 'database', 500, group * 100, { size: 5 }),
    )
    links.push(link('lb', lb), link(pooler, database))
    for (let index = 0; index < 30; index += 1) {
      const id = `s${group}-${index}`
      nodes.push(
        node(id, 'server', 300, group * 100 + index, {
          size: 3,
          runtime: 'php_fpm',
          workers: 40,
        }),
      )
      links.push(link(lb, id), link(id, pooler))
    }
  }
  return {
    ...preseedGame(),
    nodes,
    links,
    users: 400_000,
    researched: [...preseedGame().researched, 'pooling', 'opcache'],
  }
}

test('a 200-Node board', async ({ bench }) => {
  const game = bigBoard()
  solveFlow(game)
  await bench.compare(
    bench('solveFlow (budget 2 ms)', () => {
      solveFlow({ ...game })
    }),
    bench('bottleneckOf (budget 3 ms)', () => {
      bottleneckOf(game)
    }),
  )
})

test('the Tradeoff preview', { timeout: 300_000 }, async ({ bench }) => {
  const game: Game = {
    ...preseedGame(),
    users: 4_000,
    researched: [...preseedGame().researched, 'lang-node', 'node-cluster'],
  }
  const big: Game = { ...bigBoard(), cash: 1e9 }
  let second = 0
  await bench.compare(
    bench('previewOf, Pre-seed runtime switch', () => {
      previewOf({ ...game }, 'cluster', (current) => setRuntime(current, 'server', 'node_cluster'))
    }),
    bench('previewOf, Pre-seed resize', () => {
      previewOf({ ...game }, 'resize', (current) => resize(current, 'server', 1))
    }),
    bench('previewOf, Pre-seed second option', () => {
      previewOf(game, `resize-${(second += 1)}`, (current) => resize(current, 'server', 1))
    }),
    bench('previewOf, 200-Node board resize', () => {
      previewOf({ ...big }, 'resize', (current) => resize(current, 's0-0', 1))
    }),
    bench('previewOf, cached', () => {
      previewOf(game, 'resize', (current) => resize(current, 'server', 1))
    }),
  )
})
