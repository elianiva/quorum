import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css } from '@quorum/styled-system/css'
import type { IconNode } from 'lucide'

const DEFAULT = css({ width: '4', height: '4', flexShrink: '0' })

type SvgChild = IconNode[number]

const child = <Msg>(h: H<Msg>, [tag, attributes]: SvgChild): View.Content<Msg> => {
  const attrs = Object.fromEntries(
    Object.entries(attributes).map(([name, value]) => [name, String(value)]),
  )
  switch (tag) {
    case 'circle':
      return h.circle.attrs(attrs as never).children()
    case 'ellipse':
      return h.ellipse.attrs(attrs as never).children()
    case 'g':
      return h.g.attrs(attrs as never).children()
    case 'line':
      return h.line.attrs(attrs as never).children()
    case 'polygon':
      return h.polygon.attrs(attrs as never).children()
    case 'polyline':
      return h.polyline.attrs(attrs as never).children()
    case 'rect':
      return h.rect.attrs(attrs as never).children()
    case 'text':
      return h.svgText.attrs(attrs as never).children()
    default:
      return h.path.attrs(attrs as never).children()
  }
}

export const icon = <Msg>(
  h: H<Msg>,
  node: IconNode,
  className: string = DEFAULT,
): View.Content<Msg> =>
  h.svg
    .class(className)
    .attr('aria-hidden', 'true')
    .attr('data-svg-icon', '')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('fill', 'none')
    .attr('viewBox', '0 0 24 24')
    .attr('stroke-width', '2')
    .attr('stroke', 'currentColor')
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .children(...node.map((entry) => child(h, entry)))
