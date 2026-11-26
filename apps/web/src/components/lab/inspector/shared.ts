import { css, cx } from '@quorum/styled-system/css'
import { copy, localized, nodeLabelIn, nodeTitle, type Messages } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { ChevronRight } from 'lucide'
import {
  COMPONENTS,
  FRAMEWORKS,
  PM_MODES,
  POOL_LIMITS,
  OS_RAM,
  RUNTIMES,
  SIZES,
  type RuntimeId,
  DB_ENGINES,
} from '@quorum/simulation/catalog'
import { openRegions } from '@quorum/simulation/regions'
import type { Ledger, NodeLedger } from '@quorum/simulation/ledger'
import { engineOf, has, ramOf } from '@quorum/simulation/lookups'
import type { DbEngine, Game, GameLink, GameNode, PmMode, Service } from '@quorum/simulation/state'
import { serviceOfNode } from '@quorum/simulation/work'
import { Message } from '@/game/message.ts'
import { POOL_SLIDER_STEPS, poolFromSlider, sliderFromPool } from '@/game/pool-scale.ts'
import * as Slider from '@quorum/ui/primitives/slider'
import type { Model } from '@/game/model.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { button } from '@quorum/ui/primitives/button'
import { EYEBROW, FIGURE, WELL_STYLE } from '@quorum/ui/game/bits'
import { frameworkPickerView, runtimePickerView } from './stack-picker.ts'

export type PanelContext = Readonly<{
  model: Model
  game: Game
  node: GameNode
  ledger: Ledger
  h: HtmlBuilder<Message>
}>

export type Panel = Readonly<{
  stats?: (
    context: Omit<PanelContext, 'model'> & Readonly<{ own: NodeLedger }>,
  ) => ReadonlyArray<Html>
  top?: (context: PanelContext) => ReadonlyArray<Html>
  body?: (context: PanelContext) => ReadonlyArray<Html>
  late?: (context: PanelContext) => ReadonlyArray<Html>
}>

export const section = (
  title: string,
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
  open = false,
) =>
  h.details(
    [
      h.Key(title),
      ...(open ? [h.Attribute('open', '')] : []),
      h.Class(
        cx(
          css({
            paddingInline: '4',
          }),
          'fold',
          'group',
        ),
      ),
    ],
    [
      h.summary(
        [
          h.Class(
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
          ),
        ],
        [
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
          h.span([h.Class(EYEBROW)], [title]),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '2',
              paddingBottom: '3',
            }),
          ),
        ],
        children,
      ),
    ],
  )

export const segmented = (
  columns: string,
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [
      h.Class(
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
      ),
    ],
    children,
  )

export const choice = (
  key: string,
  selected: boolean,
  ready: boolean,
  message: Message,
  children: ReadonlyArray<Html | string>,
  title: string,
  h: HtmlBuilder<Message>,
  hover?: Message,
) =>
  h.button(
    [
      h.Key(key),
      h.Type('button'),
      h.Title(title),
      h.Disabled(!ready),
      h.AriaPressed(selected ? 'true' : 'false'),
      h.OnClick(message),
      ...(hover && !selected && ready
        ? [h.OnMouseEnter(hover), h.OnMouseLeave(Message.OptionLeft())]
        : []),
      h.Class(
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
      ),
    ],
    children,
  )

const COLUMNS: Record<number, string> = {
  2: css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }),
  3: css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
  4: css({ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }),
  5: css({ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }),
}

export const picker = <T extends string | number | boolean>(
  key: string,
  values: ReadonlyArray<readonly [T, string]>,
  current: T,
  message: (value: T) => Message,
  h: HtmlBuilder<Message>,
  ready: (value: T) => boolean = () => true,
  columns = COLUMNS[values.length] ?? css({ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }),
): Html =>
  segmented(
    columns,
    values.map(([value, label]) =>
      choice(
        `${key}-${String(value)}`,
        value === current,
        ready(value),
        message(value),
        [
          h.span(
            [
              h.Class(
                css({
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }),
              ),
            ],
            [label],
          ),
        ],
        label,
        h,
      ),
    ),
    h,
  )

export const smallButton = (
  label: string,
  glyph: Parameters<typeof icon>[1],
  message: Message,
  enabled: boolean,
  h: HtmlBuilder<Message>,
) =>
  button(
    {
      onClick: message,
      isDisabled: !enabled,
      variant: 'outline',
      size: 'icon-sm',
      attributes: [h.AriaLabel(label), h.Title(label)],
    },
    icon(
      h,
      glyph,
      css({
        width: '3.5',
        height: '3.5',
      }),
    ),
    h,
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
  h: HtmlBuilder<Message>,
): Html => {
  const choose = (workers: number) => Message.WorkersChosen({ nodeId: node.id, workers })
  const shown = model.poolDraft === null ? node.workers : poolFromSlider(model.poolDraft)
  const position = model.poolDraft ?? sliderFromPool(node.workers)
  const over = shown > fit
  const fitFraction = Math.min(
    1,
    sliderFromPool(Math.max(POOL_LIMITS.min, fit)) / POOL_SLIDER_STEPS,
  )
  return h.div(
    [h.Class(css({ display: 'flex', flexDirection: 'column', gap: '2' }))],
    [
      h.div(
        [h.Class(css({ display: 'flex', alignItems: 'center', gap: '2' }))],
        [
          h.div(
            [h.Class(css({ flex: '1 1 0%', minWidth: '0' }))],
            [
              h.submodel({
                slotId: 'pool',
                model: model.poolSlider,
                view: Slider.view,
                toParentMessage: (message) => Message.PoolSliderChanged({ message }),
                viewInputs: {
                  value: position,
                  ariaLabel: t.inspectorShared.poolSize,
                  formatValue: (value) => String(poolFromSlider(value)),
                  toView: (attributes) =>
                    h.div(
                      [
                        ...attributes.root,
                        h.Class(css({ position: 'relative', height: '8', width: '100%' })),
                      ],
                      [
                        h.div(
                          [
                            ...attributes.track,
                            h.Class(css({ height: '5', width: '100%', cursor: 'pointer' })),
                          ],
                          [
                            h.div(
                              [
                                h.Class(
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
                                ),
                              ],
                              [
                                h.div([
                                  h.Style({ width: `${fitFraction * 100}%` }),
                                  h.Class(css({ backgroundColor: 'primary', opacity: '0.45' })),
                                ]),
                                h.div([
                                  h.Class(
                                    css({
                                      flex: '1 1 0%',
                                      backgroundColor: 'danger',
                                      opacity: '0.35',
                                    }),
                                  ),
                                ]),
                              ],
                            ),
                          ],
                        ),
                        ...POOL_TICKS.map((tick) =>
                          h.span(
                            [
                              h.Style({
                                left: `${(sliderFromPool(tick) / POOL_SLIDER_STEPS) * 100}%`,
                              }),
                              h.Class(
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
                              ),
                            ],
                            [String(tick)],
                          ),
                        ),
                        ...(fit >= POOL_LIMITS.min
                          ? [
                              h.span([
                                h.AriaHidden(true),
                                h.Style({ left: `${fitFraction * 100}%` }),
                                h.Class(
                                  css({
                                    position: 'absolute',
                                    top: '1',
                                    width: '0.5',
                                    height: '3.5',
                                    backgroundColor: 'foreground',
                                    borderRadius: 'full',
                                    pointerEvents: 'none',
                                  }),
                                ),
                              ]),
                            ]
                          : []),
                        h.div([
                          ...attributes.thumb,
                          h.Class(cx(Slider.sliderThumbClass, css({ top: '0.5' }))),
                        ]),
                      ],
                    ),
                },
              }),
            ],
          ),
          h.input([
            h.Key(`${node.id}-pool-${shown}`),
            h.Type('number'),
            h.Min(String(POOL_LIMITS.min)),
            h.Max(String(POOL_LIMITS.max)),
            h.Step('1'),
            h.Attribute('value', String(shown)),
            h.AriaLabel(t.inspectorShared.workerCount),
            h.Class(
              cx(
                FIGURE,
                css(WELL_STYLE, {
                  width: '16',
                  height: '7',
                  textAlign: 'center',
                  fontSize: 'type.13',
                }),
              ),
            ),
            h.OnChange((value) =>
              choose(Number.isFinite(Number(value)) ? Number(value) : node.workers),
            ),
          ]),
        ],
      ),
      h.div(
        [h.Class(css({ display: 'flex', alignItems: 'center', gap: '2' }))],
        [
          button(
            {
              onClick: choose(Math.max(POOL_LIMITS.min, fit)),
              isDisabled: fit < POOL_LIMITS.min || node.workers === fit,
              variant: 'outline',
              size: 'sm',
            },
            [t.inspectorShared.fitWorkers],
            h,
          ),
          h.span(
            [
              h.Class(
                cx(
                  css({ marginLeft: 'auto', fontSize: 'type.11-5' }),
                  FIGURE,
                  over ? css({ color: 'danger' }) : css({ color: 'mutedForeground' }),
                ),
              ),
            ],
            [t.inspectorShared.rAMFits(fit)],
          ),
        ],
      ),
    ],
  )
}

export const stack = (
  model: Model,
  node: GameNode,
  h: HtmlBuilder<Message>,
  reviewingRuntime: RuntimeId | null,
  pool = true,
): ReadonlyArray<Html> => {
  const t = copy(h)
  const game = model.board.game

  const runtime = localized(RUNTIMES[node.runtime], t.catalog.runtimes[node.runtime])
  const fit = Math.max(
    0,
    Math.floor(
      ((ramOf(node) - OS_RAM - (node.localDb ? 1 : 0)) * 1024) /
        (runtime.memoryMb + FRAMEWORKS[node.framework].memoryMb),
    ),
  )
  return [
    section(
      t.inspectorShared.runtime,
      [
        runtimePickerView(model, node, h, reviewingRuntime),
        h.p(
          [
            h.Class(
              css({
                fontSize: 'type.12',
                lineHeight: 'snug',
                color: 'mutedForeground',
              }),
            ),
          ],
          [runtime.blurb],
        ),
      ],
      h,
      reviewingRuntime !== null,
    ),
    ...(pool && runtime.pool
      ? [section(t.inspectorShared.poolSize, [poolControl(model, node, fit, t, h)], h)]
      : []),
    section(
      t.inspectorShared.framework,
      [
        frameworkPickerView(model, node, h),
        h.p(
          [
            h.Class(
              css({
                fontSize: 'type.12',
                lineHeight: 'snug',
                color: 'mutedForeground',
              }),
            ),
          ],
          [t.catalog.frameworks[node.framework].blurb],
        ),
      ],
      h,
    ),
    ...(node.runtime === 'php_fpm'
      ? [
          section(
            t.inspectorShared.processManager,
            [
              picker(
                'pm',
                (Object.keys(PM_MODES) as ReadonlyArray<PmMode>).map(
                  (pm) => [pm, t.catalog.pmModes[pm].label] as const,
                ),
                node.pm,
                (pm) => Message.PmChosen({ nodeId: node.id, pm }),
                h,
              ),
            ],
            h,
          ),
        ]
      : []),
    ...(RUNTIMES[node.runtime].persistent
      ? [
          section(
            t.inspectorShared.recycleWorkers,
            [
              picker(
                'recycle',
                [
                  [false, t.inspectorShared.off],
                  [true, t.inspectorShared.everyFewHours],
                ],
                node.recycle,
                (recycle) => Message.RecycleChosen({ nodeId: node.id, recycle }),
                h,
              ),
              h.p(
                [
                  h.Class(
                    css({
                      fontSize: 'type.12',
                      lineHeight: 'snug',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [t.inspectorShared.pmMaxRequestsAndWorkerKillers],
              ),
            ],
            h,
          ),
        ]
      : []),
    ...(has(game, 'gzip')
      ? [
          section(
            t.inspectorShared.compression,
            [
              picker(
                'gzip',
                [
                  [false, t.inspectorShared.off],
                  [true, 'Gzip'],
                ],
                node.compress,
                (compress) => Message.CompressionChosen({ nodeId: node.id, compress }),
                h,
              ),
            ],
            h,
          ),
        ]
      : []),
  ]
}

export const serviceOwnership = (
  game: Game,
  node: GameNode,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const t = copy(h)
  return game.services.length < 2
    ? []
    : [
        section(
          t.inspectorShared.service,
          [
            picker(
              'service',
              game.services.map((service) => [service.id, serviceNameIn(t, service)] as const),
              serviceOfNode(game, node).id,
              (serviceId) => Message.ServiceAssigned({ nodeId: node.id, serviceId }),
              h,
            ),
          ],
          h,
          true,
        ),
      ]
}

export const nodeLink = (
  game: Game,
  node: GameNode,
  h: HtmlBuilder<Message>,
  className = '',
): Html => {
  const t = copy(h)

  const label = nodeLabelIn(t, game, node)
  return h.button(
    [
      h.Type('button'),
      h.OnClick(Message.RevealNode({ nodeId: node.id })),
      h.AriaLabel(t.inspectorShared.openNode(nodeTitle(t, game, node))),
      h.Class(
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
            }),
          ),
        ],
        [label.name, ...(label.ordinal > 0 ? [` ${label.ordinal}`] : [])],
      ),
      icon(
        h,
        ChevronRight,
        css({
          width: '3.5',
          height: '3.5',
          flexShrink: '0',
        }),
      ),
    ],
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

export const caption = (text: string, h: HtmlBuilder<Message>): Html =>
  h.span(
    [
      h.Class(
        css({
          fontSize: 'type.12',
          fontWeight: 'medium',
          color: 'mutedForeground',
        }),
      ),
    ],
    [text],
  )

export const engine = (node: GameNode, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return section(
    t.inspectorShared.engine,
    [
      picker(
        'db-engine',
        (Object.keys(DB_ENGINES) as ReadonlyArray<DbEngine>).map(
          (id) => [id, DB_ENGINES[id].name] as const,
        ),
        node.dbEngine,
        (dbEngine) => Message.DbEngineChosen({ nodeId: node.id, dbEngine }),
        h,
        () => true,
        css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }),
      ),
      caption(
        node.dbEngine === 'postgres'
          ? t.inspectorShared.enginePostgres
          : t.inspectorShared.engineMysql,
        h,
      ),
    ],
    h,
  )
}

export const replicaEngine = (game: Game, node: GameNode, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const engine = engineOf(game, node)
  return section(
    t.inspectorShared.engine,
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '2',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'type.12',
                  fontWeight: 'medium',
                  color: 'foreground',
                }),
              ),
            ],
            [DB_ENGINES[engine].name],
          ),
        ],
      ),
      caption(t.inspectorReplica.runsThePrimaryEngine, h),
      caption(
        engine === 'postgres' ? t.inspectorShared.enginePostgres : t.inspectorShared.engineMysql,
        h,
      ),
    ],
    h,
  )
}

export const spreading = (
  game: Game,
  node: GameNode,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const t = copy(h)
  return openRegions(game).length < 2
    ? []
    : [
        section(
          t.inspectorShared.regions,
          [
            picker(
              'spread',
              [
                [false, t.inspectorShared.one],
                [true, t.inspectorShared.spread],
              ],
              node.spread,
              (spread) => Message.SpreadChosen({ nodeId: node.id, spread }),
              h,
            ),
          ],
          h,
        ),
      ]
}

export const splitting = (node: GameNode, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return section(
    t.inspectorShared.hotKeys,
    [
      picker(
        'split',
        [
          [false, t.inspectorShared.oneShard],
          [true, t.inspectorShared.split],
        ],
        node.split,
        (split) => Message.SplitChosen({ nodeId: node.id, split }),
        h,
      ),
    ],
    h,
  )
}

export const pinnedRuntime = (model: Model, node: GameNode) => {
  const card = model.board.tradeoff
  return card._tag === 'Pinned' && card.nodeId === node.id && card.option.kind === 'runtime'
    ? card.option.id
    : null
}

export const callout = (
  text: string,
  tone: 'danger' | 'warn',
  action: Html | null,
  h: HtmlBuilder<Message>,
  className = '',
) =>
  h.div(
    [
      h.Key(text),
      h.Class(
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
      ),
    ],
    [h.span([], [text]), ...(action ? [action] : [])],
  )
