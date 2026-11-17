import { css, cx } from '@quorum/styled-system/css'
import { perSecond } from '@/game/per-second.ts'
import { serviceName, teamName } from './team.ts'
import { formats } from '@/i18n/format.ts'
import { changeIn } from '@/i18n/refusal.ts'
import { copyIn, localized, nodeTitle, type Messages } from '@/i18n/messages.ts'
import { copy, eraWords } from '@/i18n/messages.ts'
import { DashboardMessage } from '@/game/dashboard.ts'
import { createKeyedLazy, createLazy, type Html, type HtmlBuilder } from 'foldkit/html'
import { ChevronDown, Clock3, LayoutGrid, RefreshCw, Star, X } from 'lucide'
import { clockOf } from '@quorum/simulation/calendar'
import type { Limit } from '@quorum/simulation/capacity'
import {
  ALERT_RULES,
  ALERT_THRESHOLDS,
  DEVICES,
  ERAS,
  INCIDENTS,
  KINDS,
  LAYOFF_MORALE,
  PROFILES,
  REGION_INFO,
  REGIONS,
  REQUEST_KINDS,
  RESEARCH,
  type ComponentId,
  type Kind,
  type RegionId,
  type RequestKind,
  type ResearchId,
} from '@quorum/simulation/catalog'
import { churnOf, type RegionChurn } from '@quorum/simulation/churn'
import { ackAtOf, signalAtOf } from '@quorum/simulation/incident-machine'
import { ERROR_CAUSES } from '@quorum/simulation/distribution'
import { dilutionOf, grantOf } from '@quorum/simulation/founding'
import type { KindLedger, Ledger, NodeLedger } from '@quorum/simulation/ledger'
import { bootingOf, has } from '@quorum/simulation/lookups'
import { evictionShareOf } from '@quorum/simulation/rules'
import { regional, regionUsers } from '@quorum/simulation/regions'
import { RUNWAY_MONTH, runwayOf } from '@quorum/simulation/runway'
import { budgetOf, burnRateOf, slaCreditsOf } from '@quorum/simulation/slo'
import type { Game, Postmortem, Sample } from '@quorum/simulation/state'
import { ignored } from '@quorum/simulation/step'
import { teamOutputs } from '@quorum/simulation/team'
import {
  type Field,
  type History,
  TIERS,
  type Tier,
  blockIndexAt,
  startOf,
} from '@/game/history.ts'
import { isPhone } from '@/game/viewport.ts'
import { compact, money, rate as rateText } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import {
  ANNOTATION_GROUPS,
  type AnnotationGroup,
  type Mail,
  type Model,
  clockPaused,
  ledgerOf,
  boardSandbox,
} from '@/game/model.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { button } from '@quorum/ui/primitives/button'
import { Pie, PieChart } from '@quorum/ui/primitives/chart-core'
import {
  Area,
  type CartesianChild,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from '@quorum/ui/primitives/composed-chart'
import { EYEBROW, FIGURE, PANEL, SCROLL, WELL, FIGURE_STYLE } from '@quorum/ui/game/bits'

export const DASHBOARD_RANGE_MINUTES = [60, 360, 1440, 10_080, 43_200] as const

const NODE_HISTORY_EVERY_SIM_SECONDS = 10

const BLUE = 'var(--group-edge)'
const PURPLE = 'var(--group-compute)'
const TEAL = 'var(--group-data)'
const PINK = 'var(--group-ops)'
const GREEN = 'var(--ok)'
const AMBER = 'var(--warn)'
const RED = 'var(--danger)'
const MUTED = 'var(--muted-foreground)'

type Level = 'ok' | 'warn' | 'danger'
const LEVEL_COLOR: Record<Level, string> = { ok: GREEN, warn: AMBER, danger: RED }

type Thresholds = Readonly<{ warn: number; danger: number; invert?: boolean }>
const levelOf = (value: number, thresholds: Thresholds): Level =>
  thresholds.invert
    ? value <= thresholds.danger
      ? 'danger'
      : value <= thresholds.warn
        ? 'warn'
        : 'ok'
    : value >= thresholds.danger
      ? 'danger'
      : value >= thresholds.warn
        ? 'warn'
        : 'ok'

const hhmm = (time: number): string => {
  const { hour, minute } = clockOf(time)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const percent = (share: number, digits = 0): string => `${(share * 100).toFixed(digits)}%`

const sloText = (slo: number): string => `${Number((slo * 100).toFixed(3))}%`

type Row = Readonly<Record<string, number | string | null>>

const tierOf = (range: number): Tier | null =>
  range <= 600 ? null : range <= 10_080 ? 'quarter' : 'hour'

const labelOf = (t: Messages, time: number, range: number): string =>
  range > 1440 ? t.dashboard.dayAt(clockOf(time).day, hhmm(time)) : hhmm(time)

const rowsOf = (model: Model, slo: number): ReadonlyArray<Row> => {
  const range = model.board.dashboard.range
  const tier = tierOf(range)
  const source = tier === null ? model.board.game.history : model.board.dashboard.history[tier]
  const second = tier === null ? Math.floor(model.board.game.time) : 0
  const last = lastRows
  if (
    last !== null &&
    last.source === source &&
    last.second === second &&
    last.range === range &&
    last.locale === model.prefs.locale &&
    last.slo === slo
  )
    return last.rows
  const rows = buildRows(model, slo)
  lastRows = { source, second, range, locale: model.prefs.locale, slo, rows }
  return rows
}

let lastRows: Readonly<{
  source: ReadonlyArray<unknown>
  second: number
  range: number
  locale: Model['prefs']['locale']
  slo: number
  rows: ReadonlyArray<Row>
}> | null = null

const buildRows = (model: Model, slo: number): ReadonlyArray<Row> => {
  const t = copyIn(model.prefs.locale)
  const range = model.board.dashboard.range
  const tier = tierOf(range)
  const figures = (value: (field: Field) => number, at: number, span: number): Row => ({
    t: labelOf(t, at, range),
    at,
    span,
    users: value('users'),
    demand: value('demand'),
    served: value('served'),
    latency: value('latency'),
    p99: value('p99'),
    apdex: value('apdex'),
    errors: value('errors') * 100,
    availability: 100 - value('errors') * 100,
    revenue: value('revenue'),
    burn: value('burn'),
    cash: value('cash'),
    burnRate: value('errors') / (1 - slo),
  })
  if (tier === null) {
    const history = model.board.game.history
    const last = Math.floor(model.board.game.time)
    const kept = history.slice(Math.max(0, history.length - range))
    const rows = kept.map((sample: Sample, index) =>
      figures((field) => sample[field], last - (kept.length - 1 - index), 1),
    )
    return withCashRate(rows)
  }
  const { minutes } = TIERS[tier]
  const blocks = model.board.dashboard.history[tier]
  const rows = blocks
    .slice(Math.max(0, blocks.length - Math.ceil(range / minutes)))
    .map((block) =>
      figures(
        (field) =>
          field === 'p99' ? (block.max[field] ?? 0) : (block.sum[field] ?? 0) / block.count,
        startOf(block.index, tier),
        minutes,
      ),
    )
  return withCashRate(rows)
}

const withCashRate = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> =>
  rows.map((row, index) => {
    const previous = rows[index - 1]
    const seconds = previous === undefined ? 0 : Number(row.at) - Number(previous.at)
    return {
      ...row,
      cashRate:
        previous === undefined || seconds <= 0
          ? null
          : (Number(row.cash) - Number(previous.cash)) / seconds,
    }
  })

const rowAt = (rows: ReadonlyArray<Row>, time: number): number | null => {
  const index = rows.findIndex(
    (entry) => Number(entry.at) <= time && time < Number(entry.at) + Number(entry.span),
  )
  return index < 0 ? null : index
}

const DAY_SECONDS = 86_400

const COMPARE_COLOR = 'color-mix(in oklab, var(--foreground) 32%, transparent)'

const compareTier = (range: number): Tier => tierOf(range) ?? 'quarter'

const yesterdayOf = (
  blocks: History[Tier],
  tier: Tier,
  rows: ReadonlyArray<Row>,
  field: Field,
): ReadonlyArray<number | null> => {
  const means = new Map(
    blocks.map((block) => {
      const sum = block.sum[field]
      return [block.index, sum === undefined ? null : sum / Math.max(1, block.count)] as const
    }),
  )
  return rows.map((row) => means.get(blockIndexAt(Number(row.at) - DAY_SECONDS, tier)) ?? null)
}

type Compared = Readonly<{
  blocks: ReadonlyArray<unknown>
  data: ReadonlyArray<Row>
  any: boolean
}>

const compared = new WeakMap<ReadonlyArray<Row>, Map<string, Compared>>()

const comparedRows = (
  blocks: History[Tier],
  tier: Tier,
  rows: ReadonlyArray<Row>,
  key: string,
  field: Field,
): Compared => {
  const charts = compared.get(rows) ?? new Map<string, Compared>()
  compared.set(rows, charts)
  const kept = charts.get(key)
  if (kept !== undefined && kept.blocks === blocks) return kept
  const values = yesterdayOf(blocks, tier, rows, field)
  const next: Compared = {
    blocks,
    data: rows.map((row, index) => ({ ...row, cmp: values[index] ?? null })),
    any: values.some((value) => value !== null),
  }
  charts.set(key, next)
  return next
}

const namesOf = (t: Messages, nodes: Game['nodes']): ReadonlyMap<string, string> => {
  const counts = new Map<string, number>()
  const names = new Map<string, string>()
  for (const node of nodes) {
    const base = t.catalog.components[node.type].name
    const count = (counts.get(base) ?? 0) + 1
    counts.set(base, count)
    names.set(node.id, count > 1 ? `${base} ${count}` : base)
  }
  return names
}

type NodeTrack = Readonly<{ id: string; name: string; values: ReadonlyArray<number> }>

const tracksOf = (model: Model): ReadonlyArray<NodeTrack> => {
  const t = copyIn(model.prefs.locale)
  const history = model.board.nodeHistory
  const named = model.board.game.nodes
    .filter((node) => node.type !== 'users')
    .map((node) => ({ id: node.id, name: nodeTitle(t, model.board.game, node) }))
  const known = lastTracks
  if (
    known !== null &&
    known.history === history &&
    known.tracks.length === named.length &&
    named.every(
      (node, index) =>
        known.tracks[index]?.id === node.id && known.tracks[index]?.name === node.name,
    )
  )
    return known.tracks
  const tracks = named.map((node) => ({
    ...node,
    values: (history[node.id] ?? []).map((sample) => sample.utilization),
  }))
  lastTracks = { history, tracks }
  return tracks
}

let lastTracks: Readonly<{
  history: Model['board']['nodeHistory']
  tracks: ReadonlyArray<NodeTrack>
}> | null = null

const runwayText = (t: Messages, seconds: number | null): string =>
  seconds === null ? '∞' : t.dashboard.runwayMonths((seconds / RUNWAY_MONTH).toFixed(1))

type FundingRound = Readonly<{
  key: string
  name: string
  users: number
  grant: number | null
  dilution: number
  answer: 'listed' | 'raised' | 'declined' | null
  when: string
}>

const fundingOf = (model: Model): ReadonlyArray<FundingRound> => {
  const t = copyIn(model.prefs.locale)
  const game = model.board.game
  const answers = new Map(model.board.inbox.mail.map((mail) => [mail.key, mail]))
  const rounds: Array<FundingRound> = []
  for (let index = 0; index < Math.min(game.stage, ERAS.length - 1); index += 1) {
    const era = ERAS[index]
    const next = ERAS[index + 1]
    if (!era || !next) continue
    const mail = answers.get(`investor:round:${index}`)
    const at = mail?.entries[0]
    const ipo = index === ERAS.length - 2
    rounds.push({
      key: `round-${index}`,
      name: t.catalog.eras[index + 1]?.name ?? next.name,
      users: era.raiseAt,
      grant: ipo ? null : grantOf(game, era.grant),
      dilution: dilutionOf(game, era.dilution),
      answer: ipo
        ? 'listed'
        : mail?.phase._tag === 'Answered' && mail.phase.answer === 'You raised the round.'
          ? 'raised'
          : mail?.phase._tag === 'Answered' && mail.phase.answer === 'You declined the round.'
            ? 'declined'
            : null,
      when: at === undefined ? '—' : t.dashboard.dayAt(clockOf(at.time).day, hhmm(at.time)),
    })
  }
  return rounds.reverse()
}

const teamKindOf = (
  t: Messages,
): Readonly<Record<'product' | 'platform' | 'sre' | 'data' | 'security', string>> => ({
  product: t.dashboard.product,
  platform: t.dashboard.platform,
  sre: 'SRE',
  data: t.dashboard.data,
  security: t.dashboard.security,
})

const dhPerMinute = (rate: number): string => {
  const value = rate * 60
  return value < 10 ? value.toFixed(1) : String(Math.round(value))
}

const minutesText = (t: Messages, seconds: number): string =>
  t.units.minShort(Math.round(Math.max(0, seconds)))

const minutesOrUnknown = (t: Messages, seconds: number | null | undefined): string =>
  seconds === null || seconds === undefined ? '—' : minutesText(t, seconds)

const mttdOf = (incident: NonNullable<Game['incident']>): number | null =>
  signalAtOf(incident.phase) === null
    ? null
    : Math.max(0, (signalAtOf(incident.phase) ?? 0) - incident.startedAt)

const mttaOf = (incident: NonNullable<Game['incident']>): number | null =>
  ackAtOf(incident.phase) === null || signalAtOf(incident.phase) === null
    ? null
    : Math.max(0, (ackAtOf(incident.phase) ?? 0) - (signalAtOf(incident.phase) ?? 0))

const incidentTarget = (
  t: Messages,
  game: Game,
  incident: NonNullable<Game['incident']>,
): string => {
  if (incident.nodeId !== null)
    return namesOf(t, game.nodes).get(incident.nodeId) ?? incident.nodeId
  if (incident.zone !== null) return t.dashboard.zone(incident.zone.toUpperCase())
  if (incident.region !== null) return t.catalog.regionInfo[incident.region].name
  return t.dashboard.everyRegion
}

const actionText = (t: Messages, game: Game, postmortem: Postmortem): string =>
  postmortem.action === null
    ? '—'
    : has(game, postmortem.action)
      ? t.dashboard.ownedAction(t.catalog.research[postmortem.action].name)
      : t.catalog.research[postmortem.action].name

const led = (color: string, h: HtmlBuilder<Message>): Html =>
  h.span(
    [
      h.Class(
        css({
          width: '7px',
          height: '7px',
          flexShrink: '0',
          borderRadius: 'full',
        }),
      ),
      h.Style({
        background: color,
        boxShadow: `0 0 0 2px color-mix(in oklab, ${color} 22%, transparent), 0 0 6px color-mix(in oklab, ${color} 55%, transparent)`,
      }),
    ],
    [],
  )

const SCREEN = css({ borderRadius: 'xl', backgroundColor: 'well', boxShadow: 'well' })

const SPAN = {
  stat: css({ gridColumn: 'span 4 / span 4', _compact: { gridColumn: 'span 12 / span 12' } }),
  third: css({ gridColumn: 'span 8 / span 8', _compact: { gridColumn: 'span 24 / span 24' } }),
  half: css({ gridColumn: 'span 12 / span 12', _compact: { gridColumn: 'span 24 / span 24' } }),
  twoThirds: css({
    gridColumn: 'span 16 / span 16',
    _compact: { gridColumn: 'span 24 / span 24' },
  }),
  full: css({ gridColumn: 'span 24 / span 24' }),
}

const panel = (
  key: string,
  span: string,
  title: string,
  unit: string,
  body: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
  tint: Level | null = null,
  accent: string = MUTED,
): Html =>
  h.div(
    [
      h.Key(key),
      h.DataAttribute('panel', key),
      h.Class(
        cx(
          css({
            display: 'flex',
            minWidth: '0',
            flexDirection: 'column',
            gap: '1',
            borderRadius: '2xl',
            layerStyle: 'surface',
            padding: '1.5',
            boxShadow: 'card',
          }),
          span,
        ),
      ),
      ...(tint
        ? [
            h.Style({
              background: `linear-gradient(to bottom, color-mix(in oklab, ${LEVEL_COLOR[tint]} 16%, var(--card)), var(--card) 64px)`,
            }),
          ]
        : []),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              height: '5',
              flexShrink: '0',
              alignItems: 'center',
              gap: '2',
              paddingInline: '1.5',
            }),
          ),
        ],
        [
          led(tint ? LEVEL_COLOR[tint] : accent, h),
          h.span(
            [
              h.Class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'type.12-5',
                  fontWeight: 'semibold',
                  letterSpacing: 'subtle',
                }),
              ),
            ],
            [title],
          ),
          unit
            ? h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 'type.10-5',
                        color: 'mutedForeground',
                      }),
                    ),
                  ),
                ],
                [unit],
              )
            : h.empty,
        ],
      ),
      ...body,
    ],
  )

const locked = (
  key: string,
  span: string,
  title: string,
  research: ResearchId,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return panel(
    key,
    span,
    title,
    '',
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                display: 'grid',
                minHeight: '120px',
                flex: '1 1 0%',
                placeItems: 'center',
                backgroundImage:
                  'repeating-linear-gradient(135deg,transparent 0 7px,var(--hairline) 7px 8px)',
              }),
            ),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    borderRadius: 'lg',
                    layerStyle: 'raised',
                    paddingInline: '2.5',
                    paddingBlock: '1',
                    fontSize: 'type.11',
                    color: 'mutedForeground',
                    boxShadow: 'raised',
                  }),
                ),
              ),
            ],
            [t.dashboard.noDataResearch(research)],
          ),
        ],
      ),
    ],
    h,
  )
}

const rowHeader = (label: string, count: number, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Key(`row-${label}`),
      h.DataAttribute('row', label),
      h.Class(
        css({
          gridColumn: 'span 24 / span 24',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5',
          paddingTop: '2',
          paddingBottom: '0',
        }),
      ),
    ],
    [
      icon(
        h,
        ChevronDown,
        css({
          width: '3.5',
          height: '3.5',
          color: 'mutedForeground',
        }),
      ),
      h.span(
        [
          h.Class(
            css({
              fontSize: 'type.13',
              fontWeight: 'semibold',
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
                fontSize: 'type.11',
                color: 'mutedForeground',
              }),
            ),
          ),
        ],
        [copy(h).dashboard.panelCount(count)],
      ),
    ],
  )

const PLOT = css({
  '& text': {
    fontFamily: 'mono',
    fontSize: 'type.10',
    fill: 'mutedForeground',
    letterSpacing: 'subtle',
    pointerEvents: 'none',
  },
  '& path': { pointerEvents: 'none' },
  '& line': { pointerEvents: 'none' },
})

const CHART_HEIGHT = 168
const CHART_MARGIN = { top: 10, right: 12, bottom: 0, left: 2 } as const
const Y_AXIS_WIDTH = 58
const X_AXIS_PAD = 32

const TOP_OF_PLOT = -(CHART_HEIGHT - 60)

const GRID_GAP = 8
const GRID_PADDING = { wide: 32, compact: 24 } as const
const PANEL_PADDING = 12

const panelWidthOf = (columns: number, compactColumns = 24): number => {
  const compact = isPhone()
  const shown = compact ? compactColumns : columns
  const viewport = typeof window === 'undefined' ? 1600 : window.innerWidth
  const padding = compact ? GRID_PADDING.compact : GRID_PADDING.wide
  const column = (viewport - padding - GRID_GAP * 23) / 24
  return Math.round(column * shown + GRID_GAP * (shown - 1))
}

const plotX = (index: number, count: number, width: number): number => {
  const left = CHART_MARGIN.left + Y_AXIS_WIDTH + X_AXIS_PAD
  const right = width - CHART_MARGIN.right
  return left + ((right - left) * (index + 0.5)) / Math.max(1, count)
}

const typeScaleOf = (model: Model): number => (model.prefs.text === 'large' ? 1.5 : 1)

const ANNOTATION_COLOR: Record<AnnotationGroup, string> = {
  design: BLUE,
  deploys: PURPLE,
  incidents: RED,
  company: PINK,
  research: GREEN,
}

const annotationNameOf = (t: Messages): Record<AnnotationGroup, string> => ({
  design: t.dashboard.designChange,
  deploys: t.dashboard.deploy,
  incidents: t.dashboard.incident,
  company: t.dashboard.company,
  research: t.dashboard.research,
})

type Annotation = Readonly<{ group: AnnotationGroup; at: number; label: string }>

const keyParts = (mail: Mail): ReadonlyArray<string> => mail.key.split(':')

const incidentNameOf = (t: Messages, topic: string): string =>
  (t.catalog.incidents as Readonly<Record<string, Readonly<{ name: string }> | undefined>>)[topic]
    ?.name ?? t.dashboard.incident

const RESEARCH_NAMES: ReadonlyArray<readonly [string, ResearchId]> = (
  Object.entries(RESEARCH) as ReadonlyArray<[ResearchId, Readonly<{ name: string }>]>
)
  .map(([id, entry]) => [entry.name, id] as const)
  .sort((left, right) => right[0].length - left[0].length)

const WORD = /[\p{L}\p{N}]/u

const researchNamed = (text: string): ResearchId | null => {
  for (const [name, id] of RESEARCH_NAMES) {
    const at = text.indexOf(name)
    if (at < 0) continue
    const before = text[at - 1]
    const after = text[at + name.length]
    if (before !== undefined && WORD.test(before)) continue
    if (after !== undefined && WORD.test(after)) continue
    return id
  }
  return null
}

const markOfMail = (
  t: Messages,
  mail: Mail,
): Readonly<{ group: AnnotationGroup; label: string }> | null => {
  const [from, topic, about] = keyParts(mail)
  if (from === 'event' && topic !== undefined) {
    if (topic === 'deployed') return { group: 'deploys', label: `⇢ ${t.dashboard.deploy}` }
    if (topic === 'deployed-bad') return { group: 'deploys', label: `⇢ ${t.dashboard.badDeploy}` }
    if (topic.startsWith('incident-'))
      return {
        group: 'incidents',
        label: `▲ ${incidentNameOf(t, topic.slice('incident-'.length))}`,
      }
    if (topic === 'hired') return { group: 'company', label: `◆ ${t.dashboard.hired}` }
  }
  if (mail.key === 'mentor:ipo') return { group: 'company', label: '◆ IPO' }
  if (from === 'investor' && topic === 'round') {
    const stage = Number(about)
    const era = t.catalog.eras[Number.isFinite(stage) ? stage + 1 : 0]?.name
    return { group: 'company', label: `◆ ${t.dashboard.roundOf(era ?? t.dashboard.funding)}` }
  }
  return null
}

const buildAnnotations = (model: Model): ReadonlyArray<Annotation> => {
  const t = copyIn(model.prefs.locale)

  const shown = model.board.dashboard.groups
  const incident = model.board.game.incident
  const open: ReadonlyArray<Annotation> = incident
    ? [
        {
          group: 'incidents',
          at: incident.startedAt,
          label: `▲ SEV${incident.severity} ${t.catalog.incidents[incident.kind].name}`,
        },
      ]
    : []
  const design: ReadonlyArray<Annotation> = model.board.undo.map((entry) => ({
    group: 'design',
    at: entry.at,
    label: changeIn(t, entry.label),
  }))
  const marked = new Set(open.map((mark) => `${mark.group}:${Math.floor(mark.at)}`))
  const mail: Array<Annotation> = []
  for (const thread of model.board.inbox.mail) {
    const mark = markOfMail(t, thread)
    if (mark === null) continue
    for (const entry of thread.entries)
      if (!marked.has(`${mark.group}:${Math.floor(entry.time)}`))
        mail.push({ ...mark, at: entry.time })
  }
  const finished: Array<Annotation> = model.board.inbox.mail
    .filter((thread) => thread.key.startsWith('event:finished:'))
    .flatMap((thread) =>
      thread.entries.flatMap((entry) =>
        researchNamed(entry.text) === null
          ? []
          : [{ group: 'research' as const, at: entry.time, label: `⬡ ${t.dashboard.research}` }],
      ),
    )
  const game = model.board.game
  const era: ReadonlyArray<Annotation> =
    game.stage > 0 && game.stageAt > 0
      ? [
          {
            group: 'company',
            at: game.stageAt,
            label: `◇ ${t.catalog.eras[game.stage]?.name ?? ''}`,
          },
        ]
      : []
  return [...design, ...open, ...mail, ...finished, ...era].filter((mark) =>
    shown.includes(mark.group),
  )
}

const annotationsOf = (model: Model): ReadonlyArray<Annotation> => {
  const { game, undo, inbox, dashboard } = model.board
  const from: AnnotationSource = [
    model.prefs.locale,
    dashboard.groups,
    undo,
    inbox.mail,
    game.stage,
    game.stageAt,
    game.incident?.startedAt ?? null,
    game.incident?.severity ?? null,
    game.incident?.kind ?? null,
  ]
  const last = lastAnnotations
  if (last !== null && last.from.every((value, index) => value === from[index])) return last.marks
  const marks = buildAnnotations(model)
  lastAnnotations = { from, marks }
  return marks
}

type AnnotationSource = ReadonlyArray<unknown>
let lastAnnotations: Readonly<{
  from: AnnotationSource
  marks: ReadonlyArray<Annotation>
}> | null = null

type Exemplar = Readonly<{ t: string; p99: number; kind: RequestKind }>

const exemplarsOf = (model: Model, rows: ReadonlyArray<Row>): ReadonlyArray<Exemplar> => {
  if (tierOf(model.board.dashboard.range) !== null) return NO_EXEMPLARS
  const known = exemplarsFor.get(rows)
  if (known !== undefined) return known
  const history = model.board.game.history
  const kept = history.slice(Math.max(0, history.length - rows.length))
  const found: Array<Exemplar> = []
  kept.forEach((sample, index) => {
    const row = rows[index]
    if (sample.slow !== null && sample.p99 > 0 && row !== undefined)
      found.push({ t: String(row.t), p99: sample.p99, kind: sample.slow })
  })
  const slowest = found.toSorted((a, b) => b.p99 - a.p99).slice(0, 3)
  exemplarsFor.set(rows, slowest)
  return slowest
}

const NO_EXEMPLARS: ReadonlyArray<Exemplar> = []
const exemplarsFor = new WeakMap<ReadonlyArray<Row>, ReadonlyArray<Exemplar>>()

const exemplarMarks = (
  exemplars: ReadonlyArray<Exemplar>,
  scale: number,
): ReadonlyArray<CartesianChild> =>
  exemplars.map((exemplar) =>
    ReferenceLine({
      x: exemplar.t,
      stroke: 'var(--accent)',
      strokeOpacity: 0.6,
      label: {
        value: '●',
        dx: 0,
        dy: TOP_OF_PLOT + ((LABEL_LANES + REVEAL_LANES) * LANE_HEIGHT + 6) * scale,
        fill: 'var(--accent)',
      },
    }),
  )

const exemplarStrip = (exemplars: ReadonlyArray<Exemplar>, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Key('exemplars'),
      h.Class(
        css({
          gridColumn: 'span 24 / span 24',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
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
              color: 'mutedForeground',
            }),
          ),
        ],
        [exemplars.length === 0 ? t.dashboard.noExemplarInThisRange : t.dashboard.exemplars],
      ),
      ...exemplars.map((exemplar) =>
        button(
          {
            size: 'sm',
            variant: 'outline',
            onClick: Message.DashboardChanged({
              message: DashboardMessage.KindChosen({ kind: exemplar.kind }),
            }),
            attributes: [h.Title(t.dashboard.openWaterfall(t.catalog.kinds[exemplar.kind].label))],
          },
          [
            `● ${exemplar.t} · ${formats(t).ms(exemplar.p99)} · ${t.catalog.kinds[exemplar.kind].label}`,
          ],
          h,
        ),
      ),
    ],
  )
}

type LabelPlace = Readonly<{ lane: number; dx: number }>

const LABEL_ORDER: Record<AnnotationGroup, number> = {
  incidents: 0,
  company: 1,
  deploys: 2,
  design: 3,
  research: 4,
}

const LABEL_LANES = 2
const REVEAL_LANES = 2
const LANE_HEIGHT = 12
const LABEL_GAP = 6
const LABEL_PAD = 14
const REVEAL_PX = 4

const WIDE_GLYPH =
  /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/u

const labelSpan = (label: string, scale: number): number =>
  Array.from(label).reduce(
    (width, glyph) => width + (WIDE_GLYPH.test(glyph) ? 12.4 : 6.2),
    LABEL_PAD,
  ) * scale

const labelPlacesOf = (
  marks: ReadonlyArray<Annotation>,
  rows: ReadonlyArray<Row>,
  width: number,
  scale: number,
  hovered: number | null,
): ReadonlyMap<Annotation, LabelPlace> => {
  const lanes: Array<Array<readonly [number, number]>> = Array.from(
    { length: LABEL_LANES + REVEAL_LANES },
    () => [],
  )
  const placed = new Map<Annotation, LabelPlace>()
  const right = width - CHART_MARGIN.right

  const place = (mark: Annotation, from: number): boolean => {
    const index = rowAt(rows, Math.floor(mark.at))
    if (index === null) return false
    const x = plotX(index, rows.length, width)
    const span = labelSpan(mark.label, scale)
    const dx = x + 4 + span > right ? -span - 4 : 4
    const start = x + dx - LABEL_GAP
    const end = x + dx + span + LABEL_GAP
    for (let lane = from; lane < lanes.length; lane += 1) {
      const taken = lanes[lane]
      if (taken === undefined || taken.some(([head, tail]) => start < tail && head < end)) continue
      taken.push([start, end])
      placed.set(mark, { lane, dx })
      return true
    }
    return false
  }

  const ordered = [...marks].sort(
    (left, right) => LABEL_ORDER[left.group] - LABEL_ORDER[right.group] || left.at - right.at,
  )
  const dropped: Array<Annotation> = []
  for (const mark of ordered) if (!place(mark, 0)) dropped.push(mark)

  if (hovered !== null) {
    const plotLeft = CHART_MARGIN.left + Y_AXIS_WIDTH + X_AXIS_PAD
    const rowWidth = (right - plotLeft) / Math.max(1, rows.length)
    const reach = Math.max(1, Math.round(REVEAL_PX / rowWidth))
    const near = dropped.flatMap((mark) => {
      const index = rowAt(rows, Math.floor(mark.at))
      if (index === null) return []
      const distance = Math.abs(index - hovered)
      return distance <= reach ? [{ mark, distance }] : []
    })
    near.sort(
      (left, right) =>
        left.distance - right.distance ||
        LABEL_ORDER[left.mark.group] - LABEL_ORDER[right.mark.group],
    )
    for (const { mark } of near) place(mark, LABEL_LANES)
  }
  return placed
}

const markersOf = (
  scale: number,
  hover: number | null,
  marks: ReadonlyArray<Annotation>,
  rows: ReadonlyArray<Row>,
  width: number,
): ReadonlyArray<CartesianChild> => {
  const places = labelPlacesOf(
    marks,
    rows,
    width,
    scale,
    hover !== null && hover >= 0 && hover < rows.length ? hover : null,
  )
  return marks.flatMap((mark) => {
    const index = rowAt(rows, Math.floor(mark.at))
    const row = index === null ? undefined : rows[index]
    if (row === undefined) return []
    const color = ANNOTATION_COLOR[mark.group]
    const place = places.get(mark)
    return [
      ReferenceLine({
        x: String(row.t),
        stroke: color,
        strokeDasharray: '3 3',
        ...(place === undefined
          ? {}
          : {
              label: {
                value: mark.label,
                dx: place.dx,
                dy: TOP_OF_PLOT + place.lane * LANE_HEIGHT * scale,
                fill: color,
              },
            }),
      }),
    ]
  })
}

type Series = Readonly<{
  key: string
  name: string
  color: string
  fill?: boolean
  dashed?: boolean
  faint?: boolean
}>

type SeriesSpec = Readonly<{
  key: string
  span: string
  title: string
  unit: string
  series: ReadonlyArray<Series>
  format: (value: number) => string
  compare?: Field
  rules?: ReadonlyArray<Readonly<{ y: number; label: string; color: string }>>
  domain?: readonly [number, number]
  columns: number
}>

const gradient = (id: string, color: string, h: HtmlBuilder<Message>): Html =>
  h.linearGradient(
    [
      h.Id(id),
      h.Attribute('x1', '0'),
      h.Attribute('y1', '0'),
      h.Attribute('x2', '0'),
      h.Attribute('y2', '1'),
    ],
    [
      h.stop(
        [
          h.Attribute('offset', '0%'),
          h.Attribute('stop-color', color),
          h.Attribute('stop-opacity', '0.45'),
        ],
        [],
      ),
      h.stop(
        [
          h.Attribute('offset', '100%'),
          h.Attribute('stop-color', color),
          h.Attribute('stop-opacity', '0'),
        ],
        [],
      ),
    ],
  )

const figuresOf = (rows: ReadonlyArray<Row>, key: string): ReadonlyArray<number> =>
  rows.flatMap((row) => (typeof row[key] === 'number' ? [row[key] as number] : []))

const seriesLegend = (
  rows: ReadonlyArray<Row>,
  series: ReadonlyArray<Series>,
  spec: SeriesSpec,
  hovered: Row | undefined,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: '4',
          rowGap: '0.5',
          paddingInline: '1.5',
          paddingBottom: '0.5',
          fontSize: 'type.11',
        }),
      ),
    ],
    [
      ...(hovered
        ? [
            h.span(
              [
                h.Key('at'),
                h.Class(
                  cx(
                    FIGURE,
                    css({
                      color: 'mutedForeground',
                    }),
                  ),
                ),
              ],
              [String(hovered.t)],
            ),
          ]
        : []),
      ...series.map((entry) => {
        const values = figuresOf(rows, entry.key)
        const last = values[values.length - 1] ?? 0
        const max = Math.max(...values)
        const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
        return h.span(
          [
            h.Key(entry.key),
            h.Class(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '1.5',
                whiteSpace: 'nowrap',
              }),
            ),
          ],
          [
            h.span(
              [
                h.Class(
                  css({
                    height: '3px',
                    width: '3.5',
                    borderRadius: 'full',
                  }),
                ),
                h.Style({ background: entry.color }),
              ],
              [],
            ),
            h.span(
              [
                h.Class(
                  css({
                    color: 'foreground',
                  }),
                ),
              ],
              [entry.name],
            ),
            h.span(
              [
                h.Class(
                  cx(
                    FIGURE,
                    css({
                      color: 'mutedForeground',
                    }),
                  ),
                ),
              ],
              hovered
                ? [spec.format(Number(hovered[entry.key]))]
                : [t.dashboard.meanMaxLast(spec.format(mean), spec.format(max), spec.format(last))],
            ),
          ],
        )
      }),
    ],
  )
}

const seriesTable = (
  data: ReadonlyArray<Row>,
  series: ReadonlyArray<Series>,
  spec: SeriesSpec,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const border = css({
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderColor: 'hairline',
    paddingInline: '2',
    paddingBlock: '1',
  })
  const figure = (row: Row, key: string): string => {
    const value = row[key]
    return typeof value === 'number' ? spec.format(value) : '—'
  }
  return h.div(
    [
      h.Class(
        cx(
          SCREEN,
          css({
            maxHeight: '210px',
            minHeight: '0',
            flex: '1 1 0%',
            overflow: 'auto',
            paddingInline: '1',
            paddingBottom: '1',
          }),
          SCROLL,
        ),
      ),
    ],
    [
      h.table(
        [
          h.DataAttribute('table', spec.key),
          h.Class(
            css({
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'type.11-5',
            }),
          ),
        ],
        [
          h.caption(
            [
              h.Class(
                css({
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  padding: '0',
                  margin: '-1px',
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  borderWidth: '0',
                }),
              ),
            ],
            [`${spec.title} · ${spec.unit}`],
          ),
          h.thead(
            [],
            [
              h.tr(
                [
                  h.Class(
                    css({
                      fontSize: 'type.11',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [
                  h.th(
                    [
                      h.Class(
                        cx(
                          border,
                          css({
                            textAlign: 'left',
                            fontWeight: 'medium',
                          }),
                        ),
                      ),
                    ],
                    [t.dashboard.time],
                  ),
                  ...series.map((entry) =>
                    h.th(
                      [
                        h.Key(entry.key),
                        h.Class(
                          cx(
                            border,
                            css({
                              textAlign: 'right',
                              fontWeight: 'medium',
                            }),
                          ),
                        ),
                      ],
                      [entry.name],
                    ),
                  ),
                ],
              ),
            ],
          ),
          h.tbody(
            [],
            data.map((row, index) =>
              h.tr(
                [
                  h.Key(`${String(row.t)}-${index}`),
                  h.Class(
                    css({
                      _hover: {
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 3%, transparent)',
                      },
                    }),
                  ),
                ],
                [
                  h.td([h.Class(cx(border, FIGURE))], [String(row.t)]),
                  ...series.map((entry) =>
                    h.td(
                      [
                        h.Key(entry.key),
                        h.Class(
                          cx(
                            border,
                            FIGURE,
                            css({
                              textAlign: 'right',
                            }),
                          ),
                        ),
                      ],
                      [figure(row, entry.key)],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  )
}

type ChartInput = [
  rows: ReadonlyArray<Row>,
  marks: ReadonlyArray<Annotation>,
  exemplars: ReadonlyArray<Exemplar>,
  spec: SeriesSpec,
  width: number,
  hover: number | null,
  compared: boolean,
  table: boolean,
  blocks: History[Tier],
  tier: Tier,
  scale: number,
  h: HtmlBuilder<Message>,
]

const timeSeries = (
  model: Model,
  rows: ReadonlyArray<Row>,
  marks: ReadonlyArray<Annotation>,
  exemplars: ReadonlyArray<Exemplar>,
  spec: SeriesSpec,
  h: HtmlBuilder<Message>,
): Html => {
  const { hover, compare, table, history, range } = model.board.dashboard
  const tier = compareTier(range)
  const input: ChartInput = [
    rows,
    marks,
    exemplars,
    keptSpec(spec, h),
    panelWidthOf(spec.columns),
    hover,
    compare,
    table,
    history[tier],
    tier,
    typeScaleOf(model),
    h,
  ]
  return lazyChart(spec.key, timeSeriesView, input)
}

const lazyChart = createKeyedLazy()

const keptSpec = (spec: SeriesSpec, h: HtmlBuilder<Message>): SeriesSpec => {
  const said = JSON.stringify(spec)
  const last = specs.get(spec.key)
  if (last !== undefined && last.said === said && last.h === h) return last.spec
  specs.set(spec.key, { said, h, spec })
  return spec
}
const specs = new Map<
  string,
  Readonly<{ said: string; h: HtmlBuilder<Message>; spec: SeriesSpec }>
>()

const timeSeriesView = (...input: ChartInput): Html => {
  const [rows, marks, exemplars, spec, width, hover, compared, table, blocks, tier, scale, h] =
    input
  const t = copy(h)
  const markers: ReadonlyArray<CartesianChild> = [
    ...markersOf(scale, hover, marks, rows, width),
    ...exemplarMarks(exemplars, scale),
  ]
  const hovered = hover !== null ? rows[hover] : undefined
  const id = (series: Series) => `fill-${spec.key}-${series.key}`
  const yesterday =
    spec.compare === undefined || !compared
      ? null
      : comparedRows(blocks, tier, rows, spec.key, spec.compare)
  const compare = yesterday !== null && yesterday.any
  const series: ReadonlyArray<Series> = compare
    ? [
        ...spec.series,
        { key: 'cmp', name: t.dashboard.yesterday, color: COMPARE_COLOR, faint: true },
      ]
    : spec.series
  const data: ReadonlyArray<Row> = compare && yesterday !== null ? yesterday.data : rows
  const line = (entry: Series): CartesianChild =>
    Line({
      dataKey: entry.key,
      name: entry.name,
      stroke: entry.color,
      strokeWidth: 1.5,
      type: 'linear',
      dot: false,
      activeDot: { r: 3, fill: entry.color, stroke: 'var(--card)' },
      ...(entry.faint ? { strokeDasharray: '5 3' } : {}),
      ...(entry.dashed ? { strokeDasharray: '4 3' } : {}),
    })
  return panel(
    spec.key,
    spec.span,
    spec.title,
    spec.unit,
    [
      ...(table
        ? [seriesTable(data, series, spec, h)]
        : [
            h.div(
              [
                h.Class(
                  cx(
                    SCREEN,
                    css({
                      minHeight: '0',
                      flex: '1 1 0%',
                      paddingInline: '1',
                      paddingTop: '1',
                    }),
                  ),
                ),
              ],
              [
                ComposedChart(
                  {
                    data,
                    responsive: true,
                    width,
                    height: CHART_HEIGHT,
                    margin: CHART_MARGIN,
                    title: spec.title,
                    className: PLOT,
                    accessibilityLayer: true,
                    activeIndex: hover,
                    onActiveIndexChange: (index) =>
                      Message.DashboardChanged({ message: DashboardMessage.Hovered({ index }) }),
                    defs: series
                      .filter((entry) => entry.fill)
                      .map((entry) => gradient(id(entry), entry.color, h)),
                    children: [
                      CartesianGrid({ stroke: 'var(--hairline)' }),
                      XAxis({
                        dataKey: 't',
                        interval: Math.max(0, Math.ceil(rows.length / (width / 70)) - 1),
                        padding: { left: X_AXIS_PAD },
                        tick: ({ x, y, value }) =>
                          h.text(
                            [
                              h.Attribute('x', String(x)),
                              h.Attribute('y', String(y - 14)),
                              h.Attribute('text-anchor', x + 30 > width ? 'end' : 'middle'),
                            ],
                            [String(value)],
                          ),
                        stroke: 'var(--hairline)',
                      }),
                      YAxis({
                        width: Y_AXIS_WIDTH,
                        tickCount: 5,
                        ...(spec.domain ? { domain: spec.domain } : {}),
                        tickFormatter: (value) => spec.format(Number(value)),
                        stroke: 'transparent',
                      }),
                      Tooltip({ content: 'none' }),
                      ...(spec.rules ?? []).map((rule) =>
                        ReferenceLine({
                          y: rule.y,
                          stroke: rule.color,
                          strokeDasharray: '6 4',
                          label: { value: rule.label, dy: -6, fill: rule.color },
                        }),
                      ),
                      ...markers,
                      ...(hovered
                        ? [
                            ReferenceLine({
                              x: String(hovered.t),
                              stroke: 'var(--foreground)',
                              strokeOpacity: 0.4,
                            }),
                          ]
                        : []),
                      ...series.filter((entry) => entry.faint).map(line),
                      ...series
                        .filter((entry) => !entry.faint)
                        .map((entry) =>
                          entry.fill
                            ? Area({
                                dataKey: entry.key,
                                name: entry.name,
                                stroke: entry.color,
                                strokeWidth: 1.5,
                                fill: `url(#${id(entry)})`,
                                fillOpacity: 1,
                                type: 'linear',
                              })
                            : line(entry),
                        ),
                    ],
                  },
                  h,
                ),
              ],
            ),
          ]),
      seriesLegend(data, series, spec, hovered, h),
    ],
    h,
    null,
    spec.series[0]?.color,
  )
}

const sparkDomain = (
  rows: ReadonlyArray<Row>,
  key: string,
  signed: boolean,
): readonly [number, number] => {
  const values = figuresOf(rows, key)
  const top = Math.max(1e-9, ...values) * 1.6
  return signed ? [Math.min(0, ...values), top] : [0, top]
}

const stat = (
  key: string,
  title: string,
  value: string,
  level: Level | 'plain',
  rows: ReadonlyArray<Row>,
  dataKey: string,
  color: string,
  h: HtmlBuilder<Message>,
  background = false,
  signed = false,
): Html =>
  lazyStat(key, statView, [key, title, value, level, rows, dataKey, color, h, background, signed])

const lazyStat = createKeyedLazy()

const statView = (
  key: string,
  title: string,
  value: string,
  level: Level | 'plain',
  rows: ReadonlyArray<Row>,
  dataKey: string,
  color: string,
  h: HtmlBuilder<Message>,
  background: boolean,
  signed: boolean,
): Html =>
  panel(
    key,
    SPAN.stat,
    title,
    '',
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                position: 'relative',
                display: 'flex',
                minHeight: '92px',
                flex: '1 1 0%',
                flexDirection: 'column',
                justifyContent: 'center',
                overflow: 'hidden',
              }),
            ),
          ),
          ...(background && level !== 'plain' && level !== 'ok'
            ? [
                h.Style({
                  background: `color-mix(in oklab, ${LEVEL_COLOR[level]} 18%, var(--well))`,
                }),
              ]
            : []),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  position: 'absolute',
                  insetInline: '0',
                  bottom: '0',
                  height: '46px',
                  opacity: 0.9,
                }),
              ),
            ],
            [
              ComposedChart(
                {
                  title,
                  data: rows,
                  responsive: true,
                  width: panelWidthOf(4, 12) - PANEL_PADDING,
                  height: 46,
                  margin: { top: 0, right: 0, bottom: 0, left: 0 },
                  defs: [gradient(`stat-${key}`, color, h)],
                  children: [
                    XAxis({ dataKey: 't', hide: true }),
                    YAxis({ hide: true, domain: sparkDomain(rows, dataKey, signed) }),
                    Area({
                      dataKey,
                      stroke: color,
                      strokeWidth: 1.25,
                      fill: `url(#stat-${key})`,
                      fillOpacity: 1,
                      type: 'linear',
                    }),
                  ],
                },
                h,
              ),
            ],
          ),
          h.span(
            [
              h.Class(
                css(FIGURE_STYLE, {
                  position: 'relative',
                  paddingInline: '3',
                  paddingBottom: '7',
                  fontSize: 'type.30',
                  lineHeight: 'none',
                  fontWeight: 'medium',
                  letterSpacing: 'title',
                  textShadow: '0 1px 0 var(--highlight)',
                }),
              ),
              h.Style({ color: level === 'plain' ? 'var(--foreground)' : LEVEL_COLOR[level] }),
            ],
            [value],
          ),
        ],
      ),
    ],
    h,
    null,
    level === 'plain' ? color : LEVEL_COLOR[level],
  )

const point = (cx: number, cy: number, r: number, degrees: number): string => {
  const radians = (degrees * Math.PI) / 180
  return `${(cx + r * Math.cos(radians)).toFixed(2)} ${(cy + r * Math.sin(radians)).toFixed(2)}`
}
const arc = (cx: number, cy: number, r: number, from: number, to: number): string =>
  `M ${point(cx, cy, r, from)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${point(cx, cy, r, to)}`

const gauge = (
  key: string,
  title: string,
  share: number,
  label: string,
  thresholds: Thresholds,
  h: HtmlBuilder<Message>,
): Html => {
  const START = 150
  const SWEEP = 240
  const at = (value: number) => START + SWEEP * Math.min(1, Math.max(0, value))
  const level = levelOf(share, thresholds)
  const bands: ReadonlyArray<readonly [number, number, Level]> = thresholds.invert
    ? [
        [0, thresholds.danger, 'danger'],
        [thresholds.danger, thresholds.warn, 'warn'],
        [thresholds.warn, 1, 'ok'],
      ]
    : [
        [0, thresholds.warn, 'ok'],
        [thresholds.warn, thresholds.danger, 'warn'],
        [thresholds.danger, 1, 'danger'],
      ]
  return panel(
    key,
    SPAN.stat,
    title,
    '',
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                display: 'grid',
                flex: '1 1 0%',
                placeItems: 'center',
                paddingInline: '2',
                paddingBlock: '1',
              }),
            ),
          ),
        ],
        [
          h.svg(
            [
              h.ViewBox('0 0 200 140'),
              h.Class(
                css({
                  height: '96px',
                  width: '100%',
                  maxWidth: '200px',
                }),
              ),
            ],
            [
              ...bands.map(([from, to, band]) =>
                h.path(
                  [
                    h.Key(band),
                    h.Attribute('d', arc(100, 92, 84, at(from) + 0.6, at(to) - 0.6)),
                    h.Attribute('fill', 'none'),
                    h.Attribute('stroke', LEVEL_COLOR[band]),
                    h.Attribute('stroke-width', '3'),
                  ],
                  [],
                ),
              ),
              h.path(
                [
                  h.Attribute('d', arc(100, 92, 70, START, START + SWEEP)),
                  h.Attribute('fill', 'none'),
                  h.Attribute('stroke', 'var(--hairline)'),
                  h.Attribute('stroke-width', '16'),
                ],
                [],
              ),
              share > 0.002
                ? h.path(
                    [
                      h.Attribute('d', arc(100, 92, 70, START, at(share))),
                      h.Attribute('fill', 'none'),
                      h.Attribute('stroke', LEVEL_COLOR[level]),
                      h.Attribute('stroke-width', '16'),
                    ],
                    [],
                  )
                : h.empty,
              h.text(
                [
                  h.Attribute('x', '100'),
                  h.Attribute('y', '100'),
                  h.Attribute('text-anchor', 'middle'),
                  h.Attribute('fill', LEVEL_COLOR[level]),
                  h.Class(
                    css({
                      fontFamily: 'mono',
                      fontSize: 'type.30',
                      fontWeight: 'medium',
                      letterSpacing: 'title',
                    }),
                  ),
                ],
                [label],
              ),
            ],
          ),
        ],
      ),
    ],
    h,
    null,
    LEVEL_COLOR[level],
  )
}

const UTILIZATION: Thresholds = { warn: 0.7, danger: 0.9 }
const CELLS = 32

const lcd = (key: string, share: number, h: HtmlBuilder<Message>, cells = CELLS): Html => {
  const level = Math.min(share, 1)
  let lit = 0
  while (lit < cells && (lit + 0.5) / cells <= level) lit += 1
  return lazyLcd(key, lcdView, [lit, cells, h])
}

const lazyLcd = createKeyedLazy()

const lazyPanel = createKeyedLazy()

const lazyNodeTable = createKeyedLazy()

const lcdView = (lit: number, cells: number, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        css({
          display: 'flex',
          height: '100%',
          minWidth: '0',
          flex: '1 1 0%',
          gap: '0.5',
          borderRadius: 'md',
          backgroundColor: 'well',
          padding: '0.75',
          boxShadow: 'well',
        }),
      ),
    ],
    Array.from({ length: cells }, (_, index) => {
      const position = (index + 0.5) / cells
      return h.span(
        [
          h.Key(String(index)),
          h.Class(
            css({
              minWidth: '0',
              flex: '1 1 0%',
              borderRadius: '2xs',
            }),
          ),
          h.Style({
            background:
              index < lit
                ? LEVEL_COLOR[levelOf(position, UTILIZATION)]
                : `color-mix(in oklab, ${LEVEL_COLOR[levelOf(position, UTILIZATION)]} 10%, transparent)`,
          }),
        ],
        [],
      )
    }),
  )

const barGauge = (
  ledger: Ledger,
  tracks: ReadonlyArray<NodeTrack>,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return panel(
    'bar-gauge',
    SPAN.third,
    t.dashboard.utilizationNow,
    t.dashboard.ofCapacity,
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                display: 'flex',
                flex: '1 1 0%',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2.5',
                padding: '3',
              }),
            ),
          ),
        ],
        tracks.map((track) => {
          const share = ledger.nodes[track.id]?.utilization ?? 0
          return h.div(
            [
              h.Key(track.id),
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1',
                }),
              ),
            ],
            [
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      fontSize: 'type.11-5',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          color: 'mutedForeground',
                        }),
                      ),
                    ],
                    [track.name],
                  ),
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'type.13',
                          }),
                        ),
                      ),
                      h.Style({ color: LEVEL_COLOR[levelOf(share, UTILIZATION)] }),
                    ],
                    [percent(Math.min(share, 9.99))],
                  ),
                ],
              ),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      height: '5',
                    }),
                  ),
                ],
                [lcd(`now:${track.id}`, share, h)],
              ),
            ],
          )
        }),
      ),
    ],
    h,
  )
}

const stateLabelOf = (t: Messages): Record<Level, string> => ({
  ok: t.dashboard.oK,
  warn: t.dashboard.hIGH,
  danger: t.dashboard.sATURATED,
})

type Run = Readonly<{ from: number; to: number; color: string; label: string }>

type Lane = Readonly<{ key: string; name: string; runs: ReadonlyArray<Run> }>

const runsOf = <S extends string>(
  states: ReadonlyArray<S>,
  offset: number,
  describe: (state: S) => Readonly<{ color: string; label: string }>,
): ReadonlyArray<Run> => {
  const out: Array<{ state: S; from: number; to: number }> = []
  states.forEach((state, index) => {
    const run = out[out.length - 1]
    if (run && run.state === state) run.to = offset + index + 1
    else out.push({ state, from: offset + index, to: offset + index + 1 })
  })
  return out.map((run) => ({ from: run.from, to: run.to, ...describe(run.state) }))
}

const swatch = (name: string, color: string, h: HtmlBuilder<Message>): Html =>
  h.span(
    [
      h.Key(name),
      h.Class(
        css({
          display: 'flex',
          alignItems: 'center',
          gap: '1.5',
        }),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              height: '2',
              width: '2.5',
              borderRadius: '2xs',
            }),
          ),
          h.Style({ background: color }),
        ],
        [],
      ),
      name,
    ],
  )

const laneTimeline = (
  key: string,
  span: string,
  title: string,
  unit: string,
  lanes: ReadonlyArray<Lane>,
  length: number,
  first: number,
  last: number,
  h: HtmlBuilder<Message>,
  legend: ReadonlyArray<Html> = [],
): Html =>
  panel(
    key,
    span,
    title,
    unit,
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                display: 'flex',
                flex: '1 1 0%',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '1.5',
                padding: '3',
              }),
            ),
          ),
        ],
        [
          ...lanes.map((lane) =>
            h.div(
              [
                h.Key(lane.key),
                h.Class(
                  css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3',
                  }),
                ),
              ],
              [
                h.span(
                  [
                    h.Class(
                      css({
                        width: '28',
                        flexShrink: '0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 'type.11-5',
                        color: 'mutedForeground',
                      }),
                    ),
                  ],
                  [lane.name],
                ),
                h.div(
                  [
                    h.Class(
                      css({
                        position: 'relative',
                        height: '7',
                        minWidth: '0',
                        flex: '1 1 0%',
                        overflow: 'hidden',
                        borderRadius: 'md',
                        backgroundColor: 'card',
                        boxShadow: 'lineStrong',
                      }),
                    ),
                  ],
                  lane.runs.map((run, index) =>
                    h.div(
                      [
                        h.Key(String(index)),
                        h.Class(
                          cx(
                            FIGURE,
                            css({
                              position: 'absolute',
                              insetBlock: '0.75',
                              display: 'flex',
                              alignItems: 'center',
                              overflow: 'hidden',
                              borderRadius: 'xs',
                              paddingInline: '1.5',
                              fontSize: 'type.10',
                              fontWeight: 'medium',
                              whiteSpace: 'nowrap',
                              color: 'color-mix(in oklab, black 70%, transparent)',
                              boxShadow: 'highlightTopStrong',
                            }),
                          ),
                        ),
                        h.Style({
                          left: `calc(${(run.from / length) * 100}% + 1px)`,
                          width: `calc(${((run.to - run.from) / length) * 100}% - 2px)`,
                          background: run.color,
                        }),
                        h.Title(`${lane.name}: ${run.label}`),
                      ],
                      [(run.to - run.from) / length > 0.08 ? run.label : ''],
                    ),
                  ),
                ),
              ],
            ),
          ),
          h.div(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingLeft: '124px',
                    fontSize: 'type.10',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [
              h.span([], [hhmm(first)]),
              h.span([], [hhmm(first + (last - first) / 2)]),
              h.span([], [hhmm(last)]),
            ],
          ),
          ...(legend.length === 0
            ? []
            : [
                h.div(
                  [
                    h.Class(
                      css({
                        display: 'flex',
                        flexWrap: 'wrap',
                        columnGap: '3',
                        rowGap: '1',
                        paddingLeft: '124px',
                        fontSize: 'type.10',
                      }),
                    ),
                  ],
                  legend,
                ),
              ]),
        ],
      ),
    ],
    h,
  )

const stateTimeline = (
  model: Model,
  tracks: ReadonlyArray<NodeTrack>,
  span: string,
  h: HtmlBuilder<Message>,
): Html =>
  lazyStateTimeline(stateTimelineView, [
    tracks,
    Math.floor(model.board.game.time / NODE_HISTORY_EVERY_SIM_SECONDS) *
      NODE_HISTORY_EVERY_SIM_SECONDS,
    span,
    h,
  ])

const lazyStateTimeline = createLazy()

const stateTimelineView = (
  tracks: ReadonlyArray<NodeTrack>,
  last: number,
  span: string,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const length = Math.max(1, ...tracks.map((track) => track.values.length))
  const first = last - (length - 1) * NODE_HISTORY_EVERY_SIM_SECONDS
  const lanes = tracks.map((track) => ({
    key: track.id,
    name: track.name,
    runs: runsOf(
      track.values.map((value) => levelOf(value, UTILIZATION)),
      length - track.values.length,
      (level) => ({ color: LEVEL_COLOR[level], label: stateLabelOf(t)[level] }),
    ),
  }))
  return laneTimeline(
    'state-timeline',
    span,
    t.dashboard.nodeState,
    t.dashboard.utilizationLast24H,
    lanes,
    length,
    first,
    last,
    h,
  )
}

const kindColor = (kind: Kind): string => `#${KINDS[kind].color.toString(16).padStart(6, '0')}`

const mix = (
  ledger: Ledger,
  shown: (kind: RequestKind) => boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const kinds = (
    Object.entries(ledger.kinds) as ReadonlyArray<[Kind, { rate: number; p99: number }]>
  )
    .filter(([entryKind, entry]) => entry.rate > 0 && shown(entryKind as RequestKind))
    .sort((a, b) => b[1].rate - a[1].rate)
  const total = kinds.reduce((sum, [, entry]) => sum + entry.rate, 0)
  return panel(
    'mix',
    SPAN.third,
    t.dashboard.requestMix,
    t.dashboard.reqPerSecondByKind,
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                display: 'flex',
                flex: '1 1 0%',
                alignItems: 'center',
                gap: '3',
                padding: '3',
              }),
            ),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  width: '118px',
                  flexShrink: '0',
                }),
              ),
            ],
            [
              PieChart(
                {
                  title: t.dashboard.requestMix,
                  data: kinds.map(([kind, entry]) => ({ name: kind, value: entry.rate })),
                  width: 120,
                  height: 120,
                  responsive: true,
                  children: [
                    Pie({
                      dataKey: 'value',
                      nameKey: 'name',
                      innerRadius: '58%',
                      outerRadius: '96%',
                      paddingAngle: 2,
                      stroke: 'var(--card)',
                      colors: kinds.map(([kind]) => kindColor(kind)),
                    }),
                  ],
                },
                h,
              ),
            ],
          ),
          h.table(
            [
              h.Class(
                css({
                  width: '100%',
                  fontSize: 'type.11-5',
                }),
              ),
            ],
            [
              h.tbody(
                [],
                kinds.map(([kind, entry]) =>
                  h.tr(
                    [h.Key(kind)],
                    [
                      h.td(
                        [
                          h.Class(
                            css({
                              paddingBlock: '0.5',
                            }),
                          ),
                        ],
                        [
                          h.span(
                            [
                              h.Class(
                                css({
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '1.5',
                                }),
                              ),
                            ],
                            [
                              h.span(
                                [
                                  h.Class(
                                    css({
                                      width: '2',
                                      height: '2',
                                      borderRadius: '2xs',
                                    }),
                                  ),
                                  h.Style({ background: kindColor(kind) }),
                                ],
                                [],
                              ),
                              h.span(
                                [
                                  h.Class(
                                    css({
                                      fontFamily: 'mono',
                                      fontSize: 'type.11',
                                    }),
                                  ),
                                ],
                                [kind],
                              ),
                            ],
                          ),
                        ],
                      ),
                      h.td(
                        [
                          h.Class(
                            cx(
                              FIGURE,
                              css({
                                paddingBlock: '0.5',
                                textAlign: 'right',
                              }),
                            ),
                          ),
                        ],
                        [t.dashboard.s(compact(entry.rate))],
                      ),
                      h.td(
                        [
                          h.Class(
                            cx(
                              FIGURE,
                              css({
                                width: '12',
                                paddingBlock: '0.5',
                                textAlign: 'right',
                                color: 'mutedForeground',
                              }),
                            ),
                          ),
                        ],
                        [percent(total > 0 ? entry.rate / total : 0)],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    ],
    h,
  )
}

const causes = (ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const entries = ERROR_CAUSES.map((cause) => [cause, ledger.errors[cause]] as const)
    .filter(([, rate]) => rate > 0.0005)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const max = Math.max(...entries.map(([, rate]) => rate), 0.001)
  return panel(
    'causes',
    SPAN.third,
    t.dashboard.errorsByCause,
    t.dashboard.reqPerSecondNow,
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                display: 'flex',
                flex: '1 1 0%',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '1.5',
                padding: '3',
              }),
            ),
          ),
        ],
        entries.length === 0
          ? [
              h.span(
                [
                  h.Key('none'),
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.28',
                        color: 'ok',
                      }),
                    ),
                  ),
                ],
                [t.dashboard.n0Errors],
              ),
            ]
          : entries.map(([cause, rate]) =>
              h.div(
                [
                  h.Key(cause),
                  h.Class(
                    css({
                      display: 'grid',
                      gridTemplateColumns: '72px minmax(0,1fr) 56px',
                      alignItems: 'center',
                      gap: '2',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          fontFamily: 'mono',
                          fontSize: 'type.11',
                          color: 'mutedForeground',
                        }),
                      ),
                    ],
                    [t.dashboard.errorCauses[cause]],
                  ),
                  h.div(
                    [
                      h.Class(
                        css({
                          height: '3.5',
                          borderRadius: 'xs',
                          backgroundColor: 'card',
                          boxShadow: 'lineStrong',
                        }),
                      ),
                    ],
                    [
                      h.div(
                        [
                          h.Class(
                            css({
                              height: '100%',
                              borderRadius: '2xs',
                            }),
                          ),
                          h.Style({
                            width: `${(rate / max) * 100}%`,
                            background: `linear-gradient(90deg, color-mix(in oklab, ${RED} 35%, transparent), ${RED})`,
                          }),
                        ],
                        [],
                      ),
                    ],
                  ),
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            textAlign: 'right',
                            fontSize: 'type.11-5',
                          }),
                        ),
                      ),
                    ],
                    [t.dashboard.s(compact(rate))],
                  ),
                ],
              ),
            ),
      ),
    ],
    h,
  )
}

const nodeRow = (
  id: string,
  name: string,
  own: NodeLedger | undefined,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  const share = own?.utilization ?? 0
  const level = own?.status === 'down' ? 'danger' : levelOf(share, UTILIZATION)
  const cell = css({
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderColor: 'hairline',
    paddingInline: '2',
    paddingBlock: '1',
  })
  return h.tr(
    [
      h.Key(id),
      h.Class(
        css({
          _hover: {
            backgroundColor: 'color-mix(in oklab, var(--foreground) 3%, transparent)',
          },
        }),
      ),
    ],
    [
      h.td(
        [
          h.Class(
            cx(
              cell,
              css({
                fontWeight: 'medium',
              }),
            ),
          ),
        ],
        [name],
      ),
      h.td(
        [
          h.Class(
            cx(
              cell,
              FIGURE,
              css({
                textAlign: 'right',
              }),
            ),
          ),
        ],
        [t.dashboard.s(compact(own?.inbound ?? 0))],
      ),
      h.td(
        [
          h.Class(
            cx(
              cell,
              FIGURE,
              css({
                textAlign: 'right',
                color: 'mutedForeground',
              }),
            ),
          ),
        ],
        [t.dashboard.s(compact(own?.capacity ?? 0))],
      ),
      h.td(
        [h.Class(cell)],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  height: '3.5',
                  alignItems: 'center',
                  gap: '2',
                }),
              ),
            ],
            [
              lcd(`nodes:${id}`, share, h, 24),
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        width: '11',
                        textAlign: 'right',
                      }),
                    ),
                  ),
                  h.Style({ color: LEVEL_COLOR[levelOf(share, UTILIZATION)] }),
                ],
                [percent(Math.min(share, 9.99))],
              ),
            ],
          ),
        ],
      ),
      h.td(
        [
          h.Class(
            cx(
              cell,
              FIGURE,
              css({
                textAlign: 'right',
              }),
            ),
          ),
        ],
        [formats(t).ms(own?.latency ?? 0)],
      ),
      h.td(
        [
          h.Class(
            cx(
              cell,
              FIGURE,
              css({
                textAlign: 'right',
              }),
            ),
          ),
        ],
        [formats(t).ms(own?.p99 ?? 0)],
      ),
      h.td(
        [
          h.Class(
            cx(
              cell,
              FIGURE,
              css({
                textAlign: 'right',
              }),
              (own?.dropped ?? 0) > 0.05
                ? css({
                    color: 'danger',
                  })
                : css({
                    color: 'mutedForeground',
                  }),
            ),
          ),
        ],
        [t.dashboard.s(compact(own?.dropped ?? 0))],
      ),
      h.td(
        [
          h.Class(
            cx(
              cell,
              FIGURE,
              css({
                textAlign: 'right',
                fontSize: 'type.11',
                fontWeight: 'medium',
                color: 'color-mix(in oklab, black 75%, transparent)',
              }),
            ),
          ),
          h.Style({
            background: `color-mix(in oklab, ${LEVEL_COLOR[level]} 85%, transparent)`,
          }),
        ],
        [own?.status === 'down' ? t.dashboard.down : stateLabelOf(t)[level]],
      ),
    ],
  )
}

const lazyNodeRow = createKeyedLazy()

const nodeTable = (
  ledger: Ledger,
  tracks: ReadonlyArray<NodeTrack>,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const sorted = [...tracks].sort(
    (a, b) => (ledger.nodes[b.id]?.utilization ?? 0) - (ledger.nodes[a.id]?.utilization ?? 0),
  )
  const head = [
    t.dashboard.node,
    t.dashboard.inbound,
    t.dashboard.capacity,
    t.dashboard.load,
    t.dashboard.latency,
    'p99',
    t.dashboard.dropped,
    t.dashboard.status,
  ]
  return panel(
    'nodes',
    SPAN.full,
    t.dashboard.nodes,
    t.dashboard.rows(tracks.length),
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                paddingInline: '1',
                paddingBottom: '1',
              }),
              SCROLL,
            ),
          ),
        ],
        [
          h.table(
            [
              h.Class(
                css({
                  width: '100%',
                  minWidth: '720px',
                  borderCollapse: 'collapse',
                  fontSize: 'type.12',
                }),
              ),
            ],
            [
              h.thead(
                [],
                [
                  h.tr(
                    [
                      h.Class(
                        css({
                          fontSize: 'type.11',
                          color: 'mutedForeground',
                        }),
                      ),
                    ],
                    head.map((label, index) =>
                      h.th(
                        [
                          h.Key(label),
                          h.Class(
                            cx(
                              css({
                                borderBottomWidth: '1px',
                                borderBottomStyle: 'solid',
                                borderColor: 'hairline',
                                paddingInline: '2',
                                paddingBlock: '1',
                                fontWeight: 'medium',
                              }),
                              index === 0
                                ? css({
                                    textAlign: 'left',
                                  })
                                : index === 3
                                  ? css({
                                      width: '30%',
                                      textAlign: 'left',
                                    })
                                  : css({
                                      textAlign: 'right',
                                    }),
                            ),
                          ),
                        ],
                        [label],
                      ),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                sorted.map((track) =>
                  lazyNodeRow(track.id, nodeRow, [track.id, track.name, ledger.nodes[track.id], h]),
                ),
              ),
            ],
          ),
        ],
      ),
    ],
    h,
  )
}

type Cell = Readonly<{
  text: string
  color?: string | undefined
  fill?: string | undefined
  bar?: Readonly<{ share: number; color: string }> | undefined
  hint?: string | undefined
  onClick?: Message | undefined
  content?: Html | undefined
}>

const tablePanel = (
  key: string,
  span: string,
  title: string,
  unit: string,
  head: ReadonlyArray<string>,
  rows: ReadonlyArray<Readonly<{ key: string; cells: ReadonlyArray<Cell> }>>,
  h: HtmlBuilder<Message>,
  extra: ReadonlyArray<Html> = [],
): Html => {
  const border = css({
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderColor: 'hairline',
    paddingInline: '2',
    paddingBlock: '1',
  })
  const bars = rows.some((row) => row.cells.some((cell) => cell.bar !== undefined))
  const columnClass = (index: number): string =>
    bars
      ? index === 0
        ? css({ textAlign: 'left' })
        : css({ textAlign: 'right' })
      : index === 0
        ? css({ width: '100%', textAlign: 'left' })
        : css({ width: '1px', minWidth: '88px', textAlign: 'right', whiteSpace: 'nowrap' })
  return panel(
    key,
    span,
    title,
    unit,
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                paddingInline: '1',
                paddingBottom: '1',
              }),
              SCROLL,
            ),
          ),
        ],
        rows.length === 0
          ? [
              h.span(
                [
                  h.Key('none'),
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        paddingInline: '2',
                        paddingBlock: '3',
                        fontSize: 'type.12',
                        color: 'mutedForeground',
                      }),
                    ),
                  ),
                ],
                [copy(h).dashboard.nothingToShowYet],
              ),
            ]
          : [
              h.table(
                [
                  h.Class(
                    css({
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 'type.12',
                    }),
                  ),
                ],
                [
                  h.thead(
                    [],
                    [
                      h.tr(
                        [
                          h.Class(
                            css({
                              fontSize: 'type.11',
                              color: 'mutedForeground',
                            }),
                          ),
                        ],
                        head.map((label, index) =>
                          h.th(
                            [
                              h.Key(label),
                              h.Class(
                                cx(
                                  border,
                                  css({
                                    fontWeight: 'medium',
                                  }),
                                  columnClass(index),
                                ),
                              ),
                            ],
                            [label],
                          ),
                        ),
                      ),
                    ],
                  ),
                  h.tbody(
                    [],
                    rows.map((row) =>
                      h.tr(
                        [
                          h.Key(row.key),
                          h.Class(
                            css({
                              _hover: {
                                backgroundColor:
                                  'color-mix(in oklab, var(--foreground) 3%, transparent)',
                              },
                            }),
                          ),
                        ],
                        row.cells.map((cell, index) =>
                          h.td(
                            [
                              h.Key(head[index] ?? String(index)),
                              h.Class(
                                cx(
                                  border,
                                  index === 0
                                    ? css({
                                        fontWeight: 'medium',
                                      })
                                    : FIGURE,
                                  columnClass(index),
                                  cell.fill === undefined
                                    ? undefined
                                    : css({
                                        fontSize: 'type.11',
                                        fontWeight: 'medium',
                                        color: 'color-mix(in oklab, black 75%, transparent)',
                                      }),
                                ),
                              ),
                              ...(cell.fill === undefined
                                ? []
                                : [
                                    h.Style({
                                      background: `color-mix(in oklab, ${cell.fill} 85%, transparent)`,
                                    }),
                                  ]),
                              ...(cell.hint === undefined ? [] : [h.Title(cell.hint)]),
                            ],
                            cell.content !== undefined
                              ? [cell.content]
                              : cell.bar === undefined
                                ? [
                                    cell.onClick === undefined
                                      ? h.span(
                                          cell.color === undefined
                                            ? []
                                            : [h.Style({ color: cell.color })],
                                          [cell.text],
                                        )
                                      : h.button(
                                          [
                                            h.Type('button'),
                                            h.OnClick(cell.onClick),
                                            h.Class(
                                              css({
                                                textAlign: 'left',
                                                fontWeight: 'medium',
                                                textUnderlineOffset: '2',
                                                _hover: {
                                                  textDecorationLine: 'underline',
                                                },
                                              }),
                                            ),
                                            ...(cell.hint === undefined
                                              ? []
                                              : [h.Title(cell.hint)]),
                                          ],
                                          [cell.text],
                                        ),
                                  ]
                                : [
                                    h.div(
                                      [
                                        h.Class(
                                          css({
                                            display: 'flex',
                                            height: '3.5',
                                            alignItems: 'center',
                                            gap: '2',
                                          }),
                                        ),
                                      ],
                                      [
                                        lcd(`${key}:${row.key}:${index}`, cell.bar.share, h, 24),
                                        h.span(
                                          [
                                            h.Class(
                                              cx(
                                                FIGURE,
                                                css({
                                                  width: '11',
                                                  textAlign: 'right',
                                                }),
                                              ),
                                            ),
                                          ],
                                          [cell.text],
                                        ),
                                      ],
                                    ),
                                  ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
      ),
      ...extra,
    ],
    h,
  )
}

const barList = (
  key: string,
  span: string,
  title: string,
  unit: string,
  entries: ReadonlyArray<
    Readonly<{ key: string; name: string; value: number; text: string; color?: string }>
  >,
  h: HtmlBuilder<Message>,
): Html => {
  const widest = Math.max(...entries.map((entry) => Math.abs(entry.value)), 1e-9)
  return panel(
    key,
    span,
    title,
    unit,
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                display: 'flex',
                flex: '1 1 0%',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '1.5',
                padding: '3',
              }),
            ),
          ),
        ],
        entries.length === 0
          ? [
              h.span(
                [
                  h.Key('none'),
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.12',
                        color: 'mutedForeground',
                      }),
                    ),
                  ),
                ],
                [copy(h).dashboard.noNodeToShow],
              ),
            ]
          : entries.map((entry) => {
              const color = entry.color ?? BLUE
              return h.div(
                [
                  h.Key(entry.key),
                  h.Class(
                    css({
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr) 60px',
                      alignItems: 'center',
                      gap: '2',
                    }),
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
                          fontSize: 'type.11-5',
                          color: 'mutedForeground',
                        }),
                      ),
                    ],
                    [entry.name],
                  ),
                  h.div(
                    [
                      h.Class(
                        css({
                          height: '3.5',
                          borderRadius: 'xs',
                          backgroundColor: 'card',
                          boxShadow: 'lineStrong',
                        }),
                      ),
                    ],
                    [
                      h.div(
                        [
                          h.Class(
                            css({
                              height: '100%',
                              borderRadius: '2xs',
                            }),
                          ),
                          h.Style({
                            width: `${Math.max(2, (Math.abs(entry.value) / widest) * 100)}%`,
                            background: `linear-gradient(90deg, color-mix(in oklab, ${color} 35%, transparent), ${color})`,
                          }),
                        ],
                        [],
                      ),
                    ],
                  ),
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            textAlign: 'right',
                            fontSize: 'type.11-5',
                          }),
                        ),
                      ),
                    ],
                    [entry.text],
                  ),
                ],
              )
            }),
      ),
    ],
    h,
  )
}

const cashSpark = (rows: ReadonlyArray<Row>, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const values = rows.map((row) => Number(row.cash))
  const short = (values[values.length - 1] ?? 0) < 0
  const color = short ? RED : GREEN
  const spec: SeriesSpec = {
    key: 'cash-series',
    span: '',
    columns: 8,
    title: t.dashboard.cash,
    unit: '$',
    series: [{ key: 'cash', name: t.dashboard.cash, color }],
    format: (value) => money(value),
  }
  return h.div(
    [
      h.Class(
        css({
          marginTop: '1.5',
          display: 'flex',
          flexShrink: '0',
          flexDirection: 'column',
          gap: '0.5',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                position: 'relative',
                display: 'flex',
                height: '76px',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                paddingInline: '1',
                paddingTop: '1',
              }),
            ),
          ),
        ],
        [
          ComposedChart(
            {
              title: t.dashboard.cash,
              data: rows,
              responsive: true,
              width: panelWidthOf(8) - PANEL_PADDING,
              height: 76,
              margin: { top: 4, right: 6, bottom: 2, left: 6 },
              defs: [gradient('cash-series', color, h)],
              children: [
                XAxis({ dataKey: 't', hide: true }),
                YAxis({
                  hide: true,
                  domain: [Math.min(0, ...values), Math.max(1, ...values) * 1.1],
                }),
                ReferenceLine({ y: 0, stroke: MUTED, strokeDasharray: '3 3' }),
                Tooltip({ content: 'none' }),
                Area({
                  dataKey: 'cash',
                  name: t.dashboard.cash,
                  stroke: color,
                  strokeWidth: 1.5,
                  fill: 'url(#cash-series)',
                  fillOpacity: 1,
                  type: 'linear',
                }),
              ],
            },
            h,
          ),
        ],
      ),
      seriesLegend(rows, spec.series, spec, undefined, h),
    ],
  )
}

const companyPanels = (
  model: Model,
  ledger: Ledger,
  rows: ReadonlyArray<Row>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const t = copy(h)

  const game = model.board.game
  const net = ledger.revenue - ledger.burn
  const runway = runwayOf(game, ledger)
  const teams = teamOutputs(game, ledger)
  const people = teams.reduce((sum, entry) => sum + entry.headcount, 0)
  const morale = game.time < game.moraleUntil
  const teamUnit = `${t.dashboard.peopleAndVelocity(people)}${
    morale ? t.dashboard.moraleDrop(Math.round((1 - LAYOFF_MORALE) * 100)) : ''
  }`
  const credits = slaCreditsOf(game, ledger)
  const moneyRows: ReadonlyArray<readonly [string, string, Message?]> = [
    [t.dashboard.cash, money(game.cash)],
    [t.dashboard.revenue, t.dashboard.s(money(ledger.revenue))],
    [t.dashboard.burn, t.dashboard.s(money(ledger.burn))],
    [t.dashboard.net, t.dashboard.s2(net >= 0 ? '+' : '', money(net))],
    [t.dashboard.payroll, t.dashboard.s(money(ledger.salaries))],
    [t.dashboard.equity, percent(game.equity)],
    [t.dashboard.runway, runwayText(t, runway)],
    ...(credits > 0
      ? [[t.dashboard.sLACredits, `−${t.units.perSecond(money(credits))}`] as const]
      : []),
    ...(game.bridge._tag === 'Offered'
      ? [
          [
            t.dashboard.bridge,
            `${money(game.bridge.grant)} · ${percent(game.bridge.dilution)} · ${t.dashboard.accept}`,
            Message.BridgeAccepted(),
          ] as const,
        ]
      : []),
  ]
  return [
    tablePanel(
      'company-money',
      SPAN.third,
      t.dashboard.money,
      t.dashboard.nowCash(rangeLabel(t, model.board.dashboard.range)),
      [t.dashboard.line, t.dashboard.value],
      moneyRows.map(([name, value, onClick]) => ({
        key: name,
        cells: [
          { text: name },
          onClick === undefined
            ? { text: value }
            : {
                text: value,
                onClick,
                hint: t.dashboard.bridgeHint,
              },
        ],
      })),
      h,
      [cashSpark(rows, h)],
    ),
    tablePanel(
      'company-team',
      SPAN.twoThirds,
      t.dashboard.team,
      teamUnit,
      [
        t.dashboard.team,
        t.dashboard.kindHead,
        t.dashboard.people,
        t.dashboard.effective,
        t.dashboard.velocity,
        t.dashboard.devHoursPerMinute,
      ],
      teams.map((entry) => ({
        key: entry.team.id,
        cells: [
          { text: teamName(t, entry.team) },
          { text: teamKindOf(t)[entry.team.kind] },
          { text: String(entry.headcount) },
          { text: entry.effective.toFixed(1) },
          { text: `×${entry.velocity.toFixed(2)}` },
          { text: dhPerMinute(entry.devHoursPerSecond) },
        ],
      })),
      h,
    ),
    tablePanel(
      'company-funding',
      SPAN.full,
      t.dashboard.funding,
      t.dashboard.roundsFromTheInbox,
      [
        t.dashboard.round,
        t.dashboard.atUsers,
        t.dashboard.grant,
        t.dashboard.dilution,
        t.dashboard.answer,
        t.dashboard.when,
      ],
      fundingOf(model).map((round) => ({
        key: round.key,
        cells: [
          { text: round.name },
          { text: round.users.toLocaleString('en-US') },
          { text: round.grant === null ? t.dashboard.publicMarket : money(round.grant) },
          { text: percent(round.dilution) },
          {
            text: round.answer === null ? '—' : t.dashboard.fundingAnswers[round.answer],
            color: round.answer === 'raised' ? GREEN : round.answer === 'declined' ? AMBER : MUTED,
          },
          { text: round.when },
        ],
      })),
      h,
    ),
  ]
}

const SEVERITY_COLOR: Readonly<Record<number, string>> = { 1: RED, 2: AMBER, 3: PURPLE }

const UNSEEN = MUTED
const AWAITING = BLUE

const incidentTimeline = (
  model: Model,
  rows: ReadonlyArray<Row>,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const game = model.board.game
  const range = model.board.dashboard.range
  const first = Number(rows[0]?.at ?? Math.floor(game.time))
  const last = Number(rows[rows.length - 1]?.at ?? first) + Number(rows[rows.length - 1]?.span ?? 1)
  const span = Math.max(1, last - first)
  const lane = (
    key: string,
    name: string,
    from: number,
    to: number,
    severity: number,
    signalAt: number | null,
    ackAt: number | null,
    pending = false,
  ): Lane => {
    const start = Math.max(first, from)
    const end = Math.min(last, to)
    const color = SEVERITY_COLOR[severity] ?? MUTED
    const block = (at: number, until: number, background: string, label: string): Run => ({
      from: at - first,
      to: until - first,
      color: background,
      label,
    })
    const held = `SEV${severity} · ${hhmm(start)}–${hhmm(end)}`
    if (signalAt === null)
      return {
        key,
        name,
        runs: [
          pending
            ? block(start, end, UNSEEN, t.dashboard.notSeenFor(minutesText(t, end - start)))
            : block(start, end, color, held),
        ],
      }
    const signal = Math.min(end, Math.max(start, signalAt))
    const answered = ackAt === null ? null : Math.min(end, Math.max(signal, ackAt))
    const runs: Array<Run> = []
    if (signal > start)
      runs.push(
        block(start, signal, UNSEEN, t.dashboard.notSeenFor(minutesText(t, signal - start))),
      )
    const awaited = answered ?? end
    if (awaited > signal)
      runs.push(
        block(
          signal,
          awaited,
          AWAITING,
          t.dashboard.awaitingAckFor(minutesText(t, awaited - signal)),
        ),
      )
    if (answered !== null && end > answered)
      runs.push(block(answered, end, color, `SEV${severity} · ${hhmm(answered)}–${hhmm(end)}`))
    return { key, name, runs: runs.length === 0 ? [block(start, end, color, held)] : runs }
  }
  const lanes: Array<Lane> = []
  const severities = new Set<number>()
  for (const postmortem of game.postmortems) {
    const endedAt = postmortem.endedAt
    if (endedAt === null) continue
    const startedAt = endedAt - postmortem.duration
    if (endedAt < first || startedAt > last) continue
    severities.add(postmortem.severity)
    const signal = postmortem.mttd
    lanes.push(
      lane(
        `pm-${postmortem.id}`,
        t.catalog.incidents[postmortem.kind].name,
        startedAt,
        endedAt,
        postmortem.severity,
        signal === null ? null : startedAt + signal,
        signal === null || postmortem.mtta === null ? null : startedAt + signal + postmortem.mtta,
      ),
    )
  }
  const incident = game.incident
  const now = Math.floor(game.time)
  if (incident !== null && incident.startedAt <= now) {
    severities.add(incident.severity)
    lanes.push(
      lane(
        'running',
        t.dashboard.runningLane(t.catalog.incidents[incident.kind].name),
        incident.startedAt,
        now,
        incident.severity,
        signalAtOf(incident.phase),
        ackAtOf(incident.phase),
        true,
      ),
    )
  }
  if (lanes.length === 0)
    return panel(
      'incident-timeline',
      SPAN.full,
      t.dashboard.incidentTimeline,
      rangeLabel(t, range),
      [
        h.div(
          [
            h.Class(
              cx(
                SCREEN,
                css({
                  paddingInline: '2',
                  paddingBlock: '3',
                }),
              ),
            ),
          ],
          [
            h.span(
              [
                h.Class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.12',
                      color: 'mutedForeground',
                    }),
                  ),
                ),
              ],
              [t.dashboard.noRunInThisRange],
            ),
          ],
        ),
      ],
      h,
    )
  return laneTimeline(
    'incident-timeline',
    SPAN.full,
    t.dashboard.incidentTimeline,
    t.dashboard.runRange(rangeLabel(t, range)),
    lanes,
    span,
    first,
    last,
    h,
    [
      ...(lanes.some((entry) => entry.runs.some((run) => run.color === UNSEEN))
        ? [swatch(t.dashboard.notSeen, UNSEEN, h)]
        : []),
      ...(lanes.some((entry) => entry.runs.some((run) => run.color === AWAITING))
        ? [swatch(t.dashboard.awaitingAck, AWAITING, h)]
        : []),
      ...[...severities]
        .sort((a, b) => a - b)
        .map((severity) => swatch(`SEV${severity}`, SEVERITY_COLOR[severity] ?? MUTED, h)),
    ],
  )
}

const actionColor = (game: Game, postmortem: Postmortem): string =>
  postmortem.action === null ? MUTED : has(game, postmortem.action) ? GREEN : AMBER

const runningIncident = (game: Game, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const incident = game.incident
  if (incident === null)
    return tablePanel(
      'incident-running',
      SPAN.third,
      t.dashboard.runningIncident,
      t.dashboard.none,
      [t.dashboard.fact, t.dashboard.value],
      [
        {
          key: 'none',
          cells: [{ text: t.dashboard.state }, { text: t.dashboard.noIncidentRunning }],
        },
      ],
      h,
    )
  const elapsed = Math.max(0, game.time - incident.startedAt)
  const total = elapsed + Math.max(0, incident.remaining)
  const facts: ReadonlyArray<readonly [string, Cell]> = [
    [t.dashboard.severity, { text: `SEV${incident.severity}` }],
    [t.dashboard.target, { text: incidentTarget(t, game, incident) }],
    [
      t.dashboard.cause,
      {
        text:
          incident.causedBy === null
            ? '—'
            : t.dashboard.causeLeftAlone(t.catalog.incidents[incident.causedBy].name),
      },
    ],
    [
      t.dashboard.run,
      {
        text: `${minutesText(t, elapsed)} / ${minutesText(t, total)}`,
        bar: { share: total > 0 ? Math.min(1, elapsed / total) : 0, color: RED },
      },
    ],
    ['MTTD', { text: minutesOrUnknown(t, mttdOf(incident)) }],
    ['MTTA', { text: minutesOrUnknown(t, mttaOf(incident)) }],
    [t.dashboard.mttrSoFar, { text: minutesText(t, incident.impaired) }],
    [
      t.dashboard.usersLost,
      { text: `−${compact(Math.max(0, incident.usersAtStart - game.users))}` },
    ],
    [t.dashboard.revenueLost, { text: `−${money(incident.lostRevenue)}` }],
    [t.dashboard.failed, { text: compact(incident.failed) }],
  ]
  return tablePanel(
    'incident-running',
    SPAN.third,
    t.dashboard.runningIncident,
    t.catalog.incidents[incident.kind].name,
    [t.dashboard.fact, t.dashboard.value],
    facts.map(([name, cell]) => ({ key: name, cells: [{ text: name }, cell] })),
    h,
  )
}

const incidentHistory = (game: Game, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return tablePanel(
    'incident-history',
    SPAN.twoThirds,
    t.dashboard.incidentHistory,
    t.dashboard.postmortemCount(game.postmortems.length),
    [
      t.dashboard.incident,
      t.dashboard.cause,
      'SEV',
      t.dashboard.target,
      t.dashboard.run,
      'MTTD',
      'MTTA',
      'MTTR',
      t.dashboard.users,
      t.dashboard.revenue,
      t.dashboard.failed,
      t.dashboard.action,
    ],
    [...game.postmortems].reverse().map((postmortem) => ({
      key: `pm-${postmortem.id}`,
      cells: [
        {
          text: t.catalog.incidents[postmortem.kind].name,
          onClick: Message.DashboardChanged({
            message: DashboardMessage.PostmortemChosen({ id: postmortem.id }),
          }),
          hint: t.dashboard.showThisPostmortem,
        },
        {
          text: postmortem.causedBy === null ? '—' : t.catalog.incidents[postmortem.causedBy].name,
        },
        { text: `SEV${postmortem.severity}` },
        { text: postmortem.target ?? '—' },
        { text: minutesText(t, postmortem.duration) },
        { text: minutesOrUnknown(t, postmortem.mttd) },
        { text: minutesOrUnknown(t, postmortem.mtta) },
        { text: minutesText(t, postmortem.mttr) },
        { text: `−${compact(postmortem.lostUsers)}` },
        { text: `−${money(postmortem.lostRevenue)}` },
        { text: compact(postmortem.failed) },
        { text: actionText(t, game, postmortem), color: actionColor(game, postmortem) },
      ],
    })),
    h,
  )
}

const postmortemDetail = (game: Game, postmortem: Postmortem, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const def = localized(INCIDENTS[postmortem.kind], t.catalog.incidents[postmortem.kind])
  const facts: ReadonlyArray<readonly [string, string]> = [
    [t.dashboard.run, minutesText(t, postmortem.duration)],
    [
      t.dashboard.cause,
      postmortem.causedBy === null ? '—' : t.catalog.incidents[postmortem.causedBy].name,
    ],
    ['MTTD', minutesOrUnknown(t, postmortem.mttd)],
    ['MTTA', minutesOrUnknown(t, postmortem.mtta)],
    ['MTTR', minutesText(t, postmortem.mttr)],
    [t.dashboard.usersLost, `−${compact(postmortem.lostUsers)}`],
    [t.dashboard.revenueLost, `−${money(postmortem.lostRevenue)}`],
    [t.dashboard.failed, compact(postmortem.failed)],
  ]
  const open = postmortem.action !== null && !has(game, postmortem.action)
  return panel(
    `pm-detail-${postmortem.id}`,
    SPAN.full,
    t.dashboard.postmortemOf(def.name),
    `SEV${postmortem.severity}${postmortem.target === null ? '' : ` · ${postmortem.target}`}`,
    [
      h.div(
        [
          h.Class(
            cx(
              SCREEN,
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '3',
                padding: '3',
              }),
            ),
          ),
        ],
        [
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
            [def.cause],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                  '& > :not(:last-child)': {
                    borderRightWidth: '1px',
                    borderRightStyle: 'solid',
                    borderColor: 'hairline',
                  },
                }),
              ),
            ],
            facts.map(([name, value]) =>
              h.div(
                [
                  h.Key(name),
                  h.Class(
                    css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1',
                      paddingInline: '2.5',
                      paddingBlock: '1.5',
                    }),
                  ),
                ],
                [
                  h.span([h.Class(EYEBROW)], [name]),
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'type.12-5',
                          }),
                        ),
                      ),
                    ],
                    [value],
                  ),
                ],
              ),
            ),
          ),
          h.p(
            [
              h.Class(
                css({
                  fontSize: 'type.12',
                  lineHeight: 'snug',
                }),
              ),
            ],
            [def.prevention],
          ),
          h.p(
            [
              h.Class(
                cx(
                  css({
                    fontSize: 'type.12',
                    lineHeight: 'snug',
                  }),
                  open
                    ? css({
                        color: 'warn',
                      })
                    : css({
                        color: 'mutedForeground',
                      }),
                ),
              ),
            ],
            [
              postmortem.action === null
                ? t.dashboard.noActionItem
                : has(game, postmortem.action)
                  ? t.dashboard.actionItemDone(t.catalog.research[postmortem.action].name)
                  : t.dashboard.actionItemOpen(t.catalog.research[postmortem.action].name),
            ],
          ),
        ],
      ),
    ],
    h,
    null,
    actionColor(game, postmortem),
  )
}

const incidentPanels = (
  model: Model,
  rows: ReadonlyArray<Row>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const game = model.board.game
  const chosen = game.postmortems.find(
    (postmortem) => postmortem.id === model.board.dashboard.postmortem,
  )
  return [
    runningIncident(game, h),
    incidentHistory(game, h),
    incidentTimeline(model, rows, h),
    ...(chosen === undefined ? [] : [postmortemDetail(game, chosen, h)]),
  ]
}

const RULES = ['errors', 'latency', 'saturation', 'queue', 'budget'] as const
type Rule = (typeof RULES)[number]
const ruleNameOf = (t: Messages): Record<Rule, string> => ({
  errors: t.dashboard.errorRate,
  latency: t.dashboard.latency,
  saturation: t.dashboard.saturation,
  queue: t.dashboard.queueGrowth,
  budget: t.dashboard.budgetBurn,
})

type AlertState = 'ok' | 'pending' | 'firing' | 'ignored'
const alertStateCopy = (
  t: Messages,
): Record<AlertState, Readonly<{ color: string; label: string }>> => ({
  ok: { color: GREEN, label: t.dashboard.oK },
  pending: { color: AMBER, label: t.dashboard.pending },
  firing: { color: RED, label: t.dashboard.firing },
  ignored: { color: MUTED, label: t.dashboard.ignoredState },
})

const alertStateOf = (game: Game, rule: Rule): AlertState =>
  ignored(game, rule)
    ? 'ignored'
    : game.alarms[rule] >= ALERT_RULES[rule].seconds
      ? 'firing'
      : game.alarms[rule] > 0
        ? 'pending'
        : 'ok'

const watchedOf = (game: Game, ledger: Ledger): Record<Rule, number> => {
  const slowest = Object.entries(ledger.kinds).reduce(
    (most, [kind, entry]) =>
      entry === undefined ? most : Math.max(most, entry.p99 / PROFILES[kind as RequestKind].apdex),
    0,
  )
  const hottest = Math.max(
    0,
    ...game.nodes
      .filter((node) => node.type !== 'users' && node.type !== 'analytics')
      .map((node) => ledger.nodes[node.id]?.utilization ?? 0),
  )
  const oldest = Math.max(
    0,
    ...game.nodes.map((node) => (node.type === 'queue' ? (ledger.nodes[node.id]?.age ?? 0) : 0)),
  )
  return {
    errors: ledger.errorShare,
    latency: slowest,
    saturation: hottest,
    queue: Number.isFinite(oldest) ? oldest : 0,
    budget: burnRateOf(game, ledger),
  }
}

const asRule = (value: string | undefined): Rule | null =>
  (RULES as ReadonlyArray<string>).includes(value ?? '') ? (value as Rule) : null

const alertMarks = (
  model: Model,
): ReadonlyArray<Readonly<{ rule: Rule; at: number; ignored: boolean }>> =>
  model.board.inbox.mail.flatMap((mail) => {
    const [, topic, about] = keyParts(mail)
    if (topic !== 'alert' && topic !== 'alert-ignored') return []
    const rule = asRule(about)
    if (rule === null) return []
    return mail.entries.map((entry) => ({
      rule,
      at: entry.time,
      ignored: topic === 'alert-ignored',
    }))
  })

const alertTimeline = (model: Model, rows: ReadonlyArray<Row>, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const marks = alertMarks(model)
  const last = rows.length - 1
  const lanes = RULES.map((rule) => {
    const given = ignored(game, rule)
    const states = rows.map(() => 'ok' as AlertState)
    for (const mark of marks) {
      if (mark.rule !== rule) continue
      const index = rows.findIndex(
        (row) => Number(row.at) <= mark.at && mark.at < Number(row.at) + Number(row.span),
      )
      if (index < 0) continue
      if (mark.ignored)
        for (let at = index; at < (given ? states.length : index + 1); at += 1)
          states[at] = 'ignored'
      else if (states[index] === 'ok') states[index] = 'firing'
    }
    const now = alertStateOf(game, rule)
    if (now !== 'ok' && last >= 0) states[last] = now
    return {
      key: rule,
      name: ruleNameOf(t)[rule],
      runs: runsOf(states, 0, (state) => alertStateCopy(t)[state]),
    }
  })
  const first = Number(rows[0]?.at ?? 0)
  const end = Number(rows[last]?.at ?? first) + Number(rows[last]?.span ?? 1)
  return laneTimeline(
    'alert-state',
    SPAN.half,
    t.dashboard.alertState,
    t.dashboard.pagesTheInboxKept,
    lanes,
    Math.max(1, rows.length),
    first,
    end,
    h,
    Object.values(alertStateCopy(t)).map((state) => swatch(state.label, state.color, h)),
  )
}

const thresholdPicker = (rule: Rule, chosen: number, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const label = (threshold: number): string =>
    rule === 'latency' || rule === 'budget'
      ? `${threshold}×`
      : rule === 'queue'
        ? t.dashboard.s3(threshold)
        : `${Math.round(threshold * 1000) / 10}%`
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'inline-flex',
            gap: '0.75',
            padding: '0.75',
          }),
          WELL,
        ),
      ),
    ],
    ALERT_THRESHOLDS[rule].map((threshold) =>
      h.button(
        [
          h.Key(`${rule}-${threshold}`),
          h.Type('button'),
          h.AriaPressed(threshold === chosen ? 'true' : 'false'),
          h.OnClick(Message.AlertRuleChosen({ rule, threshold })),
          h.Class(
            cx(
              FIGURE,
              css({
                height: '5',
                borderRadius: 'md',
                paddingInline: '1.5',
                fontSize: 'type.11',
              }),
              threshold === chosen
                ? css({
                    layerStyle: 'raised',
                    color: 'foreground',
                    boxShadow: 'raised',
                  })
                : css({
                    color: 'mutedForeground',
                    _hover: {
                      color: 'foreground',
                    },
                  }),
            ),
          ),
        ],
        [label(threshold)],
      ),
    ),
  )
}

const alertTable = (game: Game, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const watched = watchedOf(game, ledger)
  const limit = (rule: Rule): string =>
    rule === 'errors'
      ? percent(game.alertRules.errors, 1)
      : rule === 'latency'
        ? `${game.alertRules.latency}× T`
        : rule === 'queue'
          ? t.dashboard.s3(game.alertRules.queue)
          : rule === 'budget'
            ? `${game.alertRules.budget}×`
            : percent(game.alertRules.saturation)
  const seen = (rule: Rule): string =>
    rule === 'errors'
      ? percent(watched.errors, 2)
      : rule === 'latency'
        ? `${watched.latency.toFixed(1)}× T`
        : rule === 'queue'
          ? t.dashboard.s3(Math.round(watched.queue))
          : rule === 'budget'
            ? `${watched.budget.toFixed(1)}×`
            : percent(watched.saturation)
  return tablePanel(
    'alert-rules',
    SPAN.half,
    t.dashboard.alertRules,
    t.dashboard.thePagersConditions,
    [t.dashboard.rule, t.dashboard.threshold, t.dashboard.now, t.dashboard.held, t.dashboard.state],
    RULES.map((rule) => {
      const state = alertStateCopy(t)[alertStateOf(game, rule)]
      return {
        key: rule,
        cells: [
          {
            text: ruleNameOf(t)[rule],
            hint: formats(t).alertText(rule, game.alertRules[rule]),
          },
          { text: limit(rule), content: thresholdPicker(rule, game.alertRules[rule], h) },
          { text: seen(rule) },
          { text: t.dashboard.heldOf(Math.round(game.alarms[rule]), ALERT_RULES[rule].seconds) },
          { text: state.label, fill: state.color },
        ],
      }
    }),
    h,
  )
}

const servicesTable = (
  ledger: Ledger,
  shown: (kind: RequestKind) => boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const kinds = (
    Object.entries(ledger.kinds) as ReadonlyArray<[RequestKind, KindLedger | undefined]>
  )
    .flatMap(([kind, entry]) =>
      entry === undefined || entry.rate <= 0 || !shown(kind) ? [] : [{ kind, entry }],
    )
    .sort((left, right) => right.entry.rate - left.entry.rate)
  const total = kinds.reduce((sum, { entry }) => sum + entry.rate, 0)
  return tablePanel(
    'services',
    SPAN.full,
    t.dashboard.services,
    t.dashboard.rateErrorsDurationNow,
    [
      t.dashboard.service,
      t.dashboard.rate,
      t.dashboard.share,
      t.dashboard.errors,
      t.dashboard.mean,
      'p99',
    ],
    kinds.map(({ kind, entry }) => {
      const failed = 1 - entry.success
      return {
        key: kind,
        cells: [
          { text: t.catalog.kinds[kind].label },
          { text: t.dashboard.s(rateText(entry.rate)) },
          { text: percent(total > 0 ? entry.rate / total : 0) },
          { text: percent(failed, failed < 0.1 ? 2 : 1), color: failed > 0.01 ? RED : undefined },
          { text: formats(t).ms(entry.mean) },
          { text: formats(t).ms(entry.p99) },
        ],
      }
    }),
    h,
  )
}

const serviceTable = (
  game: Game,
  ledger: Ledger,
  only: string | null,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const rows = game.services.flatMap((service) => {
    const entry = ledger.services[service.id]
    return entry === undefined || entry.rate <= 0 || (only !== null && service.id !== only)
      ? []
      : [{ service, entry }]
  })
  const total = rows.reduce((sum, { entry }) => sum + entry.rate, 0)
  return tablePanel(
    'service-red',
    SPAN.half,
    t.dashboard.code,
    t.dashboard.rateErrorsDurationPerCodebase,
    [
      t.dashboard.service,
      t.dashboard.rate,
      t.dashboard.share,
      t.dashboard.errors,
      t.dashboard.mean,
      'p99',
    ],
    rows.map(({ service, entry }) => {
      const failed = entry.rate > 0 ? entry.failed / entry.rate : 0
      return {
        key: service.id,
        cells: [
          { text: serviceName(t, service) },
          { text: t.dashboard.s(rateText(entry.rate)) },
          { text: percent(total > 0 ? entry.rate / total : 0) },
          { text: percent(failed, failed < 0.1 ? 2 : 1), color: failed > 0.01 ? RED : undefined },
          { text: formats(t).ms(entry.mean) },
          { text: formats(t).ms(entry.p99) },
        ],
      }
    }),
    h,
  )
}

const waterfallTable = (
  game: Game,
  ledger: Ledger,
  kind: RequestKind,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const names = namesOf(t, game.nodes)
  const byId = new Map(game.nodes.map((node) => [node.id, node] as const))
  const pressured = ledger.bottleneckByKind[kind] ?? null
  const limitName = (limit: Limit): string =>
    ({
      cpu: 'CPU',
      credits: t.dashboard.cPUCredits,
      memory: t.dashboard.memory,
      workers: t.dashboard.workers,
      connections: t.dashboard.connections,
      network: t.dashboard.network,
      disk: t.dashboard.disk,
      throughput: t.dashboard.throughput,
      none: t.dashboard.noLimit,
    })[limit]
  const carriesKind = (id: string): boolean => (ledger.nodes[id]?.traffic[kind] ?? 0) > 0
  const incoming = new Set(
    ledger.links.filter((link) => (link.traffic[kind] ?? 0) > 0).map((link) => link.to),
  )
  const roots = Object.keys(ledger.nodes).filter((id) => carriesKind(id) && !incoming.has(id))
  const order: Array<string> = []
  const seen = new Set<string>()
  const queue = [...roots]
  while (queue.length > 0) {
    const id = queue.shift() as string
    if (seen.has(id)) continue
    seen.add(id)
    order.push(id)
    for (const link of ledger.links)
      if (link.from === id && (link.traffic[kind] ?? 0) > 0 && !seen.has(link.to))
        queue.push(link.to)
  }
  return tablePanel(
    'waterfall',
    SPAN.half,
    t.dashboard.waterfall,
    t.dashboard.waterfallOf(t.catalog.kinds[kind].label),
    [t.dashboard.node, t.dashboard.hopTime, t.dashboard.wait, t.dashboard.bottleneck],
    order.flatMap((id) => {
      const own = ledger.nodes[id] as NodeLedger
      const node = byId.get(id)
      if (!node) return []
      const hop = own.hopByKind[kind] ?? 0
      const wait = own.waitByKind[kind] ?? 0
      return [
        {
          key: id,
          cells: [
            { text: names.get(id) ?? t.catalog.components[node.type].name },
            { text: formats(t).ms(hop) },
            { text: wait > 0 ? formats(t).queueWait(wait) : '—' },
            {
              text: id === pressured ? limitName(own.limit) : '',
              color: id === pressured ? RED : undefined,
            },
          ],
        },
      ]
    }),
    h,
  )
}

const limitNameOf = (t: Messages): Record<Limit, string> => ({
  cpu: 'CPU',
  credits: t.dashboard.cPUCredits,
  memory: t.dashboard.memory,
  workers: t.dashboard.workers,
  connections: t.dashboard.connections,
  network: t.dashboard.network,
  disk: t.dashboard.disk,
  throughput: t.dashboard.throughput,
  none: t.dashboard.noLimit,
})

const LIMIT_COLOR: Record<Limit, string> = {
  cpu: RED,
  credits: AMBER,
  memory: PINK,
  workers: PURPLE,
  connections: TEAL,
  network: BLUE,
  disk: AMBER,
  throughput: GREEN,
  none: MUTED,
}

const resourceTimeline = (
  model: Model,
  tracks: ReadonlyArray<NodeTrack>,
  h: HtmlBuilder<Message>,
): Html =>
  lazyResourceTimeline(resourceTimelineView, [
    model.board.nodeHistory,
    tracks,
    Math.floor(model.board.game.time / NODE_HISTORY_EVERY_SIM_SECONDS) *
      NODE_HISTORY_EVERY_SIM_SECONDS,
    h,
  ])

const lazyResourceTimeline = createLazy()

const resourceTimelineView = (
  history: Model['board']['nodeHistory'],
  tracks: ReadonlyArray<NodeTrack>,
  last: number,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const length = Math.max(1, ...tracks.map((track) => (history[track.id] ?? []).length))
  const first = last - (length - 1) * NODE_HISTORY_EVERY_SIM_SECONDS
  const lanes = tracks.map((track) => {
    const limits = (history[track.id] ?? []).map((sample) => sample.limit)
    return {
      key: track.id,
      name: track.name,
      runs: runsOf(limits, length - limits.length, (limit) => ({
        color: LIMIT_COLOR[limit],
        label: limitNameOf(t)[limit],
      })),
    }
  })
  const present = [
    ...new Set(tracks.flatMap((track) => (history[track.id] ?? []).map((sample) => sample.limit))),
  ]
  return laneTimeline(
    'resources',
    SPAN.third,
    t.dashboard.resources,
    t.dashboard.theLimitingResource,
    lanes,
    length,
    first,
    last,
    h,
    present.map((limit) => swatch(limitNameOf(t)[limit], LIMIT_COLOR[limit], h)),
  )
}

const churnCached = perSecond<ReadonlyArray<RegionChurn>>()

const usersTable = (
  game: Game,
  ledger: Ledger,
  only: RegionId | null,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const all = churnCached(game, '', () => churnOf(game, ledger))
  const regions = only === null ? all : all.filter((region) => region.region === only)
  const split = regional(game)
  return tablePanel(
    'users-region',
    SPAN.half,
    t.dashboard.users,
    t.dashboard.byRegionMarketAndChurn,
    [
      t.dashboard.region,
      t.dashboard.users,
      t.dashboard.market,
      t.dashboard.share,
      'Apdex',
      t.dashboard.churn,
    ],
    regions.map((region) => {
      const market = ledger.market * (split ? REGION_INFO[region.region].share : 1)
      const share = market > 0 ? region.users / market : 0
      return {
        key: region.region,
        cells: [
          { text: t.catalog.regionInfo[region.region].name },
          { text: compact(region.users) },
          { text: compact(market) },
          {
            text: percent(share, share < 0.1 ? 1 : 0),
            bar: { share: Math.min(1, share), color: TEAL },
          },
          {
            text: `${region.now.toFixed(2)} / ${region.target.toFixed(2)}`,
            color: region.now >= region.target ? GREEN : RED,
          },
          {
            text: t.units.perHour(`${region.perHour >= 0 ? '+' : ''}${compact(region.perHour)}`),
            color: region.perHour < 0 ? RED : GREEN,
          },
        ],
      }
    }),
    h,
  )
}

const deviceTable = (ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return tablePanel(
    'devices',
    SPAN.half,
    t.dashboard.realUserMonitoring,
    t.dashboard.meanLatencyByDevice,
    [t.dashboard.device, t.dashboard.latency],
    DEVICES.map((device) => ({
      key: device,
      cells: [
        { text: t.catalog.deviceInfo[device].name },
        { text: formats(t).ms(ledger.deviceLatency[device] ?? 0) },
      ],
    })),
    h,
  )
}

const loadBalancer = (nodes: Game['nodes'], ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const names = namesOf(t, nodes)
  const balancers = nodes.filter((node) => node.type === 'lb')
  const entries = balancers.flatMap((balancer) =>
    ledger.links
      .filter((link) => link.from === balancer.id)
      .map((link) => ({
        key: `${link.from}>${link.to}`,
        name:
          balancers.length > 1
            ? `${names.get(link.from) ?? link.from} → ${names.get(link.to) ?? link.to}`
            : (names.get(link.to) ?? link.to),
        value: link.rate,
        text: t.dashboard.s(rateText(link.rate)),
      })),
  )
  return barList(
    'load-balancer',
    SPAN.half,
    t.dashboard.loadBalancer,
    entries.length === 0
      ? t.dashboard.noBackend
      : t.dashboard.perBackendEvenSplit(percent(1 / entries.length)),
    entries,
    h,
  )
}

const appServers = (nodes: Game['nodes'], ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const names = namesOf(t, nodes)
  return tablePanel(
    'app-server',
    SPAN.half,
    t.dashboard.appServer,
    t.dashboard.copiesBusyWorkers,
    [t.dashboard.node, t.dashboard.copies, t.dashboard.busyWorkers],
    nodes
      .filter((node) => node.type === 'server')
      .map((node) => {
        const own = ledger.nodes[node.id]
        const slots = own?.resources.slots ?? null
        const busy = slots === null ? 0 : Math.min(slots.used, slots.total)
        const share = slots === null || slots.total <= 0 ? 0 : busy / slots.total
        return {
          key: node.id,
          cells: [
            { text: names.get(node.id) ?? t.catalog.components[node.type].name },
            {
              text:
                bootingOf(node) > 0
                  ? t.dashboard.copiesBooting(node.replicas, bootingOf(node))
                  : String(node.replicas),
            },
            slots === null
              ? { text: '—' }
              : {
                  text: `${Math.round(busy)}/${Math.round(slots.total)}`,
                  bar: { share, color: LEVEL_COLOR[levelOf(share, UTILIZATION)] },
                },
          ],
        }
      }),
    h,
  )
}

const databases = (nodes: Game['nodes'], ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const names = namesOf(t, nodes)
  return tablePanel(
    'database',
    SPAN.half,
    t.dashboard.database,
    t.dashboard.connectionsRefusedLag,
    [
      t.dashboard.node,
      t.dashboard.connections,
      t.dashboard.queries,
      t.dashboard.refused,
      t.dashboard.lag,
    ],
    nodes
      .filter((node) => node.type === 'database' || node.type === 'replica')
      .map((node) => {
        const own = ledger.nodes[node.id]
        const connections = own?.connections ?? null
        const share = connections === null ? 0 : connections.used / Math.max(1, connections.max)
        const refused = own?.refused ?? 0
        const lag = own?.lagMs ?? null
        return {
          key: node.id,
          cells: [
            { text: names.get(node.id) ?? t.catalog.components[node.type].name },
            connections === null
              ? { text: '—' }
              : {
                  text: `${Math.round(connections.used)}/${Math.round(connections.max)}`,
                  bar: { share, color: LEVEL_COLOR[levelOf(share, UTILIZATION)] },
                },
            { text: t.dashboard.s(compact(own?.inbound ?? 0)) },
            {
              text: refused > 0.0005 ? t.dashboard.s(compact(refused)) : '—',
              color: refused > 0.0005 ? RED : undefined,
            },
            { text: lag === null ? '—' : formats(t).ms(lag) },
          ],
        }
      }),
    h,
  )
}

const evictions = (game: Game, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const names = namesOf(t, game.nodes)
  return barList(
    'evictions',
    SPAN.half,
    t.dashboard.cacheEvictions,
    t.dashboard.keysEvictedNow,
    game.nodes
      .filter((node) => node.type === 'cache')
      .map((node) => {
        const own = ledger.nodes[node.id]
        const share = Math.min(1, evictionShareOf(game, node))
        return {
          key: node.id,
          name: names.get(node.id) ?? t.catalog.components[node.type].name,
          value: share,
          text: t.dashboard.s(compact(Math.round(own?.evictions ?? 0))),
          color: PINK,
        }
      }),
    h,
  )
}

const hits = (
  key: string,
  title: string,
  unit: string,
  type: 'cache' | 'cdn',
  nodes: Game['nodes'],
  ledger: Ledger,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const names = namesOf(t, nodes)
  return barList(
    key,
    SPAN.half,
    title,
    unit,
    nodes
      .filter((node) => node.type === type)
      .map((node) => {
        const hit = ledger.nodes[node.id]?.hitRatio ?? null
        return {
          key: node.id,
          name: names.get(node.id) ?? t.catalog.components[node.type].name,
          value: hit ?? 0,
          text: hit === null ? '—' : percent(hit, 1),
          color: TEAL,
        }
      }),
    h,
  )
}

const queues = (nodes: Game['nodes'], ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const names = namesOf(t, nodes)
  return tablePanel(
    'queue',
    SPAN.half,
    t.dashboard.queue,
    t.dashboard.depthAndOldestAge,
    [
      t.dashboard.queue,
      t.dashboard.depth,
      t.dashboard.oldestTask,
      t.dashboard.drained,
      t.dashboard.state,
    ],
    nodes
      .filter((node) => node.type === 'queue')
      .map((node) => {
        const own = ledger.nodes[node.id]
        const age = own?.age ?? null
        const stalled = age === Number.POSITIVE_INFINITY
        const down = own?.status === 'down'
        const level: Level = down || stalled ? 'danger' : age !== null && age > 0 ? 'warn' : 'ok'
        const label = down
          ? t.dashboard.down
          : stalled
            ? t.dashboard.stalled
            : age !== null && age > 0
              ? t.dashboard.waiting
              : t.dashboard.clear
        const drained = Object.values(own?.out ?? {}).reduce((sum, rate) => sum + rate, 0)
        return {
          key: node.id,
          cells: [
            { text: names.get(node.id) ?? t.catalog.components[node.type].name },
            { text: compact(node.depth) },
            { text: formats(t).queueWait(age) },
            { text: t.dashboard.s(compact(drained)) },
            { text: label, fill: LEVEL_COLOR[level] },
          ],
        }
      }),
    h,
  )
}

const MANAGED: ReadonlyArray<ComponentId> = ['psp', 'llm', 'msgp', 'auth']

const managed = (nodes: Game['nodes'], ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const names = namesOf(t, nodes)
  return tablePanel(
    'managed',
    SPAN.half,
    t.dashboard.managedComponents,
    t.dashboard.callsLatencyOutage,
    [
      t.dashboard.component,
      t.dashboard.calls,
      t.dashboard.sent,
      t.dashboard.latency,
      t.dashboard.state,
    ],
    nodes
      .filter((node) => MANAGED.includes(node.type))
      .map((node) => {
        const own = ledger.nodes[node.id]
        const down = own?.status === 'down'
        const throttled = own?.throttled ?? false
        const sent = Object.values(own?.out ?? {}).reduce((sum, rate) => sum + rate, 0)
        return {
          key: node.id,
          cells: [
            { text: names.get(node.id) ?? t.catalog.components[node.type].name },
            { text: t.dashboard.s(compact(own?.inbound ?? 0)) },
            { text: sent > 0 ? t.dashboard.s(compact(sent)) : '—' },
            { text: formats(t).ms(own?.latency ?? 0) },
            {
              text: down ? t.dashboard.down : throttled ? t.dashboard.throttled : t.dashboard.up,
              fill: LEVEL_COLOR[down ? 'danger' : throttled ? 'warn' : 'ok'],
            },
          ],
        }
      }),
    h,
  )
}

const rangeLabel = (t: Messages, minutes: number): string =>
  minutes >= 1440 ? t.units.dShort(minutes / 1440) : t.units.hShort(minutes / 60)

const topBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const now = clockOf(model.board.game.time)
  const open = boardSandbox(model.board)
  const place = open
    ? open.id === null
      ? t.dashboard.freeSandbox
      : t.dashboard.sandbox
    : t.dashboard.company
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '2',
          paddingInline: '4',
          paddingTop: '4',
          _compact: {
            paddingInline: '3',
          },
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            cx(
              PANEL,
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '2.5',
                paddingBlock: '2',
                paddingRight: '3',
                paddingLeft: '3.5',
              }),
            ),
          ),
        ],
        [
          icon(
            h,
            LayoutGrid,
            css({
              width: '4',
              height: '4',
              color: 'mutedForeground',
            }),
          ),
          h.span(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                  fontSize: 'type.13',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [
              t.dashboard.dashboards,
              h.span([], ['/']),
              place,
              h.span([], ['/']),
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'type.15',
                      fontWeight: 'semibold',
                      letterSpacing: 'body',
                      color: 'foreground',
                    }),
                  ),
                ],
                [t.dashboard.overview],
              ),
            ],
          ),
          icon(
            h,
            Star,
            css({
              width: '3.5',
              height: '3.5',
              color: 'mutedForeground',
            }),
          ),
        ],
      ),
      h.span(
        [
          h.Class(
            css({
              flex: '1 1 0%',
            }),
          ),
        ],
        [],
      ),
      h.div(
        [
          h.Class(
            cx(
              PANEL,
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '1.5',
                padding: '1.5',
              }),
            ),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  display: 'grid',
                  height: '7',
                  placeItems: 'center',
                  paddingInline: '1.5',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [
              icon(
                h,
                Clock3,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                cx(
                  css({
                    display: 'flex',
                    gap: '0.75',
                    padding: '0.75',
                  }),
                  WELL,
                ),
              ),
            ],
            DASHBOARD_RANGE_MINUTES.map((minutes) =>
              h.button(
                [
                  h.Key(`range-${minutes}`),
                  h.Type('button'),
                  h.AriaPressed(minutes === model.board.dashboard.range ? 'true' : 'false'),
                  h.OnClick(
                    Message.DashboardChanged({
                      message: DashboardMessage.RangeChosen({ minutes }),
                    }),
                  ),
                  h.Class(
                    cx(
                      css({
                        height: '6',
                        borderRadius: 'md',
                        paddingInline: '2.5',
                        fontSize: 'type.12',
                      }),
                      minutes === model.board.dashboard.range
                        ? css({
                            layerStyle: 'raised',
                            color: 'foreground',
                            boxShadow: 'raised',
                          })
                        : css({
                            color: 'mutedForeground',
                            _hover: {
                              color: 'foreground',
                            },
                          }),
                    ),
                  ),
                ],
                [rangeLabel(t, minutes)],
              ),
            ),
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    display: 'flex',
                    height: '7',
                    alignItems: 'center',
                    gap: '2',
                    borderRadius: 'lg',
                    layerStyle: 'raised',
                    paddingInline: '2.5',
                    fontSize: 'type.12',
                    boxShadow: 'raised',
                  }),
                  clockPaused(model)
                    ? css({
                        color: 'mutedForeground',
                      })
                    : css({
                        color: 'foreground',
                      }),
                ),
              ),
            ],
            [
              led(clockPaused(model) ? MUTED : GREEN, h),
              clockPaused(model)
                ? t.dashboard.paused
                : t.dashboard.liveD(
                    now.day,
                    String(now.hour).padStart(2, '0'),
                    String(now.minute).padStart(2, '0'),
                  ),
              icon(
                h,
                RefreshCw,
                css({
                  width: '3.5',
                  height: '3.5',
                  color: 'mutedForeground',
                }),
              ),
            ],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            cx(
              PANEL,
              css({
                padding: '1',
              }),
            ),
          ),
        ],
        [
          button(
            {
              onClick: Message.PanelClosed(),
              variant: 'ghost',
              size: 'icon',
              className: css({
                color: 'mutedForeground',
              }),
              attributes: [h.AriaLabel(t.dashboard.closeEsc)],
            },
            icon(
              h,
              X,
              css({
                width: '4',
                height: '4',
              }),
            ),
            h,
          ),
        ],
      ),
    ],
  )
}

const variables = (model: Model, slo: number, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const dashboard = model.board.dashboard
  const chip = (name: string, value: string) =>
    h.span(
      [
        h.Key(name),
        h.Class(
          css({
            display: 'flex',
            height: '7',
            alignItems: 'stretch',
            overflow: 'hidden',
            borderRadius: 'lg',
            layerStyle: 'raised',
            fontSize: 'type.12',
            boxShadow: 'raised',
          }),
        ),
      ],
      [
        h.span(
          [
            h.Class(
              css({
                display: 'grid',
                placeItems: 'center',
                borderRightWidth: '1px',
                borderRightStyle: 'solid',
                borderColor: 'hairline',
                backgroundColor: 'color-mix(in oklab, var(--well) 60%, transparent)',
                paddingInline: '2',
                color: 'mutedForeground',
              }),
            ),
          ],
          [name],
        ),
        h.span(
          [
            h.Class(
              css({
                display: 'grid',
                placeItems: 'center',
                paddingInline: '2',
                fontFamily: 'mono',
                fontSize: 'type.11-5',
              }),
            ),
          ],
          [value],
        ),
      ],
    )
  const select = (
    name: string,
    value: string,
    options: ReadonlyArray<readonly [string, string]>,
    chosen: (value: string) => Message,
  ) =>
    h.label(
      [
        h.Key(name),
        h.DataAttribute('variable', name),
        h.Class(
          css({
            display: 'flex',
            height: '7',
            alignItems: 'center',
            gap: '1.5',
            borderRadius: 'lg',
            layerStyle: 'raised',
            paddingRight: '1',
            paddingLeft: '2',
            fontSize: 'type.11',
            boxShadow: 'raised',
          }),
        ),
      ],
      [
        h.span(
          [
            h.Class(
              css({
                color: 'mutedForeground',
              }),
            ),
          ],
          [name],
        ),
        h.select(
          [
            h.Value(value),
            h.AriaLabel(name),
            h.OnChange(chosen),
            h.Class(
              css({
                height: '6',
                maxWidth: '9.5rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                borderRadius: 'md',
                backgroundColor: 'well',
                paddingInline: '1',
                fontFamily: 'mono',
                fontSize: 'type.11-5',
                color: 'foreground',
                outlineStyle: 'none',
              }),
            ),
          ],
          options.map(([option, label]) =>
            h.option([h.Value(option), ...(option === value ? [h.Selected(true)] : [])], [label]),
          ),
        ),
      ],
    )
  const toggle = (name: string, on: boolean, click: Message, color?: string) =>
    h.button(
      [
        h.Key(name),
        h.Type('button'),
        h.AriaPressed(on ? 'true' : 'false'),
        h.OnClick(click),
        h.Class(
          cx(
            css({
              display: 'flex',
              height: '6',
              alignItems: 'center',
              gap: '1.5',
              borderRadius: 'md',
              paddingInline: '1.5',
              fontSize: 'type.11',
            }),
            on
              ? css({
                  layerStyle: 'raised',
                  color: 'foreground',
                  boxShadow: 'raised',
                })
              : css({
                  color: 'color-mix(in oklab, var(--muted-foreground) 70%, transparent)',
                }),
          ),
        ),
      ],
      [
        ...(color === undefined
          ? []
          : [
              h.span(
                [
                  h.Class(
                    css({
                      height: '3',
                      borderLeftWidth: '1px',
                      borderLeftStyle: 'solid',
                      borderStyle: 'dashed',
                    }),
                  ),
                  h.Style({ borderColor: color, opacity: on ? '1' : '0.4' }),
                ],
                [],
              ),
            ]),
        h.span([], [name]),
      ],
    )
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '2',
          paddingInline: '4',
          paddingTop: '4',
          _compact: {
            paddingInline: '3',
          },
        }),
      ),
    ],
    [
      select(
        t.dashboard.kind,
        dashboard.kind ?? 'all',
        [
          ['all', t.dashboard.allKinds],
          ...REQUEST_KINDS.map((kind) => [kind, t.catalog.kinds[kind].label] as const),
        ],
        (value) =>
          Message.DashboardChanged({
            message: DashboardMessage.KindChosen({
              kind: value === 'all' ? null : (value as RequestKind),
            }),
          }),
      ),
      ...(game.services.length > 1
        ? [
            select(
              t.dashboard.serviceVariable,
              dashboard.service ?? 'all',
              [
                ['all', t.dashboard.allServices],
                ...game.services.map((entry) => [entry.id, serviceName(t, entry)] as const),
              ],
              (value) =>
                Message.DashboardChanged({
                  message: DashboardMessage.ServiceChosen({
                    service: value === 'all' ? null : value,
                  }),
                }),
            ),
          ]
        : []),
      regional(game)
        ? select(
            t.dashboard.region2,
            dashboard.region ?? 'all',
            [
              ['all', t.dashboard.allRegions],
              ...REGIONS.map((region) => [region, t.catalog.regionInfo[region].name] as const),
            ],
            (value) =>
              Message.DashboardChanged({
                message: DashboardMessage.RegionChosen({
                  region: value === 'all' ? null : (value as RegionId),
                }),
              }),
          )
        : chip(t.dashboard.region2, model.board.region),
      chip(t.dashboard.eraVariable, eraWords(t, game).name),
      chip(t.dashboard.sloVariable, sloText(slo)),
      h.span(
        [
          h.Class(
            css({
              flex: '1 1 0%',
            }),
          ),
        ],
        [],
      ),
      toggle(
        t.dashboard.compare,
        dashboard.compare,
        Message.DashboardChanged({ message: DashboardMessage.CompareToggled() }),
      ),
      toggle(
        t.dashboard.table,
        dashboard.table,
        Message.DashboardChanged({ message: DashboardMessage.TableToggled() }),
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '1',
            }),
          ),
        ],
        ANNOTATION_GROUPS.map((group) =>
          toggle(
            annotationNameOf(t)[group],
            dashboard.groups.includes(group),
            Message.DashboardChanged({ message: DashboardMessage.GroupToggled({ group }) }),
            ANNOTATION_COLOR[group],
          ),
        ),
      ),
    ],
  )
}

export const dashboardPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const ledger = ledgerOf(model)
  const budget = budgetOf(game)
  const credit = slaCreditsOf(game, ledger)
  const slo = budget.slo > 0 && budget.slo < 1 ? budget.slo : 0.999
  const rows = rowsOf(model, slo)
  const tracks = tracksOf(model)
  const latest = game.history[game.history.length - 1]
  const cashRate = Number(rows[rows.length - 1]?.cashRate ?? 0)
  const kind = model.board.dashboard.kind
  const service = model.board.dashboard.service
  const serviceKinds = service === null ? null : (ledger.services[service]?.kinds ?? [])
  const shownKind = (entry: RequestKind): boolean =>
    (kind === null || entry === kind) && (serviceKinds === null || serviceKinds.includes(entry))
  const region = regional(game) ? model.board.dashboard.region : null
  const regionApdex = region === null ? null : (ledger.regions[region] ?? null)
  const percentiles = has(game, 'percentiles')
  const alerting = has(game, 'alerting')
  const resourcesShown = has(game, 'profiling') || has(game, 'tracing')
  const hasNode = (type: ComponentId): boolean => game.nodes.some((node) => node.type === type)
  const latencyRule = ((): number | null => {
    if (!alerting) return null
    const busiest = (
      Object.entries(ledger.kinds) as ReadonlyArray<[RequestKind, KindLedger | undefined]>
    )
      .filter(([, entry]) => entry !== undefined && entry.rate > 0)
      .sort((left, right) => (right[1]?.rate ?? 0) - (left[1]?.rate ?? 0))[0]
    return busiest ? game.alertRules.latency * PROFILES[busiest[0]].apdex : null
  })()
  const bottleneck = tracks.reduce<NodeTrack | null>(
    (best, track) =>
      (ledger.nodes[track.id]?.utilization ?? 0) >
      (best ? (ledger.nodes[best.id]?.utilization ?? 0) : -1)
        ? track
        : best,
    null,
  )
  const exemplars = exemplarsOf(model, rows)
  const nodePanels: ReadonlyArray<Html> = [
    ...(hasNode('lb') ? [lazyPanel('load-balancer', loadBalancer, [game.nodes, ledger, h])] : []),
    ...(hasNode('server') ? [lazyPanel('app-server', appServers, [game.nodes, ledger, h])] : []),
    ...(hasNode('database') || hasNode('replica')
      ? [lazyPanel('databases', databases, [game.nodes, ledger, h])]
      : []),
    ...(hasNode('queue') ? [lazyPanel('queues', queues, [game.nodes, ledger, h])] : []),
    ...(hasNode('cache')
      ? [
          lazyPanel('cache', hits, [
            'cache',
            t.dashboard.cache,
            t.dashboard.hitRatioNow,
            'cache',
            game.nodes,
            ledger,
            h,
          ]),
          evictions(game, ledger, h),
        ]
      : []),
    ...(hasNode('cdn')
      ? [
          lazyPanel('cdn', hits, [
            'cdn',
            'CDN',
            t.dashboard.hitRatioEgress(t.units.perSecond(money(ledger.egress))),
            'cdn',
            game.nodes,
            ledger,
            h,
          ]),
        ]
      : []),
    ...(game.nodes.some((node) => MANAGED.includes(node.type))
      ? [lazyPanel('managed', managed, [game.nodes, ledger, h])]
      : []),
  ]
  const userPanels: ReadonlyArray<Html> = has(game, 'multi-region')
    ? [usersTable(game, ledger, region, h), ...(has(game, 'rum') ? [deviceTable(ledger, h)] : [])]
    : []
  const marks = annotationsOf(model)
  const series = (spec: SeriesSpec) =>
    timeSeries(
      model,
      rows,
      marks,
      spec.key === 'latency' && has(game, 'tracing') ? exemplars : NO_EXEMPLARS,
      spec,
      h,
    )

  const panels: ReadonlyArray<Html> =
    rows.length < 2 || !latest
      ? [
          h.div(
            [
              h.Key('empty'),
              h.Class(
                cx(
                  PANEL,
                  css({
                    gridColumn: 'span 24 / span 24',
                    paddingInline: '4',
                    paddingBlock: '6',
                    fontSize: 'type.13',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [t.dashboard.chartsFillInAsTheClock],
          ),
        ]
      : [
          stat(
            'users',
            t.dashboard.users,
            compact(region === null ? latest.users : regionUsers(game)[region]),
            'plain',
            rows,
            'users',
            BLUE,
            h,
          ),
          stat(
            'cash-rate',
            t.dashboard.cashPerSecond,
            t.dashboard.s2(cashRate >= 0 ? '+' : '', money(cashRate)),
            cashRate > 0 ? 'ok' : cashRate < 0 ? 'danger' : 'plain',
            rows,
            'cashRate',
            GREEN,
            h,
            false,
            true,
          ),
          gauge(
            'apdex',
            'Apdex',
            regionApdex ?? latest.apdex,
            (regionApdex ?? latest.apdex).toFixed(2),
            { warn: 0.85, danger: 0.7, invert: true },
            h,
          ),
          gauge(
            'bottleneck',
            bottleneck ? t.dashboard.hottestNode(bottleneck.name) : t.dashboard.hottestNode2,
            Math.min(1, bottleneck ? (ledger.nodes[bottleneck.id]?.utilization ?? 0) : 0),
            percent(
              Math.min(9.99, bottleneck ? (ledger.nodes[bottleneck.id]?.utilization ?? 0) : 0),
            ),
            UTILIZATION,
            h,
          ),
          has(game, 'logs')
            ? stat(
                t.dashboard.errors2,
                t.dashboard.errorRate,
                percent(latest.errors, latest.errors < 0.1 ? 2 : 1),
                levelOf(latest.errors, { warn: 0.001, danger: 0.01 }),
                rows,
                t.dashboard.errors2,
                RED,
                h,
                true,
              )
            : locked(t.dashboard.errors2, SPAN.stat, t.dashboard.errorRate, 'logs', h),
          stat(
            'latency-now',
            percentiles ? t.dashboard.p99Latency : t.dashboard.meanLatency,
            formats(t).ms(percentiles ? latest.p99 : latest.latency),
            'plain',
            rows,
            percentiles ? 'p99' : 'latency',
            PURPLE,
            h,
          ),

          rowHeader(t.dashboard.goldenSignals, 5, h),
          series({
            key: 'traffic',
            span: SPAN.half,
            columns: 12,
            title: t.dashboard.traffic,
            unit: t.dashboard.reqPerSecond,
            series: [
              { key: 'served', name: t.dashboard.served, color: TEAL, fill: true },
              { key: 'demand', name: t.dashboard.demand, color: MUTED, dashed: true },
            ],
            format: (value) => t.dashboard.s(compact(value)),
            compare: 'served',
            ...(has(game, 'anomaly-detection')
              ? {
                  rules: [
                    {
                      y: ledger.forecastPeak,
                      label: t.dashboard.tomorrowsPeak(
                        t.units.perSecond(compact(ledger.forecastPeak)),
                      ),
                      color: PINK,
                    },
                  ],
                }
              : {}),
          }),
          series({
            key: 'latency',
            span: SPAN.half,
            columns: 12,
            title: t.dashboard.latency,
            unit: percentiles ? t.dashboard.meanP99 : t.dashboard.meanUnit,
            series: percentiles
              ? [
                  { key: 'p99', name: 'p99', color: PURPLE, fill: true },
                  { key: 'latency', name: t.dashboard.mean, color: BLUE },
                ]
              : [{ key: 'latency', name: t.dashboard.mean, color: BLUE, fill: true }],
            format: formats(t).ms,
            compare: percentiles ? 'p99' : 'latency',
            ...(latencyRule === null
              ? {}
              : {
                  rules: [
                    {
                      y: latencyRule,
                      label: t.dashboard.alertAbove(formats(t).ms(latencyRule)),
                      color: AMBER,
                    },
                  ],
                }),
          }),
          ...(has(game, 'tracing') ? [exemplarStrip(exemplars, h)] : []),
          has(game, 'logs')
            ? series({
                key: 'errors-series',
                span: SPAN.third,
                columns: 8,
                title: t.dashboard.errors,
                unit: t.dashboard.failed2,
                series: [{ key: 'errors', name: t.dashboard.failed, color: RED, fill: true }],
                format: (value) => `${value.toFixed(value < 1 ? 2 : 1)}%`,
                rules: [
                  {
                    y: (alerting ? game.alertRules.errors : 0.01) * 100,
                    label: t.dashboard.alertAbove(
                      percent(alerting ? game.alertRules.errors : 0.01, 1),
                    ),
                    color: AMBER,
                  },
                ],
              })
            : locked('errors-series', SPAN.third, t.dashboard.errors, 'logs', h),
          causes(ledger, h),
          mix(ledger, shownKind, h),

          ...(alerting
            ? [
                rowHeader(t.dashboard.alerts, 2, h),
                alertTable(game, ledger, h),
                alertTimeline(model, rows, h),
              ]
            : []),
          ...(has(game, 'tracing')
            ? [
                rowHeader(
                  t.dashboard.servicesRed,
                  1 + (game.services.length > 1 ? 1 : 0) + (kind ? 1 : 0),
                  h,
                ),
                servicesTable(ledger, shownKind, h),
                ...(game.services.length > 1 ? [serviceTable(game, ledger, service, h)] : []),
                ...(kind ? [waterfallTable(game, ledger, kind, h)] : []),
              ]
            : []),

          rowHeader(t.dashboard.saturation, resourcesShown ? 4 : 3, h),
          lazyPanel('bar-gauge', barGauge, [ledger, tracks, h]),
          stateTimeline(model, tracks, resourcesShown ? SPAN.third : SPAN.twoThirds, h),
          ...(has(game, 'profiling')
            ? [resourceTimeline(model, tracks, h)]
            : has(game, 'tracing')
              ? [locked('resources', SPAN.third, t.dashboard.resourcesUse, 'profiling', h)]
              : []),
          lazyNodeTable('nodes', nodeTable, [ledger, tracks, h]),

          rowHeader(t.dashboard.money, 1, h),
          series({
            key: 'money',
            span: SPAN.full,
            columns: 24,
            title: t.dashboard.revenueAndBurn,
            unit: t.dashboard.s4,
            series: [
              { key: 'revenue', name: t.dashboard.revenue, color: TEAL, fill: true },
              { key: 'burn', name: t.dashboard.burn, color: AMBER },
            ],
            format: (value) => money(value),
          }),

          ...(has(game, 'slo-dashboards')
            ? [
                rowHeader('SLO', 4, h),
                stat(
                  'availability',
                  t.dashboard.availabilityWeek,
                  percent(budget.availability, 2),
                  budget.availability >= budget.slo ? 'ok' : 'danger',
                  rows,
                  'availability',
                  GREEN,
                  h,
                ),
                gauge(
                  'error-budget',
                  t.dashboard.errorBudgetLeft,
                  Math.max(0, Math.min(1, budget.left)),
                  budget.left > 0
                    ? `${Math.round(Math.min(1, budget.left) * 100)}%`
                    : t.dashboard.spent,
                  { warn: 0.5, danger: 0.05, invert: true },
                  h,
                ),
                panel(
                  'sla-credit',
                  SPAN.stat,
                  t.dashboard.sLACredits,
                  credit > 0 ? t.dashboard.paid : '',
                  [
                    h.div(
                      [
                        h.Class(
                          cx(
                            SCREEN,
                            css({
                              display: 'flex',
                              minHeight: '92px',
                              flex: '1 1 0%',
                              flexDirection: 'column',
                              justifyContent: 'flex-end',
                              paddingInline: '3',
                              paddingTop: '2',
                              paddingBottom: '3',
                            }),
                          ),
                        ),
                      ],
                      [
                        h.span(
                          [
                            h.Class(
                              css(FIGURE_STYLE, {
                                fontSize: 'type.30',
                                lineHeight: 'none',
                                fontWeight: 'medium',
                                letterSpacing: 'title',
                              }),
                            ),
                            h.Style({ color: credit > 0 ? RED : MUTED }),
                            h.Title(
                              credit > 0
                                ? t.dashboard.slaPaysBack(
                                    t.units.perSecond(money(credit)),
                                    sloText(budget.slo),
                                  )
                                : t.dashboard.noSlaCredit,
                            ),
                          ],
                          [credit > 0 ? `−${t.units.perSecond(money(credit))}` : '—'],
                        ),
                      ],
                    ),
                  ],
                  h,
                  null,
                  credit > 0 ? RED : MUTED,
                ),
                series({
                  key: 'burn-rate',
                  span: SPAN.half,
                  columns: 12,
                  title: t.dashboard.errorBudgetBurnRate,
                  unit: t.dashboard.budgetSLO(sloText(slo)),
                  series: [
                    { key: 'burnRate', name: t.dashboard.burnRate, color: PINK, fill: true },
                  ],
                  format: (value) => `${value < 10 ? value.toFixed(1) : Math.round(value)}×`,
                  rules: [
                    { y: 10, label: t.dashboard.page10, color: RED },
                    { y: 1, label: '1×', color: MUTED },
                  ],
                }),
              ]
            : [
                rowHeader('SLO', 1, h),
                locked(
                  'burn-rate',
                  SPAN.half,
                  t.dashboard.errorBudgetBurnRate,
                  'slo-dashboards',
                  h,
                ),
              ]),

          ...(nodePanels.length === 0
            ? []
            : [rowHeader(t.dashboard.nodes, nodePanels.length, h), ...nodePanels]),

          ...(userPanels.length === 0
            ? []
            : [rowHeader(t.dashboard.users, userPanels.length, h), ...userPanels]),

          ...(game.sandbox
            ? []
            : [rowHeader(t.dashboard.company, 3, h), ...companyPanels(model, ledger, rows, h)]),
          ...(game.incident === null && game.postmortems.length === 0
            ? []
            : [
                rowHeader(
                  t.dashboard.incidents,
                  game.postmortems.some(
                    (postmortem) => postmortem.id === model.board.dashboard.postmortem,
                  )
                    ? 4
                    : 3,
                  h,
                ),
                ...incidentPanels(model, rows, h),
              ]),
        ]

  return h.div(
    [
      h.Key('dashboard'),
      h.DataAttribute('dashboard', ''),
      h.DataAttribute('exit', 'gesture'),
      h.Class(
        cx(
          css({
            position: 'absolute',
            inset: '0',
            zIndex: '30',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'canvas',
            color: 'foreground',
          }),
          'enter-backdrop',
        ),
      ),
    ],
    [
      topBar(model, h),
      h.div(
        [
          h.Key('scroll'),
          h.DataAttribute('scroll', 'dashboard'),
          h.Tabindex(0),
          h.Role('region'),
          h.AriaLabel(t.dashboard.dashboardScrollForTheCompanyAnd),
          h.Class(
            cx(
              css({
                minHeight: '0',
                flex: '1 1 0%',
              }),
              SCROLL,
              css({
                _focusVisible: {
                  outlineWidth: '2px',
                  outlineStyle: 'solid',
                  outlineOffset: '-2px',
                  outlineColor: 'primary',
                },
              }),
            ),
          ),
        ],
        [
          variables(model, slo, h),
          h.div(
            [
              h.Class(
                css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
                  gap: '2',
                  paddingInline: '4',
                  paddingTop: '2',
                  paddingBottom: '8',
                  _compact: {
                    paddingInline: '3',
                  },
                }),
              ),
            ],
            panels,
          ),
        ],
      ),
    ],
  )
}
