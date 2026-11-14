import type { Html, HtmlBuilder } from 'foldkit/html'
import type { LeverKind } from '@quorum/simulation/catalog'
import { FIGURE } from '@quorum/ui/game/bits'
import { localeOf } from '../i18n/builder.ts'
import { langOf } from '../i18n/lang.ts'
import { leverOf, leverRows } from '../reference/levers.ts'
import { css, cx, cx as cn } from '@quorum/styled-system/css'

/* A kind's Product lever as the game offers it: three steps, each with the share
   it gives the kind, its Dev Hours, and its growth cost. */

const percent = (share: number): string => `${Math.round(share * 1000) / 10}%`

export const leverView = <M>(kind: LeverKind, h: HtmlBuilder<M>): Html => {
  const l = langOf(localeOf(h))
  const t = l.t.islands.lever
  const def = leverOf(l, kind)
  const rows = leverRows(kind)
  const cell = css({
    paddingInline: '0.75rem',
    paddingBlock: '0.375rem',
    textAlign: 'left',
  })
  return h.figure(
    [
      h.Class(
        cx(
          css({
            marginBlock: '1.5rem',
            overflow: 'hidden',
            borderRadius: 'lg',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border)',
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
              gap: '0.75rem',
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              borderColor: 'var(--border)',
              backgroundColor: 'color-mix(in oklab, var(--muted) 40%, transparent)',
              paddingInline: '0.75rem',
              paddingBlock: '0.5rem',
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
                  color: 'var(--muted-foreground)',
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
                            cn(
                              cell,
                              css({
                                backgroundColor:
                                  'color-mix(in oklab, var(--muted) 30%, transparent)',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: 'var(--muted-foreground)',
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
                          borderColor: 'var(--border)',
                          '&:last-child': {
                            borderBottomWidth: '0',
                          },
                        }),
                      ),
                    ],
                    [
                      h.td([h.Class(cn(cell, FIGURE))], [String(row.step)]),
                      h.td([h.Class(cn(cell, FIGURE))], [percent(row.share)]),
                      h.td([h.Class(cn(cell, FIGURE))], [String(row.dh)]),
                      h.td([h.Class(cn(cell, FIGURE))], [`−${Math.round(row.growth * 100)}%`]),
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
              borderColor: 'var(--border)',
              paddingInline: '0.75rem',
              paddingBlock: '0.5rem',
              fontSize: '12px',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [t.note],
      ),
    ],
  )
}
