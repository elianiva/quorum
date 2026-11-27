import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { COMPONENTS, type BuildGroup, type ComponentId } from '@quorum/simulation/catalog'
import { COMPONENT_ICONS } from '@quorum/ui/game/component-icons'
import { css, cx } from '@quorum/styled-system/css'
import { GROUP_SHAPES, type GroupShape } from '@quorum/ui/game/icons'
import { GROUP_TEXT } from '@quorum/ui/game/bits'
import { icon } from './icon.ts'
import type { IconNode } from 'lucide'

const SCALE: Record<GroupShape, number> = {
  hexagon: 0.5,
  chip: 0.48,
  disc: 0.52,
  diamond: 0.42,
}

const CHIP_PINS = [7.5, 12, 16.5].flatMap((at) => [
  [0.5, at - 0.9, 3.5, 1.8],
  [20, at - 0.9, 3.5, 1.8],
  [at - 0.9, 0.5, 1.8, 3.5],
  [at - 0.9, 20, 1.8, 3.5],
])

const shape = <Msg>(kind: GroupShape, h: H<Msg>): ReadonlyArray<View.Content<Msg>> => {
  switch (kind) {
    case 'hexagon':
      return [
        h.polygon
          .attr('points', '12,1.5 21.1,6.75 21.1,17.25 12,22.5 2.9,17.25 2.9,6.75')
          .attr('fill', 'currentColor')
          .attr('stroke', 'currentColor')
          .attr('stroke-width', '2')
          .attr('stroke-linejoin', 'round')
          .children(),
      ]
    case 'diamond':
      return [
        h.polygon
          .attr('points', '12,1.5 22.5,12 12,22.5 1.5,12')
          .attr('fill', 'currentColor')
          .attr('stroke', 'currentColor')
          .attr('stroke-width', '2')
          .attr('stroke-linejoin', 'round')
          .children(),
      ]
    case 'chip':
      return [
        ...CHIP_PINS.map(([x = 0, y = 0, width = 0, height = 0]) =>
          h.rect
            .attr('x', String(x))
            .attr('y', String(y))
            .attr('width', String(width))
            .attr('height', String(height))
            .attr('rx', '0.6')
            .attr('fill', 'currentColor')
            .attr('opacity', '0.75')
            .children(),
        ),
        h.rect
          .attr('x', '3.5')
          .attr('y', '3.5')
          .attr('width', '17')
          .attr('height', '17')
          .attr('rx', '3')
          .attr('fill', 'currentColor')
          .children(),
      ]
    case 'disc':
      return [
        h.circle
          .attr('cx', '12')
          .attr('cy', '12')
          .attr('r', '11')
          .attr('fill', 'currentColor')
          .children(),
      ]
  }
}

export type BadgeContent = IconNode | Readonly<{ path: string }>

export const componentBadge = <Msg>(
  id: ComponentId,
  className: string,
  h: H<Msg>,
): View.Content<Msg> => groupBadge(COMPONENTS[id].group, COMPONENT_ICONS[id], className, h)

export const groupBadge = <Msg>(
  group: BuildGroup,
  content: BadgeContent,
  className: string,
  h: H<Msg>,
  muted = false,
  colour?: string,
): View.Content<Msg> => {
  const kind = GROUP_SHAPES[group]
  const scale = SCALE[kind]
  const offset = 12 - 12 * scale
  const glyph = colour && !muted ? 'white' : 'var(--on-group)'
  return h.svg
    .attr('aria-hidden', 'true')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', '0 0 24 24')
    .class(
      cx(
        css({
          flexShrink: '0',
          overflow: 'visible',
          filter: 'drop-shadow(0 1px 1px oklch(0 0 0 / 0.18))',
        }),
        muted
          ? css({ color: 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)' })
          : colour
            ? undefined
            : GROUP_TEXT[group],
        className,
      ),
    )
    .style(colour && !muted ? { color: colour } : {})
    .children(
      ...shape(kind, h),
      h.g
        .attr('transform', `translate(${offset} ${offset}) scale(${scale})`)
        .children(
          'path' in content
            ? h.g
                .style({ color: glyph })
                .children(h.path.attr('d', content.path).attr('fill', 'currentColor').children())
            : icon(h, content, css({ width: '6', height: '6', color: glyph })),
        ),
    )
}
