import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { COMPONENTS, type InsightPool, type ResearchDef } from '@quorum/simulation/catalog'
import { css, cx } from '@quorum/styled-system/css'
import { FIGURE } from '@quorum/ui/game/bits'
import { COMPONENT_ICONS } from '@quorum/ui/game/component-icons'
import { STACK_LOGOS } from '@quorum/ui/game/icons'
import { POOL_ICONS, poolColor } from '@quorum/ui/game/pool-visuals'
import { LOOKS, colorOf } from '@quorum/ui/game/research-marks'
import { groupBadge } from '../badge.ts'
import { icon } from '../icon.ts'

/**
 * The research mark, drawn
 * here on the ported group badge.
 */
export const researchMark = <Msg>(
  entry: ResearchDef,
  size: 'sm' | 'lg',
  muted: boolean,
  h: H<Msg>,
): View.Content<Msg> => {
  const look = LOOKS[entry.id]
  const badge =
    'component' in look
      ? groupBadge(
          COMPONENTS[look.component].group,
          COMPONENT_ICONS[look.component],
          size === 'lg' ? css({ width: '11', height: '11' }) : css({ width: '7', height: '7' }),
          h,
          muted,
        )
      : groupBadge(
          look.group,
          'glyph' in look
            ? look.glyph
            : { path: 'logo' in look ? STACK_LOGOS[look.logo].path : look.brand.path },
          size === 'lg' ? css({ width: '11', height: '11' }) : css({ width: '7', height: '7' }),
          h,
          muted,
          colorOf(look),
        )
  return h.span
    .class(
      cx(
        css({ display: 'grid', flexShrink: '0', placeItems: 'center' }),
        size === 'lg' ? css({ width: '12', height: '12' }) : css({ width: '8', height: '8' }),
      ),
    )
    .children(badge)
}

/** One pool's cost: its icon in the pool's colour, then the figure. */
export const insightChip = <Msg>(
  pool: InsightPool,
  figure: string,
  name: string,
  h: H<Msg>,
): View.Content<Msg> =>
  h.span
    .attr('title', `${name} ${figure}`)
    .attr('aria-label', `${name} ${figure}`)
    .class(
      cx(
        FIGURE,
        css({ display: 'inline-flex', alignItems: 'center', gap: '0.75', whiteSpace: 'nowrap' }),
      ),
    )
    .children(
      h.span
        .class(css({ display: 'inline-flex' }))
        .style({ color: poolColor(pool) })
        .children(icon(h, POOL_ICONS[pool], css({ width: '3', height: '3', flexShrink: '0' }))),
      h.span.attr('aria-hidden', 'true').children(figure),
    )
