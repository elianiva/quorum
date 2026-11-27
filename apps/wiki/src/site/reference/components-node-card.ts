import { Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import type { ComponentId } from '@quorum/simulation/catalog'
import { heightOf } from '@quorum/ui/board/size'
import { Effect, Schema, Stream } from 'effect'
import { css } from '@quorum/styled-system/css'
import { componentBadge } from '../badge.ts'
import type { Lang } from './shared.ts'

const DrawCard = Mount.makeStream(
  'DrawComponentCard',
  { args: { type: Schema.String } },
  (node: HTMLElement, { type }) =>
    Stream.callback<never>(() =>
      Effect.acquireRelease(
        Effect.promise(async () => {
          const { solverReadyForBoard } = await import('../../solver.ts')
          await solverReadyForBoard()
          const { drawNodeCard } = await import('../../components/node-board.ts')
          node.replaceChildren()
          return drawNodeCard(`card-${type}`, type as ComponentId, node)
        }),
        (detach) => Effect.sync(detach),
      ).pipe(Effect.andThen(Effect.never)),
    ),
)

const SCALE = 1.1
const PAD = 8
const INSET = 16

/**
 * The old wiki drew a Node's card on a canvas, through the board renderer and the solver.
 * The site has no canvas renderer, so this keeps the card's box, its height, and its
 * accessible name, and stands the Component's badge and code in for the drawing.
 */
export const nodeCard = <Msg>(l: Lang, id: ComponentId, h: H<Msg>): View.Content<Msg> => {
  const def = l.cat.COMPONENTS[id]
  return h.div
    .key(`card-${id}`)
    .attr('role', 'img')
    .attr('aria-label', l.t.islands.nodeCard(def.name))
    .attr('data-lazy-island', '')
    .class(
      css({
        pointerEvents: 'none',
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        width: '100%',
      }),
    )
    .style({ height: `${Math.round((heightOf(id) + 2 * PAD) * SCALE) + 2 * INSET}px` })
    .onMount(DrawCard({ type: id }))
    .children(
      h.span
        .class(css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' }))
        .children(
          componentBadge(id, css({ width: '12', height: '12' }), h),
          h.span
            .class(
              css({
                fontFamily: 'mono',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 'type.12',
                color: 'mutedForeground',
              }),
            )
            .children(def.code),
        ),
    )
}
