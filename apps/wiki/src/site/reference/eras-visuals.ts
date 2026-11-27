import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { KINDS, type EraDef, type RequestKind } from '@quorum/simulation/catalog'
import { css, cx } from '@quorum/styled-system/css'
import { percent, type Lang } from './shared.ts'

/** The figure style, shared with the game. */
export const FIGURE = css({
  fontFamily: 'mono',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 'subtle',
})

/** The eyebrow style, shared with the game. */
export const EYEBROW = css({
  fontFamily: 'mono',
  fontSize: 'type.10-5',
  fontWeight: 'medium',
  textTransform: 'uppercase',
  letterSpacing: 'eyebrow',
  color: 'mutedForeground',
})

const colorOf = (kind: RequestKind): string => `#${KINDS[kind].color.toString(16).padStart(6, '0')}`

export const mixBar = <Msg>(
  l: Lang,
  mix: EraDef['mix'],
  h: H<Msg>,
  legend = true,
): View.Content<Msg> => {
  const entries = Object.entries(mix) as ReadonlyArray<[RequestKind, number]>
  const names = l.cat.KINDS
  return h.div
    .class(
      cx(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
        }),
        'not-prose',
        legend &&
          css({
            marginBlock: '5',
          }),
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            height: '2',
            gap: '0.25',
            overflow: 'hidden',
            borderRadius: 'full',
          }),
        )
        .attr('aria-hidden', legend ? 'true' : undefined)
        .attr('role', legend ? undefined : 'img')
        .attr(
          'aria-label',
          legend
            ? undefined
            : entries.map(([kind, share]) => `${names[kind].label} ${percent(share)}`).join(', '),
        )
        .children(
          ...entries.map(([kind, share]) =>
            h.span
              .key(kind)
              .attr('title', `${names[kind].label} ${percent(share)}`)
              .style({ width: percent(share), background: colorOf(kind) })
              .children(),
          ),
        ),
      ...(legend
        ? [
            h.ul
              .class(
                css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  columnGap: '4',
                  rowGap: '1.5',
                  fontSize: 'type.12',
                }),
              )
              .children(
                ...entries.map(([kind, share]) =>
                  h.li
                    .key(kind)
                    .class(
                      css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '1.5',
                      }),
                    )
                    .children(
                      h.span
                        .class(
                          css({
                            width: '2.5',
                            height: '2.5',
                            borderRadius: 'sm',
                          }),
                        )
                        .style({ background: colorOf(kind) })
                        .children(),
                      names[kind].label,
                      h.span
                        .class(
                          cx(
                            FIGURE,
                            css({
                              color: 'mutedForeground',
                            }),
                          ),
                        )
                        .children(percent(share)),
                    ),
                ),
              ),
          ]
        : []),
    )
}
