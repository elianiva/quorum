import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy, localeOf, nodeLabelIn, nodeTitle, speak, type Messages } from '@/i18n/messages.ts'
import { isDown } from '@quorum/simulation/life'
import {
  ArrowDownToLine,
  ArrowUp,
  ArrowUpFromLine,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Minus,
  Plus,
  RotateCcw,
  ArrowRightLeft,
  Trash2,
} from 'lucide'
import { clockOf } from '@quorum/simulation/calendar'
import {
  COMPONENTS,
  CREDIT_CAP,
  FAMILY_IDS,
  PRICING_FROM_STAGE,
  PRICING_IDS,
  RUNTIMES,
  SIZES,
  SPOT_WARNING,
  STANDBY_TYPES,
  TASKS,
  AUTH_MOVE_DH,
  LOAD_TEST_DEMAND,
  ZONES,
  DB_ENGINES,
} from '@quorum/simulation/catalog'
import { isGlobal, openRegions } from '@quorum/simulation/regions'
import { platformTax, quartersBehind } from '@quorum/simulation/team'
import type { Limit } from '@quorum/simulation/capacity'
import type { Ledger, LinkLedger, NodeLedger } from '@quorum/simulation/ledger'
import {
  burnOf,
  has,
  hasPricing,
  maxSize,
  pricingOf,
  ramOf,
  refundOf,
  replacePrice,
  resizePrice,
  vcpuOf,
  zoned,
  nodeCertDaysLeft,
  flatScale,
} from '@quorum/simulation/lookups'
import { LINK_TIMEOUTS, restartable } from '@quorum/simulation/actions'
import { installedPart, missingParts, partsUnlocked, type SlotKind } from '@quorum/simulation/parts'
import { CACHE_HIT_LOW, hotDataGb } from '@quorum/simulation/rules'
import { activeIncident, type Game, type GameLink, type GameNode } from '@quorum/simulation/state'
import { compact, money, priceLabel, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'
import {
  costShifts,
  hasTraffic,
  hintOf,
  oversized,
  sampleNode,
  TRAFFIC_KINDS,
  type NodeSample,
} from '@/game/node-metrics.ts'
import { COMPONENT_ICONS } from '@quorum/ui/game/component-icons'
import { componentUrl } from '@/platform/analytics.ts'
import { buttonClass } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'
import { badge } from '../ui/badge.ts'
import { progress } from '../ui/progress.ts'
import { EYEBROW, FIGURE, NESTED, PANEL, SCROLL, WELL } from '@quorum/ui/game/bits'
import {
  button,
  callout,
  caption,
  choice,
  closeButton,
  groupBadge,
  meter,
  nodeLink,
  outbound,
  percent,
  picker,
  row,
  section,
  segmented,
  sizeLabelIn,
  smallButton,
  type Content,
} from './inspector/shared.ts'
import { PANELS } from './inspector/index.ts'
import { amplification, costReceipts, loadChange, whatIfs } from './inspector/diagnosis.ts'

const gauge = (
  h: H<Message>,
  name: string,
  used: number,
  total: number,
  value: string,
  invert = false,
): Content => {
  const share = total > 0 ? Math.min(1, used / total) : 0
  const level = invert ? 1 - share : share
  const fill =
    level >= 0.9
      ? css({ backgroundColor: 'danger' })
      : level >= 0.7
        ? css({ backgroundColor: 'warn' })
        : css({ layerStyle: 'primaryFill' })
  return h.div
    .key(name)
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5',
        paddingBlock: '0.5',
      }),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }),
        )
        .children(
          h.span
            .class(
              css({
                fontSize: 'type.12-5',
                color: 'mutedForeground',
              }),
            )
            .children(name),
          h.span
            .class(
              cx(
                FIGURE,
                css({ fontSize: 'type.12' }),
                level >= 0.9
                  ? css({ color: 'danger' })
                  : level >= 0.7
                    ? css({ color: 'warn' })
                    : '',
              ),
            )
            .children(value),
        ),
      meter(h, share, fill),
    )
}

const warnings = (
  game: Game,
  node: GameNode,
  ledger: Ledger,
  h: H<Message>,
): ReadonlyArray<Content> => {
  const t = copy(h)

  const list: Array<Content> = []
  const own = ledger.nodes[node.id]
  if (!own) return []
  if (node.life._tag === 'Stopped') {
    const price = replacePrice(game, node)
    list.push(
      callout(
        h,
        t.inspector.theHostUnderThisVMDied,
        'danger',
        button(
          h,
          {
            onClick: Message.ReplaceBought({ nodeId: node.id }),
            isDisabled: game.cash < price,
            variant: 'outline',
            size: 'sm',
            className: css({
              alignSelf: 'flex-start',
              color: 'danger',
            }),
          },
          [t.inspector.replace, h.span.class(FIGURE).children(priceLabel(game.sandbox, price))],
        ),
      ),
    )
  }
  const incident = activeIncident(game)
  if (incident?.nodeId === node.id && incident.kind === 'reconnect' && incident.throttled !== true)
    list.push(
      callout(
        h,
        t.inspector.everyClientIsReconnectingAtOnce,
        'danger',
        button(
          h,
          {
            onClick: Message.ConnectsThrottled({ nodeId: node.id }),
            variant: 'outline',
            size: 'sm',
            className: css({
              alignSelf: 'flex-start',
              color: 'danger',
            }),
          },
          [t.inspector.throttleConnects],
        ),
      ),
    )
  if (
    incident?.kind === 'loop' &&
    node.type === 'server' &&
    RUNTIMES[node.runtime].blocking === 'loop'
  )
    list.push(
      callout(
        h,
        t.inspector.aHeavyLoginHashBlocksThis,
        'danger',
        button(
          h,
          {
            onClick: Message.KindMoved(),
            variant: 'outline',
            size: 'sm',
            className: css({
              alignSelf: 'flex-start',
              color: 'danger',
            }),
          },
          [t.inspector.moveLogin],
        ),
      ),
    )
  if (isDown(node.life) && node.life._tag === 'Restarting' && node.standby && has(game, 'multi-az'))
    list.push(
      callout(
        h,
        t.inspector.itsStandbyTakesOverInA,
        'warn',
        button(
          h,
          {
            onClick: Message.FailedOver({ nodeId: node.id }),
            variant: 'outline',
            size: 'sm',
            className: css({
              alignSelf: 'flex-start',
            }),
          },
          [t.inspector.failOver],
        ),
      ),
    )
  if (own.stranded > 0.01) {
    const names = own.strandedKinds
      .map((kind) => t.catalog.kinds[kind].label.toLowerCase())
      .join(', ')
    list.push(callout(h, t.inspector.sOfHaveNowhereToGo(rate(own.stranded), names), 'danger', null))
  }
  if (own.refused > 0.01)
    list.push(
      callout(h, t.inspector.refusingQueriesSTooManyConnections(rate(own.refused)), 'danger', null),
    )
  if (own.swapping) list.push(callout(h, t.inspector.outOfRAMAndSwappingEvery, 'danger', null))
  if (own.throttled) list.push(callout(h, t.inspector.outOfCPUCreditsThrottledTo, 'warn', null))
  if (own.disk) list.push(callout(h, t.inspector.theWorkingSetDoesNotFit, 'warn', null))
  if (
    node.type === 'cache' &&
    !isDown(node.life) &&
    own.hitRatio !== null &&
    own.hitRatio < CACHE_HIT_LOW &&
    (own.traffic['q-read'] ?? 0) > 0
  ) {
    const price = resizePrice(game, node)
    const evicted = (own.evictions ?? 0) > 0
    const hot = hotDataGb(game).toFixed(1)
    const memory = flatScale(node).toFixed(0)
    list.push(
      callout(
        h,
        evicted
          ? t.inspector.theHotDataOutgrewThisCachesMemory(hot, memory, percent(own.hitRatio))
          : t.inspector.theHotDataFitsThisCachesMemory(hot, memory, percent(own.hitRatio)),
        'warn',
        evicted && price !== null
          ? button(
              h,
              {
                onClick: Message.ResizeChosen({ nodeId: node.id, direction: 1 }),
                isDisabled: game.cash < price,
                variant: 'outline',
                size: 'sm',
                className: css({
                  alignSelf: 'flex-start',
                }),
              },
              [game.sandbox ? t.inspector.larger : t.inspector.larger2(money(price))],
            )
          : null,
      ),
    )
  }
  if (node.leak > 0) {
    list.push(
      callout(
        h,
        t.inspector.memoryGrowsGBLeaked(node.leak.toFixed(1)),
        'danger',
        button(
          h,
          {
            onClick: Message.RestartChosen({ nodeId: node.id }),
            variant: 'outline',
            size: 'sm',
            className: css({
              alignSelf: 'flex-start',
              color: 'danger',
            }),
          },
          [
            icon(
              h,
              RotateCcw,
              css({
                width: '3.5',
                height: '3.5',
              }),
            ),
            t.inspector.restart,
          ],
        ),
      ),
    )
  }
  if (node.service._tag === 'Draining') list.push(callout(h, t.inspector.draining, 'warn', null))
  if (node.type === 'cluster' && !game.sandbox) {
    const upgrade = button(
      h,
      {
        onClick: Message.TaskQueued({ id: 'upgrade-cluster' }),
        variant: 'outline',
        size: 'sm',
        className: css({
          alignSelf: 'flex-start',
        }),
      },
      [t.inspector.upgradeClustersDH(TASKS['upgrade-cluster'].dh)],
    )
    if (incident?.kind === 'cluster-upgrade' && incident.nodeId === node.id)
      list.push(callout(h, t.inspector.theProviderIsForcingAnUpgrade, 'danger', upgrade))
    else if (quartersBehind(game, node) > 0)
      list.push(callout(h, t.inspector.itsKubernetesVersionIsOutOf, 'warn', upgrade))
    if (platformTax(game) > 0)
      list.push(
        callout(h, t.inspector.clustersTakeEngineersOfDevHours(platformTax(game)), 'warn', null),
      )
  }
  if (node.type === 'auth' && !game.sandbox)
    list.push(
      callout(
        h,
        t.inspector.moveLoginInHouseTheApp,
        'warn',
        button(
          h,
          {
            onClick: Message.AuthMoveQueued(),
            isDisabled: game.backlog.some((item) => item.ref === 'auth'),
            variant: 'outline',
            size: 'sm',
            className: css({
              alignSelf: 'flex-start',
            }),
          },
          [t.inspector.moveAuthInHouseDH(AUTH_MOVE_DH)],
        ),
      ),
    )
  if (game.time < game.loadTestUntil && own.utilization > 0)
    list.push(
      callout(
        h,
        t.inspector.loadTestAtDemandThisNode(
          LOAD_TEST_DEMAND,
          Math.round(own.utilization * LOAD_TEST_DEMAND * 100),
        ),
        own.utilization * LOAD_TEST_DEMAND > 1 ? 'danger' : 'warn',
        null,
      ),
    )
  if (
    node.type === 'database' &&
    game.engineChange.phase._tag !== 'Idle' &&
    game.engineChange.node === node.id
  )
    list.push(
      callout(
        h,
        game.engineChange.phase._tag === 'Copying'
          ? t.inspector.copyingItsDataToItKeeps(
              DB_ENGINES[game.engineChange.to].name,
              DB_ENGINES[node.dbEngine].name,
            )
          : t.inspector.rewritingTheCodeForItIs(DB_ENGINES[game.engineChange.to].name),
        'warn',
        null,
      ),
    )
  if (
    node.type === 'database' &&
    game.reshard.phase._tag !== 'Idle' &&
    game.reshard.node === node.id
  )
    list.push(
      callout(
        h,
        game.reshard.phase._tag === 'Copying'
          ? t.inspector.copyingToShards(
              game.reshard.shards,
              t.catalog.shardKeys[game.reshard.key].name,
            )
          : t.inspector.rewritingForTheNewShards,
        'warn',
        null,
      ),
    )
  if (node.type === 'queue' && incident?.kind === 'poison' && incident.nodeId === node.id)
    list.push(
      callout(
        h,
        node.dlq ? t.inspector.aTaskKeepsFailingTheDead : t.inspector.aTaskKeepsFailingWorkersRetry,
        node.dlq ? 'warn' : 'danger',
        node.dlq
          ? null
          : button(
              h,
              {
                onClick: Message.MessageDeleted(),
                variant: 'outline',
                size: 'sm',
                className: css({
                  alignSelf: 'flex-start',
                  color: 'danger',
                }),
              },
              [t.inspector.deleteMessage],
            ),
      ),
    )
  if (incident?.kind === 'spot-reclaim' && incident.nodeId === node.id) {
    const left = Math.max(0, Math.ceil(SPOT_WARNING - (game.time - incident.startedAt)))
    list.push(
      callout(
        h,
        isDown(node.life) ? t.inspector.spotReclaimed : t.inspector.spotReclaimsIn(t.units.s(left)),
        'danger',
        node.pricing === 'spot'
          ? button(
              h,
              {
                onClick: Message.PricingChosen({ nodeId: node.id, pricing: 'on-demand' }),
                variant: 'outline',
                size: 'sm',
                className: css({
                  alignSelf: 'flex-start',
                  color: 'danger',
                }),
              },
              [t.inspector.switchToOnDemand],
            )
          : null,
      ),
    )
  }
  const fix = (text: string, label: string, message: Message) =>
    list.push(
      callout(
        h,
        text,
        'danger',
        button(
          h,
          {
            onClick: message,
            variant: 'outline',
            size: 'sm',
            className: css({
              alignSelf: 'flex-start',
              color: 'danger',
            }),
          },
          [label],
        ),
      ),
    )
  if (node.type === 'waf' && incident?.kind === 'regex')
    fix(t.inspector.aRuleBacktracksCPUAt100, t.inspector.disableRule, Message.RuleDisabled())
  if (node.type === 'database' && incident?.kind === 'report-db')
    fix(
      t.inspector.aReportIsScanningEveryTable,
      t.inspector.cancelReport,
      Message.ReportCancelled(),
    )
  if (node.type === 'psp' && incident?.kind === 'psp-outage')
    fix(t.inspector.providerOutage, t.inspector.switchProvider, Message.ProviderSwitched())
  if (node.type === 'database' && incident?.kind === 'disk-full' && incident.nodeId === node.id)
    fix(t.inspector.theDiskIsFullWritesFail, t.inspector.expandVolume, Message.VolumeExpanded())
  if (node.type === 'waf' && incident?.kind === 'ddos' && !node.underAttack)
    list.push(
      callout(
        h,
        t.inspector.aFloodOfJunkTraffic,
        'danger',
        button(
          h,
          {
            onClick: Message.UnderAttackChosen({ nodeId: node.id, underAttack: true }),
            variant: 'outline',
            size: 'sm',
            className: css({
              alignSelf: 'flex-start',
              color: 'danger',
            }),
          },
          [t.inspector.underAttack],
        ),
      ),
    )
  if (node.type === 'database' && incident?.kind === 'slow-query') {
    const analysed = has(game, 'query-analysis')
    list.push(
      callout(
        h,
        analysed ? t.inspector.aNewQueryHasNoIndex : t.inspector.aNewQueryHasNoIndex2,
        'danger',
        analysed
          ? button(
              h,
              {
                onClick: Message.IndexAdded({ nodeId: node.id }),
                variant: 'outline',
                size: 'sm',
                className: css({
                  alignSelf: 'flex-start',
                  color: 'danger',
                }),
              },
              [t.inspector.addIndex],
            )
          : null,
      ),
    )
  }
  return list
}

const stats = (
  game: Game,
  node: GameNode,
  ledger: Ledger,
  h: H<Message>,
): ReadonlyArray<Content> => {
  const t = copy(h)

  const own = ledger.nodes[node.id]
  if (!own) return []
  const panelStats = PANELS[node.type]?.stats
  if (panelStats) return panelStats({ game, node, ledger, own, h })
  const util = own.utilization
  return [
    row(h, t.inspector.inbound, t.inspector.s(rate(own.inbound)), 'plain'),
    row(
      h,
      t.inspector.load,
      own.inbound > 0 ? t.inspector.ofS(percent(util), rate(own.capacity)) : t.inspector.idle,
      util >= 0.9 ? 'danger' : util >= 0.7 ? 'warn' : 'plain',
    ),
    row(h, t.inspector.latency, formats(t).ms(own.latency), 'plain'),
    node.type === 'worker'
      ? row(
          h,
          t.inspector.requeued,
          t.inspector.s(rate(own.dropped)),
          own.dropped > 0.05 ? 'warn' : 'plain',
        )
      : row(
          h,
          t.inspector.dropped,
          t.inspector.s(rate(own.dropped)),
          own.dropped > 0.05 ? 'danger' : 'plain',
        ),
    ...(own.hitRatio !== null
      ? [
          row(
            h,
            t.inspector.hitRatio,
            percent(own.hitRatio),
            node.type === 'cache' &&
              own.hitRatio < CACHE_HIT_LOW &&
              (own.traffic['q-read'] ?? 0) > 0
              ? 'warn'
              : 'plain',
          ),
        ]
      : []),
    ...(own.evictions !== null
      ? [
          row(
            h,
            t.inspector.evictions,
            t.inspector.s(rate(own.evictions)),
            own.evictions > 0 ? 'warn' : 'plain',
          ),
        ]
      : []),
    ...(own.lagMs !== null ? [row(h, t.inspector.lag, formats(t).ms(own.lagMs), 'plain')] : []),
    ...(node.certUntil !== null
      ? [
          row(
            h,
            t.inspector.certificate,
            (nodeCertDaysLeft(game, node) ?? 0) <= 0
              ? t.inspector.expired
              : t.inspector.dLeft(Math.round(nodeCertDaysLeft(game, node) ?? 0)),
            (nodeCertDaysLeft(game, node) ?? 0) <= 1 ? 'danger' : 'plain',
          ),
        ]
      : []),
    row(h, t.inspector.burn, t.inspector.s(money(burnOf(game, node))), 'plain'),
  ]
}

const limitNameOf = (t: Messages): Record<Limit, string> => ({
  cpu: 'CPU',
  credits: t.inspector.cPUCredits,
  memory: t.inspector.rAM,
  workers: t.inspector.workersBusy,
  connections: t.inspector.connections,
  network: t.inspector.network,
  disk: t.inspector.diskIOPS,
  throughput: t.inspector.throughput,
  none: t.inspector.nothing,
})

type GaugeSpec = Readonly<{
  label: string
  used: number
  total: number
  text: string
  invert?: boolean
}>

const gaugesOf = (t: Messages, node: GameNode, own: NodeLedger) => {
  const { cpuCores, ramGb, slots, creditsCoreSeconds, networkKbps } = own.resources
  const gauges: Partial<Record<Limit, GaugeSpec>> = {}
  if (cpuCores)
    gauges.cpu = {
      label: 'CPU',
      used: cpuCores.used,
      total: cpuCores.total,
      text: t.inspector.cores(cpuCores.used.toFixed(2), cpuCores.total.toFixed(1)),
    }
  if (ramGb)
    gauges.memory = {
      label: t.inspector.rAM,
      used: ramGb.used,
      total: ramGb.total,
      text: t.inspector.gigabytes(ramGb.used.toFixed(1), ramGb.total.toFixed(0)),
    }
  if (slots)
    gauges.workers = {
      label: node.type === 'fn' ? t.inspector.executions : t.inspector.workersBusy,
      used: slots.used,
      total: slots.total,
      text: `${slots.used.toFixed(1)} / ${slots.total}`,
    }
  if (own.connections)
    gauges.connections = {
      label: t.inspector.connections,
      used: own.connections.used,
      total: own.connections.max,
      text: `${Math.round(own.connections.used)} / ${own.connections.max}`,
    }
  if (creditsCoreSeconds) {
    const cap = CREDIT_CAP * vcpuOf(node)
    gauges.credits = {
      label: t.inspector.cPUCredits,
      used: creditsCoreSeconds.balance,
      total: cap,
      text: `${Math.round(creditsCoreSeconds.balance)} · ${t.units.perSecond(`${creditsCoreSeconds.rate >= 0 ? '+' : ''}${creditsCoreSeconds.rate.toFixed(2)}`)}`,
      invert: true,
    }
  }
  if (networkKbps)
    gauges.network = {
      label: t.inspector.network,
      used: networkKbps.used,
      total: networkKbps.total,
      text: t.inspector.megabytesPerSecond(
        (networkKbps.used / 1_000).toFixed(1),
        (networkKbps.total / 1_000).toFixed(0),
      ),
    }
  return gauges
}

const resources = (node: GameNode, ledger: Ledger, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const own = ledger.nodes[node.id]
  if (!own) return []
  const gauges = gaugesOf(t, node, own)
  const list: Array<Content> = []
  const tight = gauges[own.limit]
  if (own.limit === 'none') list.push(row(h, t.inspector.limit, t.inspector.nothingTight, 'ok'))
  else if (tight)
    list.push(
      gauge(h, t.inspector.limitOf(tight.label), tight.used, tight.total, tight.text, tight.invert),
    )
  else list.push(row(h, t.inspector.limit, t.inspector.noGauge(limitNameOf(t)[own.limit]), 'warn'))
  for (const limit of ['cpu', 'memory', 'workers', 'connections', 'credits', 'network'] as const) {
    const spec = gauges[limit]
    if (spec) list.push(gauge(h, spec.label, spec.used, spec.total, spec.text, spec.invert))
  }
  return list.length > 0 ? [section(h, t.inspector.resources, list)] : []
}

const sparkline = (
  points: ReadonlyArray<number>,
  h: H<Message>,
  options: Readonly<{
    selected?: number
    onPick?: (index: number) => Message
    label?: string
    marks?: ReadonlyArray<number>
  }> = {},
): Content => {
  const width = 300
  const height = 44
  const top = Math.max(1, ...points)
  const x = (index: number) => (index / Math.max(1, points.length - 1)) * width
  const y = (value: number) => height - (Math.min(value, top) / top) * height
  const path = points.map((value, index) => `${x(index)},${y(value)}`).join(' ')
  const limit = height - (1 / top) * height
  const selected =
    options.selected !== undefined && options.selected >= 0 && options.selected < points.length
      ? options.selected
      : null
  const onPick = options.onPick
  return h.svg
    .class(
      cx(
        css({
          height: '11',
          width: '100%',
        }),
        selected !== null
          ? css({
              overflow: 'visible',
            })
          : '',
      ),
    )
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'none')
    .attr('aria-label', options.label)
    .children(
      h.line
        .attr('x1', '0')
        .attr('x2', String(width))
        .attr('y1', String(limit))
        .attr('y2', String(limit))
        .attr('stroke', 'var(--danger)')
        .attr('stroke-dasharray', '3 3')
        .attr('stroke-width', '1')
        .children(),
      h.polyline
        .attr('points', path)
        .attr('fill', 'none')
        .attr('stroke', 'var(--primary-strong)')
        .attr('stroke-width', '1.5')
        .children(),
      ...(options.marks ?? []).map((index) =>
        h.line
          .attr('x1', String(x(index)))
          .attr('x2', String(x(index)))
          .attr('y1', '0')
          .attr('y2', String(height))
          .attr('stroke', 'var(--warn)')
          .attr('stroke-dasharray', '2 2')
          .attr('stroke-width', '1')
          .children(),
      ),
      ...(selected !== null
        ? [
            h.line
              .attr('x1', String(x(selected)))
              .attr('x2', String(x(selected)))
              .attr('y1', '0')
              .attr('y2', String(height))
              .attr('stroke', 'var(--muted-foreground)')
              .attr('stroke-width', '1')
              .children(),
            h.circle
              .attr('cx', String(x(selected)))
              .attr('cy', String(y(points[selected] ?? 0)))
              .attr('r', '2.5')
              .attr('fill', 'var(--foreground)')
              .children(),
          ]
        : []),
      ...(onPick
        ? points.map((_, index) => {
            const left = index === 0 ? 0 : x(index - 0.5)
            const right = index === points.length - 1 ? width : x(index + 0.5)
            return h.rect
              .attr('x', String(left))
              .attr('y', '0')
              .attr('width', String(right - left))
              .attr('height', String(height))
              .attr('fill', 'transparent')
              .class(css({ cursor: 'crosshair' }))
              .on('click', () => onPick(index))
              .children()
          })
        : []),
    )
}

const pricing = (game: Game, node: GameNode, h: H<Message>): Content => {
  const t = copy(h)

  const current = pricingOf(game, node)
  const term =
    current === 'reserved' && node.pricingUntil !== null
      ? Math.ceil((node.pricingUntil - game.time) / 1_440)
      : null
  return h.div
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5',
        paddingTop: '1',
      }),
    )
    .children(
      h.span
        .class(
          cx(
            EYEBROW,
            css({
              paddingInline: '1',
              color: 'mutedForeground',
            }),
          ),
        )
        .children(term === null ? t.inspector.pricing : t.inspector.pricingReservedFor(term)),
      segmented(
        h,
        css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
        PRICING_IDS.map((id) =>
          choice(
            h,
            id,
            current === id,
            true,
            Message.PricingChosen({ nodeId: node.id, pricing: id }),
            [
              h.span
                .class(
                  css({
                    width: '100%',
                    textAlign: 'center',
                  }),
                )
                .children(t.catalog.pricings[id].name),
            ],
            t.catalog.pricings[id].blurb,
          ),
        ),
      ),
    )
}

const upgradeAll = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const peers = game.nodes.filter(
    (entry) => entry.type === node.type && entry.region === node.region,
  )
  if (peers.length < 2) return []
  const name = t.catalog.components[node.type].name
  const growable = peers.filter((entry) => entry.size < maxSize(entry))
  const payable = growable.some((entry) => {
    const price = resizePrice(game, entry)
    return price !== null && (game.sandbox || game.cash >= price)
  })
  return [
    h.div
      .class(
        css({
          paddingInline: '4',
          paddingBlock: '3',
        }),
      )
      .children(
        button(
          h,
          {
            onClick: Message.UpgradeAllChosen({ nodeId: node.id }),
            isDisabled: !payable,
            variant: 'outline',
            size: 'sm',
            className: css({
              width: '100%',
              justifyContent: 'space-between',
            }),
            attributes: {
              'aria-label': t.inspector.upgradeEveryHere(name),
              title: t.inspector.oneSizeOnEveryOnThis(name),
            },
          },
          [
            h.span
              .class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                }),
              )
              .children(
                icon(
                  h,
                  ArrowUp,
                  css({
                    width: '3.5',
                    height: '3.5',
                  }),
                ),
                growable.length > 0
                  ? t.inspector.upgradeAll(growable.length)
                  : t.inspector.upgradeAll2,
              ),
          ],
        ),
      ),
  ]
}

const instance = (game: Game, node: GameNode, h: H<Message>): Content => {
  const t = copy(h)

  const sizeName = SIZES[node.size]?.name
  const price = resizePrice(game, node)
  return section(h, t.inspector.instance, [
    h.div
      .class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2',
            padding: '1',
          }),
          WELL,
        ),
      )
      .children(
        smallButton(
          h,
          t.inspector.smallerFree,
          Minus,
          Message.ResizeChosen({ nodeId: node.id, direction: -1 }),
          node.size > 0,
        ),
        h.span
          .class(
            cx(
              FIGURE,
              css({
                flex: '1 1 0%',
                textAlign: 'center',
                fontSize: 'type.12-5',
              }),
            ),
          )
          .children(
            t.inspector.vCPUGB(
              sizeName ? t.nodeList.sizes[sizeName] : '',
              vcpuOf(node),
              ramOf(node),
            ),
          ),
        smallButton(
          h,
          price === null
            ? t.inspector.largestSize
            : game.sandbox
              ? t.inspector.larger
              : t.inspector.larger2(money(price)),
          Plus,
          Message.ResizeChosen({ nodeId: node.id, direction: 1 }),
          price !== null && game.cash >= price,
        ),
      ),
    h.div
      .class(
        css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          paddingInline: '1',
          paddingTop: '1',
        }),
      )
      .children(
        smallButton(
          h,
          t.inspector.buyTenSizes,
          ChevronsRight,
          Message.BulkResizeChosen({ nodeId: node.id, mode: 'ten' }),
          price !== null && game.cash >= price,
        ),
        smallButton(
          h,
          t.inspector.buyToTheLargestSize,
          ArrowUp,
          Message.BulkResizeChosen({ nodeId: node.id, mode: 'max' }),
          price !== null && game.cash >= price,
        ),
      ),
    segmented(
      h,
      css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
      FAMILY_IDS.map((id) =>
        choice(
          h,
          id,
          node.family === id,
          true,
          Message.OptionChosen({ nodeId: node.id, option: { kind: 'family', id } }),
          [
            h.span
              .class(
                css({
                  width: '100%',
                  textAlign: 'center',
                }),
              )
              .children(t.catalog.families[id].name),
          ],
          t.catalog.families[id].blurb,
          Message.OptionPreviewed({ nodeId: node.id, option: { kind: 'family', id } }),
        ),
      ),
    ),
    h.div.class(css({ paddingTop: '1' })).children(
      button(
        h,
        {
          onClick: Message.ShopOpened({ nodeId: node.id, slot: 'cpu' }),
          variant: 'outline',
          size: 'sm',
        },
        t.shop.openInstanceCatalog,
      ),
    ),
    ...(hasPricing(node) && game.stage >= PRICING_FROM_STAGE ? [pricing(game, node, h)] : []),
  ])
}

const partsPanel = (game: Game, node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  const missing = missingParts(game, node)
  const partRow = (slot: SlotKind, label: string): Content => {
    const value = installedPart(node, slot)
    return h.button
      .attr('type', 'button')
      .on('click', () => Message.ShopOpened({ nodeId: node.id, slot }))
      .class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2',
            borderRadius: 'lg',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'border',
            paddingInline: '2.5',
            paddingBlock: '1.5',
            fontSize: 'type.12',
            textAlign: 'left',
            color: 'mutedForeground',
            _hover: { borderColor: 'mutedForeground', color: 'foreground' },
          }),
          value === null ? css({ borderStyle: 'dashed' }) : css({}),
        ),
      )
      .children(
        h.span.class(css({ fontWeight: 'medium' })).children(label),
        h.span
          .class(
            cx(FIGURE, css({ fontSize: 'type.12', color: value === null ? 'warn' : 'foreground' })),
          )
          .children(value ?? '+'),
      )
  }
  return section(
    h,
    t.inspector.parts,
    [
      h.p
        .class(
          css({
            paddingInline: '1',
            paddingBottom: '1',
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(t.inspector.partsHint),
      h.div
        .class(
          css({
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '1',
          }),
        )
        .children(
          partRow('cpu', t.inspector.partsCpu),
          partRow('ram', t.inspector.partsMemory),
          partRow('disk', t.inspector.partsDisk),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '1',
            paddingTop: '1',
          }),
        )
        .children(
          button(
            h,
            {
              onClick: Message.ShopOpened({
                nodeId: node.id,
                slot: missing[0] ?? 'cpu',
                mode: 'parts',
              }),
              variant: 'outline',
              size: 'sm',
              className: css({ width: '100%' }),
            },
            t.inspector.openShop,
          ),
          button(
            h,
            {
              onClick: Message.ShopOpened({ nodeId: node.id, slot: 'cpu', mode: 'instance' }),
              variant: 'ghost',
              size: 'sm',
              className: css({ width: '100%' }),
            },
            t.shop.openInstanceCatalog,
          ),
        ),
      ...(hasPricing(node) && game.stage >= PRICING_FROM_STAGE ? [pricing(game, node, h)] : []),
    ],
    true,
  )
}

const inboundLinks = (game: Game, node: GameNode): ReadonlyArray<readonly [GameLink, GameNode]> =>
  game.links.flatMap((link) => {
    const source = game.nodes.find((entry) => entry.id === link.from)
    return link.to === node.id &&
      source &&
      !COMPONENTS[source.type].control &&
      !COMPONENTS[source.type].tap
      ? [[link, source] as const]
      : []
  })

const liveLinkOf = (ledger: Ledger, from: string, to: string): LinkLedger | undefined =>
  ledger.links.find((link) => link.from === from && link.to === to)

const outboundRoutes = (game: Game, node: GameNode): ReadonlyArray<readonly [GameLink, GameNode]> =>
  game.links.flatMap((link) => {
    const target = game.nodes.find((entry) => entry.id === link.to)
    return link.from === node.id &&
      target &&
      !COMPONENTS[target.type].control &&
      !COMPONENTS[target.type].tap
      ? [[link, target] as const]
      : []
  })

const connectionGrid = (
  game: Game,
  node: GameNode,
  links: ReadonlyArray<readonly [GameLink, GameNode]>,
  side: 'in' | 'out',
  ledger: Ledger,
  h: H<Message>,
): Content => {
  const t = copy(h)
  return h.div
    .class(
      cx(
        css({
          marginInline: '-0.375rem',
          display: 'grid',
        }),
        links.length === 1
          ? css({ gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' })
          : css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }),
        css({
          columnGap: '1',
          rowGap: '0.5',
        }),
      ),
    )
    .children(
      ...links.map(([, other]) => {
        const live =
          side === 'in'
            ? liveLinkOf(ledger, other.id, node.id)
            : liveLinkOf(ledger, node.id, other.id)
        const rateNow = live?.rate ?? 0
        const name = nodeTitle(t, game, other)
        return h.button
          .key(`${side}-${other.id}`)
          .attr('type', 'button')
          .on('click', () => Message.RevealNode({ nodeId: other.id }))
          .attr('aria-label', t.inspectorShared.openNode(name))
          .attr('title', `${name} · ${t.inspector.s(rate(rateNow))}`)
          .attr('data-connection', side)
          .class(
            cx(
              css({
                display: 'flex',
                minWidth: '0',
                alignItems: 'center',
                gap: '1',
                borderRadius: 'md',
                paddingInline: '1.5',
                paddingBlock: '1',
                textAlign: 'left',
                transitionProperty:
                  'color, background-color, border-color, text-decoration-color, fill, stroke',
                transitionDuration: 'fast',
                transitionTimingFunction: 'out',
                _hover: {
                  backgroundColor: 'well',
                },
              }),
              'group',
            ),
          )
          .children(
            groupBadge(
              COMPONENTS[other.type].group,
              COMPONENT_ICONS[other.type],
              css({ width: '4', height: '4', flexShrink: '0' }),
              h,
            ),
            h.span
              .class(
                css({
                  minWidth: '0',
                  flex: '1 1 0%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'type.11',
                  fontWeight: 'medium',
                }),
              )
              .children(name),
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    flexShrink: '0',
                    fontSize: 'type.10-5',
                  }),
                  rateNow > 0.01
                    ? css({
                        color: 'mutedForeground',
                      })
                    : css({
                        color: 'color-mix(in oklab, var(--muted-foreground) 55%, transparent)',
                      }),
                ),
              )
              .children(t.inspector.s(rate(rateNow))),
          )
      }),
    )
}

const capacityMeter = (
  label: string,
  value: number,
  scale: number,
  bounded: boolean,
  glyph: typeof ArrowDownToLine,
  links: ReadonlyArray<readonly [GameLink, GameNode]>,
  side: 'in' | 'out',
  game: Game,
  node: GameNode,
  ledger: Ledger,
  h: H<Message>,
): Content => {
  const t = copy(h)
  const share = scale > 0 ? Math.min(1, value / scale) : 0
  const valueText = bounded
    ? `${t.inspector.s(rate(value))} · ${t.inspector.ofS(percent(share), rate(scale))}`
    : t.inspector.s(rate(value))
  return h.div
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5',
      }),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '3',
          }),
        )
        .children(
          h.span
            .class(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '1.5',
              }),
            )
            .children(
              icon(
                h,
                glyph,
                css({
                  width: '3.5',
                  height: '3.5',
                  flexShrink: '0',
                  color: 'mutedForeground',
                }),
              ),
              h.span.class(EYEBROW).children(label),
            ),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.11',
                  color: 'mutedForeground',
                }),
              ),
            )
            .children(valueText),
        ),
      progress(h, {
        value: share * 100,
        className: css({
          gap: '0',
        }),
        trackClassName: css({ height: '2' }),
        label: `${label} ${valueText}`,
      }),
      ...(links.length > 0 ? [connectionGrid(game, node, links, side, ledger, h)] : []),
    )
}

const trafficMeters = (
  game: Game,
  node: GameNode,
  ledger: Ledger,
  h: H<Message>,
): ReadonlyArray<Content> => {
  const t = copy(h)

  const inbound = inboundLinks(game, node)
  const outgoing = outboundRoutes(game, node)
  if (inbound.length === 0 && outgoing.length === 0) return []
  const own = ledger.nodes[node.id]
  const inboundRate = own?.inbound ?? 0
  const outboundRate = outgoing.reduce(
    (sum, [link]) => sum + (liveLinkOf(ledger, node.id, link.to)?.rate ?? 0),
    0,
  )
  const capacity = own?.capacity ?? 0
  const bounded = Number.isFinite(capacity) && capacity > 0
  const scale = bounded ? capacity : Math.max(inboundRate, outboundRate)
  return [
    h.div
      .class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
          paddingInline: '4',
          paddingBottom: '3',
        }),
      )
      .children(
        capacityMeter(
          t.inspector.inbound,
          inboundRate,
          scale,
          bounded,
          ArrowDownToLine,
          inbound,
          'in',
          game,
          node,
          ledger,
          h,
        ),
        capacityMeter(
          t.inspector.outbound,
          outboundRate,
          scale,
          bounded,
          ArrowUpFromLine,
          outgoing,
          'out',
          game,
          node,
          ledger,
          h,
        ),
      ),
  ]
}

const placement = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspector.zone, [
    picker(
      h,
      'zone',
      ZONES.map((zone) => [zone, zone.toUpperCase()] as const),
      node.zone,
      (zone) => Message.ZoneChosen({ nodeId: node.id, zone }),
    ),
    ...(STANDBY_TYPES.includes(node.type)
      ? [
          picker(
            h,
            'standby',
            [
              ['off', t.inspector.noStandby],
              ['async', t.inspector.standbyAsync],
              ['sync', t.inspector.standbySync],
            ],
            !node.standby ? 'off' : node.standbySync ? 'sync' : 'async',
            (mode) =>
              Message.StandbyChosen({
                nodeId: node.id,
                standby: mode !== 'off',
                standbySync: mode === 'sync',
              }),
          ),
        ]
      : []),
  ])
}

const regionSection = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const open = openRegions(game)
  if (open.length < 2 || isGlobal(node) || COMPONENTS[node.type].fixed) return []
  return [
    section(h, t.inspector.region, [
      picker(
        h,
        t.inspector.region2,
        open.map((region) => [region, t.catalog.regionInfo[region].short] as const),
        node.region,
        (region) => Message.NodeRegionChosen({ nodeId: node.id, region }),
      ),
    ]),
  ]
}

const calls = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const links = outbound(game, node)
  if (links.length === 0) return []
  return [
    section(
      h,
      t.inspector.calls,
      links.map(([link, target]) =>
        h.div
          .key(link.to)
          .class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5',
            }),
          )
          .children(
            nodeLink(game, target, h),
            picker(
              h,
              `timeout-${link.to}`,
              LINK_TIMEOUTS.map((seconds) => [seconds, t.inspector.s2(seconds)] as const),
              link.timeout,
              (timeout) => Message.LinkPolicyChosen({ from: node.id, to: link.to, timeout }),
            ),
            picker(
              h,
              `retries-${link.to}`,
              [
                ['none', t.inspector.noRetries],
                ['naive', t.inspector.retry3],
                ['backoff', t.inspector.backoff],
              ],
              link.retries,
              (retries) => Message.LinkPolicyChosen({ from: node.id, to: link.to, retries }),
              (retries) => retries !== 'backoff' || has(game, 'backoff-jitter'),
            ),
            ...(has(game, 'circuit-breakers')
              ? [
                  picker(
                    h,
                    `breaker-${link.to}`,
                    [
                      [false, t.inspector.noBreaker],
                      [
                        true,
                        link.fuse._tag === 'Open' ? t.inspector.breakerOpen : t.inspector.breaker,
                      ],
                    ],
                    link.breaker,
                    (breaker) => Message.LinkPolicyChosen({ from: node.id, to: link.to, breaker }),
                  ),
                ]
              : []),
            ...(has(game, 'bulkheads')
              ? [
                  picker(
                    h,
                    `bulkhead-${link.to}`,
                    [
                      [false, t.inspector.noBulkhead],
                      [true, t.inspector.bulkhead],
                    ],
                    link.bulkhead,
                    (bulkhead) =>
                      Message.LinkPolicyChosen({ from: node.id, to: link.to, bulkhead }),
                  ),
                ]
              : []),
            ...(has(game, 'hedged-requests')
              ? [
                  picker(
                    h,
                    `hedge-${link.to}`,
                    [
                      [false, t.inspector.oneCopy],
                      [true, t.inspector.hedge],
                    ],
                    link.hedge,
                    (hedge) => Message.LinkPolicyChosen({ from: node.id, to: link.to, hedge }),
                  ),
                ]
              : []),
          ),
      ),
    ),
  ]
}

const when = (t: Messages, time: number): string => {
  const clock = clockOf(time)
  return t.inspector.dayAt(
    clock.day,
    `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`,
  )
}

const difference = (t: Messages, value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${t.units.perSecond(rate(Math.abs(value)))}`

const breakdown = (
  label: string | ReadonlyArray<string>,
  value: number,
  total: number,
  previous: number | null,
  h: H<Message>,
  work: number | null = null,
): Content => {
  const t = copy(h)
  const share = total > 0 ? percent(value / total) : '0%'
  return h.div
    .key(typeof label === 'string' ? label : label.join(''))
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
      h.span
        .class(
          css({
            minWidth: '0',
            overflowWrap: 'break-word',
            fontSize: 'type.12-5',
            color: 'mutedForeground',
          }),
        )
        .children(...(typeof label === 'string' ? [label] : label)),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'flex-end',
              gap: '1.5',
              fontSize: 'type.12',
              whiteSpace: 'nowrap',
            }),
          ),
        )
        .children(
          work === null
            ? t.inspector.rateAndShare(rate(value), share)
            : t.inspector.workShareOf(rate(value), share, percent(work)),
          ...(previous === null
            ? []
            : [
                h.span
                  .class(
                    css({
                      fontSize: 'type.11-5',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(difference(t, value - previous)),
              ]),
        ),
    )
}

const workResourceOf = (t: Messages, unit: NodeSample['workUnit']): string | null =>
  unit === null ? null : t.inspector.workResources[unit]

const trafficBreakdown = (model: Model, node: GameNode, ledger: Ledger, h: H<Message>): Content => {
  const t = copy(h)

  const game = model.board.game
  const history = model.board.nodeHistory[node.id] ?? []
  const selection = model.board.nodeSample
  const index =
    selection?.nodeId === node.id
      ? history.findIndex((sample) => sample.time === selection.time)
      : -1
  const sample = history[index] ?? sampleNode(game, node, ledger)
  const previous = index > 0 ? history[index - 1] : index === -1 ? history.at(-1) : undefined
  const hint = hintOf(sample)
  const kinds = TRAFFIC_KINDS.filter(
    (kind) => (sample.traffic[kind] ?? 0) > 0 || (previous?.traffic[kind] ?? 0) > 0,
  ).sort((a, b) => (sample.traffic[b] ?? 0) - (sample.traffic[a] ?? 0))
  const sources = [...sample.sources].sort((a, b) => b.rate - a.rate)
  const sourceNames = new Map(
    game.nodes.map((entry) => [entry.id, t.catalog.components[entry.type].name] as const),
  )
  const load = sample.utilization >= 0.9 ? 'danger' : sample.utilization >= 0.7 ? 'warn' : 'plain'
  const earlier = index === -1 ? history.at(-1) : history[index - 1]
  const workResource = has(game, 'profiling') ? workResourceOf(t, sample.workUnit) : null
  const change = loadChange(model, history, sample, index, h)
  const amplified = amplification(model, node, sample, h)
  const receipts = index === -1 ? costReceipts(model, node, ledger, h) : null
  const whatIf = index === -1 ? whatIfs(model, node, h) : null
  return section(h, t.inspector.trafficLoad, [
    h.div
      .class(
        css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '2',
        }),
      )
      .children(
        caption(h, index >= 0 ? t.inspector.recordedSample : t.inspector.liveTraffic),
        ...(index >= 0
          ? [
              button(
                h,
                {
                  onClick: Message.NodeSampleChosen({ nodeId: node.id, time: null }),
                  variant: 'outline',
                  size: 'xs',
                },
                [
                  icon(
                    h,
                    ChevronsRight,
                    css({
                      width: '3',
                      height: '3',
                    }),
                  ),
                  t.inspector.backToLive,
                ],
              ),
            ]
          : []),
      ),
    ...(has(game, 'metrics') && history.length > 1
      ? [
          sparkline(
            history.map((entry) => entry.utilization),
            h,
            {
              selected: index >= 0 ? index : history.length - 1,
              onPick: (at) =>
                Message.NodeSampleChosen({ nodeId: node.id, time: history[at]?.time ?? null }),
              label: t.inspector.loadHistorySelectAPointOr,
              marks: costShifts(history),
            },
          ),
          h.div
            .class(
              cx(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '2',
                  padding: '1',
                }),
                WELL,
              ),
            )
            .children(
              smallButton(
                h,
                t.inspector.earlierSample,
                ChevronLeft,
                Message.NodeSampleChosen({ nodeId: node.id, time: earlier?.time ?? null }),
                earlier !== undefined,
              ),
              h.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      flex: '1 1 0%',
                      textAlign: 'center',
                      fontSize: 'type.12-5',
                    }),
                  ),
                )
                .children(when(t, sample.time)),
              smallButton(
                h,
                t.inspector.laterSample,
                ChevronRight,
                Message.NodeSampleChosen({
                  nodeId: node.id,
                  time: history[index + 1]?.time ?? null,
                }),
                index >= 0 && index < history.length - 1,
              ),
            ),
        ]
      : [
          h.p
            .class(
              css({
                fontSize: 'type.12',
                lineHeight: 'snug',
                color: 'mutedForeground',
              }),
            )
            .children(
              has(game, 'metrics')
                ? t.inspector.historyAppearsAfterTwoRecordedSamples
                : t.inspector.researchMetricsToInspectPastSamples,
            ),
        ]),
    h.div
      .class(NESTED)
      .children(
        row(h, t.inspector.inbound, t.inspector.s(rate(sample.inbound)), 'plain'),
        row(
          h,
          t.inspector.load,
          sample.inbound > 0
            ? t.inspector.ofS(percent(sample.utilization), rate(sample.capacity))
            : t.inspector.idle,
          sample.inbound > 0 ? load : 'plain',
        ),
        ...(sample.dropped > 0
          ? [
              row(
                h,
                node.type === 'worker' ? t.inspector.requeued : t.inspector.dropped,
                t.inspector.s(rate(sample.dropped)),
                sample.dropped > 0.05 ? (node.type === 'worker' ? 'warn' : 'danger') : 'plain',
              ),
            ]
          : []),
        ...(sample.refused > 0
          ? [
              row(
                h,
                t.inspector.refused,
                t.inspector.s(rate(sample.refused)),
                sample.refused > 0.05 ? 'danger' : 'plain',
              ),
            ]
          : []),
        ...(sample.hitRatio !== null
          ? [row(h, t.inspector.hitRatio, percent(sample.hitRatio), 'plain')]
          : []),
        ...(sample.queue
          ? [
              row(h, t.inspector.backlog, compact(sample.queue.depth), 'plain'),
              row(h, t.inspector.sentToWorkers, t.inspector.s(rate(sample.queue.out)), 'plain'),
              row(
                h,
                t.inspector.queueWait,
                formats(t).queueWait(
                  sample.queue.stalled ? Number.POSITIVE_INFINITY : sample.queue.wait,
                ),
                sample.queue.stalled ? 'warn' : 'plain',
              ),
            ]
          : []),
      ),
    ...(change ? [change] : []),
    h.div
      .class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1',
        }),
      )
      .children(
        caption(h, t.inspector.incomingOperations),
        ...(kinds.length
          ? [
              h.div
                .class(NESTED)
                .children(
                  ...kinds.map((kind) =>
                    breakdown(
                      t.catalog.kinds[kind].label,
                      sample.traffic[kind] ?? 0,
                      sample.inbound,
                      previous ? (previous.traffic[kind] ?? 0) : null,
                      h,
                      workResource ? (sample.workShare[kind] ?? 0) : null,
                    ),
                  ),
                ),
            ]
          : [
              h.p
                .class(
                  css({
                    paddingInline: '3',
                    fontSize: 'type.12',
                    color: 'mutedForeground',
                  }),
                )
                .children(t.inspector.noIncomingTrafficAtThisSample),
            ]),
        h.p
          .class(
            css({
              paddingInline: '3',
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(
            workResource
              ? t.inspector.workIs(workResource)
              : t.inspector.sharesDescribeIncomingTrafficNotCPU,
          ),
      ),
    ...(receipts ? [receipts] : []),
    ...(sources.length
      ? [
          h.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1',
              }),
            )
            .children(
              caption(h, t.inspector.sentBy),
              h.div
                .class(NESTED)
                .children(
                  ...sources.map((source) =>
                    breakdown(
                      [
                        sourceNames.get(source.id) ?? source.name,
                        ...(source.ordinal > 0 ? [` ${source.ordinal}`] : []),
                      ],
                      source.rate,
                      sample.inbound,
                      previous
                        ? (previous.sources.find((entry) => entry.id === source.id)?.rate ?? 0)
                        : null,
                      h,
                    ),
                  ),
                ),
            ),
        ]
      : []),
    ...(amplified ? [amplified] : []),
    ...(whatIf ? [whatIf] : []),
    ...(hint
      ? [
          callout(
            h,
            hint,
            sample.down || sample.swapping || sample.refused > 0 ? 'danger' : 'warn',
            null,
            css({ marginInline: '0', marginBottom: '0' }),
          ),
        ]
      : []),
    ...(!hint && has(game, 'rightsizing') && oversized(history)
      ? [
          callout(
            h,
            t.inspector.rightsizingReport,
            'warn',
            null,
            css({ marginInline: '0', marginBottom: '0' }),
          ),
        ]
      : []),
  ])
}

export const inspector = (h: H<Message>, model: Model, ledger: Ledger): View.Content<Message> => {
  const localized = speak(model.prefs.locale, h)
  const t = copy(localized)

  const game = model.board.game
  const node = game.nodes.find((entry) => entry.id === model.board.selected)
  if (!node) return h.text('')
  const def = { ...COMPONENTS[node.type], ...t.catalog.components[node.type] }
  const label = nodeLabelIn(t, game, node)
  const history = model.board.nodeHistory[node.id] ?? []
  const price = resizePrice(game, node)
  const sizeLabel = def.sized || def.steps > 1 ? sizeLabelIn(t, node) : null
  const panel = PANELS[node.type]
  const context = { model, game, node, ledger, h: localized }

  return localized.aside
    .key(`inspector-${node.id}`)
    .attr('data-exit', 'gesture')
    .attr('data-inspector', '')
    .attr('aria-label', nodeTitle(t, game, node))
    .class(
      cx(
        css({
          position: 'absolute',
          top: '76px',
          right: '3',
          bottom: '3',
          zIndex: '20',
          display: 'flex',
          width: '348px',
          flexDirection: 'column',
          overflow: 'hidden',
          _compact: {
            inset: 'auto 0 0 0',
            height: '52dvh',
            maxHeight: 'none',
            width: 'auto',
            borderBottomRadius: '0',
            paddingBottom: 'env(safe-area-inset-bottom)',
          },
          _short: {
            left: 'auto',
            height: 'auto',
            top: '132px',
            right: 'max(8px, env(safe-area-inset-right))',
            width: '320px',
            maxHeight: 'none',
          },
        }),
        PANEL,
        'enter-panel sheet-screen',
      ),
    )
    .children(
      closeButton(localized, {
        label: t.inspector.close,
        onClick: Message.EmptyTapped(),
        className: css({
          _compact: {
            width: '11',
            height: '11',
          },
        }),
      }),
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '3',
            paddingInline: '4',
            paddingTop: '4',
            paddingRight: '10',
            paddingBottom: '2',
            _compact: {
              paddingRight: '14',
            },
          }),
        )
        .children(
          groupBadge(
            def.group,
            COMPONENT_ICONS[node.type],
            css({ width: '10', height: '10' }),
            localized,
          ),
          h.div
            .class(
              css({
                display: 'flex',
                minWidth: '0',
                flex: '1 1 0%',
                flexDirection: 'column',
              }),
            )
            .children(
              h.span
                .class(
                  css({
                    fontSize: 'type.17',
                    fontWeight: 'semibold',
                    letterSpacing: 'tight',
                  }),
                )
                .children(label.name, ...(label.ordinal > 0 ? [` ${label.ordinal}`] : [])),
              h.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.11-5',
                      color: 'mutedForeground',
                    }),
                  ),
                )
                .children(def.product),
            ),
          ...(sizeLabel
            ? [
                badge(
                  localized,
                  {
                    variant: 'secondary',
                    className: css({
                      fontFamily: 'mono',
                    }),
                  },
                  [sizeLabel],
                ),
              ]
            : []),
        ),
      h.p
        .class(
          css({
            paddingInline: '4',
            paddingBottom: '3',
            fontSize: 'type.12-5',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(def.blurb),
      ...(def.control ? [] : trafficMeters(game, node, ledger, localized)),
      ...warnings(game, node, ledger, localized),
      h.div
        .class(
          cx(
            css({
              display: 'flex',
              minHeight: '0',
              flex: '1 1 0%',
              flexDirection: 'column',
              '& > :not(:last-child)': {
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderColor: 'hairline',
              },
            }),
            SCROLL,
          ),
        )
        .children(
          h.div
            .class(
              css({
                paddingInline: '4',
                paddingTop: '1',
                paddingBottom: '2',
              }),
            )
            .children(
              ...(hasTraffic(node)
                ? [
                    h.p
                      .class(
                        cx(
                          EYEBROW,
                          css({
                            marginBottom: '2',
                            color: 'mutedForeground',
                          }),
                        ),
                      )
                      .children(t.inspector.liveNow),
                  ]
                : []),
              h.div.class(NESTED).children(...stats(game, node, ledger, localized)),
            ),
          ...(hasTraffic(node) ? [trafficBreakdown(model, node, ledger, localized)] : []),
          ...(has(game, 'metrics') && history.length > 1 && !def.fixed && !hasTraffic(node)
            ? [
                section(h, t.inspector.loadLastDay, [
                  sparkline(
                    history.map((sample) => sample.utilization),
                    localized,
                  ),
                ]),
              ]
            : []),
          ...resources(node, ledger, localized),
          ...(panel?.top?.(context) ?? []),
          ...(def.sized
            ? node.type === 'server' || node.type === 'database'
              ? partsUnlocked(game)
                ? [partsPanel(game, node, localized)]
                : [instance(game, node, localized)]
              : [instance(game, node, localized)]
            : []),
          ...(panel?.body?.(context) ?? []),
          ...(has(game, 'multi-az') && zoned(node) ? [placement(node, localized)] : []),
          ...regionSection(game, node, localized),
          ...(panel?.late?.(context) ?? []),
          ...(has(game, 'timeouts') ? calls(game, node, localized) : []),
          ...upgradeAll(game, node, localized),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            gap: '2',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderColor: 'hairline',
            backgroundColor: 'nested',
            padding: '3',
          }),
        )
        .children(
          ...(node.type === 'payments' && game.pending > 0
            ? [
                h.button
                  .attr('type', 'button')
                  .on('click', () => Message.Collected())
                  .class(
                    css({
                      display: 'flex',
                      height: '9',
                      flex: '1 1 0%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2',
                      borderRadius: 'lg',
                      backgroundColor: 'ok',
                      fontSize: 'type.13',
                      fontWeight: 'medium',
                      color: 'white',
                      boxShadow:
                        'inset 0 1px 0 oklch(1 0 0/0.25),0 0 0 1px color-mix(in oklch,var(--ok),black 25%),0 2px 6px -2px color-mix(in oklch,var(--ok) 50%,transparent)',
                      transitionProperty: 'filter',
                      transitionDuration: 'fast',
                      transitionTimingFunction: 'out',
                      _hover: {
                        filter: 'brightness(105%)',
                      },
                      _active: {
                        translate: '0 1px',
                      },
                    }),
                  )
                  .children(
                    t.inspector.collect,
                    h.span.class(FIGURE).children(money(game.pending)),
                  ),
              ]
            : []),
          ...(price !== null && node.life._tag !== 'Stopped'
            ? [
                button(
                  localized,
                  {
                    onClick: Message.ResizeChosen({ nodeId: node.id, direction: 1 }),
                    isDisabled: game.cash < price,
                    size: 'lg',
                    className: css({
                      minWidth: '0',
                      flex: '1 1 0%',
                      justifyContent: 'space-between',
                      paddingInline: '3',
                    }),
                    attributes: { title: 'U' },
                  },
                  [
                    h.span
                      .class(
                        css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1.5',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }),
                      )
                      .children(
                        icon(
                          localized,
                          ArrowUp,
                          css({
                            width: '4',
                            height: '4',
                            flexShrink: '0',
                          }),
                        ),
                        node.type === 'payments'
                          ? t.inspector.biggerDrawer
                          : node.type === 'analytics'
                            ? t.inspector.moreSamples
                            : sizeLabelIn(t, node, node.size + 1),
                      ),
                    h.span.class(FIGURE).children(priceLabel(game.sandbox, price)),
                  ],
                ),
              ]
            : []),
          h.a
            .key('wiki')
            .attr('href', componentUrl(node.type, localeOf(localized)))
            .attr('target', '_blank')
            .attr('rel', 'noreferrer noopener')
            .attr('title', t.inspector.openOnTheWiki(label.name))
            .attr('aria-label', t.inspector.openOnTheWiki(label.name))
            .class(buttonClass('outline', 'icon-lg'))
            .children(
              icon(
                localized,
                BookOpen,
                css({
                  width: '4',
                  height: '4',
                }),
              ),
            ),
          ...(restartable(node) && !isDown(node.life)
            ? [
                button(
                  localized,
                  {
                    onClick: Message.RestartChosen({ nodeId: node.id }),
                    variant: 'outline',
                    size: 'icon-lg',
                    attributes: {
                      title: t.inspector.restartFreesLeakedMemoryComesBack,
                      'aria-label': t.inspector.restart,
                    },
                  },
                  icon(
                    localized,
                    RotateCcw,
                    css({
                      width: '4',
                      height: '4',
                    }),
                  ),
                ),
              ]
            : []),
          ...(node.standby && isDown(node.life) && has(game, 'multi-az')
            ? [
                button(
                  localized,
                  {
                    onClick: Message.FailedOver({ nodeId: node.id }),
                    variant: 'outline',
                    size: 'icon-lg',
                    attributes: {
                      title: t.inspector.failOverTheStandbyTakesOver,
                      'aria-label': t.inspector.failOver,
                    },
                  },
                  icon(
                    localized,
                    ArrowRightLeft,
                    css({
                      width: '4',
                      height: '4',
                    }),
                  ),
                ),
              ]
            : []),
          ...(has(game, 'health-checks') &&
          !def.fixed &&
          !isDown(node.life) &&
          node.service._tag !== 'Draining'
            ? [
                button(
                  localized,
                  {
                    onClick: Message.DrainChosen({ nodeId: node.id }),
                    variant: 'outline',
                    size: 'icon-lg',
                    attributes: { title: t.inspector.drainTitle, 'aria-label': t.inspector.drain },
                  },
                  icon(
                    localized,
                    ArrowDownToLine,
                    css({
                      width: '4',
                      height: '4',
                    }),
                  ),
                ),
              ]
            : []),
          ...(def.fixed
            ? []
            : [
                button(
                  localized,
                  {
                    onClick: Message.SellAsked(),
                    variant: 'outline',
                    size: 'icon-lg',
                    className: css({
                      color: 'mutedForeground',
                      _hover: {
                        color: 'danger',
                      },
                    }),
                    attributes: {
                      title: t.inspector.sellForDelete(money(refundOf(game, node))),
                      'aria-label': t.inspector.sell,
                    },
                  },
                  icon(
                    localized,
                    Trash2,
                    css({
                      width: '4',
                      height: '4',
                    }),
                  ),
                ),
              ]),
        ),
    )
}
