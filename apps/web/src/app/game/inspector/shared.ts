import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import type { IconNode } from 'lucide'
import { ChevronRight, X } from 'lucide'
import { copy, nodeLabelIn, nodeTitle, type Messages } from '@/i18n/messages.ts'
import {
  COMPONENTS,
  FRAMEWORKS,
  PM_MODES,
  POOL_LIMITS,
  OS_RAM,
  RUNTIMES,
  SIZES,
  DB_ENGINES,
  type BuildGroup,
  type RuntimeId,
} from '@quorum/simulation/catalog'
import { GROUP_SHAPES, STACK_LOGOS, type StackLogoId } from '@quorum/ui/game/icons'
import { openRegions } from '@quorum/simulation/regions'
import type { Ledger, NodeLedger } from '@quorum/simulation/ledger'
import { engineOf, has, ramOf } from '@quorum/simulation/lookups'
import type { DbEngine, Game, GameLink, GameNode, PmMode, Service } from '@quorum/simulation/state'
import { serviceOfNode } from '@quorum/simulation/work'
import { Message } from '@/game/message.ts'
import { POOL_SLIDER_STEPS, poolFromSlider, sliderFromPool } from '@/game/pool-scale.ts'
import type { Model } from '@/game/model.ts'
import { EYEBROW, FIGURE, WELL_STYLE } from '@quorum/ui/game/bits'
import { icon } from '../../ui/icon.ts'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../../ui/button-styles.ts'
import { frameworkPickerView, runtimePickerView } from './stack-picker.ts'

export type Child = View.Input<Message>
export type Content = View.Content<Message>

export type PanelContext = Readonly<{
  model: Model
  game: Game
  node: GameNode
  ledger: Ledger
  h: H<Message>
}>

export type Panel = Readonly<{
  stats?: (
    context: Omit<PanelContext, 'model'> & Readonly<{ own: NodeLedger }>,
  ) => ReadonlyArray<Content>
  top?: (context: PanelContext) => ReadonlyArray<Content>
  body?: (context: PanelContext) => ReadonlyArray<Content>
  late?: (context: PanelContext) => ReadonlyArray<Content>
}>

export type ButtonConfig<M> = Readonly<{
  onClick?: M
  isDisabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  isAutofocus?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  attributes?: Readonly<Record<string, string | undefined>>
}>

/* A native button with
   `aria-disabled` and `data-disabled`, no click handler while disabled. */
export const button = <M>(
  h: H<M>,
  config: ButtonConfig<M>,
  label: ReadonlyArray<View.Input<M>> | View.Input<M>,
): View.Content<M> => {
  const base = h.button
    .attr('type', config.type ?? 'button')
    .attr('tabindex', '0')
    .attr('aria-disabled', config.isDisabled ? 'true' : undefined)
    .attr('data-disabled', config.isDisabled ? '' : undefined)
    .attr('autofocus', config.isAutofocus ? '' : undefined)
    .class(buttonClass(config.variant, config.size), config.className)
    .attr('data-slot', 'button')
    .attrs(config.attributes ?? {})
  const clickable =
    config.onClick !== undefined && config.isDisabled !== true
      ? base.on('click', () => config.onClick)
      : base
  const inputs = (Array.isArray(label) ? label : [label]) as ReadonlyArray<View.Input<M>>
  return clickable.children(...inputs)
}

export const closeButton = (
  h: H<Message>,
  config: Readonly<{ label: string; onClick: Message; className?: string }>,
): Content =>
  h.button
    .attr('type', 'button')
    .attr('aria-label', config.label)
    .attr('title', config.label)
    .on('click', () => config.onClick)
    .class(
      cx(
        css({
          position: 'absolute',
          top: '1.5',
          right: '1.5',
          zIndex: 10,
          display: 'grid',
          width: '7',
          height: '7',
          placeItems: 'center',
          borderRadius: 'lg',
          color: 'color-mix(in oklab, var(--muted-foreground) 80%, transparent)',
          _hover: { backgroundColor: 'well', color: 'foreground' },
          _focusVisible: {
            boxShadow: 'focus',
            outlineStyle: 'none',
          },
        }),
        config.className,
      ),
    )
    .children(icon(h, X, css({ width: '3.5', height: '3.5' })))

export const section = (
  h: H<Message>,
  title: string,
  children: ReadonlyArray<Child>,
  open = false,
): Content =>
  h.details
    .key(title)
    .attr('open', open ? '' : undefined)
    .class(css({ paddingInline: '4' }), 'fold', 'group')
    .children(
      h.summary
        .class(
          css({
            display: 'flex',
            cursor: 'pointer',
            listStyleType: 'none',
            alignItems: 'center',
            gap: '1.5',
            paddingBlock: '2.5',
            _hover: {
              '&>span': {
                color: 'foreground',
              },
            },
            '&::-webkit-details-marker': {
              display: 'none',
            },
          }),
        )
        .children(
          icon(
            h,
            ChevronRight,
            cx(
              css({
                width: '3.5',
                height: '3.5',
                flexShrink: '0',
                color: 'mutedForeground',
                '.group[open] &': {
                  rotate: '90deg',
                },
              }),
              'fold-chevron',
            ),
          ),
          h.span.class(EYEBROW).children(title),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '2',
            paddingBottom: '3',
          }),
        )
        .children(...children),
    )

export const segmented = (
  h: H<Message>,
  columns: string,
  children: ReadonlyArray<Child>,
): Content =>
  h.div
    .class(
      cx(
        css(
          {
            display: 'grid',
            gridAutoRows: 'fr',
            gap: '0.75',
            padding: '0.75',
          },
          WELL_STYLE,
          {
            borderRadius: 'lg',
          },
        ),
        columns,
      ),
    )
    .children(...children)

export const choice = (
  h: H<Message>,
  key: string,
  selected: boolean,
  ready: boolean,
  message: Message,
  children: ReadonlyArray<Child>,
  title: string,
  hover?: Message,
): Content => {
  const base = h.button
    .key(key)
    .attr('type', 'button')
    .attr('title', title)
    .attr('disabled', ready ? undefined : '')
    .attr('aria-pressed', selected ? 'true' : 'false')
    .on('click', () => message)
    .class(
      cx(
        css({
          display: 'flex',
          minHeight: '8',
          minWidth: '0',
          alignItems: 'center',
          gap: '2',
          borderRadius: 'lg',
          paddingInline: '2',
          paddingBlock: '1',
          textAlign: 'left',
          fontSize: 'type.12',
          fontWeight: 'medium',
          lineHeight: 'tight',
          transitionProperty:
            'color, background-color, border-color, text-decoration-color, fill, stroke',
          transitionDuration: 'fast',
          transitionTimingFunction: 'out',
        }),
        selected
          ? css({
              layerStyle: 'raised',
              color: 'foreground',
              boxShadow: 'raised',
            })
          : ready
            ? css({
                color: 'mutedForeground',
                _hover: {
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                  color: 'foreground',
                },
              })
            : css({
                cursor: 'not-allowed',
                color: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)',
                '& svg': { opacity: 0.45, filter: 'grayscale(100%)' },
              }),
      ),
    )
  const hoverable =
    hover !== undefined && !selected && ready
      ? base.on('mouseenter', () => hover).on('mouseleave', () => Message.OptionLeft())
      : base
  return hoverable.children(...children)
}

const COLUMNS: Record<number, string> = {
  2: css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }),
  3: css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
  4: css({ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }),
  5: css({ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }),
}

export const picker = <T extends string | number | boolean>(
  h: H<Message>,
  key: string,
  values: ReadonlyArray<readonly [T, string]>,
  current: T,
  message: (value: T) => Message,
  ready: (value: T) => boolean = () => true,
  columns = COLUMNS[values.length] ?? css({ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }),
): Content =>
  segmented(
    h,
    columns,
    values.map(([value, label]) =>
      choice(
        h,
        `${key}-${String(value)}`,
        value === current,
        ready(value),
        message(value),
        [
          h.span
            .class(
              css({
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center',
              }),
            )
            .children(label),
        ],
        label,
      ),
    ),
  )

export const smallButton = (
  h: H<Message>,
  label: string,
  glyph: IconNode,
  message: Message,
  enabled: boolean,
): Content =>
  button(
    h,
    {
      onClick: message,
      isDisabled: !enabled,
      variant: 'outline',
      size: 'icon-sm',
      attributes: { 'aria-label': label, title: label },
    },
    icon(h, glyph, css({ width: '3.5', height: '3.5' })),
  )

export const serviceNameIn = (t: Messages, service: Service): string =>
  service.id === 'monolith' ? t.inspectorShared.monolith : service.name

export const sizeLabelIn = (t: Messages, node: GameNode, size = node.size): string =>
  COMPONENTS[node.type].sized
    ? SIZES[size]
      ? t.nodeList.sizes[SIZES[size].name]
      : ''
    : t.nodeList.sizeStep(size)

export const percent = (value: number) => `${Math.round(value * 100)}%`

export const percentNumber = (value: number) => Math.round(value * 100)

const POOL_TICKS = [1, 10, 100, POOL_LIMITS.max] as const

const poolControl = (
  model: Model,
  node: GameNode,
  fit: number,
  t: Messages,
  h: H<Message>,
): Content => {
  const choose = (workers: number) => Message.WorkersChosen({ nodeId: node.id, workers })
  const shown = node.workers
  const position = sliderFromPool(node.workers)
  const over = shown > fit
  const fitFraction = Math.min(
    1,
    sliderFromPool(Math.max(POOL_LIMITS.min, fit)) / POOL_SLIDER_STEPS,
  )
  return h.div.class(css({ display: 'flex', flexDirection: 'column', gap: '2' })).children(
    h.div.class(css({ display: 'flex', alignItems: 'center', gap: '2' })).children(
      h.div.class(css({ flex: '1 1 0%', minWidth: '0' })).children(
        h.div
          .class(css({ position: 'relative', height: '8', width: '100%' }))
          .attr('data-slider-id', 'pool')
          .attr('data-orientation', 'horizontal')
          .attr('data-horizontal', '')
          .children(
            h.div
              .class(css({ height: '5', width: '100%', cursor: 'pointer' }))
              .attr('data-slider-track-id', 'pool')
              .attr('data-orientation', 'horizontal')
              .attr('data-horizontal', '')
              .style({ position: 'relative', touchAction: 'none' })
              .children(
                h.div
                  .class(
                    css({
                      position: 'absolute',
                      left: '0',
                      right: '0',
                      top: '1.5',
                      height: '2',
                      borderRadius: 'full',
                      overflow: 'hidden',
                      display: 'flex',
                      boxShadow: 'well',
                      pointerEvents: 'none',
                    }),
                  )
                  .children(
                    h.div
                      .style({ width: `${fitFraction * 100}%` })
                      .class(css({ backgroundColor: 'primary', opacity: '0.45' }))
                      .children(),
                    h.div
                      .class(
                        css({
                          flex: '1 1 0%',
                          backgroundColor: 'danger',
                          opacity: '0.35',
                        }),
                      )
                      .children(),
                  ),
                ...POOL_TICKS.map((tick) =>
                  h.span
                    .style({
                      left: `${(sliderFromPool(tick) / POOL_SLIDER_STEPS) * 100}%`,
                    })
                    .class(
                      cx(
                        FIGURE,
                        css({
                          position: 'absolute',
                          top: '5',
                          transform: 'translateX(-50%)',
                          fontSize: 'type.10',
                          color: 'mutedForeground',
                          pointerEvents: 'none',
                        }),
                      ),
                    )
                    .children(String(tick)),
                ),
                ...(fit >= POOL_LIMITS.min
                  ? [
                      h.span
                        .attr('aria-hidden', 'true')
                        .style({ left: `${fitFraction * 100}%` })
                        .class(
                          css({
                            position: 'absolute',
                            top: '1',
                            width: '0.5',
                            height: '3.5',
                            backgroundColor: 'foreground',
                            borderRadius: 'full',
                            pointerEvents: 'none',
                          }),
                        )
                        .children(),
                    ]
                  : []),
                h.div
                  .attr('id', 'pool-thumb')
                  .attr('role', 'slider')
                  .attr('tabindex', '0')
                  .attr('aria-orientation', 'horizontal')
                  .attr('aria-valuemin', '0')
                  .attr('aria-valuemax', String(POOL_SLIDER_STEPS))
                  .attr('aria-valuenow', String(position))
                  .attr('aria-valuetext', String(shown))
                  .attr('aria-label', t.inspectorShared.poolSize)
                  .style({
                    position: 'absolute',
                    left: `calc((100% - 0.75rem) * ${position / POOL_SLIDER_STEPS})`,
                    touchAction: 'none',
                  })
                  .class(css({ top: '0.5' }))
                  .children(),
                /* A native range
                         covers the track and reports the position. */
                h.input
                  .attr('type', 'range')
                  .attr('min', '0')
                  .attr('max', String(POOL_SLIDER_STEPS))
                  .attr('step', '1')
                  .value(String(position))
                  .attr('aria-label', t.inspectorShared.poolSize)
                  .style({
                    position: 'absolute',
                    inset: '0',
                    width: '100%',
                    opacity: '0',
                    cursor: 'pointer',
                  })
                  .on('input', ({ value }) => choose(poolFromSlider(Number(value)))),
              ),
          ),
      ),
      h.input
        .key(`${node.id}-pool-${shown}`)
        .attr('type', 'number')
        .attr('min', String(POOL_LIMITS.min))
        .attr('max', String(POOL_LIMITS.max))
        .attr('step', '1')
        .value(String(shown))
        .attr('aria-label', t.inspectorShared.workerCount)
        .class(
          cx(
            FIGURE,
            css(WELL_STYLE, {
              width: '16',
              height: '7',
              textAlign: 'center',
              fontSize: 'type.13',
            }),
          ),
        )
        .on('change', ({ value }) =>
          choose(Number.isFinite(Number(value)) ? Number(value) : node.workers),
        ),
    ),
    h.div.class(css({ display: 'flex', alignItems: 'center', gap: '2' })).children(
      button(
        h,
        {
          onClick: choose(Math.max(POOL_LIMITS.min, fit)),
          isDisabled: fit < POOL_LIMITS.min || node.workers === fit,
          variant: 'outline',
          size: 'sm',
        },
        [t.inspectorShared.fitWorkers],
      ),
      h.span
        .class(
          cx(
            css({ marginLeft: 'auto', fontSize: 'type.11-5' }),
            FIGURE,
            over ? css({ color: 'danger' }) : css({ color: 'mutedForeground' }),
          ),
        )
        .children(t.inspectorShared.rAMFits(fit)),
    ),
  )
}

export const stack = (
  model: Model,
  node: GameNode,
  h: H<Message>,
  reviewingRuntime: RuntimeId | null,
  pool = true,
): ReadonlyArray<Content> => {
  const t = copy(h)
  const game = model.board.game

  const runtime = { ...RUNTIMES[node.runtime], ...t.catalog.runtimes[node.runtime] }
  const fit = Math.max(
    0,
    Math.floor(
      ((ramOf(node) - OS_RAM - (node.localDb ? 1 : 0)) * 1024) /
        (runtime.memoryMb + FRAMEWORKS[node.framework].memoryMb),
    ),
  )
  return [
    section(
      h,
      t.inspectorShared.runtime,
      [
        runtimePickerView(model, node, h, reviewingRuntime),
        h.p
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(runtime.blurb),
      ],
      reviewingRuntime !== null,
    ),
    ...(pool && runtime.pool
      ? [section(h, t.inspectorShared.poolSize, [poolControl(model, node, fit, t, h)])]
      : []),
    section(h, t.inspectorShared.framework, [
      frameworkPickerView(model, node, h),
      h.p
        .class(
          css({
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(t.catalog.frameworks[node.framework].blurb),
    ]),
    ...(node.runtime === 'php_fpm'
      ? [
          section(h, t.inspectorShared.processManager, [
            picker(
              h,
              'pm',
              (Object.keys(PM_MODES) as ReadonlyArray<PmMode>).map(
                (pm) => [pm, t.catalog.pmModes[pm].label] as const,
              ),
              node.pm,
              (pm) => Message.PmChosen({ nodeId: node.id, pm }),
            ),
          ]),
        ]
      : []),
    ...(RUNTIMES[node.runtime].persistent
      ? [
          section(h, t.inspectorShared.recycleWorkers, [
            picker(
              h,
              'recycle',
              [
                [false, t.inspectorShared.off],
                [true, t.inspectorShared.everyFewHours],
              ],
              node.recycle,
              (recycle) => Message.RecycleChosen({ nodeId: node.id, recycle }),
            ),
            h.p
              .class(
                css({
                  fontSize: 'type.12',
                  lineHeight: 'snug',
                  color: 'mutedForeground',
                }),
              )
              .children(t.inspectorShared.pmMaxRequestsAndWorkerKillers),
          ]),
        ]
      : []),
    ...(has(game, 'gzip')
      ? [
          section(h, t.inspectorShared.compression, [
            picker(
              h,
              'gzip',
              [
                [false, t.inspectorShared.off],
                [true, 'Gzip'],
              ],
              node.compress,
              (compress) => Message.CompressionChosen({ nodeId: node.id, compress }),
            ),
          ]),
        ]
      : []),
  ]
}

export const serviceOwnership = (
  game: Game,
  node: GameNode,
  h: H<Message>,
): ReadonlyArray<Content> => {
  const t = copy(h)
  return game.services.length < 2
    ? []
    : [
        section(
          h,
          t.inspectorShared.service,
          [
            picker(
              h,
              'service',
              game.services.map((service) => [service.id, serviceNameIn(t, service)] as const),
              serviceOfNode(game, node).id,
              (serviceId) => Message.ServiceAssigned({ nodeId: node.id, serviceId }),
            ),
          ],
          true,
        ),
      ]
}

export const nodeLink = (game: Game, node: GameNode, h: H<Message>, className = ''): Content => {
  const t = copy(h)

  const label = nodeLabelIn(t, game, node)
  return h.button
    .attr('type', 'button')
    .on('click', () => Message.RevealNode({ nodeId: node.id }))
    .attr('aria-label', t.inspectorShared.openNode(nodeTitle(t, game, node)))
    .class(
      cx(
        css({
          display: 'flex',
          minWidth: '0',
          alignItems: 'center',
          gap: '1',
          textAlign: 'left',
          fontSize: 'type.12',
          fontWeight: 'medium',
          color: 'mutedForeground',
          _hover: {
            color: 'foreground',
          },
        }),
        className,
      ),
    )
    .children(
      h.span
        .class(
          css({
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }),
        )
        .children(label.name, ...(label.ordinal > 0 ? [` ${label.ordinal}`] : [])),
      icon(h, ChevronRight, css({ width: '3.5', height: '3.5', flexShrink: '0' })),
    )
}

export const outbound = (
  game: Game,
  node: GameNode,
): ReadonlyArray<readonly [GameLink, GameNode]> =>
  game.links.flatMap((link) => {
    const target = game.nodes.find((entry) => entry.id === link.to)
    return link.from === node.id && target && !COMPONENTS[target.type].tap
      ? [[link, target] as const]
      : []
  })

export const caption = (h: H<Message>, text: string): Content =>
  h.span
    .class(
      css({
        fontSize: 'type.12',
        fontWeight: 'medium',
        color: 'mutedForeground',
      }),
    )
    .children(text)

export const engine = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorShared.engine, [
    picker(
      h,
      'db-engine',
      (Object.keys(DB_ENGINES) as ReadonlyArray<DbEngine>).map(
        (id) => [id, DB_ENGINES[id].name] as const,
      ),
      node.dbEngine,
      (dbEngine) => Message.DbEngineChosen({ nodeId: node.id, dbEngine }),
      () => true,
      css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }),
    ),
    caption(
      h,
      node.dbEngine === 'postgres'
        ? t.inspectorShared.enginePostgres
        : t.inspectorShared.engineMysql,
    ),
  ])
}

export const replicaEngine = (game: Game, node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  const engine = engineOf(game, node)
  return section(h, t.inspectorShared.engine, [
    h.div
      .class(
        css({
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '2',
        }),
      )
      .children(
        h.span
          .class(
            css({
              fontSize: 'type.12',
              fontWeight: 'medium',
              color: 'foreground',
            }),
          )
          .children(DB_ENGINES[engine].name),
      ),
    caption(h, t.inspectorReplica.runsThePrimaryEngine),
    caption(
      h,
      engine === 'postgres' ? t.inspectorShared.enginePostgres : t.inspectorShared.engineMysql,
    ),
  ])
}

export const spreading = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)
  return openRegions(game).length < 2
    ? []
    : [
        section(h, t.inspectorShared.regions, [
          picker(
            h,
            'spread',
            [
              [false, t.inspectorShared.one],
              [true, t.inspectorShared.spread],
            ],
            node.spread,
            (spread) => Message.SpreadChosen({ nodeId: node.id, spread }),
          ),
        ]),
      ]
}

export const splitting = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorShared.hotKeys, [
    picker(
      h,
      'split',
      [
        [false, t.inspectorShared.oneShard],
        [true, t.inspectorShared.split],
      ],
      node.split,
      (split) => Message.SplitChosen({ nodeId: node.id, split }),
    ),
  ])
}

export const pinnedRuntime = (model: Model, node: GameNode) => {
  const card = model.board.tradeoff
  return card._tag === 'Pinned' && card.nodeId === node.id && card.option.kind === 'runtime'
    ? card.option.id
    : null
}

export const callout = (
  h: H<Message>,
  text: string,
  tone: 'danger' | 'warn',
  action: Content | null,
  className = '',
): Content =>
  h.div
    .key(text)
    .class(
      cx(
        css({
          marginInline: '4',
          marginBottom: '3',
          display: 'flex',
          flexDirection: 'column',
          gap: '2',
          borderRadius: 'xl',
          paddingInline: '3',
          paddingBlock: '2.5',
          fontSize: 'type.12',
          lineHeight: 'snug',
        }),
        tone === 'danger'
          ? css({
              backgroundColor: 'color-mix(in oklab, var(--danger) 8%, transparent)',
              color: 'danger',
              boxShadow: 'dangerLineInset',
            })
          : css({
              backgroundColor: 'color-mix(in oklab, var(--warn) 10%, transparent)',
              color: 'warn',
              boxShadow: 'warnLine',
            }),
        className,
      ),
    )
    .children(h.span.children(text), ...(action ? [action] : []))

export type Tone = 'plain' | 'ok' | 'warn' | 'danger'

export const toneText = (tone: Tone): string =>
  ({
    plain: css({ color: 'foreground' }),
    ok: css({ color: 'ok' }),
    warn: css({ color: 'warn' }),
    danger: css({ color: 'danger' }),
  })[tone]

export const row = (h: H<Message>, name: string, value: string, tone: Tone): Content =>
  h.div
    .key(name)
    .class(
      css({
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '3',
        paddingInline: '3',
        paddingBlock: '1.5',
      }),
    )
    .children(
      h.span.class(css({ fontSize: 'type.12-5', color: 'mutedForeground' })).children(name),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              fontSize: 'type.12',
              whiteSpace: 'nowrap',
            }),
            toneText(tone),
          ),
        )
        .children(value),
    )

export const meter = (h: H<Message>, share: number, fill: string): Content =>
  h.div
    .class(
      css({
        height: '1.5',
        overflow: 'hidden',
        borderRadius: 'full',
        backgroundColor: 'well',
        boxShadow: 'well',
      }),
    )
    .children(
      h.div
        .class(
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
        )
        .style({
          transform: `translateX(${(Math.max(0, Math.min(1, share)) - 1) * 100}%)`,
        })
        .children(),
    )

const GROUP_TEXT: Record<BuildGroup, string> = {
  edge: css({ color: 'groupEdge' }),
  compute: css({ color: 'groupCompute' }),
  data: css({ color: 'groupData' }),
  ops: css({ color: 'groupOps' }),
}

const GLYPH_SCALE: Record<'hexagon' | 'chip' | 'disc' | 'diamond', number> = {
  hexagon: 0.5,
  chip: 0.48,
  disc: 0.52,
  diamond: 0.42,
}

const CHIP_PINS = [7.5, 12, 16.5].flatMap((at) => [
  [0.5, at - 0.9, 3.5, 1.8],
  [20, at - 0.9, 3.5, 1.8],
  [at - 0.9, 0.5, 1.8, 3.5],
  [at - 0.9, 20, 1.8, 3.5],
])

type GroupShape = 'hexagon' | 'chip' | 'disc' | 'diamond'

const shapeOf = (shape: GroupShape, h: H<Message>): ReadonlyArray<Content> => {
  const soft = {
    fill: 'currentColor',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linejoin': 'round',
  }
  switch (shape) {
    case 'hexagon':
      return [
        h.polygon
          .attr('points', '12,1.5 21.1,6.75 21.1,17.25 12,22.5 2.9,17.25 2.9,6.75')
          .attrs(soft)
          .children(),
      ]
    case 'diamond':
      return [h.polygon.attr('points', '12,1.5 22.5,12 12,22.5 1.5,12').attrs(soft).children()]
    case 'chip':
      return [
        ...CHIP_PINS.map(([x = 0, y = 0, w = 0, ht = 0]) =>
          h.rect
            .attr('x', String(x))
            .attr('y', String(y))
            .attr('width', String(w))
            .attr('height', String(ht))
            .attr('rx', '0.6')
            .attr('fill', 'currentColor')
            .attr('opacity', '0.75')
            .children(),
        ),
        h.rect
          .attr('x', '3.5')
          .attr('y', '3.5')
          .attr('width', '17')
          .attr('height', '17')
          .attr('rx', '3')
          .attr('fill', 'currentColor')
          .children(),
      ]
    case 'disc':
      return [
        h.circle
          .attr('cx', '12')
          .attr('cy', '12')
          .attr('r', '11')
          .attr('fill', 'currentColor')
          .children(),
      ]
  }
}

export type BadgeContent = IconNode | Readonly<{ path: string }>

export const groupBadge = (
  group: BuildGroup,
  content: BadgeContent,
  className: string,
  h: H<Message>,
  muted = false,
  color?: string,
): Content => {
  const shape = GROUP_SHAPES[group]
  const scale = GLYPH_SCALE[shape]
  const offset = 12 - 12 * scale
  const glyph = color && !muted ? 'white' : 'onGroup'
  return h.svg
    .attr('aria-hidden', 'true')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', '0 0 24 24')
    .class(
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
    )
    .style(color && !muted ? { color } : {})
    .children(
      ...shapeOf(shape, h),
      h.g
        .attr('transform', `translate(${offset} ${offset}) scale(${scale})`)
        .children(
          'path' in content
            ? h.g
                .class(css({ color: glyph }))
                .children(h.path.attr('d', content.path).attr('fill', 'currentColor').children())
            : icon(h, content, css({ width: '6', height: '6', color: glyph })),
        ),
    )
}

export const stackLogo = (id: StackLogoId, className: string, h: H<Message>): Content => {
  const logo = STACK_LOGOS[id]
  return h.svg
    .attr('aria-hidden', 'true')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', '0 0 24 24')
    .class(
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
    )
    .children(
      h.path
        .attr('d', logo.path)
        .attr('fill', logo.color ?? 'currentColor')
        .children(),
    )
}
