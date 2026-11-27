import { css } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { VEC_AI_LIFT, VEC_INDEXES, VEC_QUERIES } from '@quorum/simulation/catalog'
import { burnOf } from '@quorum/simulation/lookups'
import type { Game, GameNode, VecIndexType } from '@quorum/simulation/state'
import { money, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import {
  type Content,
  type Panel,
  caption,
  outbound,
  percent,
  picker,
  row,
  section,
} from './shared.ts'

const vector = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const index = VEC_INDEXES[node.indexType]
  const prompts = game.nodes.filter(
    (entry) => entry.type === 'server' || entry.type === 'worker' || entry.type === 'fn',
  )
  const reached = prompts.filter((entry) =>
    outbound(game, entry).some(([, to]) => to.id === node.id),
  )
  return [
    section(
      h,
      t.inspectorVec.index,
      [
        picker(
          h,
          'index-type',
          (
            Object.entries(VEC_INDEXES) as ReadonlyArray<
              [VecIndexType, (typeof VEC_INDEXES)['exact']]
            >
          ).map(([id]) => [id, t.catalog.vecIndexes[id].name] as const),
          node.indexType,
          (indexType) => Message.VecIndexChosen({ nodeId: node.id, indexType }),
        ),
        h.p
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(
            t.inspectorVec.exactComparesTheQueryToEvery(
              VEC_QUERIES,
              index.queries,
              percent(index.recall),
            ),
          ),
        caption(h, t.inspectorVec.recallBurnS(percent(index.recall), money(burnOf(game, node)))),
      ],
      true,
    ),
    section(h, t.inspectorVec.retrieval, [
      h.p
        .class(
          css({
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(t.inspectorVec.linkANodeThatAnswersPrompts(Math.round((VEC_AI_LIFT - 1) * 100))),
      caption(
        h,
        reached.length === 0
          ? t.inspectorVec.nothingAnswersPromptsThroughItYet
          : t.inspectorVec.nodesRetrieveFromIt(reached.length),
      ),
    ]),
  ]
}

export const vecPanel: Panel = {
  stats: ({ game, node, own, h }) => {
    const t = copy(h)

    const index = VEC_INDEXES[node.indexType]
    return [
      row(h, t.inspectorVec.lookups, t.inspectorVec.s(rate(own.inbound)), 'plain'),
      row(
        h,
        t.inspectorVec.load,
        own.inbound > 0
          ? t.inspectorVec.ofS(percent(Math.min(own.utilization, 9.99)), rate(own.capacity))
          : t.inspectorVec.idle,
        own.utilization >= 0.9 ? 'danger' : own.utilization >= 0.7 ? 'warn' : 'plain',
      ),
      row(h, t.inspectorVec.index, t.catalog.vecIndexes[node.indexType].name, 'plain'),
      row(h, t.inspectorVec.recall, percent(index.recall), index.recall >= 1 ? 'ok' : 'warn'),
      row(h, t.inspectorVec.latency, formats(t).ms(own.latency), 'plain'),
      row(h, t.inspectorVec.burn, t.inspectorVec.s(money(burnOf(game, node))), 'plain'),
    ]
  },
  body: ({ game, node, h }) => [...vector(game, node, h)],
}
