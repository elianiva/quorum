import { css } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy, nodeTitle, type Messages } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { churnOf, ChurnFix, type ChurnRow, type RegionChurn } from '@quorum/simulation/churn'
import { has } from '@quorum/simulation/lookups'
import { openRegions } from '@quorum/simulation/regions'
import type { Game } from '@quorum/simulation/state'
import { compact } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { ledgerOf, type Model } from '@/game/model.ts'
import { button } from '@quorum/ui/primitives/button'
import { cn } from '@/lib/utils'
import { FIGURE, SCROLL, WELL, toneText } from '@quorum/ui/game/bits'
import { shell } from './panels.ts'

/** The button that applies a row's fix, or its advice as text. */
const fixOf = (game: Game, entry: ChurnRow, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const apply = (kind: 'region' | 'research' | 'node', label: string, target: string): Html =>
    button(
      {
        onClick: Message.ChurnFixTaken({ fix: kind, target }),
        variant: 'outline',
        size: 'sm',
        className: css({
          justifySelf: 'start',
        }),
      },
      label,
      h,
    )

  return ChurnFix.match(entry.fix, {
    advice: () =>
      h.span(
        [
          h.Class(
            css({
              fontSize: 'calc(12px*var(--type-scale))',
              lineHeight: '1.375',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [entry.cause === 'far' ? '' : t.churn.fixes[entry.cause]],
      ),
    node: ({ nodeId }) => {
      const shown = game.nodes.find((node) => node.id === nodeId)
      return apply('node', t.churn.show(shown ? nodeTitle(t, game, shown) : t.churn.node), nodeId)
    },
    region: ({ region }) =>
      apply(
        'region',
        has(game, 'infra-as-code') &&
          !game.nodes.some((node) => node.region === region && node.type !== 'users')
          ? t.churn.mirrorInto[region]
          : openRegions(game).includes(region)
            ? t.churn.buildIn[region]
            : t.churn.openRegion[region],
        region,
      ),
    research: ({ research }) =>
      apply('research', t.churn.research(t.catalog.research[research].name), research),
  })
}

/** The slowest hop and the internet hop per device that a row names, as one line. */
const detailOf = (t: Messages, game: Game, entry: ChurnRow): string => {
  const hop = entry.hop
  const shown = hop ? game.nodes.find((node) => node.id === hop.nodeId) : undefined
  return [
    ...(hop
      ? [
          t.churn.slowestHop(
            shown ? nodeTitle(t, game, shown) : t.churn.node,
            formats(t).ms(hop.ms),
          ),
        ]
      : []),
    ...(entry.device
      ? [
          t.churn.deviceAdds(
            t.catalog.deviceInfo[entry.device.device].name,
            formats(t).ms(entry.device.ms),
          ),
        ]
      : []),
  ].join(' · ')
}

const row = (
  game: Game,
  entry: ChurnRow,
  widest: number,
  fixed: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const detail = detailOf(t, game, entry)
  return h.div(
    [h.Key(`${entry.kind}:${entry.cause}`)],
    [
      rowGrid(game, entry, widest, fixed, h),
      ...(detail === ''
        ? []
        : [
            h.div(
              [
                h.Class(
                  cn(
                    css({
                      paddingInline: '0.75rem',
                      paddingBottom: '0.25rem',
                      fontSize: 'calc(11.5px*var(--type-scale))',
                      color: 'var(--muted-foreground)',
                    }),
                    !entry.needed &&
                      css({
                        opacity: 0.6,
                      }),
                  ),
                ),
              ],
              [detail],
            ),
          ]),
    ],
  )
}

const rowGrid = (
  game: Game,
  entry: ChurnRow,
  widest: number,
  fixed: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        cn(
          css({
            display: 'grid',
            gridTemplateColumns: '88px 80px 1fr 44px minmax(0,180px)',
            alignItems: 'center',
            gap: '0.75rem',
            paddingInline: '0.75rem',
            paddingBlock: '0.375rem',
            _compact: {
              gridTemplateColumns: '72px 64px 1fr 40px',
            },
          }),
          !entry.needed &&
            css({
              opacity: 0.6,
            }),
        ),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'calc(12.5px*var(--type-scale))',
              fontWeight: '500',
            }),
          ),
        ],
        [t.catalog.kinds[entry.kind].label],
      ),
      h.span(
        [
          h.Class(
            cn(
              css({
                fontSize: 'calc(12px*var(--type-scale))',
              }),
              entry.cause === 'slow' || entry.cause === 'far'
                ? css({
                    color: 'var(--warn)',
                  })
                : css({
                    color: 'var(--danger)',
                  }),
            ),
          ),
        ],
        [t.churn.causes[entry.cause]],
      ),
      h.div(
        [
          h.Class(
            css({
              height: '0.375rem',
              borderRadius: '9999px',
              backgroundColor: 'var(--muted)',
            }),
          ),
          h.Title(
            entry.p99 === null
              ? ''
              : `p99 ${formats(t).ms(entry.p99)} · T ${formats(t).ms(entry.target)}`,
          ),
        ],
        [
          h.div(
            [
              h.Class(
                cn(
                  css({
                    height: '100%',
                    borderRadius: '9999px',
                  }),
                  entry.needed
                    ? css({
                        backgroundColor: 'var(--danger)',
                      })
                    : css({
                        backgroundColor: 'var(--muted-foreground)',
                      }),
                ),
              ),
              h.Style({ width: `${Math.max(4, (entry.points / widest) * 100)}%` }),
            ],
            [],
          ),
        ],
      ),
      h.span(
        [
          h.Class(
            cn(
              FIGURE,
              css({
                textAlign: 'right',
                fontSize: 'calc(12px*var(--type-scale))',
              }),
            ),
          ),
        ],
        [entry.points.toFixed(3)],
      ),
      h.div(
        [
          h.Class(
            css({
              _compact: {
                gridColumn: 'span 4 / span 4',
              },
            }),
          ),
        ],
        fixed ? [fixOf(game, entry, h)] : [],
      ),
    ],
  )
}

const section = (game: Game, region: RegionChurn, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const falling = region.perHour < 0
  const share = region.users > 0 ? (region.perHour / region.users) * 100 : 0
  const widest = region.rows.reduce((most, entry) => Math.max(most, entry.points), 0.001)
  return h.section(
    [
      h.Key(region.region),
      h.Class(
        cn(
          css({
            display: 'flex',
            flexDirection: 'column',
            paddingBlock: '0.25rem',
          }),
          WELL,
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              columnGap: '1rem',
              rowGap: '0.25rem',
              paddingInline: '0.75rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.375rem',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(14px*var(--type-scale))',
                  fontWeight: '600',
                }),
              ),
            ],
            [t.catalog.regionInfo[region.region].name],
          ),
          h.span(
            [
              h.Class(
                cn(
                  FIGURE,
                  css({
                    fontSize: 'calc(12.5px*var(--type-scale))',
                  }),
                ),
              ),
            ],
            [t.churn.users(compact(region.users))],
          ),
          h.span(
            [
              h.Class(
                cn(
                  FIGURE,
                  css({
                    fontSize: 'calc(12.5px*var(--type-scale))',
                  }),
                  toneText(region.now >= region.target ? 'ok' : 'danger'),
                ),
              ),
            ],
            [t.churn.apdex(region.now.toFixed(2), region.target.toFixed(2))],
          ),
          h.span(
            [
              h.Class(
                cn(
                  FIGURE,
                  css({
                    fontSize: 'calc(12.5px*var(--type-scale))',
                  }),
                  toneText(falling ? 'danger' : 'ok'),
                ),
              ),
            ],
            [t.units.perHour(`${share >= 0 ? '+' : '−'}${Math.abs(share).toFixed(1)}%`)],
          ),
          h.span(
            [
              h.Class(
                cn(
                  FIGURE,
                  css({
                    marginLeft: 'auto',
                    fontSize: 'calc(12.5px*var(--type-scale))',
                    color: 'var(--muted-foreground)',
                  }),
                ),
              ),
            ],
            [t.churn.n1Day(compact(region.inADay))],
          ),
        ],
      ),
      // Each fix shows once, on the first row the region needs it for.
      ...region.rows.map((entry, index) =>
        row(
          game,
          entry,
          widest,
          entry.needed &&
            region.rows.findIndex(
              (other) => JSON.stringify(other.fix) === JSON.stringify(entry.fix),
            ) === index,
          h,
        ),
      ),
    ],
  )
}

/** The breakdown runs a day's forecast, so each Game computes it once, not every frame. */
const cache = new WeakMap<Game, ReadonlyArray<RegionChurn>>()

export const churnPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const regions = cache.get(game) ?? churnOf(game, ledgerOf(model))
  cache.set(game, regions)
  return shell(
    t.churn.whyUsersLeave,
    [],
    [
      h.div(
        [
          h.Class(
            cn(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                paddingInline: '1.25rem',
                paddingTop: '0.25rem',
                paddingBottom: '1.25rem',
              }),
              SCROLL,
            ),
          ),
        ],
        regions.map((region) => section(game, region, h)),
      ),
    ],
    css({ maxWidth: '720px' }),
    h,
  )
}
