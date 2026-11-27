import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { DEPLOY_STRATEGIES, DEPLOY_STRATEGY_IDS } from '@quorum/simulation/catalog'
import { deploysPerDay } from '@quorum/simulation/team'
import { burnOf } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import { money } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, percent, picker, row, section } from './shared.ts'

const pipeline = (game: Game, node: GameNode, h: H<Message>): Content => {
  const t = copy(h)

  const strategy = DEPLOY_STRATEGIES[node.strategy]
  return section(h, t.inspectorCi.deployStrategy, [
    picker(
      h,
      'deploy-strategy',
      DEPLOY_STRATEGY_IDS.map((id) => [id, t.catalog.deployStrategies[id].name] as const),
      node.strategy,
      (chosen) => Message.DeployStrategyChosen({ nodeId: node.id, strategy: chosen }),
    ),
    caption(
      h,
      t.inspectorCi.deploysInMinABadDeploy(strategy.deployMinutes, percent(strategy.blast)),
    ),
    caption(h, t.inspectorCi.deploysADayAtThisBuild(deploysPerDay(game).toFixed(1))),
  ])
}

export const ciPanel: Panel = {
  stats: ({ game, node, h }) => {
    const t = copy(h)

    const strategy = DEPLOY_STRATEGIES[node.strategy]
    return [
      row(h, t.inspectorCi.deploys, t.inspectorCi.perDay(deploysPerDay(game).toFixed(1)), 'plain'),
      row(h, t.inspectorCi.deployTime, t.inspectorCi.min(strategy.deployMinutes), 'plain'),
      row(
        h,
        t.inspectorCi.blastRadius,
        t.inspectorCi.upTo(percent(strategy.blast)),
        strategy.blast >= 1 ? 'danger' : strategy.blast <= 0.05 ? 'ok' : 'plain',
      ),
      row(h, t.inspectorCi.burn, t.inspectorCi.s(money(burnOf(game, node))), 'plain'),
    ]
  },
  body: ({ game, node, h }) => [pipeline(game, node, h)],
}
