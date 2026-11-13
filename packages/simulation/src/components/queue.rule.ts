import { type Action, answering, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { MAX_ATTEMPTS, QUEUE_LENGTHS } from '../catalog.ts'

/** Turns a Queue's dead-letter queue on or off. */
export const setDlq = (game: Game, id: string, dlq: boolean): Action =>
  withNode(game, id, (node) =>
    node.type === 'queue'
      ? ok(node.dlq === dlq ? game : patch(game, id, { dlq }))
      : notAllowed('Only a Queue has a dead-letter queue.'),
  )

/** Sets the attempts a Queue's dead-letter queue allows a task. */
export const setAttempts = (game: Game, id: string, attempts: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'queue') return notAllowed('Only a Queue retries tasks.')
    if (!(MAX_ATTEMPTS as ReadonlyArray<number>).includes(attempts))
      return notAllowed(`Max attempts are ${MAX_ATTEMPTS.join(', ')}.`)
    return ok(node.attempts === attempts ? game : patch(game, id, { attempts }))
  })

/** Sets the most tasks a Queue holds before it refuses new ones; 0 means no limit. */
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

/** Deletes the poison message: the Workers get back to the queue. */
export const deleteMessage = (game: Game): Action =>
  game.incident?.kind === 'poison'
    ? ok({ ...game, incident: { ...answering(game, game.incident), remaining: 0 } })
    : notAllowed('No poison message is stuck.')
