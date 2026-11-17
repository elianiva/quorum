import { type Action, Refusal, no, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game } from '../state.ts'
import { GATEWAY_BURST, GATEWAY_LIMITS, RESEARCH } from '../catalog.ts'

import { has } from '../lookups.ts'

export const setRateLimit = (game: Game, id: string, rateLimit: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'gw') return notAllowed('Only an API Gateway rate-limits.')
    if (!(GATEWAY_LIMITS as ReadonlyArray<number>).includes(rateLimit))
      return notAllowed(`Rate limits are ${GATEWAY_LIMITS.join(', ')} requests per second.`)
    return ok(
      node.rateLimit === rateLimit
        ? game
        : {
            ...game,
            nodes: game.nodes.map((entry) =>
              entry.type === 'gw' ? { ...entry, rateLimit } : entry,
            ),
          },
    )
  })

export const setGatewayBucket = (game: Game, id: string, bucket: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'gw') return notAllowed('Only an API Gateway holds a token bucket.')
    if (bucket && !has(game, 'rate-limiting'))
      return no(
        Refusal.Locked({ what: 'A token bucket', research: RESEARCH['rate-limiting'].name }),
      )
    const burst = bucket ? GATEWAY_BURST : 0
    return ok(
      node.burst === burst
        ? game
        : {
            ...game,
            nodes: game.nodes.map((entry) => (entry.type === 'gw' ? { ...entry, burst } : entry)),
          },
    )
  })

export const setGatewayOptions = (
  game: Game,
  id: string,
  change: Readonly<{ authEdge?: boolean; merge?: boolean }>,
): Action =>
  withNode(game, id, (node) =>
    node.type === 'gw' ? ok(patch(game, id, change)) : notAllowed('Only an API Gateway has these.'),
  )
