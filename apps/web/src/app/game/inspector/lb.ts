import { css } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import {
  CHECK_INTERVALS,
  LB_POLICIES,
  LB_VARIANTS,
  type LbVariant,
} from '@quorum/simulation/catalog'
import { has } from '@quorum/simulation/lookups'
import type { Game, GameNode, LbPolicy } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, picker, section } from './shared.ts'

const loadBalancer = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const checked = has(game, 'health-checks')
  const policies = Object.entries(LB_POLICIES) as ReadonlyArray<
    readonly [LbPolicy, (typeof LB_POLICIES)[LbPolicy]]
  >
  return [
    section(h, t.inspectorLb.variant, [
      picker(
        h,
        'lb-variant',
        (Object.keys(LB_VARIANTS) as ReadonlyArray<LbVariant>).map(
          (id) => [id, LB_VARIANTS[id].name] as const,
        ),
        node.variant,
        (variant) => Message.LbVariantChosen({ nodeId: node.id, variant }),
        (id) => LB_VARIANTS[id].research === null || has(game, LB_VARIANTS[id].research),
        css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }),
      ),
      caption(
        h,
        node.variant === 'l4'
          ? t.inspectorLb.forwardsTCPTenTimesTheThroughput
          : t.inspectorLb.readsHTTPRetriesAndChecksHealth,
      ),
    ]),
    section(h, t.inspectorLb.policy, [
      picker(
        h,
        'policy',
        policies.map(([policy]) => [policy, t.catalog.lbPolicies[policy].label] as const),
        node.policy,
        (policy) => Message.PolicyChosen({ nodeId: node.id, policy }),
        (policy) => {
          const research = LB_POLICIES[policy].research
          return research === null || has(game, research)
        },
        css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }),
      ),
    ]),
    section(h, t.inspectorLb.sessions, [
      picker(
        h,
        'sticky',
        [
          [false, t.inspectorLb.balanced],
          [true, t.inspectorLb.sticky],
        ],
        node.sticky,
        (sticky) => Message.StickyChosen({ nodeId: node.id, sticky }),
      ),
      caption(
        h,
        node.sticky ? t.inspectorLb.stickyHolds : t.inspectorLb.everyRequestGoesWhereTheAlgorithm,
      ),
    ]),
    section(h, t.inspectorLb.slowStart, [
      picker(
        h,
        'slow-start',
        [
          [false, t.inspectorLb.off],
          [true, t.inspectorLb.on],
        ],
        node.slowStart,
        (slowStart) => Message.SlowStartChosen({ nodeId: node.id, slowStart }),
      ),
      caption(h, node.slowStart ? t.inspectorLb.slowStartOn : t.inspectorLb.slowStartOff),
    ]),
    section(h, t.inspectorLb.healthChecks, [
      picker(
        h,
        'check-every',
        CHECK_INTERVALS.map((seconds) => [seconds, t.inspectorLb.s(seconds)] as const),
        node.checkEvery,
        (checkEvery) => Message.HealthCheckChosen({ nodeId: node.id, checkEvery }),
        (seconds) => checked || seconds === 10,
      ),
      picker(
        h,
        'deep-check',
        [
          [false, t.inspectorLb.shallow],
          [true, t.inspectorLb.deep],
        ],
        node.deepCheck,
        (deepCheck) => Message.HealthCheckChosen({ nodeId: node.id, deepCheck }),
        (deep) => checked || !deep,
      ),
    ]),
  ]
}

export const lbPanel: Panel = {
  body: ({ game, node, h }) => [...loadBalancer(game, node, h)],
}
