import { Result } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Actions from '../src/actions.ts'
import { COMPONENTS, COMPONENT_IDS, type ComponentId } from '../src/catalog.ts'
import { newGame, node, preseedGame } from '../src/company.ts'
import type { Game, GameNode } from '../src/state.ts'

const linked = (game: ReturnType<typeof newGame>): boolean =>
  game.links.some((link) => link.from === 'users' && link.to === 'server')

const pair = (from: ComponentId, to: ComponentId): Game => {
  const extra = (type: ComponentId): Partial<GameNode> => (type === 'lb' ? { variant: 'l4' } : {})
  return {
    ...newGame(),
    nodes: [node('from', from, 200, 280, extra(from)), node('to', to, 600, 280, extra(to))],
    links: [],
  }
}

describe('the reason a Link is refused', () => {
  test('a duplicate says it is already there, and connect leaves the Game alone', () => {
    const game = newGame()
    expect(linked(game)).toBe(true)
    expect(Actions.linkRefusalOf(game, 'users', 'server')).toBe('Already linked.')
    const result = Actions.connect(game, 'users', 'server')
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result) && result.failure._tag === 'NotAllowed')
      expect(result.failure.reason).toBe('Already linked.')
  })

  test('a target with no input says so instead of accepting a dead Link', () => {
    expect(Actions.linkRefusalOf(newGame(), 'server', 'payments')).toBe('Payments has no input.')
  })

  test('a legal Link returns null, and connect spends the local Database', () => {
    const game = preseedGame()
    const unlinked = Actions.disconnect(game, 'server', 'database')
    expect(Actions.linkRefusalOf(unlinked, 'server', 'database')).toBeNull()
    const result = Actions.connect(unlinked, 'server', 'database')
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(
        result.success.links.some((link) => link.from === 'server' && link.to === 'database'),
      ).toBe(true)
      expect(result.success.nodes.find((node) => node.id === 'server')?.localDb).toBe(false)
    }
  })

  test('two Databases do not link to each other', () => {
    const game = preseedGame()
    const two = {
      ...game,
      nodes: [...game.nodes, node('database2', 'database', 900, 280)],
    }
    expect(Actions.linkRefusalOf(two, 'database', 'database2')).toContain(
      'Databases do not link to each other',
    )
  })
})

describe('the Nodes a Component may call', () => {
  test('a Cache cannot call Object Storage, though both accept blobs', () => {
    expect(COMPONENTS.storage.accepts).toContain('blob-put')
    const game = pair('cache', 'storage')
    expect(Actions.linkRefusalOf(game, 'from', 'to')).toBe('Cache does not call Object Storage.')
    expect(Result.isFailure(Actions.connect(game, 'from', 'to'))).toBe(true)
  })

  test('a Cache forwards to a Database or a Connection Pooler', () => {
    expect(Actions.linkRefusalOf(pair('cache', 'database'), 'from', 'to')).toBeNull()
    expect(Actions.linkRefusalOf(pair('cache', 'pooler'), 'from', 'to')).toBeNull()
  })

  test('a Connection Pooler pools database connections, not a Cache', () => {
    expect(Actions.linkRefusalOf(pair('pooler', 'cache'), 'from', 'to')).toBe(
      'Connection Pooler does not call Cache.',
    )
    expect(Actions.linkRefusalOf(pair('pooler', 'database'), 'from', 'to')).toBeNull()
    expect(Actions.linkRefusalOf(pair('pooler', 'replica'), 'from', 'to')).toBeNull()
  })

  test('a CDN can read video from Object Storage', () => {
    expect(COMPONENTS.storage.accepts).toContain('media')
    expect(Actions.linkRefusalOf(pair('cdn', 'storage'), 'from', 'to')).toBeNull()
  })

  test('a Function or Edge Function can hand work to a Queue', () => {
    expect(Actions.linkRefusalOf(pair('fn', 'queue'), 'from', 'to')).toBeNull()
    expect(Actions.linkRefusalOf(pair('edge', 'queue'), 'from', 'to')).toBeNull()
    expect(Actions.linkRefusalOf(pair('fn', 'log'), 'from', 'to')).not.toBeNull()
  })

  test('every Component declares its inbound and outbound links', () => {
    for (const from of COMPONENT_IDS) {
      const { inbound, outbound } = COMPONENTS[from]
      expect(new Set(inbound).size, `${from} inbound`).toBe(inbound.length)
      expect(new Set(outbound).size, `${from} outbound`).toBe(outbound.length)
      for (const to of outbound) {
        expect(COMPONENT_IDS, `${from} -> ${to}`).toContain(to)
        expect(COMPONENTS[to].inbound, `${to} lists ${from}`).toContain(from)
      }
      for (const to of inbound) {
        expect(COMPONENT_IDS, `${to} -> ${from}`).toContain(to)
        expect(COMPONENTS[to].outbound, `${to} calls ${from}`).toContain(from)
      }
    }
    const self = {
      ...newGame(),
      nodes: [node('one', 'server', 200, 280)],
      links: [],
    }
    expect(Actions.linkRefusalOf(self, 'one', 'one')).toBe('Link two different Nodes.')
  })

  test('every pair the kinds allow outside the declaration is refused', () => {
    // A Replica copy, a CDC mirror and a control Link are topology, not request kinds.
    const special = (from: ComponentId, to: ComponentId): boolean =>
      (from === 'database' && (to === 'cdc' || to === 'replica')) ||
      ((from === 'server' || from === 'worker') &&
        (to === 'autoscaler' || to === 'cluster' || to === 'mesh'))
    for (const from of COMPONENT_IDS)
      for (const to of COMPONENT_IDS) {
        if (from === to) continue
        if (special(from, to)) continue
        const refusal = Actions.linkRefusalOf(pair(from, to), 'from', 'to')
        const compatible = COMPONENTS[from].sends.some((kind) =>
          COMPONENTS[to].accepts.includes(kind),
        )
        if (COMPONENTS[from].outbound.includes(to)) {
          expect(compatible, `${from} -> ${to}`).toBe(true)
          expect(refusal, `${from} -> ${to}`).toBeNull()
        } else if (compatible) {
          expect(refusal, `${from} -> ${to}`).not.toBeNull()
        }
      }
  })
})
