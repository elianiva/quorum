import { type Action, Refusal, no, notAllowed, ok, patch, withNode } from '../action-kit.ts'
import type { Game, LbPolicy } from '../state.ts'
import {
  CHECK_INTERVALS,
  COMPONENTS,
  DATA_KINDS,
  LB_POLICIES,
  LB_VARIANTS,
  RESEARCH,
  type LbVariant,
} from '../catalog.ts'

import { has } from '../lookups.ts'

export const setLbVariant = (game: Game, id: string, variant: LbVariant): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'lb') return notAllowed('Only a Load Balancer has a variant.')
    const research = LB_VARIANTS[variant].research
    if (research !== null && !has(game, research))
      return no(
        Refusal.Locked({ what: LB_VARIANTS[variant].name, research: RESEARCH[research].name }),
      )
    const linksDataKinds = game.links.some((link) => {
      const other = game.nodes.find(
        (entry) => entry.id === (link.from === id ? link.to : link.from),
      )
      return (
        (link.from === id || link.to === id) &&
        other !== undefined &&
        DATA_KINDS.some((kind) => COMPONENTS[other.type].accepts.includes(kind))
      )
    })
    if (variant === 'l7' && linksDataKinds)
      return notAllowed('Cut its links to the Database and Read Replicas first: an L7 reads HTTP.')
    return ok(node.variant === variant ? game : patch(game, id, { variant }))
  })

export const setPolicy = (game: Game, id: string, policy: LbPolicy): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'lb') return notAllowed('Only a Load Balancer has a policy.')
    const research = LB_POLICIES[policy].research
    if (research && !has(game, research))
      return no(
        Refusal.Locked({ what: LB_POLICIES[policy].label, research: RESEARCH[research].name }),
      )
    return ok(patch(game, id, { policy }))
  })

export const setSticky = (game: Game, id: string, sticky: boolean): Action =>
  withNode(game, id, (node) =>
    node.type === 'lb'
      ? ok(node.sticky === sticky ? game : patch(game, id, { sticky }))
      : notAllowed('Only a Load Balancer keeps users on a target.'),
  )

export const setSlowStart = (game: Game, id: string, slowStart: boolean): Action =>
  withNode(game, id, (node) =>
    node.type === 'lb'
      ? ok(node.slowStart === slowStart ? game : patch(game, id, { slowStart }))
      : notAllowed('Only a Load Balancer ramps a new copy up.'),
  )

export const setHealthCheck = (
  game: Game,
  id: string,
  change: Readonly<{ checkEvery?: number; deepCheck?: boolean }>,
): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'lb') return notAllowed('Only a Load Balancer runs health checks.')
    if (
      change.checkEvery !== undefined &&
      !(CHECK_INTERVALS as ReadonlyArray<number>).includes(change.checkEvery)
    )
      return notAllowed('A health check runs every 2, 10, or 30 seconds.')
    const tuned = (change.checkEvery ?? 10) !== 10 || change.deepCheck === true
    if (tuned && !has(game, 'health-checks'))
      return no(Refusal.Locked({ what: 'Health checks', research: RESEARCH['health-checks'].name }))
    return ok(patch(game, id, change))
  })
