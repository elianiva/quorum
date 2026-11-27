import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect } from 'effect'
import { X } from 'lucide'
import {
  IAC_TOOLS,
  IAC_TOOL_INFO,
  MIRROR_TIME_MINUTES,
  OPEN_REGION_PRICE,
  REGIONS,
  SIZES,
  type DataPatternId,
  type RegionId,
} from '@quorum/simulation/catalog'
import { eraOf, has } from '@quorum/simulation/lookups'
import {
  applyCost,
  driftOf,
  mirrorOf,
  mirrorsOf,
  overridable,
  patternsFor,
  previewApply,
  switchLeft,
  toolOf,
  Change,
  type Drift,
  type Managed,
} from '@quorum/simulation/mirror'
import { isApplying } from '@quorum/simulation/mirror-machine'
import { openRegions } from '@quorum/simulation/regions'
import { solveFlow } from '@quorum/simulation/solve'
import type { Game, Mirror } from '@quorum/simulation/state'
import { money } from '@quorum/ui/game/format'
import { perSecond } from '@/game/per-second.ts'
import { copy, nodeTitle, speak, type Messages } from '@/i18n/messages.ts'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'
import { EYEBROW, FIGURE, FLOAT, SCROLL, WELL, WELL_STYLE } from '@quorum/ui/game/bits'
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

const fieldLabelOf = (t: Messages): Record<Managed, string> => ({
  size: t.mirror.fieldSize,
  family: t.mirror.family,
  runtime: t.mirror.runtime,
  framework: t.mirror.framework,
  workers: t.mirror.workers,
  compress: t.mirror.compression,
  recycle: t.mirror.recycleWorkers,
  sampleRate: t.mirror.sampleRate,
  retention: t.mirror.retention,
  policy: t.mirror.policy,
  checkEvery: t.mirror.healthCheck,
  deepCheck: t.mirror.deepCheck,
  ttl: 'TTL',
  pm: t.mirror.processManager,
  engine: t.mirror.engine,
  dbEngine: t.mirror.databaseEngine,
  topology: t.mirror.databaseTopology,
  iops: t.mirror.volume,
  shards: t.mirror.shards,
  storageClass: t.mirror.storageClass,
  keep: t.mirror.retention,
  lifecycle: t.mirror.lifecycle,
  cacheStrategy: t.mirror.cacheStrategy,
  refresh: t.mirror.searchRefresh,
  sticky: t.mirror.stickySessions,
  slowStart: t.mirror.slowStart,
  purge: t.mirror.purgeOnDeploy,
  cacheKey: t.mirror.cacheKey,
  earlyExpiry: t.mirror.earlyExpiration,
  swr: t.mirror.staleWhileRevalidate,
  shardKey: t.mirror.shardKey,
  sync: t.mirror.synchronousReplica,
  searchVariant: t.mirror.searchProduct,
  searchShards: t.mirror.searchShards,
  searchReplicas: t.mirror.searchReplicas,
  heap: t.mirror.searchHeap,
  storeVariant: t.mirror.storageProduct,
  mode: t.mirror.poolMode,
  dlq: t.mirror.deadLetterQueue,
  attempts: t.mirror.attempts,
  maxLength: t.mirror.maxLength,
  concurrency: t.mirror.concurrency,
  coalesce: t.mirror.stampedeProtection,
  warming: t.mirror.cacheWarming,
  paranoia: t.mirror.paranoia,
  zone: t.mirror.zone,
  standby: t.mirror.standby,
  signal: t.mirror.signal,
  target: t.mirror.fieldTarget,
  minCopies: t.mirror.minCopies,
  maxCopies: t.mirror.maxCopies,
  gpu: 'GPU',
  collector: t.mirror.collector,
  gogc: 'GOGC',
  shed: t.mirror.loadShedding,
  ryw: t.mirror.readYourWrites,
  n: 'N',
  r: 'R',
  w: 'W',
  backup: t.mirror.backups,
  fanout: t.mirror.fanOut,
  split: t.mirror.keySplitting,
})

const patternLabelOf = (t: Messages): Record<DataPatternId, string> => ({
  replica: t.mirror.readReplica,
  primary: t.mirror.ownPrimary,
  replicate: t.mirror.replicate,
  call: t.mirror.callSource,
})

const toolFactsOf = (
  t: Messages,
): Record<(typeof IAC_TOOLS)[number], ReadonlyArray<readonly [string, string]>> => ({
  terraform: [
    [t.mirror.plan, t.mirror.refreshesLiveState],
    [t.mirror.apply2, t.mirror.minRefresh(MIRROR_TIME_MINUTES)],
    [t.mirror.drift, t.mirror.everyPlan],
  ],
  pulumi: [
    [t.mirror.plan, t.mirror.recordedState],
    [t.mirror.apply2, t.mirror.min(MIRROR_TIME_MINUTES)],
    [t.mirror.drift, 'pulumi refresh'],
  ],
  alchemy: [
    [t.mirror.plan, t.mirror.recordedState],
    [t.mirror.apply2, t.mirror.min(MIRROR_TIME_MINUTES)],
    [t.mirror.drift, t.mirror.alchemyDriftRepair],
  ],
})

const valueText = (
  t: Messages,
  field: Managed,
  value: string | number | boolean | undefined,
): string =>
  field === 'size' && typeof value === 'number'
    ? (t.nodeList.sizes[SIZES[value]?.name ?? 'custom'] ?? String(value))
    : typeof value === 'boolean'
      ? value
        ? t.mirror.valueOn
        : t.mirror.valueOff
      : String(value)

const nodeName = (t: Messages, game: Game, id: string, mirror: Mirror): string => {
  if (id.startsWith('+')) {
    const source = game.nodes.find((entry) => entry.id === id.slice(1))
    if (!source) return t.mirror.node
    return source.type === 'database' && mirror.data[source.id] === 'replica'
      ? t.catalog.components.replica.name
      : nodeTitle(t, game, source)
  }
  const node = game.nodes.find((entry) => entry.id === id)
  if (!node) return t.mirror.node
  const name = nodeTitle(t, game, node)
  return node.region === mirror.region ? name : `${name} ${t.catalog.regionInfo[node.region].short}`
}

const segmented = <A>(
  h: H<Message>,
  key: string,
  options: ReadonlyArray<readonly [A, string]>,
  current: A,
  message: (value: A) => Message,
): Content =>
  h.div
    .key(key)
    .class(
      css(
        {
          display: 'grid',
          gap: '0.75',
          padding: '0.75',
        },
        WELL_STYLE,
        {
          borderRadius: 'lg',
        },
      ),
    )
    .style({ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` })
    .children(
      ...options.map(([value, label]) =>
        h.button
          .key(label)
          .attr('type', 'button')
          .attr('aria-pressed', value === current ? 'true' : 'false')
          .on('click', () => message(value))
          .class(
            cx(
              css({
                height: '7',
                borderRadius: 'lg',
                paddingInline: '2',
                fontSize: 'type.12',
                fontWeight: 'medium',
                transitionProperty:
                  'color, background-color, border-color, text-decoration-color, fill, stroke',
                transitionDuration: 'fast',
                transitionTimingFunction: 'out',
              }),
              value === current
                ? css({
                    layerStyle: 'raised',
                    color: 'foreground',
                    boxShadow: 'raised',
                  })
                : css({
                    color: 'mutedForeground',
                    _hover: {
                      backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                      color: 'foreground',
                    },
                  }),
            ),
          )
          .children(label),
      ),
    )

const heading = (h: H<Message>, text: string): Content =>
  h.span
    .class(
      cx(
        EYEBROW,
        css({
          paddingInline: '1',
        }),
      ),
    )
    .children(text)

const toolCards = (h: H<Message>, game: Game): Content => {
  const t = copy(h)

  const current = toolOf(game)
  const left = switchLeft(game)
  return h.section
    .key('tool')
    .class(css({ display: 'flex', flexDirection: 'column', gap: '2' }))
    .children(
      heading(
        h,
        left > 0 && current
          ? t.mirror.iaCToolMovingToMin(IAC_TOOL_INFO[current].name, Math.ceil(left))
          : t.mirror.iaCTool,
      ),
      h.div
        .class(
          css({
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '2',
            _compact: {
              gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
            },
          }),
        )
        .children(
          ...IAC_TOOLS.map((tool) =>
            h.button
              .key(tool)
              .attr('type', 'button')
              .attr('aria-pressed', current === tool ? 'true' : 'false')
              .on('click', () => Message.IacToolPicked({ tool }))
              .class(
                cx(
                  css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5',
                    borderRadius: 'xl',
                    padding: '3',
                    textAlign: 'left',
                    transitionProperty:
                      'color, background-color, border-color, text-decoration-color, fill, stroke',
                    transitionDuration: 'fast',
                    transitionTimingFunction: 'out',
                  }),
                  current === tool
                    ? css({
                        layerStyle: 'raised',
                        boxShadow: 'raised',
                      })
                    : cx(
                        WELL,
                        css({
                          _hover: {
                            filter: 'brightness(0.98)',
                          },
                        }),
                      ),
                ),
              )
              .children(
                h.span
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
                          fontSize: 'type.14',
                          fontWeight: 'semibold',
                        }),
                      )
                      .children(IAC_TOOL_INFO[tool].name),
                    h.span
                      .class(
                        css({
                          fontSize: 'type.11-5',
                          color: 'mutedForeground',
                        }),
                      )
                      .children(IAC_TOOL_INFO[tool].language),
                  ),
                ...toolFactsOf(t)[tool].map(([name, value]) =>
                  h.span
                    .key(name)
                    .class(
                      css({
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '2',
                        fontSize: 'type.12',
                      }),
                    )
                    .children(
                      h.span
                        .class(
                          css({
                            color: 'mutedForeground',
                          }),
                        )
                        .children(name),
                      h.span
                        .class(
                          css({
                            fontWeight: 'medium',
                          }),
                        )
                        .children(value),
                    ),
                ),
              ),
          ),
        ),
    )
}

const gitops = (h: H<Message>, game: Game): View.Input<Message> => {
  const t = copy(h)
  return !has(game, 'gitops') || game.iac._tag !== 'Chosen'
    ? null
    : h.section
        .key('gitops')
        .class(css({ display: 'flex', flexDirection: 'column', gap: '2' }))
        .children(
          heading(h, 'GitOps'),
          segmented(
            h,
            'sync',
            [
              [null, t.mirror.off],
              ['all', t.mirror.allAtOnce],
              ['staged', t.mirror.staged],
            ] as const,
            game.iac._tag === 'Chosen' ? game.iac.sync : null,
            (sync) => Message.SyncModePicked({ sync }),
          ),
        )
}

const driftText = (t: Messages, game: Game, mirror: Mirror, drift: Drift): string => {
  if (isApplying(mirror.sync))
    return t.mirror.applying(Math.max(1, Math.ceil(mirror.sync.readyAt - game.time)))
  const parts = [
    ...(drift.behind > 0 ? [t.mirror.behind(drift.behind)] : []),
    ...(drift.hand > 0 ? [t.mirror.handChanges(drift.hand)] : []),
  ]
  return parts.length === 0 ? t.mirror.inSync : parts.join(' · ')
}

const changeRow = (
  h: H<Message>,
  game: Game,
  mirror: Mirror,
  change: Change,
  index: number,
): Content => {
  const t = copy(h)

  const [mark, text, keep]: readonly [string, string, Message | null] = Change.match(change, {
    create: (change) => ['+', t.catalog.components[change.type].name, null] as const,
    remove: (change) =>
      [
        '−',
        `${t.catalog.components[change.type].name}${change.data ? ` · ${t.mirror.needsConfirm}` : ''}`,
        null,
      ] as const,
    set: (change) =>
      [
        '~',
        `${nodeName(t, game, change.node, mirror)} · ${fieldLabelOf(t)[change.field]} ${valueText(t, change.field, change.from)} → ${valueText(t, change.field, change.to)}`,
        change.hand && overridable(game)
          ? Message.MirrorOverrideSet({
              region: mirror.region,
              nodeId: change.node,
              field: change.field,
              keep: true,
            })
          : null,
      ] as const,
    link: (change) =>
      [
        change.add ? '+' : '−',
        t.mirror.link(nodeName(t, game, change.from, mirror), nodeName(t, game, change.to, mirror)),
        null,
      ] as const,
    choose: (change) =>
      ['?', t.mirror.pickAPattern(t.catalog.components[change.type].name), null] as const,
  })
  const hand = !Change.guards.choose(change) && change.hand
  return h.div
    .key(`${index}`)
    .class(
      css({
        display: 'grid',
        gridTemplateColumns: '16px 1fr auto',
        alignItems: 'center',
        gap: '2',
        paddingInline: '3',
        paddingBlock: '1',
        fontSize: 'type.12-5',
      }),
    )
    .children(
      h.span
        .class(
          cx(
            FIGURE,
            hand
              ? css({
                  color: 'danger',
                })
              : css({
                  color: 'mutedForeground',
                }),
          ),
        )
        .children(mark),
      h.span
        .class(
          cx(
            css({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }),
            hand &&
              css({
                color: 'danger',
              }),
          ),
        )
        .children(hand ? t.mirror.hand(text) : text),
      keep
        ? button(h, { onClick: keep, variant: 'ghost', size: 'xs' }, t.mirror.keepAsOverride)
        : h.span.children(),
    )
}

const dataChoices = (h: H<Message>, game: Game, mirror: Mirror): View.Input<Message> => {
  const t = copy(h)

  const sources = game.nodes.filter(
    (node) => node.region === mirror.source && patternsFor(node.type).length > 0,
  )
  if (sources.length === 0) return null
  return h.div
    .key('data')
    .class(css({ display: 'flex', flexDirection: 'column', gap: '1.5' }))
    .children(
      heading(h, t.mirror.writes),
      ...sources.map((node) =>
        h.div
          .key(node.id)
          .class(
            css({
              display: 'grid',
              gridTemplateColumns: '140px 1fr',
              alignItems: 'center',
              gap: '3',
            }),
          )
          .children(
            h.span
              .class(
                css({
                  fontSize: 'type.12-5',
                  fontWeight: 'medium',
                }),
              )
              .children(t.catalog.components[node.type].name),
            segmented(
              h,
              node.id,
              patternsFor(node.type).map(
                (pattern) => [pattern, patternLabelOf(t)[pattern]] as const,
              ),
              mirror.data[node.id] ?? null,
              (pattern) =>
                Message.MirrorDataPicked({
                  region: mirror.region,
                  source: node.id,
                  pattern: pattern ?? 'call',
                }),
            ),
          ),
      ),
    )
}

const overrides = (h: H<Message>, game: Game, mirror: Mirror): View.Input<Message> => {
  const t = copy(h)

  const kept = Object.entries(mirror.overrides).flatMap(([nodeId, fields]) =>
    fields.map((field) => [nodeId, field as Managed] as const),
  )
  if (kept.length === 0) return null
  return h.div
    .key('overrides')
    .class(css({ display: 'flex', flexDirection: 'column', gap: '1' }))
    .children(
      heading(h, t.mirror.overrides),
      ...kept.map(([nodeId, field]) =>
        h.div
          .key(`${nodeId}:${field}`)
          .class(
            css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '2',
              paddingInline: '1',
              fontSize: 'type.12-5',
            }),
          )
          .children(
            h.span.children(
              `${nodeName(t, game, nodeId, mirror)} · ${fieldLabelOf(t)[field]} ${valueText(t, field, game.nodes.find((node) => node.id === nodeId)?.[field])}`,
            ),
            button(
              h,
              {
                onClick: Message.MirrorOverrideSet({
                  region: mirror.region,
                  nodeId,
                  field,
                  keep: false,
                }),
                variant: 'ghost',
                size: 'xs',
              },
              t.mirror.remove,
            ),
          ),
      ),
    )
}

const burnCached = perSecond<number>()
const burnAdded = (game: Game, mirror: Mirror): number =>
  burnCached(
    game,
    mirror.region,
    () => solveFlow(previewApply(game, mirror.region)).burn - solveFlow(game).burn,
  )

const mirrorSection = (h: H<Message>, game: Game, mirror: Mirror): Content => {
  const t = copy(h)

  const drift = driftOf(game, mirror)
  const cost = applyCost(game, mirror)
  const burn = drift.changes.length > 0 ? burnAdded(game, mirror) : 0
  const changes = drift.changes
  const pending = isApplying(mirror.sync)
  const current = toolOf(game)
  const tool = current ? IAC_TOOL_INFO[current] : null
  return h.section
    .key(`mirror-${mirror.region}`)
    .class(css({ display: 'flex', flexDirection: 'column', gap: '3' }))
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            columnGap: '3',
            rowGap: '1',
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
            .children(
              t.mirror.mirrorOf(
                t.catalog.regionInfo[mirror.region].name,
                t.catalog.regionInfo[mirror.source].name,
              ),
            ),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.12-5',
                }),
                drift.hand > 0
                  ? css({
                      color: 'danger',
                    })
                  : drift.behind > 0
                    ? css({
                        color: 'warn',
                      })
                    : css({
                        color: 'ok',
                      }),
              ),
            )
            .children(driftText(t, game, mirror, drift)),
        ),
      dataChoices(h, game, mirror),
      game.iac._tag === 'Chosen'
        ? h.div
            .key('computed')
            .class(
              css({
                display: 'grid',
                gridTemplateColumns: '140px 1fr',
                alignItems: 'center',
                gap: '3',
              }),
            )
            .children(
              h.span
                .class(
                  css({
                    fontSize: 'type.12-5',
                    fontWeight: 'medium',
                  }),
                )
                .children(t.mirror.computedSizes),
              segmented(
                h,
                'computed',
                [
                  [false, t.mirror.off],
                  [true, t.mirror.followUsers],
                ] as const,
                mirror.computed,
                (computed) => Message.MirrorComputedSet({ region: mirror.region, computed }),
              ),
            )
        : null,
      changes.length > 0
        ? h.div
            .key('plan')
            .class(
              cx(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  paddingBlock: '1.5',
                }),
                WELL,
                SCROLL,
                css({
                  maxHeight: '240px',
                }),
              ),
            )
            .children(...changes.map((change, index) => changeRow(h, game, mirror, change, index)))
        : null,
      overrides(h, game, mirror),
      h.div
        .class(
          css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '2',
          }),
        )
        .children(
          button(
            h,
            {
              onClick: Message.MirrorApplied({ region: mirror.region, destroy: false }),
              isDisabled: pending || changes.length === 0 || drift.choices > 0,
              size: 'sm',
            },
            cost > 0 ? t.mirror.apply(money(cost)) : t.mirror.apply2,
          ),
          Math.abs(burn) >= 0.01
            ? h.span
                .key('burn')
                .class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.12',
                      color: 'mutedForeground',
                    }),
                  ),
                )
                .children(t.mirror.burnS(burn > 0 ? '+' : '', money(burn)))
            : null,
          drift.data > 0
            ? button(
                h,
                {
                  onClick: Message.MirrorApplied({ region: mirror.region, destroy: true }),
                  isDisabled: pending || drift.choices > 0,
                  size: 'sm',
                  variant: 'destructive',
                },
                t.mirror.applyAndRemove(drift.data),
              )
            : null,
          tool?.refresh
            ? button(
                h,
                {
                  onClick: Message.MirrorRefreshed({ region: mirror.region }),
                  isDisabled: pending,
                  size: 'sm',
                  variant: 'outline',
                },
                tool.repair ? t.mirror.checkDrift : t.mirror.refresh,
              )
            : null,
          tool?.repair
            ? button(
                h,
                {
                  onClick: Message.MirrorRepaired({ region: mirror.region }),
                  isDisabled: pending,
                  size: 'sm',
                  variant: 'outline',
                },
                t.mirror.repair,
              )
            : null,
          button(
            h,
            {
              onClick: Message.MirrorStopped({ region: mirror.region }),
              size: 'sm',
              variant: 'ghost',
              className: css({
                marginLeft: 'auto',
              }),
            },
            t.mirror.stopMirroring,
          ),
        ),
    )
}

const startSection = (h: H<Message>, game: Game, region: RegionId): Content => {
  const t = copy(h)

  const open = openRegions(game)
  const mirrors = mirrorsOf(game)
  const isSource = (target: RegionId) => mirrors.some((mirror) => mirror.source === target)
  const empty = !game.nodes.some((node) => node.region === region && node.type !== 'users')
  const price = game.sandbox ? 0 : Math.round(OPEN_REGION_PRICE * eraOf(game).costIndex)
  const targets = empty
    ? open.filter((source) => source !== region && !mirrorOf(game, source))
    : REGIONS.filter((target) => target !== region && !mirrorOf(game, target) && !isSource(target))
  return h.section
    .key(`start-${region}`)
    .class(css({ display: 'flex', flexDirection: 'column', gap: '2' }))
    .children(
      heading(h, empty ? t.mirror.mirrorIntoFrom[region] : t.mirror.mirrorRegionInto[region]),
      targets.length === 0
        ? h.span
            .class(
              css({
                paddingInline: '1',
                fontSize: 'type.12-5',
                color: 'mutedForeground',
              }),
            )
            .children(t.mirror.noRegionToPick)
        : h.div.class(css({ display: 'flex', flexWrap: 'wrap', gap: '2' })).children(
            ...targets.map((other) =>
              button(
                h,
                {
                  onClick: empty
                    ? Message.MirrorStarted({ target: region, source: other })
                    : Message.MirrorStarted({ target: other, source: region }),
                  isDisabled: game.iac._tag !== 'Chosen',
                  size: 'sm',
                  variant: 'outline',
                },
                !empty && !open.includes(other)
                  ? `${t.catalog.regionInfo[other].name} · ${money(price)}`
                  : t.catalog.regionInfo[other].name,
              ),
            ),
          ),
    )
}

export const mirrorPanel = (h: H<Message>, model: Model): View.Input<Message> => {
  if (model.panel !== 'mirror') return undefined
  const localized = speak(model.prefs.locale, h)
  const t = copy(localized)

  const game = model.board.game
  const region = model.board.region
  const mirror = mirrorOf(game, region)
  return shell(
    localized,
    t,
    t.mirror.mirror,
    [],
    [
      localized.div
        .class(
          cx(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '5',
              paddingInline: '5',
              paddingTop: '1',
              paddingBottom: '5',
            }),
            SCROLL,
          ),
        )
        .children(
          toolCards(localized, game),
          gitops(localized, game),
          game.iac._tag === 'Chosen'
            ? mirror
              ? mirrorSection(localized, game, mirror)
              : startSection(localized, game, region)
            : null,
        ),
    ],
    css({ maxWidth: '680px' }),
  )
}

export const tabDrift = (game: Game, region: RegionId): number => {
  const mirror = mirrorOf(game, region)
  if (!mirror) return 0
  const drift = driftOf(game, mirror)
  return drift.behind + drift.hand
}
