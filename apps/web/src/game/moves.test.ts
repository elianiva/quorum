import { describe, expect, it } from 'vitest'
import { Result } from 'effect'
import type { IntentAnswers } from '@quorum/rpc'
import { place } from '@quorum/simulation/actions'
import { newGame } from '@quorum/simulation/company'
import { candidates, clauses, moveRequest, resolve } from './moves.ts'

const certain = (choice: string, other: string, p = 0.9): IntentAnswers[string] => ({
  choice,
  probabilities: { [choice]: p, [other]: 1 - p },
  confidence: p,
})

const said = (entries: Record<string, IntentAnswers[string]>): IntentAnswers => entries

describe('clauses', () => {
  it('splits at then, and keeps it at the start of the clause', () => {
    const parts = clauses("let's add a database then connect that to the app server")
    expect(parts.map((part) => part.text)).toEqual([
      "let's add a database",
      'then connect that to the app server',
    ])
  })

  it('splits at a comma before a cue, and again at also', () => {
    const parts = clauses('buy a cache, then put that in between, also upsize the server')
    expect(parts.map((part) => part.text)).toEqual([
      'buy a cache',
      'then put that in between',
      'also upsize the server',
    ])
  })

  it('splits two sentences that have no cue word', () => {
    const parts = clauses('buy a database. connect it to the server')
    expect(parts.map((part) => part.text)).toEqual(['buy a database', 'connect it to the server'])
  })

  it('keeps the spans in order and inside the utterance', () => {
    const utterance = 'add a cache then link it also open research'
    const parts = clauses(utterance)
    expect(parts.length).toBe(3)
    for (const [index, part] of parts.entries()) {
      expect(part.start).toBeLessThan(part.end)
      expect(part.end).toBeLessThanOrEqual(utterance.length)
      if (index > 0) expect(part.start).toBeGreaterThanOrEqual(parts[index - 1]?.end ?? 0)
      expect(utterance.slice(part.start, part.end)).toBe(part.text)
    }
  })
})

describe('moveRequest', () => {
  const game = newGame()

  it('offers only the Components the Game would take now', () => {
    const request = moveRequest({ game, region: 'na', clause: 'add a database', just: null })
    expect(request.questions.component?.criteria).toHaveProperty('database')
    // Users and Payments are fixed Nodes: the board places them, not the player.
    expect(request.questions.component?.criteria).not.toHaveProperty('users')
    expect(request.questions.component?.criteria).not.toHaveProperty('payments')
  })

  it('always offers nothing, so an unclear sentence can be declined', () => {
    const request = moveRequest({ game, region: 'na', clause: 'hmm', just: null })
    expect(request.questions.verb?.criteria).toHaveProperty('nothing')
  })

  it('names the Node the clause before it placed', () => {
    const placed = game.nodes[1]
    const request = moveRequest({
      game,
      region: 'na',
      clause: 'then connect that to the analytics',
      just: placed?.id ?? null,
    })
    expect(request.questions.from?.criteria[placed?.id ?? '']).toContain('just created')
    expect(request.state).toContain('then connect that to the analytics')
  })
})

describe('resolve', () => {
  const game = newGame()

  it('places the Component the answer names', () => {
    const resolved = resolve(
      game,
      said({
        verb: certain('place', 'nothing'),
        component: certain('database', 'cache'),
      }),
    )
    expect(resolved).toEqual({
      move: { _tag: 'Place', type: 'database' },
      label: 'Place Database',
      confident: true,
    })
  })

  it('turns a spoken Link around when only the other end may call', () => {
    const withDb = Result.getOrThrow(place(game, 'database', 0, 0))
    const database = withDb.nodes.at(-1)?.id ?? 'database'
    const resolved = resolve(
      withDb,
      said({
        verb: certain('connect', 'nothing'),
        from: certain(database, 'server', 0.8),
        to: {
          choice: 'server',
          probabilities: { [database]: 0.2, server: 0.8 },
          confidence: 0.6,
        },
      }),
    )
    // The Database cannot call the App Server: the Link goes the other way.
    expect(resolved.move).toEqual({ _tag: 'Connect', from: 'server', to: database })
    expect(resolved.confident).toBe(true)
  })

  it('holds a clause the answers were not sure about', () => {
    const resolved = resolve(
      game,
      said({
        verb: { choice: 'place', probabilities: { place: 0.5, connect: 0.5 }, confidence: 0.2 },
        component: certain('database', 'cache'),
      }),
    )
    expect(resolved.confident).toBe(false)
    expect(resolved.move).toEqual({ _tag: 'Nothing' })
  })

  it('keeps the size the player asked for when the Company cannot pay', () => {
    const broke = { ...game, cash: 0 }
    const database = broke.nodes.find((node) => node.type === 'server')
    const resolved = resolve(
      broke,
      said({
        verb: certain('resize', 'nothing'),
        node: certain(database?.id ?? 'server', 'analytics'),
        direction: certain('up', 'down'),
      }),
    )
    // The board refuses with its price; the answer is not read as the other direction.
    expect(resolved.move).toEqual({
      _tag: 'Resize',
      nodeId: database?.id ?? 'server',
      direction: 1,
    })
    expect(resolved.confident).toBe(true)
  })

  it('offers one reading per likely Node when it cannot pick one', () => {
    const withServer = Result.getOrThrow(place(game, 'server', 0, 0))
    const second = withServer.nodes.at(-1)?.id ?? 'n1'
    const answers = said({
      verb: certain('command', 'nothing'),
      command: certain('restart', 'sell'),
      node: {
        choice: 'server',
        probabilities: { server: 0.38, [second]: 0.35, database: 0.1 },
        confidence: 0.1,
      },
    })
    expect(resolve(withServer, answers).confident).toBe(false)
    const offered = candidates(withServer, answers)
    const labels = new Set(offered.map((offer) => offer.resolved.label))
    expect(offered.length).toBe(2)
    expect(labels.size).toBe(2)
  })

  it('declines a sentence with no move in it', () => {
    const resolved = resolve(game, said({ verb: certain('nothing', 'place') }))
    expect(resolved).toEqual({ move: { _tag: 'Nothing' }, label: '', confident: false })
  })

  it('reads get as a Study, and points Research at the same item', () => {
    const resolved = resolve(
      game,
      said({
        verb: certain('study', 'nothing'),
        research: certain('stripe', 'caching'),
      }),
    )
    expect(resolved.move).toEqual({ _tag: 'Study', id: 'stripe' })
    expect(resolved.label).toBe('Study Stripe Billing')
  })
})
