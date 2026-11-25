import { type Action, answered, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { activeIncident } from '../state.ts'
import { MAX_ATTEMPTS, QUEUE_LENGTHS } from '../catalog.ts'

export { setDlq } from '../generated/queue.rule.ts'

export const setAttempts = (game: Game, id: string, attempts: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'queue') return notAllowed('Only a Queue retries tasks.')
    if (!(MAX_ATTEMPTS as ReadonlyArray<number>).includes(attempts))
      return notAllowed(`Max attempts are ${MAX_ATTEMPTS.join(', ')}.`)
    return ok(node.attempts === attempts ? game : patch(game, id, { attempts }))
  })

export const setMaxLength = (game: Game, id: string, maxLength: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'queue') return notAllowed('Only a Queue has a max length.')
    if (!(QUEUE_LENGTHS as ReadonlyArray<number>).includes(maxLength))
      return notAllowed('That max length is not on offer.')
    return ok(
      node.maxLength === maxLength
        ? game
        : patch(game, id, {
            maxLength,
            depth: maxLength > 0 ? Math.min(node.depth, maxLength) : node.depth,
          }),
    )
  })

export const deleteMessage = (game: Game): Action =>
  activeIncident(game)?.kind === 'poison'
    ? ok({ ...game, incident: answered(game, { remaining: 0 }) })
    : notAllowed('No poison message is stuck.')
