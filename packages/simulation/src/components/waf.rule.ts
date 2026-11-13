import { type Action, endIncident, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { PARANOIA } from '../catalog.ts'

/** Sets a WAF's paranoia level, 1 to 4. */
export const setParanoia = (game: Game, id: string, paranoia: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'waf') return notAllowed('Only a WAF has a paranoia level.')
    if (!PARANOIA.some((entry) => entry.level === paranoia))
      return notAllowed('Paranoia runs from 1 to 4.')
    return ok(node.paranoia === paranoia ? game : patch(game, id, { paranoia }))
  })

/** Turns a WAF's Under attack mode on or off: it challenges every request. */
export const setUnderAttack = (game: Game, id: string, underAttack: boolean): Action =>
  withNode(game, id, (node) =>
    node.type === 'waf'
      ? ok(node.underAttack === underAttack ? game : patch(game, id, { underAttack }))
      : notAllowed('Only a WAF has Under attack mode.'),
  )

export const disableRule = (game: Game): Action =>
  endIncident(game, 'regex', 'No WAF rule is backtracking.')
