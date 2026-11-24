import { Result } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Actions from '../src/actions.ts'
import { newGame, node, preseedGame } from '../src/company.ts'

const linked = (game: ReturnType<typeof newGame>): boolean =>
  game.links.some((link) => link.from === 'users' && link.to === 'server')

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
