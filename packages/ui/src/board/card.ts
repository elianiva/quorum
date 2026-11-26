import { COMPONENTS, FAMILIES, SIZES, ZONES, REGION_INFO, rttOf } from '@quorum/simulation/catalog'
import type { Ledger } from '@quorum/simulation/ledger'
import {
  bootingOf,
  has,
  ramOf,
  replacePrice,
  resizePrice,
  sizeLabel,
  vcpuOf,
  zoned,
} from '@quorum/simulation/lookups'
import { isGlobal } from '@quorum/simulation/regions'
import { nodeLabelOf } from '@quorum/simulation/labels'
import type { Game, GameNode, RegionId } from '@quorum/simulation/state'
import { provisioned, type SlotKind } from '@quorum/simulation/parts'
import { COMPONENT_VIEWS } from '../components/index.ts'
import { ms, priceLabel, rate } from '../game/format.ts'
import { layoutOf } from './geometry.ts'
import { placementRows } from './layouts.ts'
import { POOLER_MODES } from '../components/pooler.ts'
import {
  FOOT_ICONS,
  ROW_ICONS,
  membersOf,
  outRate,
  pct,
  type Footer,
  type Row,
  type RowTone,
} from '../components/shared.ts'

export { FOOT_ICONS, POOLER_MODES, ROW_ICONS, membersOf, outRate, pct }
export type { Footer, Row, RowTone }

const limitText = (own: Ledger['nodes'][string]): string => {
  const { cpuCores, ramGb, slots, networkKbps } = own.resources
  const share = (gauge: { used: number; total: number } | null): string =>
    gauge !== null && gauge.total > 0 ? pct(gauge.used / gauge.total) : ''
  switch (own.limit) {
    case 'cpu':
      return `CPU ${share(cpuCores)}`
    case 'memory':
      return `RAM ${share(ramGb)}`
    case 'workers':
      return slots ? `Workers ${Math.round(slots.used)}/${Math.round(slots.total)}` : 'Workers'
    case 'network':
      return `Network ${share(networkKbps)}`
    case 'credits':
      return 'CPU credits'
    case 'connections':
      return own.connections
        ? `Connections ${own.connections.used}/${own.connections.max}`
        : 'Connections'
    case 'disk':
      return 'Disk IOPS'
    case 'throughput':
      return 'Throughput'
    default:
      return 'Nothing tight'
  }
}

export const rowsOf = (
  game: Game,
  node: GameNode,
  ledger: Ledger,
  history: ReadonlyArray<number> = [],
  region: RegionId | null = null,
  ordinal = nodeLabelOf(game, node).ordinal,
): ReadonlyArray<Row> => {
  const rows = withLimit(game, node, ledger, baseRowsOf(game, node, ledger, history))
  if (placementRows(node.type) === 0 || rows.length === 0) return rows
  const parts = [
    ordinal > 0 ? `#${ordinal}` : '',
    ...tagsOf(game, node, region).map((tag) => tag.text),
  ]
  const value = parts.filter(Boolean).join(' · ')
  return [
    ...rows.slice(0, layoutOf(node.type).rows - 1),
    { glyph: 'placement', name: 'Placement', value: value || '–', tone: value ? 'plain' : 'muted' },
  ]
}

const withLimit = (
  game: Game,
  node: GameNode,
  ledger: Ledger,
  rows: ReadonlyArray<Row>,
): ReadonlyArray<Row> => {
  const own = ledger.nodes[node.id]
  if (!own || !has(game, 'profiling') || own.inbound <= 0 || own.limit === 'none') return rows
  const at = rows.findIndex((row) => row.glyph === 'load')
  if (at < 0) return rows
  const limit: Row = {
    glyph: 'limit',
    name: 'Limit',
    value: limitText(own),
    tone: own.utilization >= 0.9 ? 'danger' : own.utilization >= 0.7 ? 'warn' : 'plain',
  }
  return [...rows.slice(0, at + 1), limit, ...rows.slice(at + 1)]
}

const baseRowsOf = (
  game: Game,
  node: GameNode,
  ledger: Ledger,
  history: ReadonlyArray<number> = [],
): ReadonlyArray<Row> => {
  const own = ledger.nodes[node.id]
  if (!own) return []
  const inbound: Row = {
    glyph: 'inbound',
    name: 'Inbound',
    value: `${rate(own.inbound)}/s`,
    tone: own.dropped > 0.05 ? 'danger' : 'plain',
  }
  const capacity: Row = {
    glyph: 'load',
    name: 'Load',
    value:
      own.inbound > 0
        ? `${pct(Math.min(own.utilization, 9.99))} of ${rate(own.capacity)}/s`
        : 'idle',
    tone: own.utilization >= 0.9 ? 'danger' : own.utilization >= 0.7 ? 'warn' : 'plain',
    bar: Math.min(own.utilization, 1),
    ...(has(game, 'metrics') && history.length > 1 ? { trend: history } : {}),
  }
  const latency: Row = {
    glyph: 'latency',
    name: 'Latency',
    value: has(game, 'percentiles') ? `${ms(own.latency)} · p99 ${ms(own.p99)}` : ms(own.latency),
  }
  const out: Row = {
    glyph: own.stranded > 0.01 ? 'stranded' : 'out',
    name: own.stranded > 0.01 ? 'Stranded' : 'Out',
    value: own.stranded > 0.01 ? `${rate(own.stranded)}/s` : `${rate(outRate(ledger, node.id))}/s`,
    tone: own.stranded > 0.01 ? 'danger' : 'plain',
  }
  return COMPONENT_VIEWS[node.type].rows({
    game,
    node,
    ledger,
    own,
    inbound,
    capacity,
    latency,
    out,
  })
}

export type { SlotKind }
export type Slot = Readonly<{
  kind: SlotKind
  label: string
  value: string
  empty: boolean
  tone: RowTone
}>

export const slotsOf = (
  node: GameNode,
  own: Ledger['nodes'][string],
  unlocked = true,
): ReadonlyArray<Slot> | null => {
  if (!layoutOf(node.type).slots) return null
  const cores = unlocked ? vcpuOf(node) : (SIZES[node.size]?.vcpu ?? 1)
  const cpuPresent = unlocked ? node.parts.cpu : true
  const ramPresent = unlocked ? node.parts.ram : true
  const diskPresent = unlocked ? node.parts.disk : node.type === 'database'
  const cpu = cpuPresent ? `${Number.isInteger(cores) ? cores : cores.toFixed(1)}c` : '+'
  const ram = ramPresent
    ? `${Math.round(unlocked ? ramOf(node) : cores * FAMILIES[node.family].ramPerVcpu)}g`
    : '+'
  const disk =
    node.type === 'database'
      ? diskPresent
        ? node.iops === 'provisioned'
          ? '64k'
          : '3k'
        : '+'
      : '+'
  const hot: RowTone = own.utilization >= 0.9 ? 'danger' : own.utilization >= 0.7 ? 'warn' : 'plain'
  const tight = (at: boolean): RowTone => (at && hot !== 'plain' ? hot : 'plain')
  return [
    {
      kind: 'cpu',
      label: 'CPU',
      value: cpu,
      empty: !cpuPresent,
      tone: cpuPresent ? tight(own.limit === 'cpu' || own.limit === 'credits') : 'plain',
    },
    {
      kind: 'ram',
      label: 'RAM',
      value: ram,
      empty: !ramPresent,
      tone: ramPresent ? tight(own.limit === 'memory') : 'plain',
    },
    {
      kind: 'disk',
      label: 'IOPS',
      value: disk,
      empty: node.type !== 'database' || !diskPresent,
      tone:
        node.type === 'database' && diskPresent
          ? tight(own.limit === 'disk' || own.limit === 'throughput')
          : 'plain',
    },
  ]
}

export const sizePips = (node: GameNode): Readonly<{ filled: number; total: number }> | null => {
  const def = COMPONENTS[node.type]
  if (layoutOf(node.type).slots) return null
  if (def.sized) return { filled: node.size + 1, total: SIZES.length }
  return def.steps > 1 ? { filled: node.size, total: def.steps } : null
}

type Tag = Readonly<{ kind: 'remote' | 'zone' | 'copies'; text: string }>

const tagsOf = (game: Game, node: GameNode, region: RegionId | null = null): ReadonlyArray<Tag> => {
  const booting = bootingOf(node)
  const copies = `${node.replicas > 1 ? `×${node.replicas}` : ''}${
    booting > 0
      ? ` +${booting}${node.scaler._tag === 'Scaling' ? ` · ${Math.ceil(node.scaler.readyIn)} s` : ''}`
      : ''
  }`.trim()
  const standby = ZONES[(ZONES.indexOf(node.zone) + 1) % ZONES.length] ?? ''
  const zone =
    has(game, 'multi-az') && zoned(node)
      ? `${node.zone.toUpperCase()}${node.standby ? `+${standby.toUpperCase()}` : ''}`
      : ''
  const remote =
    region !== null && node.region !== region && !isGlobal(node) && !node.spread
      ? `${REGION_INFO[node.region].short} ${rttOf(region, node.region)} ms`
      : node.spread && (node.type === 'wide' || node.type === 'dsql')
        ? 'Spread'
        : ''
  return (
    [
      { kind: 'remote', text: remote },
      { kind: 'zone', text: zone },
      { kind: 'copies', text: copies },
    ] as const
  ).filter((tag) => tag.text !== '')
}

export const footerOf = (game: Game, node: GameNode): Footer | null => {
  if (!layoutOf(node.type).footer) return null
  const own = COMPONENT_VIEWS[node.type].footer
  if (own) return own(game, node)
  if (!provisioned(game, node))
    return { glyph: 'parts', text: 'Install parts', enabled: true, tone: 'accent' }
  if (node.life._tag === 'Stopped') {
    const price = replacePrice(game, node)
    return {
      glyph: 'replace',
      text: `Replace  ${priceLabel(game.sandbox, price)}`.trim(),
      enabled: game.cash >= price,
      tone: 'danger',
    }
  }
  const price = resizePrice(game, node)
  if (price === null) return { glyph: 'max', text: 'Largest size', enabled: false, tone: 'muted' }
  const resize = COMPONENT_VIEWS[node.type].resize
  const label = priceLabel(game.sandbox, price)
  return {
    ...(resize
      ? resize(label)
      : { glyph: 'resize' as const, text: `${sizeLabel(node, node.size + 1)}  ${label}`.trim() }),
    enabled: game.cash >= price,
    tone: game.cash >= price ? 'accent' : 'muted',
  }
}
