import { css } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy, nodeTitle } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { burnOf } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import { money, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, percent, row, section } from './shared.ts'

const changes = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const source = game.nodes.find(
    (entry) =>
      entry.type === 'database' &&
      game.links.some((link) => link.from === entry.id && link.to === node.id),
  )
  const stream = game.nodes.find(
    (entry) =>
      entry.type === 'log' &&
      game.links.some((link) => link.from === node.id && link.to === entry.id),
  )
  return [
    section(
      h,
      t.inspectorCdc.changeStream,
      [
        h.p
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(t.inspectorCdc.itReadsEveryWriteOffThe),
        caption(
          h,
          source === undefined || stream === undefined
            ? t.inspectorCdc.linkADatabaseIntoItAnd
            : t.inspectorCdc.readingPublishingTo(
                nodeTitle(t, game, source),
                nodeTitle(t, game, stream),
              ),
        ),
        h.p
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(t.inspectorCdc.itAddsLagAConsumerReads),
        caption(h, t.inspectorCdc.notBuiltTheDualWriteInconsistency),
      ],
      true,
    ),
  ]
}

export const cdcPanel: Panel = {
  stats: ({ game, node, ledger, own, h }) => {
    const t = copy(h)

    const stream = game.nodes.find(
      (entry) =>
        entry.type === 'log' &&
        game.links.some((link) => link.from === node.id && link.to === entry.id),
    )
    const backlog = stream?.depth ?? 0
    const read = stream ? (ledger.nodes[stream.id]?.out.task ?? 0) : 0
    const behind = read > 0 ? backlog / read : 0
    return [
      row(h, t.inspectorCdc.changes, t.inspectorCdc.s(rate(own.inbound)), 'plain'),
      row(
        h,
        t.inspectorCdc.load,
        own.inbound > 0
          ? t.inspectorCdc.ofS(percent(Math.min(own.utilization, 9.99)), rate(own.capacity))
          : t.inspectorCdc.idle,
        own.utilization >= 0.9 ? 'danger' : own.utilization >= 0.7 ? 'warn' : 'plain',
      ),
      row(
        h,
        t.inspectorCdc.lag,
        stream
          ? backlog < 1
            ? t.inspectorCdc.caughtUp
            : t.inspectorCdc.sBehind(Math.round(behind))
          : t.inspectorCdc.noStream,
        stream === undefined ? 'warn' : behind > stream.retain ? 'danger' : 'plain',
      ),
      row(h, t.inspectorCdc.published, t.inspectorCdc.s(rate(own.out.task ?? 0)), 'plain'),
      row(h, t.inspectorCdc.latency, formats(t).ms(own.latency), 'plain'),
      row(h, t.inspectorCdc.burn, t.inspectorCdc.s(money(burnOf(game, node))), 'plain'),
    ]
  },
  body: ({ game, node, h }) => [...changes(game, node, h)],
}
