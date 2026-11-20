import { css } from '@quorum/styled-system/css'
import { copy, nodeTitle } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { EYEBROW, row } from '@quorum/ui/game/bits'
import { SCALE_MAXIMA, SCALE_MINIMA, SCALE_TARGETS } from '@quorum/simulation/catalog'
import { has } from '@quorum/simulation/lookups'
import { autoscalerViewOf } from '@quorum/simulation/scaling'
import type { Ledger } from '@quorum/simulation/ledger'
import type { Game, GameNode } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import { type Panel, callout, caption, nodeLink, picker, section } from './shared.ts'
import { copiesOf, hintOf, nextOf, readingOf, signalLabelOf, viewNextOf } from '@/game/scaling.ts'

const field = (name: string, control: Html, note: string | null, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5',
        }),
      ),
    ],
    [h.span([h.Class(EYEBROW)], [name]), control, ...(note ? [caption(note, h)] : [])],
  )

const autoscaler = (game: Game, node: GameNode, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const view = autoscalerViewOf(game, ledger, node)
  const count = view.members.length
  return section(
    t.inspectorAutoscaler.scaling,
    [
      field(
        t.inspectorAutoscaler.signal,
        picker(
          'scale-signal',
          [
            ['cpu', t.inspectorAutoscaler.cpu],
            ['load', t.inspectorAutoscaler.load],
            ['rps', t.inspectorAutoscaler.requests],
            ['queue', t.inspectorAutoscaler.queueDepth],
          ],
          node.signal,
          (signal) => Message.AutoscalerChosen({ nodeId: node.id, signal }),
          h,
        ),
        hintOf(t, node.signal),
        h,
      ),
      field(
        t.inspectorAutoscaler.target,
        picker(
          'scale-target',
          SCALE_TARGETS.map((target) => [target, `${Math.round(target * 100)}%`] as const),
          node.target,
          (target) => Message.AutoscalerChosen({ nodeId: node.id, target }),
          h,
        ),
        t.inspectorAutoscaler.targetHint,
        h,
      ),
      field(
        t.inspectorAutoscaler.minCopies,
        picker(
          'scale-min',
          SCALE_MINIMA.map((copies) => [copies, t.inspectorAutoscaler.min(copies)] as const),
          node.minCopies,
          (minCopies) => Message.AutoscalerChosen({ nodeId: node.id, minCopies }),
          h,
          (copies) => node.maxCopies === 0 || copies <= node.maxCopies,
        ),
        count === 0
          ? null
          : t.inspectorAutoscaler.perNodeMin(node.minCopies, count, node.minCopies * count),
        h,
      ),
      field(
        t.inspectorAutoscaler.maxCopies,
        picker(
          'scale-max',
          SCALE_MAXIMA.map(
            (copies) =>
              [
                copies,
                copies === 0 ? t.inspectorAutoscaler.noMax : t.inspectorAutoscaler.max(copies),
              ] as const,
          ),
          node.maxCopies,
          (maxCopies) => Message.AutoscalerChosen({ nodeId: node.id, maxCopies }),
          h,
          (copies) => copies === 0 || copies >= node.minCopies,
        ),
        node.maxCopies === 0
          ? t.inspectorAutoscaler.noCeilingWarning
          : count === 0
            ? null
            : t.inspectorAutoscaler.perNodeMax(node.maxCopies, count, node.maxCopies * count),
        h,
      ),
      field(
        t.inspectorAutoscaler.schedule,
        picker(
          'scale-schedule',
          [
            [false, t.inspectorAutoscaler.onLoad],
            [true, t.inspectorAutoscaler.aheadOfThePeak],
          ],
          node.schedule,
          (schedule) => Message.AutoscalerChosen({ nodeId: node.id, schedule }),
          h,
          (schedule) => !schedule || has(game, 'scheduled-scaling'),
        ),
        node.schedule
          ? t.inspectorAutoscaler.twoCalendarHoursBeforeTheDaily
          : t.inspectorAutoscaler.itReactsToTheLoadIt,
        h,
      ),
    ],
    h,
    true,
  )
}

const members = (game: Game, node: GameNode, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const view = autoscalerViewOf(game, ledger, node)
  return section(
    t.inspectorAutoscaler.linkedNodes,
    view.members.length === 0
      ? [caption(t.inspectorAutoscaler.linkAHint, h)]
      : view.members.map((member) => {
          const target = game.nodes.find((entry) => entry.id === member.nodeId)
          if (target === undefined) return h.empty
          return h.div(
            [
              h.Key(`member-${member.nodeId}`),
              h.Class(css({ display: 'flex', flexDirection: 'column', gap: '1' })),
            ],
            [
              nodeLink(game, target, h),
              caption(readingOf(t, member), h),
              caption(copiesOf(t, member), h),
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'type.11-5',
                      fontWeight: 'medium',
                      color:
                        member.phase === 'paused'
                          ? 'danger'
                          : member.phase === 'booting' ||
                              member.phase === 'up' ||
                              member.atLimit === 'max'
                            ? 'warn'
                            : 'foreground',
                    }),
                  ),
                ],
                [view.active ? nextOf(t, member) : t.inspectorAutoscaler.paused],
              ),
              ...(member.signal === 'queue' && member.feeds === 0
                ? [
                    callout(
                      t.inspectorAutoscaler.noQueue(nodeTitle(t, game, target)),
                      'warn',
                      null,
                      h,
                      css({ marginInline: '0', marginBottom: '1' }),
                    ),
                  ]
                : []),
            ],
          )
        }),
    h,
    true,
  )
}

export const autoscalerPanel: Panel = {
  stats: ({ game, node, ledger, h }) => {
    const t = copy(h)
    const view = autoscalerViewOf(game, ledger, node)
    const first = view.members[0]
    return [
      row(
        t.inspectorAutoscaler.copies,
        view.members.length === 0 ? '—' : String(view.copies),
        view.booting > 0 ? 'warn' : 'plain',
        h,
      ),
      row(
        t.inspectorAutoscaler.booting,
        view.booting > 0
          ? `${view.booting} · ${t.inspectorAutoscaler.readyIn(Math.ceil(view.readyIn))}`
          : '—',
        view.booting > 0 ? 'warn' : 'plain',
        h,
      ),
      row(
        t.inspectorAutoscaler.next,
        viewNextOf(t, view),
        view.phase === 'booting' || view.phase === 'up'
          ? 'warn'
          : view.phase === 'paused'
            ? 'danger'
            : 'plain',
        h,
      ),
      row(
        t.inspectorAutoscaler.signal,
        first === undefined
          ? '—'
          : t.inspectorAutoscaler.signalTarget(
              signalLabelOf(t, first.signal),
              `${Math.round(first.target * 100)}%`,
            ),
        'plain',
        h,
      ),
    ]
  },
  body: ({ game, node, ledger, h }) => [
    autoscaler(game, node, ledger, h),
    members(game, node, ledger, h),
  ],
}
