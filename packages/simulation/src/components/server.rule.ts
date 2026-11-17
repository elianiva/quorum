import { type Action, Refusal, no, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Fanout, Game } from '../state.ts'
import { RESEARCH } from '../catalog.ts'
import { has } from '../lookups.ts'

export const setCompression = (game: Game, id: string, compress: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers compress responses.')
    if (!has(game, 'gzip'))
      return no(Refusal.Locked({ what: 'Gzip', research: RESEARCH.gzip.name }))
    return ok(node.compress === compress ? game : patch(game, id, { compress }))
  })

export const setShed = (game: Game, id: string, shed: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers shed load.')
    if (shed && !has(game, 'load-shedding'))
      return no(Refusal.Locked({ what: 'Load shedding', research: RESEARCH['load-shedding'].name }))
    return ok(node.shed === shed ? game : patch(game, id, { shed }))
  })

export const setDegrade = (game: Game, id: string, degrade: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers degrade a kind.')
    if (degrade && !has(game, 'graceful-degradation'))
      return no(
        Refusal.Locked({ what: 'Degradation', research: RESEARCH['graceful-degradation'].name }),
      )
    return ok(node.degrade === degrade ? game : patch(game, id, { degrade }))
  })

export const setRyw = (game: Game, id: string, ryw: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers route reads.')
    if (ryw && !has(game, 'ryw-routing'))
      return no(
        Refusal.Locked({ what: 'Read-your-writes', research: RESEARCH['ryw-routing'].name }),
      )
    return ok(node.ryw === ryw ? game : patch(game, id, { ryw }))
  })

export const setFanout = (game: Game, id: string, fanout: Fanout): Action =>
  withNode(game, id, (node) =>
    node.type !== 'server'
      ? notAllowed('Only App Servers build feeds.')
      : ok(node.fanout === fanout ? game : patch(game, id, { fanout })),
  )
