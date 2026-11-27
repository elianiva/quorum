import { css } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import { SAMPLE_RATES } from '@quorum/simulation/catalog'
import { burnOf } from '@quorum/simulation/lookups'
import { unsampledOf } from '@quorum/simulation/ledger'
import type { Game, GameNode } from '@quorum/simulation/state'
import { money, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, choice, row, section, segmented } from './shared.ts'
import type { H } from '@effect/ui/html/Html'

const sampler = (game: Game, node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorAnalytics.sampleRate, [
    segmented(
      h,
      css({ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }),
      SAMPLE_RATES.map((value) =>
        choice(
          h,
          String(value),
          node.sampleRate === value,
          true,
          Message.SampleChosen({ nodeId: node.id, sampleRate: value }),
          [
            h.span
              .class(
                css({
                  width: '100%',
                  textAlign: 'center',
                }),
              )
              .children(`${Math.round(value * 100)}%`),
          ],
          t.inspectorAnalytics.moreSamplesMoreInsightMoreCPU,
        ),
      ),
    ),
  ])
}

export const analyticsPanel: Panel = {
  stats: ({ game, node, own, ledger, h }) => {
    const t = copy(h)
    const unsampled = unsampledOf(ledger)

    return [
      row(h, t.inspectorAnalytics.sampling, t.inspectorAnalytics.s(rate(own.inbound)), 'plain'),
      row(
        h,
        t.inspectorAnalytics.kept,
        t.inspectorAnalytics.s2(rate(Math.min(own.inbound, own.capacity)), rate(own.capacity)),
        own.inbound > own.capacity ? 'warn' : 'plain',
      ),
      row(
        h,
        t.hud.unclassified,
        `${Math.round(unsampled.share * 100)}%`,
        unsampled.share >= 0.01 ? 'warn' : 'plain',
      ),
      row(h, t.inspectorAnalytics.burn, t.inspectorAnalytics.s(money(burnOf(game, node))), 'plain'),
    ]
  },
  body: ({ game, node, ledger, h }) => {
    const t = copy(h)
    return [
      ...(unsampledOf(ledger).share >= 0.01
        ? [
            h.p
              .class(
                css({
                  paddingInline: '4',
                  paddingBottom: '2',
                  fontSize: 'type.12',
                  lineHeight: 'snug',
                  color: 'warn',
                }),
              )
              .children(t.hud.unsampledHint),
          ]
        : []),
      sampler(game, node, h),
    ]
  },
}
