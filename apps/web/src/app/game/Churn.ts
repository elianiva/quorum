import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect } from 'effect'
import { X } from 'lucide'
import { churnOf, ChurnFix, type ChurnRow, type RegionChurn } from '@quorum/simulation/churn'
import { has } from '@quorum/simulation/lookups'
import { openRegions } from '@quorum/simulation/regions'
import type { Game } from '@quorum/simulation/state'
import { compact } from '@quorum/ui/game/format'
import { perSecond } from '@/game/per-second.ts'
import { formats } from '@/i18n/format.ts'
import { copy, nodeTitle, speak, type Messages } from '@/i18n/messages.ts'
import { Message } from '@/game/message.ts'
import { ledgerOf, type Model } from '@/game/model.ts'
import { FIGURE, FLOAT, SCROLL, WELL, toneText } from '@quorum/ui/game/bits'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'

/* The view content and children these helpers pass around. */
type Content = View.Content<Message>
type Child = View.Input<Message>
type Label = View.Content<Message> | string | false | null | undefined

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const PanelFocus = Mount.make('PanelFocus', {}, (element: HTMLElement) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const before =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
          element.focus()
          const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return
            const items = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)]
            const first = items[0]
            const last = items[items.length - 1]
            if (first === undefined || last === undefined) return
            if (
              event.shiftKey &&
              (document.activeElement === first || document.activeElement === element)
            ) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first.focus()
            }
          }
          element.addEventListener('keydown', onKeyDown)
          return () => {
            element.removeEventListener('keydown', onKeyDown)
            if (
              element.contains(document.activeElement) ||
              document.activeElement === document.body
            )
              before?.focus()
          }
        }),
        (cleanup) => Effect.sync(cleanup),
      )
      return yield* Effect.never
    }),
  ).pipe(Effect.as(Component.noop)),
)

const button = (
  h: H<Message>,
  config: Readonly<{
    onClick?: Message
    isDisabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
    key?: string
    attributes?: Readonly<Record<string, string | undefined>>
  }>,
  label: Label | ReadonlyArray<Label | Child>,
): Content => {
  const root = config.key === undefined ? h.button : h.button.key(config.key)
  const base = root
    .attr('type', config.type ?? 'button')
    .attr('tabindex', '0')
    .attr('aria-disabled', config.isDisabled ? 'true' : undefined)
    .attr('data-disabled', config.isDisabled ? '' : undefined)
    .class(buttonClass(config.variant, config.size), config.className)
    .attr('data-slot', 'button')
    .attrs(config.attributes ?? {})
  const clickable =
    config.onClick !== undefined && config.isDisabled !== true
      ? base.on('click', () => config.onClick)
      : base
  const inputs: ReadonlyArray<View.Input<Message>> = Array.isArray(label) ? label : [label]
  return clickable.children(...inputs)
}

const OVERLAY = cx(
  'modal-overlay',
  css({
    position: 'absolute',
    inset: '0',
    zIndex: '30',
    display: 'grid',
    placeItems: 'center',
    padding: '6',
    _compact: { padding: '0' },
    _short: {
      '[data-toast="on"] &': { paddingTop: '3rem !important' },
    },
  }),
)

const DIALOG = css({
  display: 'flex',
  maxHeight: '100%',
  width: '100%',
  flexDirection: 'column',
  overflow: 'hidden',
  outlineStyle: 'none',
  _compact: {
    height: '100%',
    maxHeight: 'none',
    maxWidth: 'none',
    borderRadius: '0',
    paddingBottom: 'env(safe-area-inset-bottom)',
    boxShadow: 'none',
  },
})

const SHELL_HEAD = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4',
  paddingInline: '5',
  paddingTop: '4',
  paddingBottom: '3',
  _compact: {
    paddingInline: '4',
    paddingTop: 'max(12px,env(safe-area-inset-top))',
  },
})

const SHELL_TITLE = css({
  fontSize: 'type.17',
  fontWeight: 'semibold',
  letterSpacing: 'tight',
})

const SHELL_TOOLS = css({ display: 'flex', alignItems: 'center', gap: '3' })

const SHELL_CLOSE = css({
  color: 'mutedForeground',
  _compact: {
    width: '11',
    height: '11',
  },
})

/* The panel frame `components/lab/panels.ts` drew, hand-written for Effect UI. */
const shell = (
  h: H<Message>,
  t: Messages,
  title: string,
  right: ReadonlyArray<Child>,
  body: ReadonlyArray<Child>,
  width: string,
): Content =>
  h.div
    .attr('data-exit', 'gesture')
    .class(OVERLAY)
    .children(
      h.div
        .key(title)
        .attr('role', 'dialog')
        .attr('aria-modal', 'true')
        .attr('aria-label', title)
        .attr('tabindex', '-1')
        .onMount(PanelFocus({}))
        .class(cx(DIALOG, width, FLOAT, 'enter-modal'))
        .children(
          h.div.class(SHELL_HEAD).children(
            h.span.class(SHELL_TITLE).children(title),
            h.div.class(SHELL_TOOLS).children(
              ...right,
              button(
                h,
                {
                  onClick: Message.PanelClosed(),
                  variant: 'ghost',
                  size: 'icon',
                  className: SHELL_CLOSE,
                  attributes: { 'aria-label': t.panels.closeEsc },
                },
                icon(h, X, css({ width: '4', height: '4' })),
              ),
            ),
          ),
          ...body,
        ),
    )

const fixOf = (h: H<Message>, game: Game, entry: ChurnRow): Content => {
  const t = copy(h)
  const apply = (kind: 'region' | 'research' | 'node', label: string, target: string): Content =>
    button(
      h,
      {
        onClick: Message.ChurnFixTaken({ fix: kind, target }),
        variant: 'outline',
        size: 'sm',
        className: css({
          justifySelf: 'start',
        }),
      },
      label,
    )

  return ChurnFix.match(entry.fix, {
    advice: () =>
      h.span
        .class(
          css({
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(entry.cause === 'far' ? '' : t.churn.fixes[entry.cause]),
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
  h: H<Message>,
  game: Game,
  entry: ChurnRow,
  widest: number,
  fixed: boolean,
): Content => {
  const t = copy(h)

  const detail = detailOf(t, game, entry)
  return h.div.key(`${entry.kind}:${entry.cause}`).children(
    rowGrid(h, game, entry, widest, fixed),
    ...(detail === ''
      ? []
      : [
          h.div
            .class(
              cx(
                css({
                  paddingInline: '3',
                  paddingBottom: '1',
                  fontSize: 'type.11-5',
                  color: 'mutedForeground',
                }),
                !entry.needed &&
                  css({
                    opacity: 0.6,
                  }),
              ),
            )
            .children(detail),
        ]),
  )
}

const rowGrid = (
  h: H<Message>,
  game: Game,
  entry: ChurnRow,
  widest: number,
  fixed: boolean,
): Content => {
  const t = copy(h)
  return h.div
    .class(
      cx(
        css({
          display: 'grid',
          gridTemplateColumns: '88px 80px 1fr 44px minmax(0,180px)',
          alignItems: 'center',
          gap: '3',
          paddingInline: '3',
          paddingBlock: '1.5',
          _compact: {
            gridTemplateColumns: '72px 64px 1fr 40px',
          },
        }),
        !entry.needed &&
          css({
            opacity: 0.6,
          }),
      ),
    )
    .children(
      h.span
        .class(
          css({
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'type.12-5',
            fontWeight: 'medium',
          }),
        )
        .children(t.catalog.kinds[entry.kind].label),
      h.span
        .class(
          cx(
            css({
              fontSize: 'type.12',
            }),
            entry.cause === 'slow' || entry.cause === 'far'
              ? css({
                  color: 'warn',
                })
              : css({
                  color: 'danger',
                }),
          ),
        )
        .children(t.churn.causes[entry.cause]),
      h.div
        .class(
          css({
            height: '1.5',
            borderRadius: 'full',
            backgroundColor: 'muted',
          }),
        )
        .attr(
          'title',
          entry.p99 === null
            ? ''
            : `p99 ${formats(t).ms(entry.p99)} · T ${formats(t).ms(entry.target)}`,
        )
        .children(
          h.div
            .class(
              cx(
                css({
                  height: '100%',
                  borderRadius: 'full',
                }),
                entry.needed
                  ? css({
                      backgroundColor: 'danger',
                    })
                  : css({
                      backgroundColor: 'mutedForeground',
                    }),
              ),
            )
            .style({ width: `${Math.max(4, (entry.points / widest) * 100)}%` })
            .children(),
        ),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              textAlign: 'right',
              fontSize: 'type.12',
            }),
          ),
        )
        .children(entry.points.toFixed(3)),
      h.div
        .class(
          css({
            _compact: {
              gridColumn: 'span 4 / span 4',
            },
          }),
        )
        .children(...(fixed ? [fixOf(h, game, entry)] : [])),
    )
}

const section = (h: H<Message>, game: Game, region: RegionChurn): Content => {
  const t = copy(h)

  const falling = region.perHour < 0
  const share = region.users > 0 ? (region.perHour / region.users) * 100 : 0
  const widest = region.rows.reduce((most, entry) => Math.max(most, entry.points), 0.001)
  return h.section
    .key(region.region)
    .class(
      cx(
        css({
          display: 'flex',
          flexDirection: 'column',
          paddingBlock: '1',
        }),
        WELL,
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            columnGap: '4',
            rowGap: '1',
            paddingInline: '3',
            paddingTop: '2',
            paddingBottom: '1.5',
          }),
        )
        .children(
          h.span
            .class(
              css({
                fontSize: 'type.14',
                fontWeight: 'semibold',
              }),
            )
            .children(t.catalog.regionInfo[region.region].name),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.12-5',
                }),
              ),
            )
            .children(t.churn.users(compact(region.users))),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.12-5',
                }),
                toneText(region.now >= region.target ? 'ok' : 'danger'),
              ),
            )
            .children(t.churn.apdex(region.now.toFixed(2), region.target.toFixed(2))),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.12-5',
                }),
                toneText(falling ? 'danger' : 'ok'),
              ),
            )
            .children(t.units.perHour(`${share >= 0 ? '+' : '−'}${Math.abs(share).toFixed(1)}%`)),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  marginLeft: 'auto',
                  fontSize: 'type.12-5',
                  color: 'mutedForeground',
                }),
              ),
            )
            .children(t.churn.n1Day(compact(region.inADay))),
        ),
      ...region.rows.map((entry, index) =>
        row(
          h,
          game,
          entry,
          widest,
          entry.needed &&
            region.rows.findIndex(
              (other) => JSON.stringify(other.fix) === JSON.stringify(entry.fix),
            ) === index,
        ),
      ),
    )
}

const cached = perSecond<ReadonlyArray<RegionChurn>>()

export const churnPanel = (h: H<Message>, model: Model): View.Input<Message> => {
  if (model.panel !== 'churn') return undefined
  const localized = speak(model.prefs.locale, h)
  const t = copy(localized)

  const game = model.board.game
  const regions = cached(game, '', () => churnOf(game, ledgerOf(model)))
  return shell(
    localized,
    t,
    t.churn.whyUsersLeave,
    [],
    [
      localized.div
        .class(
          cx(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '3',
              paddingInline: '5',
              paddingTop: '1',
              paddingBottom: '5',
            }),
            SCROLL,
          ),
        )
        .children(...regions.map((region) => section(localized, game, region))),
    ],
    css({ maxWidth: '720px' }),
  )
}
