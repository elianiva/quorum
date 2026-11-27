import { css } from '@quorum/styled-system/css'
import { copy, nodeTitle } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { EYEBROW } from '@quorum/ui/game/bits'
import { SCALE_MAXIMA, SCALE_MINIMA, SCALE_TARGETS } from '@quorum/simulation/catalog'
import { has } from '@quorum/simulation/lookups'
import { autoscalerViewOf } from '@quorum/simulation/scaling'
import type { Ledger } from '@quorum/simulation/ledger'
import type { Game, GameNode } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import {
  type Content,
  type Panel,
  callout,
  caption,
  nodeLink,
  picker,
  row,
  section,
} from './shared.ts'
import { copiesOf, hintOf, nextOf, readingOf, signalLabelOf, viewNextOf } from '@/game/scaling.ts'

const field = (name: string, control: Content, note: string | null, h: H<Message>): Content =>
  h.div
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5',
      }),
    )
    .children(h.span.class(EYEBROW).children(name), control, ...(note ? [caption(h, note)] : []))

const autoscaler = (game: Game, node: GameNode, ledger: Ledger, h: H<Message>): Content => {
  const t = copy(h)
  const view = autoscalerViewOf(game, ledger, node)
  const count = view.members.length
  return section(
    h,
    t.inspectorAutoscaler.scaling,
    [
      field(
        t.inspectorAutoscaler.signal,
        picker(
          h,
          'scale-signal',
          [
            ['cpu', t.inspectorAutoscaler.cpu],
            ['load', t.inspectorAutoscaler.load],
            ['rps', t.inspectorAutoscaler.requests],
            ['queue', t.inspectorAutoscaler.queueDepth],
          ],
          node.signal,
          (signal) => Message.AutoscalerChosen({ nodeId: node.id, signal }),
        ),
        hintOf(t, node.signal),
        h,
      ),
      field(
        t.inspectorAutoscaler.target,
        picker(
          h,
          'scale-target',
          SCALE_TARGETS.map((target) => [target, `${Math.round(target * 100)}%`] as const),
          node.target,
          (target) => Message.AutoscalerChosen({ nodeId: node.id, target }),
        ),
        t.inspectorAutoscaler.targetHint,
        h,
      ),
      field(
        t.inspectorAutoscaler.minCopies,
        picker(
          h,
          'scale-min',
          SCALE_MINIMA.map((copies) => [copies, t.inspectorAutoscaler.min(copies)] as const),
          node.minCopies,
          (minCopies) => Message.AutoscalerChosen({ nodeId: node.id, minCopies }),
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
          h,
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
          h,
          'scale-schedule',
          [
            [false, t.inspectorAutoscaler.onLoad],
            [true, t.inspectorAutoscaler.aheadOfThePeak],
          ],
          node.schedule,
          (schedule) => Message.AutoscalerChosen({ nodeId: node.id, schedule }),
          (schedule) => !schedule || has(game, 'scheduled-scaling'),
        ),
        node.schedule
          ? t.inspectorAutoscaler.twoCalendarHoursBeforeTheDaily
          : t.inspectorAutoscaler.itReactsToTheLoadIt,
        h,
      ),
    ],
    true,
  )
}

const members = (game: Game, node: GameNode, ledger: Ledger, h: H<Message>): Content => {
  const t = copy(h)
  const view = autoscalerViewOf(game, ledger, node)
  return section(
    h,
    t.inspectorAutoscaler.linkedNodes,
    view.members.length === 0
      ? [caption(h, t.inspectorAutoscaler.linkAHint)]
      : view.members.map((member): Content | null => {
          const target = game.nodes.find((entry) => entry.id === member.nodeId)
          if (target === undefined) return null
          return h.div
            .key(`member-${member.nodeId}`)
            .class(css({ display: 'flex', flexDirection: 'column', gap: '1' }))
            .children(
              nodeLink(game, target, h),
              caption(h, readingOf(t, member)),
              caption(h, copiesOf(t, member)),
              h.span
                .class(
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
                )
                .children(view.active ? nextOf(t, member) : t.inspectorAutoscaler.paused),
              ...(member.signal === 'queue' && member.feeds === 0
                ? [
                    callout(
                      h,
                      t.inspectorAutoscaler.noQueue(nodeTitle(t, game, target)),
                      'warn',
                      null,
                      css({ marginInline: '0', marginBottom: '1' }),
                    ),
                  ]
                : []),
            )
        }),
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
        h,
        t.inspectorAutoscaler.copies,
        view.members.length === 0 ? '—' : String(view.copies),
        view.booting > 0 ? 'warn' : 'plain',
      ),
      row(
        h,
        t.inspectorAutoscaler.booting,
        view.booting > 0
          ? `${view.booting} · ${t.inspectorAutoscaler.readyIn(Math.ceil(view.readyIn))}`
          : '—',
        view.booting > 0 ? 'warn' : 'plain',
      ),
      row(
        h,
        t.inspectorAutoscaler.next,
        viewNextOf(t, view),
        view.phase === 'booting' || view.phase === 'up'
          ? 'warn'
          : view.phase === 'paused'
            ? 'danger'
            : 'plain',
      ),
      row(
        h,
        t.inspectorAutoscaler.signal,
        first === undefined
          ? '—'
          : t.inspectorAutoscaler.signalTarget(
              signalLabelOf(t, first.signal),
              `${Math.round(first.target * 100)}%`,
            ),
        'plain',
      ),
    ]
  },
  body: ({ game, node, ledger, h }) => [
    autoscaler(game, node, ledger, h),
    members(game, node, ledger, h),
  ],
}
