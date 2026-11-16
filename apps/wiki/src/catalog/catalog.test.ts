import { Option } from 'effect'
import { expect, test } from 'vitest'
import '@quorum/simulation/host/node'
import { COMPONENT_IDS } from '@quorum/simulation/catalog'
import { rowsOf } from '@quorum/ui/board/card'
import { renderPage } from '../entry.server.ts'
import { init, queryOf } from '../submodels/catalog.ts'
import { boardFor, GRID_COLUMNS } from './boards.ts'
import { STORIES, decodeArgs, encodeArgs, initialArgs, stateArgs, storyOf } from './stories.ts'

/* The catalog's contract: a story for every Component, and every state of every story draws. */

test('every Component has exactly one story, and every story has a state to draw', () => {
  expect(STORIES.map((story) => story.id)).toEqual([...COMPONENT_IDS])
  for (const story of STORIES) expect(story.states.length, story.id).toBeGreaterThan(0)
})

test('every state of every story builds a board whose cards have rows', () => {
  for (const story of STORIES) {
    const single = boardFor(story, initialArgs(story), 'single', false)
    const grid = boardFor(story, initialArgs(story), 'grid', false)
    expect(single.game.nodes, story.id).toHaveLength(1)
    expect(grid.game.nodes, story.id).toHaveLength(story.states.length)
    for (const state of story.states) {
      const board = boardFor(story, stateArgs(story, state), 'single', false)
      const node = board.game.nodes[0]
      expect(node, story.id).toBeDefined()
      if (!node) continue
      expect(
        rowsOf(board.game, node, board.ledger).length,
        `${story.id} ${state.name}`,
      ).toBeGreaterThan(0)
      // The grid draws each state's own ledger, not one shared entry.
      const placed = grid.game.nodes[story.states.indexOf(state)]
      expect(placed && grid.ledger.nodes[placed.id]?.status, `${story.id} ${state.name}`).toBe(
        board.ledger.nodes[node.id]?.status,
      )
    }
  }
  expect(GRID_COLUMNS).toBeGreaterThan(0)
})

test('args in the URL round-trip, clamp to their control, and ignore anything unsafe', () => {
  const cache = storyOf('cache')
  if (!cache) throw new Error('no cache story')
  const changed = { ...initialArgs(cache), utilization: 1.2, life: 'stopped', selected: true }
  expect(decodeArgs(cache, encodeArgs(cache, changed))).toEqual(changed)
  // An unchanged arg is not written; a value past its range is pulled back; junk is dropped.
  expect(encodeArgs(cache, initialArgs(cache))).toBe('')
  expect(decodeArgs(cache, 'utilization:99;life:exploded;zone:<b>;nope:1')).toEqual({
    ...initialArgs(cache),
    utilization: 1.5,
  })
})

test('a catalog URL names its state, and the state names its URL', () => {
  const model = init(Option.some('story=database&mode=grid&bg=dark&width=480&args=status:danger'))
  expect(model).toMatchObject({
    story: 'database',
    mode: 'grid',
    background: 'dark',
    viewport: '480',
    args: { status: 'danger' },
  })
  expect(init(Option.some(queryOf(model).split('?')[1] ?? ''))).toEqual(model)
  expect(init(Option.none()).story).toBe('cache')
})

test('the catalog page renders at its path, and is no page of the wiki', async () => {
  const result = await renderPage(new Request('https://wiki.playquorum.dev/catalog?story=queue'))
  expect(result._tag).toBe('Rendered')
  if (result._tag !== 'Rendered') return
  expect(result.status).toBeUndefined()
  expect(result.application.title).toContain('Catalog')
  expect(result.application.html).toContain('aria-label="Components"')
})
