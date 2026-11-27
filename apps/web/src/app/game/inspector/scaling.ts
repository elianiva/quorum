import { css } from '@quorum/styled-system/css'
import type { H } from '@effect/ui/html/Html'
import type { Ledger } from '@quorum/simulation/ledger'
import { autoscalerFor, scaleStateOf } from '@quorum/simulation/scaling'
import type { Game, GameNode } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import { copy, nodeTitle } from '@/i18n/messages.ts'
import { copiesOf, nextOf, readingOf, toneOf } from '@/game/scaling.ts'
import { type Content, callout, caption, nodeLink, row, section } from './shared.ts'

const scaleStateFor = (
  game: Game,
  ledger: Ledger,
  node: GameNode,
): Readonly<{ scaler: GameNode; state: ReturnType<typeof scaleStateOf> }> | null => {
  const scaler = autoscalerFor(game, node)
  return scaler === undefined ? null : { scaler, state: scaleStateOf(game, ledger, node, scaler) }
}

export const scaledNodeSections = (
  game: Game,
  ledger: Ledger,
  node: GameNode,
  h: H<Message>,
): ReadonlyArray<Content> => {
  const found = scaleStateFor(game, ledger, node)
  if (found === null) return []
  const t = copy(h)
  const { scaler, state } = found
  const tone = toneOf(state)
  return [
    section(
      h,
      t.inspectorAutoscaler.scaling,
      [
        h.div
          .class(css({ display: 'flex', alignItems: 'center', gap: '1.5' }))
          .children(caption(h, t.inspectorAutoscaler.scaledBy), nodeLink(game, scaler, h)),
        row(h, t.inspectorAutoscaler.signal, readingOf(t, state), tone),
        row(
          h,
          t.inspectorAutoscaler.copies,
          copiesOf(t, state),
          state.booting > 0 ? 'warn' : 'plain',
        ),
        row(h, t.inspectorAutoscaler.next, nextOf(t, state), tone),
        row(
          h,
          t.inspectorAutoscaler.range,
          t.inspectorAutoscaler.rangeEach(
            state.minCopies,
            state.maxCopies > 0 ? state.maxCopies : '∞',
          ),
          'plain',
        ),
        ...(state.maxCopies > 0 ? [] : [callout(h, t.inspectorAutoscaler.noCeiling, 'warn', null)]),
        ...(state.signal === 'queue' && state.feeds === 0
          ? [callout(h, t.inspectorAutoscaler.noQueue(nodeTitle(t, game, node)), 'warn', null)]
          : []),
      ],
      true,
    ),
  ]
}
