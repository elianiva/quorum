import { css } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import {
  AUTH_CHECK_MS,
  GATEWAY_AUTH_MS,
  GATEWAY_LIMITS,
  REQUEST_KINDS,
  type RequestKind,
} from '@quorum/simulation/catalog'
import { has } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import { compact } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import {
  type Content,
  type Panel,
  caption,
  choice,
  nodeLink,
  outbound,
  picker,
  section,
  segmented,
} from './shared.ts'

const routeTable = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> =>
  outbound(game, node).map(([link, target]) => {
    const t = copy(h)
    const carried = link.kinds ?? REQUEST_KINDS
    const toggled = (kind: RequestKind) => {
      const next = carried.includes(kind)
        ? carried.filter((entry) => entry !== kind)
        : REQUEST_KINDS.filter((entry) => entry === kind || carried.includes(entry))
      return next.length === REQUEST_KINDS.length ? null : next
    }
    return h.div
      .key(link.to)
      .class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5',
        }),
      )
      .children(
        nodeLink(game, target, h),
        segmented(
          h,
          css({ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }),
          REQUEST_KINDS.map((kind) => {
            const next = toggled(kind)
            return choice(
              h,
              `${link.to}-${kind}`,
              carried.includes(kind),
              next === null || next.length > 0,
              Message.LinkKindsChosen({ from: node.id, to: link.to, kinds: next }),
              [
                h.span
                  .class(
                    css({
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }),
                  )
                  .children(t.inspectorShared.kindShort[kind]),
              ],
              t.catalog.kinds[kind].label,
            )
          }),
        ),
      )
  })

const gateway = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)
  return [
    section(h, t.inspectorGw.routes, routeTable(game, node, h)),
    section(h, t.inspectorGw.rateLimit, [
      picker(
        h,
        'rate-limit',
        GATEWAY_LIMITS.map(
          (limit) =>
            [limit, limit === 0 ? t.inspectorGw.off : t.inspectorGw.s(compact(limit))] as const,
        ),
        node.rateLimit,
        (rateLimit) => Message.RateLimitChosen({ nodeId: node.id, rateLimit }),
      ),
      caption(
        h,
        node.rateLimit > 0
          ? t.inspectorGw.pastRequestsASecondTheyFail(compact(node.rateLimit))
          : t.inspectorGw.noLimitEveryRequestGoesOn,
      ),
      picker(
        h,
        'gateway-bucket',
        [
          [false, t.inspectorGw.flatCap],
          [true, t.inspectorGw.tokenBucket],
        ],
        node.burst > 0,
        (bucket) => Message.GatewayBucketChosen({ nodeId: node.id, bucket }),
        (bucket) => !bucket || has(game, 'rate-limiting'),
      ),
      caption(
        h,
        node.burst > 0
          ? t.inspectorGw.aBurstOfUpToRequests(compact(node.burst))
          : t.inspectorGw.everyStepOverTheLimitIs,
      ),
      picker(
        h,
        'gateway-auth',
        [
          [false, t.inspectorGw.servicesCheck],
          [true, t.inspectorGw.authAtTheEdge],
        ],
        node.authEdge,
        (authEdge) => Message.GatewayOptionsChosen({ nodeId: node.id, authEdge }),
      ),
      caption(
        h,
        node.authEdge
          ? t.inspectorGw.theGatewayValidatesEachToken(
              t.units.ms(GATEWAY_AUTH_MS),
              `${AUTH_CHECK_MS * 1_000} µs`,
            )
          : t.inspectorGw.everyServiceValidatesTheToken(`${AUTH_CHECK_MS * 1_000} µs`),
      ),
      picker(
        h,
        'gateway-merge',
        [
          [false, t.inspectorGw.everyReadGoesOn],
          [true, t.inspectorGw.requestCoalescing],
        ],
        node.merge,
        (merge) => Message.GatewayOptionsChosen({ nodeId: node.id, merge }),
      ),
      caption(h, t.inspectorGw.identicalReadsInFlightAtOnce),
    ]),
  ]
}

export const gwPanel: Panel = {
  body: ({ game, node, h }) => [...gateway(game, node, h)],
}
