import { Result } from 'effect'
import { Refusal, type Action } from './actions.ts'
import { CALENDAR_DAY, COMPONENTS } from './catalog.ts'
import type { Ledger } from './ledger.ts'
import { stopped, warmOf } from './life.ts'
import { step as bridgeStep } from './bridge-machine.ts'
import { burnOf } from './lookups.ts'
import { solveFlow } from './solve.ts'
import type { Game, GameNode } from './state.ts'

export const BRIDGE_OFFER_AT_BURN_DAYS = 1
export const BRIDGE_GRANT_BURN_DAYS = 3
export const BRIDGE_DILUTION = 0.08
export const SHUTDOWN_AT_BURN_DAYS = 3

export const RUNWAY_MONTH = 30 * CALENDAR_DAY

export const runwayOf = (game: Game, ledger: Ledger): number | null => {
  const net = ledger.burn - ledger.revenue
  return net > 0 ? Math.max(0, game.cash) / net : null
}

const bridgeGrantOf = (burn: number): number => burn * CALENDAR_DAY * BRIDGE_GRANT_BURN_DAYS

export const advanceRunway = (game: Game, ledger: Ledger): Game => {
  if (game.sandbox) return game
  const burn = ledger.burn
  if (burn <= 0) return game
  let next = game
  if (
    next.bridge._tag === 'None' &&
    next.cash <= -burn * CALENDAR_DAY * BRIDGE_OFFER_AT_BURN_DAYS
  ) {
    next = {
      ...next,
      bridge: bridgeStep(next.bridge, {
        _tag: 'Offered',
        grant: bridgeGrantOf(burn),
        dilution: BRIDGE_DILUTION,
      }),
    }
  }
  if (game.bridge._tag === 'Offered' && next.cash <= -burn * CALENDAR_DAY * SHUTDOWN_AT_BURN_DAYS)
    return { ...shutdown(next), bridge: bridgeStep(next.bridge, { _tag: 'Expired' }) }
  return next
}

export const acceptBridge = (game: Game): Action => {
  const bridge = game.bridge
  if (bridge._tag !== 'Offered')
    return Result.fail(Refusal.NotAllowed({ reason: 'No bridge is on the table.' }))
  return Result.succeed({
    ...game,
    cash: game.cash + bridge.grant,
    equity: game.equity * (1 - bridge.dilution),
    bridge: bridgeStep(bridge, { _tag: 'Accepted' }),
  })
}

const dearest = (game: Game): GameNode | null => {
  let worst: GameNode | null = null
  let cost = 0
  for (const node of game.nodes) {
    if (node.service._tag === 'Shut' || COMPONENTS[node.type].fixed) continue
    const burn = burnOf(game, node)
    if (burn > cost) {
      cost = burn
      worst = node
    }
  }
  return worst
}

const shutdownNode = (game: Game, node: GameNode): Game => ({
  ...game,
  nodes: game.nodes.map((entry) =>
    entry.id === node.id
      ? {
          ...entry,
          service: { _tag: 'Shut' },
          life: stopped('failure', warmOf(entry.life)),
          downAt: game.time,
        }
      : entry,
  ),
})

const shutdown = (game: Game): Game => {
  let current = game
  for (;;) {
    const flow = solveFlow(current)
    if (flow.burn - flow.revenue <= 0) break
    const node = dearest(current)
    if (!node) break
    current = shutdownNode(current, node)
  }
  return current
}
