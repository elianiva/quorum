import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { BACKEND_KINDS, KINDS, REQUEST_KINDS, type Kind } from '@quorum/simulation/catalog'

export const PACKET_SHAPES = ['circle', 'square', 'triangle', 'diamond'] as const
export type PacketShape = (typeof PACKET_SHAPES)[number]

const KINDS_IN_ORDER: ReadonlyArray<Kind> = [...REQUEST_KINDS, ...BACKEND_KINDS]

export const PACKET_SHAPE_OF: Readonly<Record<Kind, PacketShape>> = (() => {
  const colours = new Map<number, PacketShape>()
  const shapes: Record<string, PacketShape> = {}
  for (const kind of KINDS_IN_ORDER) {
    const colour = KINDS[kind].color
    const known = colours.get(colour)
    const shape = known ?? PACKET_SHAPES[colours.size % PACKET_SHAPES.length]!
    if (known === undefined) colours.set(colour, shape)
    shapes[kind] = shape
  }
  return shapes as Record<Kind, PacketShape>
})()

export const packetShapeOf = (kind: Kind): PacketShape => PACKET_SHAPE_OF[kind]

export const packetColor = (kind: Kind): string =>
  `#${KINDS[kind].color.toString(16).padStart(6, '0')}`

export const packetMark = <M>(kind: Kind, size: number, h: HtmlBuilder<M>): Html => {
  const shape = packetShapeOf(kind)
  return h.span(
    [
      h.Class(
        cx(
          css({
            display: 'inline-block',
            flexShrink: '0',
          }),
          shape === 'circle'
            ? css({
                borderRadius: 'full',
              })
            : '',
          shape === 'square'
            ? css({
                borderRadius: '2xs',
              })
            : '',
          shape === 'triangle'
            ? css({
                clipPath: 'polygon(50% 0,100% 100%,0 100%)',
              })
            : '',
          shape === 'diamond'
            ? css({
                rotate: '45deg',
                borderRadius: '2xs',
              })
            : '',
        ),
      ),
      h.Style({
        background: packetColor(kind),
        width: `${String(size)}px`,
        height: `${String(size)}px`,
      }),
      h.AriaHidden(true),
    ],
    [],
  )
}
