import { css } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { EDGE_CPU_MS, EDGE_MEMORY_MB, EDGE_MS, EDGE_READ_HIT } from '@quorum/simulation/catalog'
import { edgeRuns } from '@quorum/simulation/rules'
import { burnOf, edgeBurnOf } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import { money, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, row, section } from './shared.ts'

const edge = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)
  return [
    section(
      h,
      t.inspectorEdge.ceilings,
      [
        h.p
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(t.inspectorEdge.aHandlerRunsIn(EDGE_MEMORY_MB, t.units.ms(EDGE_CPU_MS))),
        caption(
          h,
          edgeRuns(node)
            ? t.inspectorEdge.thisStackCompilesToTheEdge
            : t.inspectorEdge.cannotRunAtTheEdge(t.catalog.runtimes[node.runtime].name),
        ),
      ],
      true,
    ),
    section(h, t.inspectorEdge.edgeCache, [
      h.p
        .class(
          css({
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(
          t.inspectorEdge.aUserInItsRegion(t.units.ms(EDGE_MS), Math.round(EDGE_READ_HIT * 100)),
        ),
    ]),
  ]
}

export const edgePanel: Panel = {
  stats: ({ game, node, own, h }) => {
    const t = copy(h)

    const refused = !edgeRuns(node)
    return [
      row(h, t.inspectorEdge.inbound, t.inspectorEdge.s(rate(own.inbound)), 'plain'),
      row(h, t.inspectorEdge.latency, formats(t).ms(own.latency), 'plain'),
      row(h, t.inspectorEdge.cPUCeiling, t.units.ms(EDGE_CPU_MS), 'plain'),
      row(
        h,
        t.inspectorEdge.stack,
        refused
          ? t.inspectorEdge.cannotRunHere(t.catalog.runtimes[node.runtime].name)
          : t.catalog.runtimes[node.runtime].name,
        refused ? 'danger' : 'plain',
      ),
      row(
        h,
        t.inspectorEdge.uses,
        t.inspectorEdge.s(money(edgeBurnOf(game, node, own.inbound - own.dropped))),
        'plain',
      ),
      row(h, t.inspectorEdge.standingBurn, t.inspectorEdge.s(money(burnOf(game, node))), 'ok'),
    ]
  },
  body: ({ game, node, h }) => [...edge(game, node, h)],
}
