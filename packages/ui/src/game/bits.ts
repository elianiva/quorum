import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'
import type { IconNode } from 'lucide'
import type { BuildGroup, InsightPool } from '@quorum/simulation/catalog'
import { icon } from '../primitives/icon.ts'
import { GROUP_SHAPES, type GroupShape, STACK_LOGOS, type StackLogoId } from './icons.ts'
import { POOL_ICONS, poolColor, poolName } from './pools.ts'

export const EYEBROW = css({
  fontFamily: 'mono',
  fontSize: 'type.10-5',
  fontWeight: 'medium',
  textTransform: 'uppercase',
  letterSpacing: 'eyebrow',
  color: 'mutedForeground',
})
export const SCROLL = css({ overflow: 'auto', scrollbarWidth: 'thin' })
export const PANEL = css({ borderRadius: '2xl', layerStyle: 'surface', boxShadow: 'card' })
export const FLOAT = css({ borderRadius: '2xl', layerStyle: 'surface', boxShadow: 'float' })
/** A group inside a panel, one step lighter, with hairline dividers. */
export const NESTED = css({
  borderRadius: 'xl',
  backgroundColor: 'nested',
  boxShadow: 'line',
  '& > :not(:last-child):not([data-slot="button"])': {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderColor: 'hairline',
  },
})
/** A sunken strip: tracks, segmented controls, figure rows. */
export const WELL = css({ borderRadius: 'xl', backgroundColor: 'well', boxShadow: 'well' })
/** A phone shows the figures as one row of chips that scrolls sideways. */
export const CHIPS = css({
  _compact: {
    flexDirection: 'row',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    '& > :not(:last-child)': {
      borderTopWidth: '0px',
      borderTopStyle: 'solid',
      borderRightWidth: '1px',
      borderRightStyle: 'solid',
      borderBottomWidth: '0px',
      borderBottomStyle: 'solid',
      borderLeftWidth: '0px',
      borderLeftStyle: 'solid',
    },
  },
})

export const FIGURE = css({
  fontFamily: 'mono',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 'subtle',
})

/** A square icon control inside a panel: flat at rest, a raised ink fill when on.
 *  On a dark board a white fill outshines the board, so on is a raised grey there. */
export const tool = (active: boolean): string =>
  active
    ? cx(
        css({
          position: 'relative',
          display: 'grid',
          width: '10',
          height: '10',
          flexShrink: 0,
          placeItems: 'center',
          borderRadius: 'xl',
          layerStyle: 'primaryFill',
          color: 'onPrimaryFill',
          boxShadow: 'primary',
          _dark: {
            layerStyle: 'raised',
            color: 'foreground',
            boxShadow: 'raised',
          },
        }),
        'press',
      )
    : cx(
        css({
          position: 'relative',
          display: 'grid',
          width: '10',
          height: '10',
          flexShrink: 0,
          placeItems: 'center',
          borderRadius: 'xl',
          color: 'mutedForeground',
          _hover: { backgroundColor: 'well', color: 'foreground' },
        }),
        'press',
      )

export type Tone = 'plain' | 'ok' | 'warn' | 'danger'

const toneClasses: Record<Tone, string> = {
  plain: css({ color: 'foreground' }),
  ok: css({ color: 'ok' }),
  warn: css({ color: 'warn' }),
  danger: css({ color: 'danger' }),
}

export const toneText = (tone: Tone): string => toneClasses[tone]

export const GROUP_TEXT: Record<BuildGroup, string> = {
  edge: css({ color: 'groupEdge' }),
  compute: css({ color: 'groupCompute' }),
  data: css({ color: 'groupData' }),
  ops: css({ color: 'groupOps' }),
}

/** Glyph scale inside each badge shape; a diamond has the least room. */
const GLYPH_SCALE: Record<GroupShape, number> = {
  hexagon: 0.5,
  chip: 0.48,
  disc: 0.52,
  diamond: 0.42,
}

/** A chip's pins: three short legs on each side of its body. */
const CHIP_PINS = [7.5, 12, 16.5].flatMap((at) => [
  [0.5, at - 0.9, 3.5, 1.8],
  [20, at - 0.9, 3.5, 1.8],
  [at - 0.9, 0.5, 1.8, 3.5],
  [at - 0.9, 20, 1.8, 3.5],
])

const shapeOf = <M>(shape: GroupShape, h: HtmlBuilder<M>): ReadonlyArray<Html> => {
  // A stroke in the fill colour with round joins softens the polygon corners.
  const soft = [
    h.Fill('currentColor'),
    h.Stroke('currentColor'),
    h.StrokeWidth('2'),
    h.StrokeLinejoin('round'),
  ]
  switch (shape) {
    case 'hexagon':
      return [
        h.polygon(
          [h.Points('12,1.5 21.1,6.75 21.1,17.25 12,22.5 2.9,17.25 2.9,6.75'), ...soft],
          [],
        ),
      ]
    case 'diamond':
      return [h.polygon([h.Points('12,1.5 22.5,12 12,22.5 1.5,12'), ...soft], [])]
    case 'chip':
      return [
        ...CHIP_PINS.map(([x = 0, y = 0, w = 0, ht = 0]) =>
          h.rect(
            [
              h.X(String(x)),
              h.Y(String(y)),
              h.Width(String(w)),
              h.Height(String(ht)),
              h.Rx('0.6'),
              h.Fill('currentColor'),
              h.Opacity('0.75'),
            ],
            [],
          ),
        ),
        h.rect(
          [
            h.X('3.5'),
            h.Y('3.5'),
            h.Width('17'),
            h.Height('17'),
            h.Rx('3'),
            h.Fill('currentColor'),
          ],
          [],
        ),
      ]
    case 'disc':
      return [h.circle([h.Cx('12'), h.Cy('12'), h.R('11'), h.Fill('currentColor')], [])]
  }
}

/** What sits on a badge: a lucide glyph, or a filled brand path. */
export type BadgeContent = IconNode | Readonly<{ path: string }>

/**
 * A glyph on a shaped badge, knocked out in white. The shape says what part
 * of the system it belongs to: Edge hexagons, Compute chips, Data discs, Ops
 * diamonds. `color` overrides the group's colour; grey when `muted`.
 */
export const groupBadge = <M>(
  group: BuildGroup,
  content: BadgeContent,
  className: string,
  h: HtmlBuilder<M>,
  muted = false,
  color?: string,
): Html => {
  const shape = GROUP_SHAPES[group]
  const scale = GLYPH_SCALE[shape]
  const offset = 12 - 12 * scale
  // A custom brand fill stays white. The theme's group fills turn pale in dark mode,
  // so their glyph flips to the theme's paired ink instead.
  const glyph = color && !muted ? 'white' : 'onGroup'
  return h.svg(
    [
      h.AriaHidden(true),
      h.Xmlns('http://www.w3.org/2000/svg'),
      h.ViewBox('0 0 24 24'),
      h.Class(
        cx(
          css({
            flexShrink: '0',
            overflow: 'visible',
            filter: 'drop-shadow(0 1px 1px oklch(0 0 0/0.18))',
          }),
          muted
            ? css({
                color: 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)',
              })
            : color
              ? ''
              : GROUP_TEXT[group],
          className,
        ),
      ),
      ...(color && !muted ? [h.Style({ color })] : []),
    ],
    [
      ...shapeOf(shape, h),
      h.g(
        [h.Transform(`translate(${offset} ${offset}) scale(${scale})`)],
        // A nested 24-unit svg; it takes the badge's paired glyph ink.
        'path' in content
          ? [
              h.g(
                [h.Class(css({ color: glyph }))],
                [h.path([h.D(content.path), h.Fill('currentColor')], [])],
              ),
            ]
          : [
              icon(
                h,
                content,
                css({
                  width: '6',
                  height: '6',
                  color: glyph,
                }),
              ),
            ],
      ),
    ],
  )
}

/** A language or framework brand mark, in its brand colour. */
export const stackLogo = <M>(id: StackLogoId, className: string, h: HtmlBuilder<M>): Html => {
  const logo = STACK_LOGOS[id]
  return h.svg(
    [
      h.AriaHidden(true),
      h.Xmlns('http://www.w3.org/2000/svg'),
      h.ViewBox('0 0 24 24'),
      h.Class(
        cx(
          css({
            flexShrink: '0',
          }),
          logo.color
            ? ''
            : css({
                color: 'foreground',
              }),
          className,
        ),
      ),
    ],
    [h.path([h.D(logo.path), h.Fill(logo.color ?? 'currentColor')], [])],
  )
}

/** A label over a value, for the HUD. */
export const figure = <M>(
  name: string,
  value: string,
  note: string,
  noteTone: Tone,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Key(name),
      h.Class(
        css({
          display: 'flex',
          minWidth: '0',
          flexDirection: 'column',
          gap: '1',
          paddingInline: '3.5',
          paddingBlock: '2',
        }),
      ),
    ],
    [
      h.span([h.Class(EYEBROW)], [name]),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                display: 'flex',
                alignItems: 'baseline',
                gap: '1.5',
                fontSize: 'type.15',
                lineHeight: 'none',
                whiteSpace: 'nowrap',
              }),
            ),
          ),
        ],
        [
          value,
          note
            ? h.span(
                [
                  h.Class(
                    cx(
                      css({
                        fontSize: 'type.10-5',
                      }),
                      noteTone === 'plain'
                        ? css({
                            color: 'mutedForeground',
                          })
                        : toneText(noteTone),
                    ),
                  ),
                ],
                [note],
              )
            : h.empty,
        ],
      ),
    ],
  )

/** A label and a value on one line, for nested groups. */
export const row = <M>(name: string, value: string, tone: Tone, h: HtmlBuilder<M>): Html =>
  h.div(
    [
      h.Key(name),
      h.Class(
        css({
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '3',
          paddingInline: '3',
          paddingBlock: '1.5',
        }),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              fontSize: 'type.12-5',
              color: 'mutedForeground',
            }),
          ),
        ],
        [name],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.12',
                whiteSpace: 'nowrap',
              }),
              toneText(tone),
            ),
          ),
        ],
        [value],
      ),
    ],
  )

/** A sunken track with a rounded fill. */
export const meter = <M>(share: number, fill: string, h: HtmlBuilder<M>): Html =>
  h.div(
    [
      h.Class(
        css({
          height: '1.5',
          overflow: 'hidden',
          borderRadius: 'full',
          backgroundColor: 'well',
          boxShadow: 'well',
        }),
      ),
    ],
    [
      h.div(
        [
          // The fill slides rather than resizing: transform skips layout, and progress moves linearly.
          h.Class(
            cx(
              css({
                height: '100%',
                width: '100%',
                borderRadius: 'full',
                transitionProperty: 'transform',
                transitionDuration: 'slow',
                transitionTimingFunction: 'linear',
              }),
              fill,
            ),
          ),
          h.Style({
            transform: `translateX(${(Math.max(0, Math.min(1, share)) - 1) * 100}%)`,
          }),
        ],
        [],
      ),
    ],
  )

/** A progress ring, from 0 to 1, drawn clockwise from the top. */
export const ring = <M>(share: number, className: string, h: HtmlBuilder<M>): Html => {
  const radius = 6
  const length = 2 * Math.PI * radius
  return h.svg(
    [
      h.AriaHidden(true),
      h.Class(className),
      h.Xmlns('http://www.w3.org/2000/svg'),
      h.ViewBox('0 0 16 16'),
      h.Fill('none'),
    ],
    [
      h.circle([
        h.Cx('8'),
        h.Cy('8'),
        h.R(String(radius)),
        h.Stroke('currentColor'),
        h.StrokeWidth('2'),
        h.Attribute('opacity', '0.2'),
      ]),
      h.circle([
        h.Cx('8'),
        h.Cy('8'),
        h.R(String(radius)),
        h.Stroke('currentColor'),
        h.StrokeWidth('2'),
        h.StrokeLinecap('round'),
        h.Attribute('stroke-dasharray', `${length}`),
        h.Attribute('stroke-dashoffset', `${length * (1 - Math.max(0, Math.min(1, share)))}`),
        h.Attribute('transform', 'rotate(-90 8 8)'),
        h.Class(
          css({
            transitionProperty: 'stroke-dashoffset',
            transitionDuration: 'normal',
            transitionTimingFunction: 'out',
          }),
        ),
      ]),
    ],
  )
}

/**
 * One Insight pool and a figure: the pool's own icon in its colour, then the
 * figure. `grey` draws it uncoloured; `tone` colours the figure.
 */
export const insightChip = <M>(
  pool: InsightPool,
  figure: string,
  h: HtmlBuilder<M>,
  grey = false,
  tone: Tone = 'plain',
  name: string = poolName(pool),
): Html =>
  h.span(
    [
      h.Title(`${name} ${figure}`),
      h.AriaLabel(`${name} ${figure}`),
      h.Class(
        cx(
          FIGURE,
          css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75',
            whiteSpace: 'nowrap',
          }),
        ),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              display: 'inline-flex',
            }),
          ),
          h.Style({ color: grey ? 'var(--muted-foreground)' : poolColor(pool) }),
        ],
        [
          icon(
            h,
            POOL_ICONS[pool],
            css({
              width: '3',
              height: '3',
              flexShrink: '0',
            }),
          ),
        ],
      ),
      h.span(
        [
          h.AriaHidden(true),
          h.Class(
            grey
              ? css({
                  color: 'mutedForeground',
                })
              : tone === 'plain'
                ? ''
                : toneText(tone),
          ),
        ],
        [figure],
      ),
    ],
  )
