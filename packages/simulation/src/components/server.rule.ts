import { type Action, notAllowed, ok, patch, withNode, locked } from '../action-kit.ts'
import type { Game } from '../state.ts'

export { setFanout } from '../generated/server.rule.ts'

export const setCompression = (game: Game, id: string, compress: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers compress responses.')
    return (
      locked(game, 'server.compress', compress) ??
      ok(node.compress === compress ? game : patch(game, id, { compress }))
    )
  })

export const setShed = (game: Game, id: string, shed: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers shed load.')
    return (
      locked(game, 'server.shed', shed) ?? ok(node.shed === shed ? game : patch(game, id, { shed }))
    )
  })

export const setDegrade = (game: Game, id: string, degrade: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers degrade a kind.')
    return (
      locked(game, 'server.degrade', degrade) ??
      ok(node.degrade === degrade ? game : patch(game, id, { degrade }))
    )
  })

export const setRyw = (game: Game, id: string, ryw: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server') return notAllowed('Only App Servers route reads.')
    return locked(game, 'server.ryw', ryw) ?? ok(node.ryw === ryw ? game : patch(game, id, { ryw }))
  })
