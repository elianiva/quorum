import { css, cx } from '@quorum/styled-system/css'
import { copy, localized, nodeLabelIn, nodeTitle, type Messages } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { ChevronRight, Minus, Plus } from 'lucide'
import {
  COMPONENTS,
  FRAMEWORKS,
  PM_MODES,
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
import type { Model } from '@/game/model.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { button } from '@quorum/ui/primitives/button'
import { cn } from '@/lib/utils'
import { EYEBROW, FIGURE, WELL } from '@quorum/ui/game/bits'
import { frameworkPickerView, runtimePickerView } from './stack-picker.ts'

/** What a Component adds to its Node's Inspector, in the slots the panel has room for. */
export type PanelContext = Readonly<{
  model: Model
  game: Game
  node: GameNode
  ledger: Ledger
  h: HtmlBuilder<Message>
}>

export type Panel = Readonly<{
  /** The figures under "Live now"; the common figures show when absent. */
  stats?: (
    context: Omit<PanelContext, 'model'> & Readonly<{ own: NodeLedger }>,
  ) => ReadonlyArray<Html>
  top?: (context: PanelContext) => ReadonlyArray<Html>
  /** Sections after the instance type, before placement and region. */
  body?: (context: PanelContext) => ReadonlyArray<Html>
  /** Sections after placement and region, before the call settings. */
  late?: (context: PanelContext) => ReadonlyArray<Html>
}>

/**
 * A folded section: the title alone until opened. Once the player has opened or
 * closed it, the browser owns that state, so a re-render on every Step leaves
 * the section as they left it. `open` forces it open while it holds, as a
 * pinned Tradeoff card does; when it stops holding, the fold is the player's
 * again.
 */
export const section = (
  title: string,
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
  open = false,
) =>
  h.details(
    [
      h.Key(title),
      ...(open ? [h.Open(true)] : []),
      h.Class(
        cx(
          css({
            paddingInline: '1rem',
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
              gap: '0.375rem',
              paddingBlock: '0.625rem',
              _hover: {
                '&>span': {
                  color: 'var(--foreground)',
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
                width: '0.875rem',
                height: '0.875rem',
                flexShrink: '0',
                color: 'var(--muted-foreground)',
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
              gap: '0.5rem',
              paddingBottom: '0.75rem',
            }),
          ),
        ],
        children,
      ),
    ],
  )

/** A segmented control: options sunk in a well, the chosen one raised. */
export const segmented = (
  columns: string,
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [
      h.Class(
        cn(
          css({
            display: 'grid',
            gridAutoRows: 'fr',
            gap: '3px',
            padding: '3px',
          }),
          WELL,
          css({
            borderRadius: '11px',
          }),
          columns,
        ),
      ),
    ],
    children,
  )

/** One option in a segmented control. It grows when its label wraps, so a translation keeps the
 *  whole label instead of clipping it. */
export const choice = (
  key: string,
  selected: boolean,
  ready: boolean,
  message: Message,
  children: ReadonlyArray<Html | string>,
  title: string,
  h: HtmlBuilder<Message>,
  /** Hovering previews the option on a Tradeoff card. */
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
            minHeight: '2rem',
            minWidth: '0',
            alignItems: 'center',
            gap: '0.5rem',
            borderRadius: 'lg',
            paddingInline: '0.5rem',
            paddingBlock: '0.25rem',
            textAlign: 'left',
            fontSize: 'calc(12px*var(--type-scale))',
            fontWeight: '500',
            lineHeight: '1.25',
            transitionProperty:
              'color, background-color, border-color, text-decoration-color, fill, stroke',
            transitionDuration: '150ms',
            transitionTimingFunction: 'var(--ease-out)',
          }),
          selected
            ? 'bg-raised text-foreground shadow-raised'
            : ready
              ? 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
              : 'cursor-not-allowed text-muted-foreground/45 [&_svg]:opacity-45 [&_svg]:grayscale',
        ),
      ),
    ],
    children,
  )

export const COLUMNS: Record<number, string> = {
  2: css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }),
  3: css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
  4: css({ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }),
  5: css({ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }),
}

/** One option set as a segmented control: each value with its label. */
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
        width: '0.875rem',
        height: '0.875rem',
      }),
    ),
    h,
  )

/** A Service's name: the first Service is the Monolith, and the player names the rest. */
export const serviceNameIn = (t: Messages, service: Service): string =>
  service.id === 'monolith' ? t.inspectorShared.monolith : service.name

/** What a card calls a size: the instance size, or a step number for a flat Component. */
export const sizeLabelIn = (t: Messages, node: GameNode, size = node.size): string =>
  COMPONENTS[node.type].sized
    ? SIZES[size]
      ? t.nodeList.sizes[SIZES[size].name]
      : ''
    : t.nodeList.sizeStep(size)

export const percent = (value: number) => `${Math.round(value * 100)}%`

/** A share as a whole number, for a message that writes its own percent sign. */
export const percentNumber = (value: number) => Math.round(value * 100)

export const stack = (
  model: Model,
  node: GameNode,
  h: HtmlBuilder<Message>,
  reviewingRuntime: RuntimeId | null,
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
                fontSize: 'calc(12px*var(--type-scale))',
                lineHeight: '1.375',
                color: 'var(--muted-foreground)',
              }),
            ),
          ],
          [runtime.blurb],
        ),
      ],
      h,
      reviewingRuntime !== null,
    ),
    ...(runtime.pool
      ? [
          section(
            t.inspectorShared.poolSize,
            [
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }),
                  ),
                ],
                [
                  smallButton(
                    t.inspectorShared.fewerWorkers,
                    Minus,
                    Message.WorkersChosen({
                      nodeId: node.id,
                      workers: Math.max(1, Math.round(node.workers * 0.75)),
                    }),
                    node.workers > 1,
                    h,
                  ),
                  h.span(
                    [
                      h.Class(
                        cn(
                          FIGURE,
                          css({
                            width: '3rem',
                            textAlign: 'center',
                            fontSize: 'calc(13px*var(--type-scale))',
                          }),
                        ),
                      ),
                    ],
                    [String(node.workers)],
                  ),
                  smallButton(
                    t.inspectorShared.moreWorkers,
                    Plus,
                    Message.WorkersChosen({
                      nodeId: node.id,
                      workers: Math.max(node.workers + 1, Math.round(node.workers * 1.5)),
                    }),
                    true,
                    h,
                  ),
                  h.span(
                    [
                      h.Class(
                        cx(
                          css({
                            marginLeft: 'auto',
                          }),
                          FIGURE,
                          css({
                            fontSize: 'calc(11.5px*var(--type-scale))',
                          }),
                          node.workers > fit ? 'text-danger' : 'text-muted-foreground',
                        ),
                      ),
                    ],
                    [t.inspectorShared.rAMFits(fit)],
                  ),
                ],
              ),
            ],
            h,
          ),
        ]
      : []),
    section(
      t.inspectorShared.framework,
      [
        frameworkPickerView(model, node, h),
        h.p(
          [
            h.Class(
              css({
                fontSize: 'calc(12px*var(--type-scale))',
                lineHeight: '1.375',
                color: 'var(--muted-foreground)',
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
                      fontSize: 'calc(12px*var(--type-scale))',
                      lineHeight: '1.375',
                      color: 'var(--muted-foreground)',
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

/** The Service an App Server or Worker belongs to (08 "Ownership"); empty while there is one Service. */
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

/** A Node's name as a button that reveals it on the Board. */
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
        cn(
          css({
            display: 'flex',
            minWidth: '0',
            alignItems: 'center',
            gap: '0.25rem',
            textAlign: 'left',
            fontSize: '12px',
            fontWeight: '500',
            color: 'var(--muted-foreground)',
            _hover: {
              color: 'var(--foreground)',
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
          width: '0.875rem',
          height: '0.875rem',
          flexShrink: '0',
        }),
      ),
    ],
  )
}

/** The routing Links out of a Node, with the Node at the far end. */
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
          fontSize: 'calc(12px*var(--type-scale))',
          fontWeight: '500',
          color: 'var(--muted-foreground)',
        }),
      ),
    ],
    [text],
  )

/** A Database's engine (07 "Variants"). */
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

/** A Read Replica's engine: it runs the primary's, so it cannot be picked here (07 "Variants"). */
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
              gap: '0.5rem',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(12px*var(--type-scale))',
                  fontWeight: '500',
                  color: 'var(--foreground)',
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

/** A store that can replicate across the open regions. */
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

/** The runtime a pinned Tradeoff card asks this Node's Stack to show, if any. */
export const pinnedRuntime = (model: Model, node: GameNode) => {
  const card = model.board.tradeoff
  return card._tag === 'Pinned' && card.nodeId === node.id && card.option.kind === 'runtime'
    ? card.option.id
    : null
}
