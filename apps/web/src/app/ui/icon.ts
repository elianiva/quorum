import type { H } from '@effect/ui/html/Html'
import type { IconNode } from 'lucide'

const svgElement = <Msg>(h: H<Msg>, tag: string, attrs: Readonly<Record<string, unknown>>) => {
  const value = (key: string, fallback = '0') => {
    const raw = attrs[key]
    return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : fallback
  }
  switch (tag) {
    case 'circle':
      return h.circle
        .attr('cx', value('cx'))
        .attr('cy', value('cy'))
        .attr('r', value('r'))
        .children()
    case 'ellipse':
      return h.ellipse
        .attr('cx', value('cx'))
        .attr('cy', value('cy'))
        .attr('rx', value('rx'))
        .attr('ry', value('ry'))
        .children()
    case 'rect':
      return h.rect
        .attr('x', value('x'))
        .attr('y', value('y'))
        .attr('width', value('width'))
        .attr('height', value('height'))
        .attr('rx', attrs['rx'] === undefined ? undefined : value('rx'))
        .children()
    case 'line':
      return h.line
        .attr('x1', value('x1'))
        .attr('y1', value('y1'))
        .attr('x2', value('x2'))
        .attr('y2', value('y2'))
        .children()
    case 'polyline':
      return h.polyline.attr('points', value('points', '')).children()
    case 'polygon':
      return h.polygon.attr('points', value('points', '')).children()
    default:
      return h.path.attr('d', value('d', '')).children()
  }
}

export const icon = <Msg>(h: H<Msg>, node: IconNode, className: string) =>
  h.svg
    .class(className)
    .attr('viewBox', '0 0 24 24')
    .attr('fill', 'none')
    .attr('stroke', 'currentColor')
    .attr('stroke-width', '2')
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .attr('aria-hidden', 'true')
    .children(...node.map(([tag, attrs]) => svgElement(h, tag, attrs)))
