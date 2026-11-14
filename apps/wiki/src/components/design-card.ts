import * as Effect from 'effect/Effect'
import { Schema } from 'effect'
import { Mount } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { SIZES } from '@quorum/simulation/catalog'
import { solveFlow } from '@quorum/simulation/solve'
import { heightOf } from '@quorum/ui/board/size'
import { compact, money, ms } from '@quorum/ui/game/format'
import { localeOf } from '../i18n/builder.ts'
import { langOf, type Lang } from '../i18n/lang.ts'
import { Message } from '../main.ts'
import { solverReadyForBoard } from '../solver.ts'
import { DESIGNS } from '../patterns/designs/index.ts'
import { DESIGN_IDS, type DesignId } from '../patterns/designs/ids.ts'
import type { Setting } from '../patterns/design.ts'
import { css, cx } from '@quorum/styled-system/css'

// Defined on first use: this module is imported while main.ts is still loading.
const defineDesignMounted = () =>
  Mount.define('DesignMounted', {
    args: { id: Schema.Literals(DESIGN_IDS) },
    messages: [Message.Navigated],
    execute: ({ element, id }) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => solverReadyForBoard())
        // Pixi loads only on pages that show a board.
        const { drawDesign } = yield* Effect.promise(() => import('./design-board.ts'))
        yield* Effect.acquireRelease(
          Effect.sync(() => drawDesign(id, element as HTMLElement)),
          (detach) => Effect.sync(detach),
        )
        return Message.Navigated()
      }),
  })

let designMounted: ReturnType<typeof defineDesignMounted> | null = null

const valueOf = (l: Lang, setting: Setting): string => {
  const { field, value } = setting
  if (field === 'size' && typeof value === 'number') return SIZES[value]?.name ?? String(value)
  if (value === true) return l.t.islands.design.on
  if (value === false) return l.t.islands.design.off
  if (field === 'timeout' && typeof value === 'number') return `${value} s`
  return String(value)
}

/** The board's height: the packed Design's extent at a readable scale, never more than most of a screen. */
const heightFor = (id: string): string => {
  const design = DESIGNS[id]
  if (!design) return '320px'
  const top = Math.min(...design.game.nodes.map((node) => node.y))
  const bottom = Math.max(...design.game.nodes.map((node) => node.y + heightOf(node.type)))
  return `min(${Math.round(Math.max(260, (bottom - top) * 0.8 + 56))}px, 70vh)`
}

export const designView = (id: DesignId, h: HtmlBuilder<Message>): Html => {
  const design = DESIGNS[id]
  if (!design) return h.empty
  const l = langOf(localeOf(h))
  const t = l.t.islands.design
  const { COMPONENTS, INCIDENTS, RESEARCH } = l.cat
  const ledger = solveFlow(design.game)
  const rows = [
    ...design.nodes.flatMap((node) =>
      node.settings.map((setting) => ({
        key: `${node.id}-${setting.field}`,
        where: h.a(
          [
            h.Href(`/components/${node.type}`),
            h.Class(
              css({
                textDecorationLine: 'underline',
                textUnderlineOffset: '4px',
              }),
            ),
          ],
          [COMPONENTS[node.type].name],
        ),
        unlock: COMPONENTS[node.type].unlock,
        setting,
      })),
    ),
    ...design.links.flatMap((link) =>
      link.settings.map((setting) => ({
        key: `${link.from}-${link.to}-${setting.field}`,
        where: h.span(
          [],
          [
            t.link(
              COMPONENTS[design.nodes.find((n) => n.id === link.from)?.type ?? 'users'].name,
              COMPONENTS[design.nodes.find((n) => n.id === link.to)?.type ?? 'users'].name,
            ),
          ],
        ),
        unlock: undefined,
        setting,
      })),
    ),
  ]
  const needs = [
    ...new Set(
      design.nodes.flatMap((node) => {
        const unlock = COMPONENTS[node.type].unlock
        return unlock ? [unlock] : []
      }),
    ),
    ...design.researched,
  ]
  return h.figure(
    [
      h.Key(`design-${id}`),
      h.DataAttribute('lazy-island', ''),
      h.Class(
        cx(
          css({
            marginBlock: '6',
          }),
          'not-prose',
        ),
      ),
    ],
    [
      h.div(
        [
          h.Role('img'),
          h.AriaLabel(t.aria(design.nodes.map((node) => COMPONENTS[node.type].name).join(', '))),
          h.Class(
            css({
              position: 'relative',
              width: '100%',
              cursor: 'grab',
              overflow: 'hidden',
              borderRadius: 'lg',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'border',
            }),
          ),
          h.Style({ height: heightFor(id) }),
          h.OnMount((designMounted ??= defineDesignMounted())({ id })),
        ],
        [],
      ),
      h.p(
        [
          h.Class(
            css({
              marginTop: '1.5',
              fontSize: 'type.12',
              color: 'mutedForeground',
            }),
          ),
        ],
        [t.hint],
      ),
      h.figcaption(
        [
          h.Class(
            css({
              marginTop: '2',
              fontSize: 'type.12',
              color: 'mutedForeground',
            }),
          ),
        ],
        [
          t.caption(
            compact(design.users),
            design.incident ? INCIDENTS[design.incident.kind].name : null,
            ledger.apdex.toFixed(2),
            ms(ledger.p99),
            (ledger.errorShare * 100).toFixed(1),
            money(ledger.burn),
            ledger.egress >= 0.005 ? money(ledger.egress) : null,
            design.note ?? null,
          ),
        ],
      ),
      rows.length > 0
        ? h.div(
            [
              h.Class(
                css({
                  marginTop: '4',
                  overflowX: 'auto',
                  borderRadius: 'lg',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'border',
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
                      fontSize: 'type.14',
                      lineHeight: 'snug',
                    }),
                  ),
                ],
                [
                  h.thead(
                    [],
                    [
                      h.tr(
                        [],
                        [t.where, t.setting, t.value, t.why].map((name) =>
                          h.th(
                            [
                              h.Class(
                                css({
                                  borderBottomWidth: '1px',
                                  borderBottomStyle: 'solid',
                                  borderColor: 'border',
                                  backgroundColor:
                                    'color-mix(in oklab, var(--muted) 50%, transparent)',
                                  paddingInline: '3',
                                  paddingBlock: '2',
                                  textAlign: 'left',
                                  fontSize: 'type.12',
                                  fontWeight: 'medium',
                                  color: 'mutedForeground',
                                }),
                              ),
                            ],
                            [name],
                          ),
                        ),
                      ),
                    ],
                  ),
                  h.tbody(
                    [
                      h.Class(
                        css({
                          '& > * + *': {
                            borderTopWidth: '1px',
                            borderTopStyle: 'solid',
                            borderColor: 'border',
                          },
                        }),
                      ),
                    ],
                    rows.map((row) =>
                      h.tr(
                        [h.Key(row.key)],
                        [
                          h.td(
                            [
                              h.Class(
                                css({
                                  paddingInline: '3',
                                  paddingBlock: '2',
                                  verticalAlign: 'top',
                                  whiteSpace: 'nowrap',
                                }),
                              ),
                            ],
                            [row.where],
                          ),
                          h.td(
                            [
                              h.Class(
                                css({
                                  paddingInline: '3',
                                  paddingBlock: '2',
                                  verticalAlign: 'top',
                                }),
                              ),
                            ],
                            [row.setting.label],
                          ),
                          h.td(
                            [
                              h.Class(
                                css({
                                  paddingInline: '3',
                                  paddingBlock: '2',
                                  verticalAlign: 'top',
                                  whiteSpace: 'nowrap',
                                  fontFamily: 'mono',
                                }),
                              ),
                            ],
                            [valueOf(l, row.setting)],
                          ),
                          h.td(
                            [
                              h.Class(
                                css({
                                  paddingInline: '3',
                                  paddingBlock: '2',
                                  verticalAlign: 'top',
                                  color: 'mutedForeground',
                                }),
                              ),
                            ],
                            [row.setting.why],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          )
        : h.empty,
      needs.length > 0
        ? h.p(
            [
              h.Class(
                css({
                  marginTop: '2',
                  fontSize: 'type.12',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [
              t.needs,
              ...needs.flatMap((research, index) => [
                ...(index > 0 ? [l.t.reference.listSeparator] : []),
                h.a(
                  [
                    h.Href(`/research/${research}`),
                    h.Class(
                      css({
                        textDecorationLine: 'underline',
                        textUnderlineOffset: '4px',
                      }),
                    ),
                  ],
                  [RESEARCH[research].name],
                ),
              ]),
              l.t.reference.sentenceEnd,
            ],
          )
        : h.empty,
    ],
  )
}
