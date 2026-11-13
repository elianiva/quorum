import { type Action, Refusal, no, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Fanout, Game } from '../state.ts'
import { RESEARCH } from '../catalog.ts'
import { has } from '../lookups.ts'

/** Turns gzip on or off for an App Server's page and read responses. Needs Compression. */
export const setCompression = (game: Game, id: string, compress: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers compress responses.')
    if (!has(game, 'gzip'))
      return no(Refusal.Locked({ what: 'Gzip', research: RESEARCH.gzip.name }))
    return ok(node.compress === compress ? game : patch(game, id, { compress }))
  })

/** Turns an App Server's load shedding on or off. Needs Priority load shedding. */
export const setShed = (game: Game, id: string, shed: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers shed load.')
    if (shed && !has(game, 'load-shedding'))
      return no(Refusal.Locked({ what: 'Load shedding', research: RESEARCH['load-shedding'].name }))
    return ok(node.shed === shed ? game : patch(game, id, { shed }))
  })

/** Turns Graceful degradation on or off: a saturated App Server drops its dearest kinds first. */
export const setDegrade = (game: Game, id: string, degrade: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers degrade a kind.')
    if (degrade && !has(game, 'graceful-degradation'))
      return no(
        Refusal.Locked({ what: 'Degradation', research: RESEARCH['graceful-degradation'].name }),
      )
    return ok(node.degrade === degrade ? game : patch(game, id, { degrade }))
  })

/** Turns an App Server's read-your-writes routing on or off. */
export const setRyw = (game: Game, id: string, ryw: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers route reads.')
    if (ryw && !has(game, 'ryw-routing'))
      return no(
        Refusal.Locked({ what: 'Read-your-writes', research: RESEARCH['ryw-routing'].name }),
      )
    return ok(node.ryw === ryw ? game : patch(game, id, { ryw }))
  })

/** Pull or push feeds on an App Server (07 "Fan-out"). */
export const setFanout = (game: Game, id: string, fanout: Fanout): Action =>
  withNode(game, id, (node) =>
    node.type !== 'server'
      ? notAllowed('Only App Servers build feeds.')
      : ok(node.fanout === fanout ? game : patch(game, id, { fanout })),
  )
