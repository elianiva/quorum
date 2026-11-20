import { css } from '@quorum/styled-system/css'
import { row } from '@quorum/ui/game/bits'
import type { Ledger } from '@quorum/simulation/ledger'
import { autoscalerFor, scaleStateOf } from '@quorum/simulation/scaling'
import type { Game, GameNode } from '@quorum/simulation/state'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { Message } from '@/game/message.ts'
import { copy, nodeTitle } from '@/i18n/messages.ts'
import { copiesOf, nextOf, readingOf, toneOf } from '@/game/scaling.ts'
import { callout, caption, nodeLink, section } from './shared.ts'

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
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const found = scaleStateFor(game, ledger, node)
  if (found === null) return []
  const t = copy(h)
  const { scaler, state } = found
  const tone = toneOf(state)
  return [
    section(
      t.inspectorAutoscaler.scaling,
      [
        h.div(
          [h.Class(css({ display: 'flex', alignItems: 'center', gap: '1.5' }))],
          [caption(t.inspectorAutoscaler.scaledBy, h), nodeLink(game, scaler, h)],
        ),
        row(t.inspectorAutoscaler.signal, readingOf(t, state), tone, h),
        row(
          t.inspectorAutoscaler.copies,
          copiesOf(t, state),
          state.booting > 0 ? 'warn' : 'plain',
          h,
        ),
        row(t.inspectorAutoscaler.next, nextOf(t, state), tone, h),
        row(
          t.inspectorAutoscaler.range,
          t.inspectorAutoscaler.rangeEach(
            state.minCopies,
            state.maxCopies > 0 ? state.maxCopies : '∞',
          ),
          'plain',
          h,
        ),
        ...(state.maxCopies > 0 ? [] : [callout(t.inspectorAutoscaler.noCeiling, 'warn', null, h)]),
        ...(state.signal === 'queue' && state.feeds === 0
          ? [callout(t.inspectorAutoscaler.noQueue(nodeTitle(t, game, node)), 'warn', null, h)]
          : []),
      ],
      h,
      true,
    ),
  ]
}
