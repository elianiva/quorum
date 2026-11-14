import { css, cx } from '@quorum/styled-system/css'
import { copy, type Messages } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import type { BurnLines } from '@quorum/simulation/ledger'
import { REQUEST_KINDS } from '@quorum/simulation/catalog'
import { has } from '@quorum/simulation/lookups'
import { money } from '@quorum/ui/game/format'
import type { Message } from '@/game/message.ts'
import { ledgerOf, type Model } from '@/game/model.ts'
import { FIGURE, WELL } from '@quorum/ui/game/bits'
import { shell } from './panels.ts'

type Line = Readonly<{ key: keyof BurnLines; label: string; note: string }>

const linesOf = (t: Messages): ReadonlyArray<Line> => [
  { key: 'compute', label: t.cost.compute, note: t.cost.notes.compute },
  { key: 'data', label: t.cost.data, note: t.cost.notes.data },
  { key: 'storage', label: t.cost.storage, note: t.cost.notes.storage },
  { key: 'egress', label: t.cost.egress, note: t.cost.notes.egress },
  { key: 'thirdParty', label: t.cost.thirdParties, note: t.cost.notes.thirdParty },
  {
    key: 'requests',
    label: t.cost.requests,
    note: t.cost.notes.requests,
  },
  { key: 'observability', label: t.cost.observability, note: t.cost.notes.observability },
  { key: 'salaries', label: t.cost.salaries, note: t.cost.notes.salaries },
]

const row = (line: Line, value: number, total: number, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        css({
          display: 'grid',
          gridTemplateColumns: '1fr auto 64px',
          alignItems: 'baseline',
          gap: '4',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: 'border',
          paddingBlock: '2',
          '&:last-child': {
            borderBottomWidth: '0px',
          },
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              minWidth: '0',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  fontSize: 'calc(13.5px*var(--type-scale))',
                  color: 'foreground',
                }),
              ),
            ],
            [line.label],
          ),
          h.div(
            [
              h.Class(
                css({
                  fontSize: 'calc(12px*var(--type-scale))',
                  lineHeight: '1.375',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [line.note],
          ),
        ],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'calc(13.5px*var(--type-scale))',
                color: 'foreground',
              }),
            ),
          ),
        ],
        [t.cost.s(money(value))],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                textAlign: 'right',
                fontSize: 'calc(12px*var(--type-scale))',
                color: 'mutedForeground',
              }),
            ),
          ),
        ],
        [total > 0 ? `${Math.round((value / total) * 100)}%` : '—'],
      ),
    ],
  )
}

/** A simple two-column figure row, for unit economics and cost allocation. */
const figureRow = (label: string, value: string, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        css({
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '4',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: 'border',
          paddingBlock: '1.5',
          '&:last-child': {
            borderBottomWidth: '0px',
          },
        }),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              fontSize: 'calc(12.5px*var(--type-scale))',
              color: 'foreground',
            }),
          ),
        ],
        [label],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'calc(12.5px*var(--type-scale))',
                color: 'mutedForeground',
              }),
            ),
          ),
        ],
        [value],
      ),
    ],
  )

export const costPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const ledger = ledgerOf(model)
  const lines = ledger.burnLines
  const total = ledger.burn
  const revenue = ledger.revenue
  const margin = revenue > 0 ? (revenue - total) / revenue : null
  const unitEconomics = has(game, 'unit-economics')
    ? REQUEST_KINDS.filter((kind) => (ledger.costPerKind[kind] ?? 0) > 0)
    : []
  const costAllocation = has(game, 'cost-allocation')
    ? (Object.entries(ledger.costPerService) as ReadonlyArray<[string, number]>).filter(
        ([, cost]) => cost > 0,
      )
    : []
  return shell(
    t.cost.cloudBill,
    [],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'baseline',
              gap: '6',
              paddingInline: '5',
              paddingBottom: '2',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'calc(20px*var(--type-scale))',
                        lineHeight: '1',
                        fontWeight: '500',
                      }),
                    ),
                  ),
                ],
                [t.cost.s(money(total))],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'calc(12px*var(--type-scale))',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [t.cost.burn],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'calc(20px*var(--type-scale))',
                        lineHeight: '1',
                        fontWeight: '500',
                      }),
                    ),
                  ),
                ],
                [t.cost.s(money(revenue))],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'calc(12px*var(--type-scale))',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [t.cost.revenue],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'calc(20px*var(--type-scale))',
                        lineHeight: '1',
                        fontWeight: '500',
                      }),
                    ),
                  ),
                ],
                [margin === null ? '—' : `${Math.round(margin * 100)}%`],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'calc(12px*var(--type-scale))',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [t.cost.margin],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            cx(
              WELL,
              css({
                marginInline: '5',
                marginBottom: '4',
                paddingInline: '4',
                paddingBlock: '2',
              }),
            ),
          ),
        ],
        linesOf(t).map((line) => row(line, lines[line.key], total, h)),
      ),
      ...(unitEconomics.length > 0
        ? [
            h.div(
              [
                h.Class(
                  css({
                    paddingInline: '5',
                    paddingBottom: '1',
                    fontSize: 'calc(12px*var(--type-scale))',
                    color: 'mutedForeground',
                  }),
                ),
              ],
              ['Unit economics · cost per served request'],
            ),
            h.div(
              [
                h.Class(
                  cx(
                    WELL,
                    css({
                      marginInline: '5',
                      marginBottom: '4',
                      paddingInline: '4',
                      paddingBlock: '2',
                    }),
                  ),
                ),
              ],
              unitEconomics.map((kind) =>
                figureRow(
                  t.catalog.kinds[kind].label,
                  `${money(ledger.costPerKind[kind] ?? 0)}/req`,
                  h,
                ),
              ),
            ),
          ]
        : []),
      ...(costAllocation.length > 0
        ? [
            h.div(
              [
                h.Class(
                  css({
                    paddingInline: '5',
                    paddingBottom: '1',
                    fontSize: 'calc(12px*var(--type-scale))',
                    color: 'mutedForeground',
                  }),
                ),
              ],
              ['Cost allocation · by Service'],
            ),
            h.div(
              [
                h.Class(
                  cx(
                    WELL,
                    css({
                      marginInline: '5',
                      marginBottom: '4',
                      paddingInline: '4',
                      paddingBlock: '2',
                    }),
                  ),
                ),
              ],
              costAllocation.map(([id, cost]) => {
                const service = game.services.find((entry) => entry.id === id)
                const team = game.teams.find((entry) => entry.id === service?.owner)
                return figureRow(
                  `${service?.name ?? id} (${team?.name ?? 'core'})`,
                  t.cost.s(money(cost)),
                  h,
                )
              }),
            ),
          ]
        : []),
      h.p(
        [
          h.Class(
            css({
              paddingInline: '5',
              paddingBottom: '4',
              fontSize: 'calc(12.5px*var(--type-scale))',
              lineHeight: '1.375',
              color: 'mutedForeground',
            }),
          ),
        ],
        [t.cost.billExplainer],
      ),
    ],
    css({ maxWidth: '560px' }),
    h,
  )
}
