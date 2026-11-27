import { css } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { DOC_JOIN_COST, DOC_SHAPE_DH } from '@quorum/simulation/catalog'
import { burnOf } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import { money, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, percent, picker, row, section } from './shared.ts'

const documents = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)
  return [
    section(
      h,
      t.inspectorDoc.transactions,
      [
        picker(
          h,
          'transactions',
          [
            [false, t.inspectorDoc.oneDocument],
            [true, t.inspectorDoc.multiDocument],
          ],
          node.transactions,
          (transactions) => Message.DocOptionsChosen({ nodeId: node.id, transactions }),
        ),
        h.p
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(t.inspectorDoc.aCheckoutWritesSeveralDocumentsWithout),
      ],
      true,
    ),
    section(h, t.inspectorDoc.accessPatterns, [
      h.p
        .class(
          css({
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(
          t.inspectorDoc.thereAreNoJoinsAQuery(DOC_JOIN_COST, Math.round((1 - DOC_SHAPE_DH) * 100)),
        ),
      caption(h, t.inspectorDoc.theTeamPanelChargesTheDev),
    ]),
  ]
}

export const docPanel: Panel = {
  stats: ({ game, node, own, h }) => {
    const t = copy(h)

    const ops = (own.traffic['q-tx'] ?? 0) + (own.traffic['q-scan'] ?? 0)
    return [
      row(h, t.inspectorDoc.inbound, t.inspectorDoc.s(rate(own.inbound)), 'plain'),
      row(
        h,
        t.inspectorDoc.load,
        own.inbound > 0
          ? t.inspectorDoc.ofOpsPerSecond(
              percent(Math.min(own.utilization, 9.99)),
              rate(own.capacity),
            )
          : t.inspectorDoc.idle,
        own.utilization >= 0.9 ? 'danger' : own.utilization >= 0.7 ? 'warn' : 'plain',
      ),
      row(h, t.inspectorDoc.joins, t.inspectorDoc.s(rate(ops)), ops > 0 ? 'warn' : 'plain'),
      row(
        h,
        t.inspectorDoc.transactions,
        node.transactions ? t.inspectorDoc.multiDocumentValue : t.inspectorDoc.oneDocumentValue,
        node.transactions ? 'plain' : 'warn',
      ),
      row(h, t.inspectorDoc.connections, t.inspectorDoc.noneToPool, 'ok'),
      row(h, t.inspectorDoc.latency, formats(t).ms(own.latency), 'plain'),
      row(h, t.inspectorDoc.burn, t.inspectorDoc.s(money(burnOf(game, node))), 'plain'),
    ]
  },
  body: ({ game, node, h }) => [...documents(game, node, h)],
}
