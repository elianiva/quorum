import type { Html, HtmlBuilder } from 'foldkit/html'
import type { LeverKind } from '@quorum/simulation/catalog'
import { FIGURE } from '@quorum/ui/game/bits'
import { localeOf } from '../i18n/builder.ts'
import { langOf } from '../i18n/lang.ts'
import { leverOf, leverRows } from '../reference/levers.ts'
import { css, cx } from '@quorum/styled-system/css'

/* A kind's Product lever as the game offers it: three steps, each with the share
   it gives the kind, its Dev Hours, and its growth cost. */

const percent = (share: number): string => `${Math.round(share * 1000) / 10}%`

export const leverView = <M>(kind: LeverKind, h: HtmlBuilder<M>): Html => {
  const l = langOf(localeOf(h))
  const t = l.t.islands.lever
  const def = leverOf(l, kind)
  const rows = leverRows(kind)
  const cell = css({
    paddingInline: '3',
    paddingBlock: '1.5',
    textAlign: 'left',
  })
  return h.figure(
    [
      h.Class(
        cx(
          css({
            marginBlock: '6',
            overflow: 'hidden',
            borderRadius: 'lg',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'border',
          }),
          'not-prose',
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '3',
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              borderColor: 'border',
              backgroundColor: 'color-mix(in oklab, var(--muted) 40%, transparent)',
              paddingInline: '3',
              paddingBlock: '2',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontSize: '13px',
                  fontWeight: '500',
                }),
              ),
            ],
            [t.title(def.name)],
          ),
          h.span(
            [
              h.Class(
                css({
                  fontSize: '12px',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [t.default(percent(def.base), def.era)],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              overflowX: 'auto',
            }),
          ),
        ],
        [
          h.table(
            [
              h.Class(
                css({
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                  lineHeight: '1.375',
                }),
              ),
            ],
            [
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    [t.step, t.share, t.devHours, t.growth].map((header) =>
                      h.th(
                        [
                          h.Key(header),
                          h.Class(
                            cx(
                              cell,
                              css({
                                backgroundColor:
                                  'color-mix(in oklab, var(--muted) 30%, transparent)',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: 'mutedForeground',
                              }),
                            ),
                          ),
                        ],
                        [header],
                      ),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                rows.map((row) =>
                  h.tr(
                    [
                      h.Key(String(row.step)),
                      h.Class(
                        css({
                          borderBottomWidth: '1px',
                          borderBottomStyle: 'solid',
                          borderColor: 'border',
                          '&:last-child': {
                            borderBottomWidth: '0',
                          },
                        }),
                      ),
                    ],
                    [
                      h.td([h.Class(cx(cell, FIGURE))], [String(row.step)]),
                      h.td([h.Class(cx(cell, FIGURE))], [percent(row.share)]),
                      h.td([h.Class(cx(cell, FIGURE))], [String(row.dh)]),
                      h.td([h.Class(cx(cell, FIGURE))], [`−${Math.round(row.growth * 100)}%`]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
      h.figcaption(
        [
          h.Class(
            css({
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'border',
              paddingInline: '3',
              paddingBlock: '2',
              fontSize: '12px',
              color: 'mutedForeground',
            }),
          ),
        ],
        [t.note],
      ),
    ],
  )
}
