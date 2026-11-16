import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { Result } from 'effect'
import { connect } from '@quorum/simulation/actions'
import { COMPONENTS } from '@quorum/simulation/catalog'
import { isDown, primaryOf } from '@quorum/simulation/lookups'
import { solveFlow } from '@quorum/simulation/solve'
import { boxOf, crowds } from '@quorum/ui/board/geometry'
import { DESIGN_IDS } from './designs/ids.ts'
import { DESIGNS } from './designs/index.ts'

/* The Patterns section's contract with the game: every Design is a Board the Simulation can solve, its
   settings are fields the game has, and a page places each one. */

const entries = Object.entries(DESIGNS)

test('the island schema lists every Design', () => {
  expect([...DESIGN_IDS].sort()).toEqual(entries.map(([id]) => id).sort())
})

test('every Design solves, links existing Nodes, and keeps its cards apart', () => {
  const bad: Array<string> = []
  for (const [id, design] of entries) {
    const nodes = design.game.nodes
    const ids = new Set(nodes.map((node) => node.id))
    for (const link of design.game.links)
      if (!ids.has(link.from) || !ids.has(link.to))
        bad.push(`${id}: link ${link.from} → ${link.to}`)
    for (const node of nodes)
      for (const other of nodes)
        if (node.id < other.id && crowds(boxOf(node), boxOf(other)))
          bad.push(`${id}: ${node.id} overlaps ${other.id}`)
    // A Read Replica copies the Database linked into it: without one it serves nothing and its card
    // tells the reader to link a Database, so the Design would not show what its page describes.
    for (const node of nodes)
      if (node.type === 'replica' && primaryOf(design.game, node) === undefined)
        bad.push(`${id}: ${node.id} copies no Database`)
    for (const node of design.nodes)
      for (const setting of node.settings)
        if (!(setting.field in (nodes.find((n) => n.id === node.id) ?? {})))
          bad.push(`${id}: ${node.id} has no field ${setting.field}`)
    for (const link of design.links)
      for (const setting of link.settings)
        if (!(setting.field in (design.game.links[0] ?? {})))
          bad.push(`${id}: link has no field ${setting.field}`)
    expect(Number.isFinite(solveFlow(design.game).apdex), id).toBe(true)
  }
  expect(bad).toEqual([])
})

test('every Design is placed on a Patterns page', () => {
  const dir = join(import.meta.dirname, '../../content/patterns')
  const text = readdirSync(dir)
    .map((file) => readFileSync(join(dir, file), 'utf8'))
    .join('\n')
  expect(entries.map(([id]) => id).filter((id) => !text.includes(`::Design{id="${id}"}`))).toEqual(
    [],
  )
})

test('every Design link is one the game accepts, so a player could build the board', () => {
  const refused: Array<string> = []
  for (const [id, design] of entries) {
    let game = { ...design.game, links: [] as typeof design.game.links }
    for (const link of design.game.links) {
      const result = connect(game, link.from, link.to)
      if (Result.isSuccess(result)) game = { ...result.success, links: [...game.links, link] }
      else refused.push(`${id}: ${link.from} → ${link.to}`)
    }
  }
  expect(refused).toEqual([])
})

test('every running Node that takes requests carries some in its Design, so no card sits at 0 a second', () => {
  const idle: Array<string> = []
  for (const [id, design] of entries) {
    const ledger = solveFlow(design.game)
    for (const node of design.game.nodes) {
      const def = COMPONENTS[node.type]
      // A host the Design takes down (a dead server) is idle on purpose.
      if (node.type === 'users' || def.control || def.accepts.length === 0 || isDown(node)) continue
      if ((ledger.nodes[node.id]?.inbound ?? 0) === 0) idle.push(`${id}: ${node.id}`)
    }
  }
  expect(idle).toEqual([])
})
