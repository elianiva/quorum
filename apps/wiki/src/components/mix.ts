import type { Html, HtmlBuilder } from 'foldkit/html'
import { localeOf } from '../i18n/builder.ts'
import { langOf } from '../i18n/lang.ts'
import { KINDS, type EraDef, type RequestKind } from '@quorum/simulation/catalog'
import { FIGURE } from '@quorum/ui/game/bits'
import { css, cx } from '@quorum/styled-system/css'

/* An Era's request mix, in each kind's colour from the game. */

const percent = (share: number): string => `${Math.round(share * 1000) / 10}%`

const colorOf = (kind: RequestKind): string => `#${KINDS[kind].color.toString(16).padStart(6, '0')}`

/** The Era's request mix as one bar; with `legend`, each kind's share beneath it. */
export const mixBar = <M>(mix: EraDef['mix'], h: HtmlBuilder<M>, legend = true): Html => {
  const entries = Object.entries(mix) as ReadonlyArray<[RequestKind, number]>
  const names = langOf(localeOf(h)).cat.KINDS
  return h.div(
    [
      h.Class(
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
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              height: '2',
              gap: '1px',
              overflow: 'hidden',
              borderRadius: '9999px',
            }),
          ),
          ...(legend
            ? [h.AriaHidden(true)]
            : [
                h.Role('img'),
                h.AriaLabel(
                  entries
                    .map(([kind, share]) => `${names[kind].label} ${percent(share)}`)
                    .join(', '),
                ),
              ]),
        ],
        entries.map(([kind, share]) =>
          h.span(
            [
              h.Key(kind),
              h.Title(`${names[kind].label} ${percent(share)}`),
              h.Style({ width: percent(share), background: colorOf(kind) }),
            ],
            [],
          ),
        ),
      ),
      legend
        ? h.ul(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  columnGap: '4',
                  rowGap: '1.5',
                  fontSize: '12px',
                }),
              ),
            ],
            entries.map(([kind, share]) =>
              h.li(
                [
                  h.Key(kind),
                  h.Class(
                    css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '1.5',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          width: '2.5',
                          height: '2.5',
                          borderRadius: 'sm',
                        }),
                      ),
                      h.Style({ background: colorOf(kind) }),
                    ],
                    [],
                  ),
                  names[kind].label,
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            color: 'mutedForeground',
                          }),
                        ),
                      ),
                    ],
                    [percent(share)],
                  ),
                ],
              ),
            ),
          )
        : h.empty,
    ],
  )
}
