import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { perSecond } from '@/game/per-second.ts'
import { formats } from '@/i18n/format.ts'
import { changeIn } from '@/i18n/refusal.ts'
import {
  copy,
  copyIn,
  eraWords,
  localized,
  nodeTitle,
  speak,
  type Messages,
} from '@/i18n/messages.ts'
import { DashboardMessage } from '@/game/dashboard.ts'
import {
  type Field,
  type History,
  TIERS,
  type Tier,
  blockIndexAt,
  startOf,
} from '@/game/history.ts'
import { isPhone } from '@/game/viewport.ts'
import { Message } from '@/game/message.ts'
import { nextOf, readingOf } from '@/game/scaling.ts'
import {
  ANNOTATION_GROUPS,
  type AnnotationGroup,
  type Mail,
  type Model,
  boardSandbox,
  clockPaused,
} from '@/game/model.ts'
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
import { policyOf } from '@quorum/simulation/solve-graph'
import { regional, regionUsers } from '@quorum/simulation/regions'
import { RUNWAY_MONTH, runwayOf } from '@quorum/simulation/runway'
import { budgetOf, burnRateOf, slaCreditsOf } from '@quorum/simulation/slo'
import {
  activeIncident,
  type Game,
  type Incident,
  type Postmortem,
  type Sample,
} from '@quorum/simulation/state'
import { ignored } from '@quorum/simulation/step'
import { autoscalerViewOf } from '@quorum/simulation/scaling'
import { teamOutputs } from '@quorum/simulation/team'
import { compact, money, rate as rateText } from '@quorum/ui/game/format'
import { EYEBROW, FIGURE, FIGURE_STYLE, PANEL, SCROLL, WELL } from '@quorum/ui/game/bits'
import { buttonClass } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'

/* The view content and children these helpers pass around. */
type Content = View.Content<Message>
type Child = View.Input<Message>
type Label = View.Content<Message> | string | false | null | undefined

const button = (
  h: H<Message>,
  config: Readonly<{
    onClick?: Message
    isDisabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    size?: 'default' | 'xs' | 'sm' | 'lg' | 'row' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
    className?: string
    key?: string
    attributes?: Readonly<Record<string, string | undefined>>
  }>,
  label: Label | ReadonlyArray<Label>,
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

/* ---------------------------------------------------------------------------
   The charts, hand-written from `packages/ui/src/primitives/chart-core.ts`
   and `line-chart.ts`. The Dashboard draws a composed line/area chart with one
   numeric axis and a donut pie chart, so that is the subset kept here.
   --------------------------------------------------------------------------- */

type ChartValue = string | number | ReadonlyArray<number> | null | undefined
type Datum = Readonly<Record<string, ChartValue>>
type DataKey = string
type Margin = Readonly<{ top?: number; right?: number; bottom?: number; left?: number }>
type DomainEnd = number | 'auto' | 'dataMin' | 'dataMax'

const isNumberRange = (value: ChartValue): value is ReadonlyArray<number> => Array.isArray(value)
const numeric = (value: ChartValue): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  const result = Number(isNumberRange(value) ? value.at(-1) : value)
  return Number.isFinite(result) ? result : undefined
}
const at = (row: Datum, key: DataKey): ChartValue => row[key]
const domainMin = (values: ReadonlyArray<number>): number =>
  values.length === 0 ? 0 : Math.min(...values)
const domainMax = (values: ReadonlyArray<number>): number =>
  values.length === 0 ? 1 : Math.max(...values)
const scale = (value: number, min: number, max: number, start: number, end: number): number =>
  max === min ? (start + end) / 2 : start + ((value - min) / (max - min)) * (end - start)

const niceTickValues = (min: number, max: number, count = 5): ReadonlyArray<number> => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  const span = Math.max(1, max - min)
  const rawStep = span / Math.max(1, count - 1)
  const power = 10 ** Math.floor(Math.log10(rawStep))
  const ratio = rawStep / power
  const step =
    (ratio >= 8.75
      ? 10
      : ratio >= 7.5
        ? 7.5
        : ratio >= 3.5
          ? 5
          : ratio >= 2.5
            ? 2.5
            : ratio >= 1.5
              ? 2
              : 1) * power
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const length = Math.round((end - start) / step) + 1
  return Array.from({ length }, (_, index) => Number((start + step * index).toPrecision(12)))
}

const MAX_HIT_TARGETS = 240

type HitGroup = Readonly<{ from: number; to: number; index: number }>

const hitGroups = (count: number, most = MAX_HIT_TARGETS): ReadonlyArray<HitGroup> => {
  const stride = Math.max(1, Math.ceil(count / most))
  const groups: Array<HitGroup> = []
  for (let from = 0; from < count; from += stride) {
    const to = Math.min(count - 1, from + stride - 1)
    groups.push({ from, to, index: from + Math.floor((to - from) / 2) })
  }
  return groups
}

const formatPathNumber = (value: number): string => String(Math.round(value * 1000) / 1000)

type LinearPoint = Readonly<{ x: number; y: number; base: number; value: number | undefined }>

const linearLinePath = (points: ReadonlyArray<LinearPoint>): string | null => {
  let path = ''
  let started = false
  let runLength = 0
  for (const point of points) {
    if (point.value === undefined) {
      if (runLength === 1) path += 'Z'
      started = false
      runLength = 0
      continue
    }
    path += `${started ? 'L' : 'M'}${formatPathNumber(point.x)},${formatPathNumber(point.y)}`
    started = true
    runLength += 1
  }
  if (runLength === 1) path += 'Z'
  return path === '' ? null : path
}

const linearAreaPath = (points: ReadonlyArray<LinearPoint>): string | null => {
  const runs: Array<Array<LinearPoint>> = []
  let run: Array<LinearPoint> = []
  for (const point of points) {
    if (point.value === undefined) {
      if (run.length > 0) runs.push(run)
      run = []
      continue
    }
    run.push(point)
  }
  if (run.length > 0) runs.push(run)
  const parts: Array<string> = []
  for (const kept of runs) {
    const first = kept[0]
    const last = kept[kept.length - 1]
    if (first === undefined || last === undefined) continue
    parts.push(`M${formatPathNumber(first.x)},${formatPathNumber(first.y)}`)
    for (const point of kept.slice(1))
      parts.push(`L${formatPathNumber(point.x)},${formatPathNumber(point.y)}`)
    parts.push(`L${formatPathNumber(last.x)},${formatPathNumber(last.base)}`)
    for (const point of kept.slice(0, -1).reverse())
      parts.push(`L${formatPathNumber(point.x)},${formatPathNumber(point.base)}`)
    parts.push('Z')
  }
  return parts.length === 0 ? null : parts.join('')
}

type AxisProps = Readonly<{
  dataKey?: DataKey
  width?: number
  orientation?: 'left' | 'right'
  type?: 'category' | 'number'
  domain?: readonly [DomainEnd, DomainEnd]
  hide?: boolean
  mirror?: boolean
  tick?:
    | boolean
    | ((
        props: Readonly<{
          x: number
          y: number
          value: ChartValue
          index: number
          band: number
        }>,
      ) => Content)
  tickCount?: number
  ticks?: ReadonlyArray<number>
  interval?: number
  height?: number
  padding?: Readonly<{ left?: number; right?: number; top?: number; bottom?: number }>
  stroke?: string
  unit?: string
  tickFormatter?: (value: string | number) => string
}>

type SeriesProps = Readonly<{
  dataKey: DataKey
  name?: string
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  fill?: string
  fillOpacity?: number
  type?: 'linear'
  dot?: boolean
  activeDot?: Readonly<{ r?: number; fill?: string; stroke?: string }>
  hide?: boolean
}>

type CartesianGridProps = Readonly<{
  horizontal?: boolean
  vertical?: boolean
  stroke?: string
  strokeDasharray?: string
}>

type ReferenceLineProps = Readonly<{
  x?: string | number
  y?: number
  stroke?: string
  strokeWidth?: number
  strokeOpacity?: number
  strokeDasharray?: string
  label?:
    | string
    | Readonly<{
        value: string
        fill?: string
        position?: string
        angle?: number
        dx?: number
        dy?: number
      }>
}>

type ChartChild =
  | Readonly<{ kind: 'line'; props: SeriesProps }>
  | Readonly<{ kind: 'area'; props: SeriesProps }>
  | Readonly<{ kind: 'xAxis'; props: AxisProps }>
  | Readonly<{ kind: 'yAxis'; props: AxisProps }>
  | Readonly<{ kind: 'grid'; props: CartesianGridProps }>
  | Readonly<{ kind: 'tooltip'; props: Readonly<{ content?: 'none' }> }>
  | Readonly<{ kind: 'referenceLine'; props: ReferenceLineProps }>

const Line = (props: SeriesProps): ChartChild => ({ kind: 'line', props })
const Area = (props: SeriesProps): ChartChild => ({ kind: 'area', props })
const XAxis = (props: AxisProps = {}): ChartChild => ({ kind: 'xAxis', props })
const YAxis = (props: AxisProps = {}): ChartChild => ({ kind: 'yAxis', props })
const CartesianGrid = (props: CartesianGridProps = {}): ChartChild => ({ kind: 'grid', props })
const Tooltip = (props: Readonly<{ content?: 'none' }> = {}): ChartChild => ({
  kind: 'tooltip',
  props,
})
const ReferenceLine = (props: ReferenceLineProps): ChartChild => ({
  kind: 'referenceLine',
  props,
})

type ComposedChartProps = Readonly<{
  data: ReadonlyArray<Datum>
  children: ReadonlyArray<ChartChild>
  defs?: ReadonlyArray<Content>
  width?: number
  height?: number
  responsive?: boolean
  margin?: Margin
  className?: string
  title?: string
  accessibilityLayer?: boolean
  activeIndex?: number | null
  onActiveIndexChange?: (index: number | null) => Message
}>

type Series = Extract<ChartChild, { kind: 'line' | 'area' }>

const composedChart = (props: ComposedChartProps, h: H<Message>): Content => {
  const data = props.data
  const width = props.width ?? 700
  const height = props.height ?? 433
  const xAxis = props.children.find(
    (child): child is Extract<ChartChild, { kind: 'xAxis' }> => child.kind === 'xAxis',
  )
  const yAxes = props.children.filter(
    (child): child is Extract<ChartChild, { kind: 'yAxis' }> => child.kind === 'yAxis',
  )
  const leftAxis = yAxes.find((axis) => axis.props.orientation !== 'right')
  const rightAxis = yAxes.find((axis) => axis.props.orientation === 'right')
  const yAxis = leftAxis ?? rightAxis
  const grid = props.children.find(
    (child): child is Extract<ChartChild, { kind: 'grid' }> => child.kind === 'grid',
  )
  const series = props.children.filter(
    (child): child is Series =>
      (child.kind === 'line' || child.kind === 'area') && child.props.hide !== true,
  )
  const axisWidth = (axis: typeof leftAxis): number => {
    if (axis === undefined || axis.props.hide || axis.props.mirror) return 0
    return axis.props.width ?? 47
  }
  const margin = {
    top: props.margin?.top ?? 5,
    right:
      (props.margin?.right ?? (xAxis === undefined && yAxis === undefined ? 5 : 20)) +
      (rightAxis === undefined || rightAxis.props.hide || rightAxis.props.mirror
        ? 0
        : (rightAxis.props.width ?? 47)),
    bottom:
      (props.margin?.bottom ?? 5) +
      (xAxis === undefined || xAxis.props.hide ? 0 : (xAxis.props.height ?? 30)),
    left: (props.margin?.left ?? 5) + axisWidth(leftAxis),
  }
  const left = margin.left
  const right = width - margin.right
  const top = margin.top
  const bottom = height - margin.bottom
  const catAxis = xAxis
  const numAxis = yAxis
  const categories = data.map((row, i) =>
    catAxis?.props.dataKey === undefined ? i : (at(row, catAxis.props.dataKey) ?? i),
  )
  const seriesValues = (items: ReadonlyArray<Series>): number[] =>
    items.flatMap((item) =>
      data.flatMap((row) => {
        const value = numeric(at(row, item.props.dataKey))
        return value === undefined ? [] : [value, 0, value]
      }),
    )
  const values = seriesValues(series)
  const minValue = Math.min(0, ...values)
  const maxValue = Math.max(0, ...values)
  const domain = numAxis?.props.domain
  const resolve = (value: DomainEnd | undefined, fallback: number): number =>
    value === 'dataMin'
      ? domainMin(values)
      : value === 'dataMax'
        ? domainMax(values)
        : value === undefined || value === 'auto'
          ? fallback
          : value
  const rawMin = resolve(domain?.[0], minValue)
  const rawMax = resolve(domain?.[1], maxValue || 1)
  const nice = numAxis?.props.ticks ?? niceTickValues(rawMin, rawMax, numAxis?.props.tickCount ?? 5)
  const min = domain?.[0] === undefined || domain[0] === 'auto' ? (nice[0] ?? rawMin) : rawMin
  const max =
    domain?.[1] === undefined || domain[1] === 'auto' ? (nice[nice.length - 1] ?? rawMax) : rawMax
  const count = Math.max(1, data.length)
  const band = (right - left) / count
  const numericCategory = catAxis?.props.type === 'number'
  const categoryValues = categories.flatMap((value) => {
    const result = numeric(value)
    return result === undefined ? [] : [result]
  })
  const categoryDomain = catAxis?.props.domain
  const categoryRawMin =
    typeof categoryDomain?.[0] === 'number'
      ? categoryDomain[0]
      : categoryDomain?.[0] === 'dataMin'
        ? domainMin(categoryValues)
        : Math.min(0, ...categoryValues)
  const categoryRawMax =
    typeof categoryDomain?.[1] === 'number'
      ? categoryDomain[1]
      : categoryDomain?.[1] === 'dataMax'
        ? domainMax(categoryValues)
        : Math.max(1, ...categoryValues)
  const categoryNice = niceTickValues(categoryRawMin, categoryRawMax, catAxis?.props.tickCount ?? 5)
  const categoryMin =
    categoryDomain?.[0] === undefined || categoryDomain[0] === 'auto'
      ? (categoryNice[0] ?? categoryRawMin)
      : categoryRawMin
  const categoryMax =
    categoryDomain?.[1] === undefined || categoryDomain[1] === 'auto'
      ? (categoryNice[categoryNice.length - 1] ?? categoryRawMax)
      : categoryRawMax
  const category = (i: number): number => {
    if (numericCategory)
      return scale(numeric(categories[i]) ?? 0, categoryMin, categoryMax, left, right)
    const start = left + (catAxis?.props.padding?.left ?? 0)
    const end = right - (catAxis?.props.padding?.right ?? 0)
    return count > 1 ? start + ((end - start) * i) / (count - 1) : start + (end - start) * 0.5
  }
  const categoryTicks = numericCategory
    ? categoryNice.map((value) => ({
        value,
        position: scale(value, categoryMin, categoryMax, left, right),
        index: -1,
      }))
    : categories.map((value, index) => ({ value, position: category(index), index }))
  const longestCategoryLabel = categories
    .map((value) => String(value).length)
    .reduce((longest, length) => Math.max(longest, length), 0)
  const categoryTickCapacity = Math.max(
    2,
    Math.floor((right - left) / Math.max(37, longestCategoryLabel * 7)),
  )
  const categoryStride =
    typeof catAxis?.props.interval === 'number'
      ? Math.max(1, catAxis.props.interval + 1)
      : Math.max(1, Math.ceil(categories.length / categoryTickCapacity))
  const visibleCategoryTicks = categoryTicks.filter(
    (tick) => tick.index < 0 || (categories.length - 1 - tick.index) % categoryStride === 0,
  )
  const position = (value: number): number => scale(value, min, max, bottom, top)
  const elements: Array<Content> = [...(props.defs ?? [])]
  const tickCount = Math.max(2, numAxis?.props.tickCount ?? 5)
  const ticks =
    numAxis?.props.ticks ??
    (domain === undefined
      ? nice
      : Array.from({ length: tickCount }, (_, i) => min + ((max - min) * i) / (tickCount - 1)))
  if (grid?.kind === 'grid') {
    const stroke = grid.props.stroke ?? '#d6d3d1'
    const dash = grid.props.strokeDasharray ?? '3 3'
    if (grid.props.horizontal !== false)
      elements.push(
        ...ticks.map((value) =>
          h.line
            .attr('x1', String(left))
            .attr('x2', String(right))
            .attr('y1', String(position(value)))
            .attr('y2', String(position(value)))
            .attr('stroke', stroke)
            .attr('stroke-dasharray', dash)
            .children(),
        ),
      )
    if (grid.props.vertical !== false)
      elements.push(
        ...visibleCategoryTicks.map((tick) =>
          h.line
            .attr('x1', String(tick.position))
            .attr('x2', String(tick.position))
            .attr('y1', String(top))
            .attr('y2', String(bottom))
            .attr('stroke', stroke)
            .attr('stroke-dasharray', dash)
            .children(),
        ),
      )
  }
  if (catAxis !== undefined && !catAxis.props.hide && !catAxis.props.mirror)
    elements.push(
      h.line
        .attr('x1', String(left))
        .attr('x2', String(right))
        .attr('y1', String(bottom))
        .attr('y2', String(bottom))
        .attr('stroke', catAxis.props.stroke ?? '#666')
        .children(),
    )
  if (numAxis !== undefined && !numAxis.props.hide && !numAxis.props.mirror)
    elements.push(
      h.line
        .attr('x1', String(left))
        .attr('x2', String(left))
        .attr('y1', String(top))
        .attr('y2', String(bottom))
        .attr('stroke', numAxis.props.stroke ?? '#666')
        .children(),
    )
  if (catAxis !== undefined && !catAxis.props.hide && catAxis.props.tick !== false)
    elements.push(
      ...visibleCategoryTicks.map(({ value, position: tickPosition, index }) =>
        typeof catAxis.props.tick === 'function'
          ? catAxis.props.tick({ x: tickPosition, y: bottom + 22, value, index, band })
          : h.svgText
              .attr('x', String(tickPosition))
              .attr('y', String(bottom + 8))
              .attr('text-anchor', 'middle')
              .attr('fill', catAxis.props.stroke ?? '#666')
              .attr('font-size', '14')
              .children(
                catAxis.props.tickFormatter?.(isNumberRange(value) ? value.join(',') : value) ??
                  String(value),
              ),
      ),
    )
  if (numAxis !== undefined && !numAxis.props.hide && numAxis.props.tick !== false)
    elements.push(
      ...ticks.map((value, index) =>
        typeof numAxis.props.tick === 'function'
          ? numAxis.props.tick({
              x: numAxis.props.orientation === 'right' ? right + 10 : left - 10,
              y: position(value) + 4,
              value,
              index,
              band,
            })
          : h.svgText
              .attr('x', String(numAxis.props.orientation === 'right' ? right + 10 : left - 10))
              .attr('y', String(position(value) + 4))
              .attr('text-anchor', numAxis.props.orientation === 'right' ? 'start' : 'end')
              .attr('fill', numAxis.props.stroke ?? '#666')
              .attr('font-size', '14')
              .children(
                numAxis.props.tickFormatter?.(value) ??
                  `${Number(value.toFixed(1))}${numAxis.props.unit ?? ''}`,
              ),
      ),
    )
  for (const reference of props.children) {
    if (reference.kind !== 'referenceLine') continue
    const categoryIndex = categories.findIndex((value) => value === reference.props.x)
    const where =
      reference.props.y === undefined
        ? categoryIndex < 0
          ? undefined
          : category(categoryIndex)
        : position(reference.props.y)
    if (where === undefined) continue
    const horizontal = reference.props.y !== undefined
    elements.push(
      h.line
        .attr('x1', horizontal ? String(left) : String(where))
        .attr('x2', horizontal ? String(right) : String(where))
        .attr('y1', horizontal ? String(where) : String(top))
        .attr('y2', horizontal ? String(where) : String(bottom))
        .attr('stroke', reference.props.stroke ?? '#64748b')
        .attr('stroke-width', String(reference.props.strokeWidth ?? 1))
        .attr('stroke-opacity', String(reference.props.strokeOpacity ?? 1))
        .attr('stroke-dasharray', reference.props.strokeDasharray)
        .children(),
    )
    if (reference.props.label !== undefined) {
      const label =
        typeof reference.props.label === 'string'
          ? { value: reference.props.label }
          : reference.props.label
      const x = horizontal ? left + (label.dx ?? 0) + 5 : where + (label.dx ?? 0)
      const y = horizontal ? where + (label.dy ?? 0) + 4 : bottom - 7 + (label.dy ?? 0)
      elements.push(
        h.svgText
          .attr('x', String(x))
          .attr('y', String(y))
          .attr('fill', label.fill ?? reference.props.stroke ?? '#64748b')
          .attr('font-size', '12')
          .children(label.value),
      )
    }
  }
  for (const [seriesIndex, item] of series.entries()) {
    const color =
      (item.kind === 'line' ? item.props.stroke : (item.props.stroke ?? item.props.fill)) ??
      paletteAt(seriesIndex)
    const points: ReadonlyArray<LinearPoint> = data.map((row, i) => {
      const value = numeric(at(row, item.props.dataKey))
      return {
        x: category(i),
        y: position(value ?? 0),
        base: position(0),
        value,
      }
    })
    const path = linearLinePath(points)
    if (item.kind === 'area') {
      const shape = linearAreaPath(points)
      if (shape !== null)
        elements.push(
          h.path
            .attr('d', shape)
            .attr('fill', item.props.fill ?? color)
            .attr('fill-opacity', String(item.props.fillOpacity ?? 0.8))
            .attr('stroke', 'none')
            .children(),
        )
    }
    if (path !== null)
      elements.push(
        h.path
          .attr('d', path)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', String(item.props.strokeWidth ?? 2))
          .attr('stroke-dasharray', item.props.strokeDasharray)
          .children(),
      )
    if (item.kind === 'line' && item.props.dot !== false)
      elements.push(
        ...points.flatMap((point) =>
          point.value === undefined
            ? []
            : [
                h.circle
                  .attr('cx', String(point.x))
                  .attr('cy', String(point.y))
                  .attr('r', '3')
                  .attr('fill', color)
                  .children(),
              ],
        ),
      )
  }
  const activeIndex = props.activeIndex
  const onActiveIndexChange = props.onActiveIndexChange
  if (onActiveIndexChange !== undefined)
    elements.push(
      ...hitGroups(categories.length).map((group) => {
        const first = category(group.from)
        const last = category(group.to)
        const start = Math.min(first, last) - band / 2
        const size = Math.abs(last - first) + band
        return h.rect
          .attr('x', String(start))
          .attr('y', String(top))
          .attr('width', String(size))
          .attr('height', String(bottom - top))
          .attr('fill', 'transparent')
          .on('mouseenter', () => onActiveIndexChange(group.index))
          .children()
      }),
    )
  const frame = h.div
    .class(cx(css({ position: 'relative' }), props.className))
    .attr('data-slot', 'composed-chart')
  const base = h.svg
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', props.responsive ? '100%' : String(width))
    .attr('height', String(height))
    .attr('font-family', 'Arial, sans-serif')
  const sized = props.responsive ? base.style({ height: 'auto', maxWidth: `${width}px` }) : base
  const labeled = sized.attr('role', 'img').attr('aria-label', props.title ?? 'composed-chart')
  const interactive =
    props.accessibilityLayer !== false && onActiveIndexChange !== undefined
      ? labeled.attr('tabindex', '0').on(
          'keydown',
          ({ key }) => {
            if (onActiveIndexChange === undefined) return undefined
            if (key === 'Escape') return onActiveIndexChange(null)
            if (data.length === 0) return undefined
            if (key === 'Home') return onActiveIndexChange(0)
            if (key === 'End') return onActiveIndexChange(data.length - 1)
            const forward = key === 'ArrowRight'
            const backward = key === 'ArrowLeft'
            if (!forward && !backward) return undefined
            const next =
              activeIndex === null || activeIndex === undefined
                ? forward
                  ? 0
                  : data.length - 1
                : Math.min(data.length - 1, Math.max(0, activeIndex + (forward ? 1 : -1)))
            return onActiveIndexChange(next)
          },
          { preventDefault: true },
        )
      : labeled
  const svg =
    onActiveIndexChange === undefined
      ? interactive
      : interactive.on('mouseleave', () => onActiveIndexChange(null))
  return frame.children(svg.children(...elements))
}

const paletteAt = (index: number): string => {
  const palette = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c', '#8dd1e1', '#d0ed57']
  return palette[index % palette.length] ?? '#8884d8'
}

type PieProps = Readonly<{
  data: ReadonlyArray<Datum>
  width?: number
  height?: number
  responsive?: boolean
  title?: string
  dataKey: string
  nameKey?: string
  innerRadius?: number | `${number}%`
  outerRadius?: number | `${number}%`
  paddingAngle?: number
  stroke?: string
  colors?: ReadonlyArray<string>
  fillOpacity?: number
}>

const polarMeasure = (
  value: number | `${number}%` | undefined,
  total: number,
  fallback: number,
): number =>
  value === undefined
    ? fallback
    : typeof value === 'number'
      ? value
      : (Number(value.slice(0, -1)) / 100) * total

type Slice = Readonly<{ startAngle: number; endAngle: number; padAngle: number; value: number }>

const pieSlices = (values: ReadonlyArray<number>, padAngle: number): ReadonlyArray<Slice> => {
  const start = Math.PI / 2
  const da = Math.min(2 * Math.PI, Math.max(-2 * Math.PI, Math.PI / 2 - 2 * Math.PI - start))
  const p = Math.min(Math.abs(da) / Math.max(1, values.length), padAngle)
  const pa = p * (da < 0 ? -1 : 1)
  const sum = values.reduce((total, value) => total + (value > 0 ? value : 0), 0)
  const k = sum ? (da - values.length * pa) / sum : 0
  const slices: Array<Slice> = []
  let a0 = start
  for (const value of values) {
    const a1 = a0 + (value > 0 ? value * k : 0) + pa
    slices.push({ startAngle: a0, endAngle: a1, padAngle: p, value })
    a0 = a1
  }
  return slices
}

const svgArc = (
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  sweep: 0 | 1,
): string => {
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  let da = sweep === 1 ? a1 - a0 : a0 - a1
  if (da < 0) da = (da % (2 * Math.PI)) + 2 * Math.PI
  return `A${formatPathNumber(r)},${formatPathNumber(r)},0,${da >= Math.PI ? 1 : 0},${sweep},${formatPathNumber(x1)},${formatPathNumber(y1)}`
}

const slicePath = (inner: number, outer: number, slice: Slice): string | null => {
  const a0 = slice.startAngle - Math.PI / 2
  const a1 = slice.endAngle - Math.PI / 2
  const da = Math.abs(a1 - a0)
  const cw = a1 > a0
  if (da < 1e-6) return null
  const ap = slice.padAngle / 2
  const rp = Math.sqrt(inner * inner + outer * outer)
  const p0 = Math.asin((rp / Math.max(inner, 1e-9)) * Math.sin(ap))
  const p1 = Math.asin((rp / Math.max(outer, 1e-9)) * Math.sin(ap))
  let da0 = da - p0 * 2
  let da1 = da - p1 * 2
  let a00 = a0
  let a10 = a1
  let a01 = a0
  let a11 = a1
  if (p0 * 2 > 1e-6) {
    if (da0 > 1e-6) {
      const pad = cw ? p0 : -p0
      a00 += pad
      a10 -= pad
    } else {
      da0 = 0
      a00 = (a0 + a1) / 2
      a10 = a00
    }
  }
  if (p1 * 2 > 1e-6) {
    if (da1 > 1e-6) {
      const pad = cw ? p1 : -p1
      a01 += pad
      a11 -= pad
    } else {
      da1 = 0
      a01 = (a0 + a1) / 2
      a11 = a01
    }
  }
  const x01 = outer * Math.cos(a01)
  const y01 = outer * Math.sin(a01)
  const x10 = inner * Math.cos(a10)
  const y10 = inner * Math.sin(a10)
  const parts: Array<string> = [`M${formatPathNumber(x01)},${formatPathNumber(y01)}`]
  parts.push(svgArc(0, 0, outer, a01, a11, cw ? 1 : 0))
  if (!(inner > 1e-6) || !(da0 > 1e-6)) {
    parts.push(`L${formatPathNumber(x10)},${formatPathNumber(y10)}`)
  } else {
    parts.push(`L${formatPathNumber(x10)},${formatPathNumber(y10)}`)
    parts.push(svgArc(0, 0, inner, a10, a00, cw ? 0 : 1))
  }
  parts.push('Z')
  return parts.join('')
}

const pieChart = (props: PieProps, h: H<Message>): Content => {
  const width = props.width ?? 500
  const height = props.height ?? 500
  const plotLeft = 5
  const plotRight = 5
  const plotTop = 5
  const plotBottom = 5
  const plotWidth = width - plotLeft - plotRight
  const plotHeight = height - plotTop - plotBottom
  const cx = plotLeft + plotWidth / 2
  const cy = plotTop + plotHeight / 2
  const maxRadius = Math.min(plotWidth, plotHeight) / 2
  const radius = polarMeasure(props.outerRadius, maxRadius, maxRadius * 0.8)
  const inner = polarMeasure(props.innerRadius, maxRadius, 0)
  const rows = props.data
  const values = rows.map((row) => Math.max(0, numeric(at(row, props.dataKey)) ?? 0))
  const slices = pieSlices(values, ((props.paddingAngle ?? 0) * Math.PI) / 180)
  const base = h.svg
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', props.responsive ? '100%' : String(width))
    .attr('height', String(height))
    .attr('font-family', 'Arial, sans-serif')
  const sized = props.responsive ? base.style({ height: 'auto', maxWidth: `${width}px` }) : base
  return h.div
    .class(css({ position: 'relative' }))
    .attr('data-slot', 'pie-chart')
    .children(
      sized
        .attr('role', 'img')
        .attr('aria-label', props.title ?? 'pie-chart')
        .children(
          ...slices.flatMap((slice, index) => {
            const path = slicePath(inner, radius, slice)
            if (path === null) return []
            return [
              h.path
                .attr('d', path)
                .attr('transform', `translate(${cx},${cy})`)
                .attr('fill', props.colors?.[index % (props.colors.length || 1)] ?? '#8884d8')
                .attr('stroke', props.stroke ?? '#fff')
                .attr('stroke-width', '2')
                .attr('fill-opacity', String(props.fillOpacity ?? 0.8))
                .children(),
            ]
          }),
        ),
    )
}

/* ---------------------------------------------------------------------------
   The Dashboard itself, from `components/lab/dashboard.ts`.
   --------------------------------------------------------------------------- */

const DASHBOARD_RANGE_MINUTES = [60, 360, 1440, 10_080, 43_200] as const

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
  source: Model['board']['game']['history'] | History[Tier]
  second: number
  range: number
  locale: Model['prefs']['locale']
  slo: number
  rows: ReadonlyArray<Row>
}> | null = null

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

const mttdOf = (incident: Incident): number | null =>
  signalAtOf(incident.phase) === null
    ? null
    : Math.max(0, (signalAtOf(incident.phase) ?? 0) - incident.startedAt)

const mttaOf = (incident: Incident): number | null =>
  ackAtOf(incident.phase) === null || signalAtOf(incident.phase) === null
    ? null
    : Math.max(0, (ackAtOf(incident.phase) ?? 0) - (signalAtOf(incident.phase) ?? 0))

const incidentTarget = (t: Messages, game: Game, incident: Incident): string => {
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

const led = (color: string, h: H<Message>): Content =>
  h.span
    .class(
      css({
        width: '7px',
        height: '7px',
        flexShrink: '0',
        borderRadius: 'full',
      }),
    )
    .style({
      background: color,
      boxShadow: `0 0 0 2px color-mix(in oklab, ${color} 22%, transparent), 0 0 6px color-mix(in oklab, ${color} 55%, transparent)`,
    })
    .children()

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
  body: ReadonlyArray<Child>,
  h: H<Message>,
  tint: Level | null = null,
  accent: string = MUTED,
): Content => {
  const base = h.div
    .key(key)
    .attr('data-panel', key)
    .class(
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
    )
  const box =
    tint === null
      ? base
      : base.style({
          background: `linear-gradient(to bottom, color-mix(in oklab, ${LEVEL_COLOR[tint]} 16%, var(--card)), var(--card) 64px)`,
        })
  return box.children(
    h.div
      .class(
        css({
          display: 'flex',
          height: '5',
          flexShrink: '0',
          alignItems: 'center',
          gap: '2',
          paddingInline: '1.5',
        }),
      )
      .children(
        led(tint ? LEVEL_COLOR[tint] : accent, h),
        h.span
          .class(
            css({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'type.12-5',
              fontWeight: 'semibold',
              letterSpacing: 'subtle',
            }),
          )
          .children(title),
        unit === ''
          ? undefined
          : h.span
              .class(
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
              )
              .children(unit),
      ),
    ...body,
  )
}

const locked = (
  key: string,
  span: string,
  title: string,
  research: ResearchId,
  h: H<Message>,
): Content => {
  const t = copy(h)
  return panel(
    key,
    span,
    title,
    '',
    [
      h.div
        .class(
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
        )
        .children(
          h.span
            .class(
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
            )
            .children(t.dashboard.noDataResearch(research)),
        ),
    ],
    h,
  )
}

const rowHeader = (label: string, count: number, h: H<Message>): Content =>
  h.div
    .key(`row-${label}`)
    .attr('data-row', label)
    .class(
      css({
        gridColumn: 'span 24 / span 24',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5',
        paddingTop: '2',
        paddingBottom: '0',
      }),
    )
    .children(
      icon(
        h,
        ChevronDown,
        css({
          width: '3.5',
          height: '3.5',
          color: 'mutedForeground',
        }),
      ),
      h.span
        .class(
          css({
            fontSize: 'type.13',
            fontWeight: 'semibold',
          }),
        )
        .children(label),
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
        .children(copy(h).dashboard.panelCount(count)),
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
  const incident = activeIncident(model.board.game)
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

type AnnotationSourceValue =
  | string
  | number
  | null
  | ReadonlyArray<AnnotationGroup>
  | Model['board']['undo']
  | Model['board']['inbox']['mail']

const annotationsOf = (model: Model): ReadonlyArray<Annotation> => {
  const { game, undo, inbox, dashboard } = model.board
  const incident = activeIncident(game)
  const from: ReadonlyArray<AnnotationSourceValue> = [
    model.prefs.locale,
    dashboard.groups,
    undo,
    inbox.mail,
    game.stage,
    game.stageAt,
    incident?.startedAt ?? null,
    incident?.severity ?? null,
    incident?.kind ?? null,
  ]
  const last = lastAnnotations
  if (last !== null && last.from.every((value, index) => value === from[index])) return last.marks
  const marks = buildAnnotations(model)
  lastAnnotations = { from, marks }
  return marks
}

let lastAnnotations: Readonly<{
  from: ReadonlyArray<AnnotationSourceValue>
  marks: ReadonlyArray<Annotation>
}> | null = null

type LazyView = Readonly<{ args: ReadonlyArray<unknown>; view: Content }>

const lazy = (): (<A extends ReadonlyArray<unknown>>(
  view: (...args: A) => Content,
  args: A,
) => Content) => {
  let kept: LazyView | null = null
  return (view, args) => {
    if (
      kept !== null &&
      kept.args.length === args.length &&
      kept.args.every((value, index) => value === args[index])
    )
      return kept.view
    const built = view(...args)
    kept = { args, view: built }
    return built
  }
}

const keyedLazy = (): (<A extends ReadonlyArray<unknown>>(
  key: string,
  view: (...args: A) => Content,
  args: A,
) => Content) => {
  const kept = new Map<string, LazyView>()
  return (key, view, args) => {
    const last = kept.get(key)
    if (
      last !== undefined &&
      last.args.length === args.length &&
      last.args.every((value, index) => value === args[index])
    )
      return last.view
    const built = view(...args)
    kept.set(key, { args, view: built })
    return built
  }
}

type Exemplar = Readonly<{ t: string; p99: number; kind: RequestKind }>

const NO_EXEMPLARS: ReadonlyArray<Exemplar> = []
const exemplarsFor = new WeakMap<ReadonlyArray<Row>, ReadonlyArray<Exemplar>>()

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

const exemplarMarks = (
  exemplars: ReadonlyArray<Exemplar>,
  scale: number,
): ReadonlyArray<ChartChild> =>
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

const exemplarStrip = (exemplars: ReadonlyArray<Exemplar>, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .key('exemplars')
    .class(
      css({
        gridColumn: 'span 24 / span 24',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '2',
      }),
    )
    .children(
      h.span
        .class(
          css({
            fontSize: 'type.12',
            color: 'mutedForeground',
          }),
        )
        .children(
          exemplars.length === 0 ? t.dashboard.noExemplarInThisRange : t.dashboard.exemplars,
        ),
      ...exemplars.map((exemplar) =>
        button(
          h,
          {
            size: 'sm',
            variant: 'outline',
            onClick: Message.DashboardChanged({
              message: DashboardMessage.KindChosen({ kind: exemplar.kind }),
            }),
            attributes: {
              title: t.dashboard.openWaterfall(t.catalog.kinds[exemplar.kind].label),
            },
          },
          `● ${exemplar.t} · ${formats(t).ms(exemplar.p99)} · ${t.catalog.kinds[exemplar.kind].label}`,
        ),
      ),
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
): ReadonlyArray<ChartChild> => {
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

type SeriesSpec = Readonly<{
  key: string
  span: string
  title: string
  unit: string
  series: ReadonlyArray<
    Readonly<{
      key: string
      name: string
      color: string
      fill?: boolean
      dashed?: boolean
      faint?: boolean
    }>
  >
  format: (value: number) => string
  compare?: Field
  rules?: ReadonlyArray<Readonly<{ y: number; label: string; color: string }>>
  domain?: readonly [number, number]
  columns: number
}>

const gradient = (id: string, color: string, h: H<Message>): Content =>
  h.linearGradient
    .attr('id', id)
    .attr('x1', '0')
    .attr('y1', '0')
    .attr('x2', '0')
    .attr('y2', '1')
    .children(
      h.stop.attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', '0.45').children(),
      h.stop.attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', '0').children(),
    )

const figuresOf = (rows: ReadonlyArray<Row>, key: string): ReadonlyArray<number> =>
  rows.flatMap((row) => (typeof row[key] === 'number' ? [row[key]] : []))

const seriesLegend = (
  rows: ReadonlyArray<Row>,
  series: SeriesSpec['series'],
  spec: SeriesSpec,
  hovered: Row | undefined,
  h: H<Message>,
): Content => {
  const t = copy(h)
  return h.div
    .class(
      css({
        display: 'flex',
        flexWrap: 'wrap',
        columnGap: '4',
        rowGap: '0.5',
        paddingInline: '1.5',
        paddingBottom: '0.5',
        fontSize: 'type.11',
      }),
    )
    .children(
      ...(hovered
        ? [
            h.span
              .key('at')
              .class(
                cx(
                  FIGURE,
                  css({
                    color: 'mutedForeground',
                  }),
                ),
              )
              .children(String(hovered.t)),
          ]
        : []),
      ...series.map((entry) => {
        const values = figuresOf(rows, entry.key)
        const last = values[values.length - 1] ?? 0
        const max = Math.max(...values)
        const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
        return h.span
          .key(entry.key)
          .class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '1.5',
              whiteSpace: 'nowrap',
            }),
          )
          .children(
            h.span
              .class(
                css({
                  height: '3px',
                  width: '3.5',
                  borderRadius: 'full',
                }),
              )
              .style({ background: entry.color })
              .children(),
            h.span
              .class(
                css({
                  color: 'foreground',
                }),
              )
              .children(entry.name),
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    color: 'mutedForeground',
                  }),
                ),
              )
              .children(
                hovered
                  ? spec.format(Number(hovered[entry.key]))
                  : t.dashboard.meanMaxLast(spec.format(mean), spec.format(max), spec.format(last)),
              ),
          )
      }),
    )
}

const seriesTable = (
  data: ReadonlyArray<Row>,
  series: SeriesSpec['series'],
  spec: SeriesSpec,
  h: H<Message>,
): Content => {
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
  return h.div
    .class(
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
    )
    .children(
      h.table
        .attr('data-table', spec.key)
        .class(
          css({
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'type.11-5',
          }),
        )
        .children(
          h.caption
            .class(
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
            )
            .children(`${spec.title} · ${spec.unit}`),
          h.thead.children(
            h.tr
              .class(
                css({
                  fontSize: 'type.11',
                  color: 'mutedForeground',
                }),
              )
              .children(
                h.th
                  .class(
                    cx(
                      border,
                      css({
                        textAlign: 'left',
                        fontWeight: 'medium',
                      }),
                    ),
                  )
                  .children(t.dashboard.time),
                ...series.map((entry) =>
                  h.th
                    .key(entry.key)
                    .class(
                      cx(
                        border,
                        css({
                          textAlign: 'right',
                          fontWeight: 'medium',
                        }),
                      ),
                    )
                    .children(entry.name),
                ),
              ),
          ),
          h.tbody.children(
            data.map((row, index) =>
              h.tr
                .key(`${String(row.t)}-${index}`)
                .class(
                  css({
                    _hover: {
                      backgroundColor: 'color-mix(in oklab, var(--foreground) 3%, transparent)',
                    },
                  }),
                )
                .children(
                  h.td.class(cx(border, FIGURE)).children(String(row.t)),
                  ...series.map((entry) =>
                    h.td
                      .key(entry.key)
                      .class(
                        cx(
                          border,
                          FIGURE,
                          css({
                            textAlign: 'right',
                          }),
                        ),
                      )
                      .children(figure(row, entry.key)),
                  ),
                ),
            ),
          ),
        ),
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
  h: H<Message>,
]

const timeSeries = (
  model: Model,
  rows: ReadonlyArray<Row>,
  marks: ReadonlyArray<Annotation>,
  exemplars: ReadonlyArray<Exemplar>,
  spec: SeriesSpec,
  h: H<Message>,
): Content => {
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

const lazyChart = keyedLazy()

const keptSpec = (spec: SeriesSpec, h: H<Message>): SeriesSpec => {
  const said = JSON.stringify(spec)
  const last = specs.get(spec.key)
  if (last !== undefined && last.said === said && last.h === h) return last.spec
  specs.set(spec.key, { said, h, spec })
  return spec
}
const specs = new Map<string, Readonly<{ said: string; h: H<Message>; spec: SeriesSpec }>>()

const timeSeriesView = (...input: ChartInput): Content => {
  const [rows, marks, exemplars, spec, width, hover, compared, table, blocks, tier, scale, h] =
    input
  const t = copy(h)
  const markers: ReadonlyArray<ChartChild> = [
    ...markersOf(scale, hover, marks, rows, width),
    ...exemplarMarks(exemplars, scale),
  ]
  const hovered = hover !== null ? rows[hover] : undefined
  const id = (series: SeriesSpec['series'][number]) => `fill-${spec.key}-${series.key}`
  const yesterday =
    spec.compare === undefined || !compared
      ? null
      : comparedRows(blocks, tier, rows, spec.key, spec.compare)
  const compare = yesterday !== null && yesterday.any
  const series: SeriesSpec['series'] = compare
    ? [
        ...spec.series,
        { key: 'cmp', name: t.dashboard.yesterday, color: COMPARE_COLOR, faint: true },
      ]
    : spec.series
  const data: ReadonlyArray<Row> = compare && yesterday !== null ? yesterday.data : rows
  const line = (entry: SeriesSpec['series'][number]): ChartChild =>
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
            h.div
              .class(
                cx(
                  SCREEN,
                  css({
                    minHeight: '0',
                    flex: '1 1 0%',
                    paddingInline: '1',
                    paddingTop: '1',
                  }),
                ),
              )
              .children(
                composedChart(
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
                          h.svgText
                            .attr('x', String(x))
                            .attr('y', String(y - 14))
                            .attr('text-anchor', x + 30 > width ? 'end' : 'middle')
                            .children(String(value)),
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
  h: H<Message>,
  background = false,
  signed = false,
): Content =>
  lazyStat(key, statView, [key, title, value, level, rows, dataKey, color, h, background, signed])

const lazyStat = keyedLazy()

const statView = (
  key: string,
  title: string,
  value: string,
  level: Level | 'plain',
  rows: ReadonlyArray<Row>,
  dataKey: string,
  color: string,
  h: H<Message>,
  background: boolean,
  signed: boolean,
): Content => {
  const screen = h.div.class(
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
  )
  const tinted =
    background && level !== 'plain' && level !== 'ok'
      ? screen.style({
          background: `color-mix(in oklab, ${LEVEL_COLOR[level]} 18%, var(--well))`,
        })
      : screen
  return panel(
    key,
    SPAN.stat,
    title,
    '',
    [
      tinted.children(
        h.div
          .class(
            css({
              position: 'absolute',
              insetInline: '0',
              bottom: '0',
              height: '46px',
              opacity: 0.9,
            }),
          )
          .children(
            composedChart(
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
          ),
        h.span
          .class(
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
          )
          .style({ color: level === 'plain' ? 'var(--foreground)' : LEVEL_COLOR[level] })
          .children(value),
      ),
    ],
    h,
    null,
    level === 'plain' ? color : LEVEL_COLOR[level],
  )
}

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
  h: H<Message>,
): Content => {
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
      h.div
        .class(
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
        )
        .children(
          h.svg
            .attr('viewBox', '0 0 200 140')
            .class(
              css({
                height: '96px',
                width: '100%',
                maxWidth: '200px',
              }),
            )
            .children(
              ...bands.map(([from, to, band]) =>
                h.path
                  .key(band)
                  .attr('d', arc(100, 92, 84, at(from) + 0.6, at(to) - 0.6))
                  .attr('fill', 'none')
                  .attr('stroke', LEVEL_COLOR[band])
                  .attr('stroke-width', '3')
                  .children(),
              ),
              h.path
                .attr('d', arc(100, 92, 70, START, START + SWEEP))
                .attr('fill', 'none')
                .attr('stroke', 'var(--hairline)')
                .attr('stroke-width', '16')
                .children(),
              share > 0.002
                ? h.path
                    .attr('d', arc(100, 92, 70, START, at(share)))
                    .attr('fill', 'none')
                    .attr('stroke', LEVEL_COLOR[level])
                    .attr('stroke-width', '16')
                    .children()
                : undefined,
              h.svgText
                .attr('x', '100')
                .attr('y', '100')
                .attr('text-anchor', 'middle')
                .attr('fill', LEVEL_COLOR[level])
                .class(
                  css({
                    fontFamily: 'mono',
                    fontSize: 'type.30',
                    fontWeight: 'medium',
                    letterSpacing: 'title',
                  }),
                )
                .children(label),
            ),
        ),
    ],
    h,
    null,
    LEVEL_COLOR[level],
  )
}

const UTILIZATION: Thresholds = { warn: 0.7, danger: 0.9 }
const CELLS = 32

const lcd = (
  key: string,
  share: number,
  h: H<Message>,
  cells = CELLS,
  color: string | null = null,
): Content => {
  const level = Math.min(share, 1)
  let lit = 0
  while (lit < cells && (lit + 0.5) / cells <= level) lit += 1
  return lazyLcd(key, lcdView, [lit, cells, color, h])
}

const lazyLcd = keyedLazy()

const lazyPanel = keyedLazy()

const lazyNodeTable = keyedLazy()

const lcdView = (lit: number, cells: number, color: string | null, h: H<Message>): Content =>
  h.div
    .class(
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
    )
    .children(
      ...Array.from({ length: cells }, (_, index) => {
        const position = (index + 0.5) / cells
        const tint = color ?? LEVEL_COLOR[levelOf(position, UTILIZATION)]
        return h.span
          .key(String(index))
          .class(
            css({
              minWidth: '0',
              flex: '1 1 0%',
              borderRadius: '2xs',
            }),
          )
          .style({
            background: index < lit ? tint : `color-mix(in oklab, ${tint} 10%, transparent)`,
          })
          .children()
      }),
    )

const barGauge = (ledger: Ledger, tracks: ReadonlyArray<NodeTrack>, h: H<Message>): Content => {
  const t = copy(h)
  return panel(
    'bar-gauge',
    SPAN.third,
    t.dashboard.utilizationNow,
    t.dashboard.ofCapacity,
    [
      h.div
        .class(
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
        )
        .children(
          ...tracks.map((track) => {
            const share = ledger.nodes[track.id]?.utilization ?? 0
            return h.div
              .key(track.id)
              .class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1',
                }),
              )
              .children(
                h.div
                  .class(
                    css({
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      fontSize: 'type.11-5',
                    }),
                  )
                  .children(
                    h.span
                      .class(
                        css({
                          color: 'mutedForeground',
                        }),
                      )
                      .children(track.name),
                    h.span
                      .class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'type.13',
                          }),
                        ),
                      )
                      .style({ color: LEVEL_COLOR[levelOf(share, UTILIZATION)] })
                      .children(percent(Math.min(share, 9.99))),
                  ),
                h.div
                  .class(
                    css({
                      display: 'flex',
                      height: '5',
                    }),
                  )
                  .children(lcd(`now:${track.id}`, share, h)),
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

const swatch = (name: string, color: string, h: H<Message>): Content =>
  h.span
    .key(name)
    .class(
      css({
        display: 'flex',
        alignItems: 'center',
        gap: '1.5',
      }),
    )
    .children(
      h.span
        .class(
          css({
            height: '2',
            width: '2.5',
            borderRadius: '2xs',
          }),
        )
        .style({ background: color })
        .children(),
      name,
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
  h: H<Message>,
  legend: ReadonlyArray<Child> = [],
): Content =>
  panel(
    key,
    span,
    title,
    unit,
    [
      h.div
        .class(
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
        )
        .children(
          ...lanes.map((lane) =>
            h.div
              .key(lane.key)
              .class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                }),
              )
              .children(
                h.span
                  .class(
                    css({
                      width: '28',
                      flexShrink: '0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'type.11-5',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(lane.name),
                h.div
                  .class(
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
                  )
                  .children(
                    lane.runs.map((run, index) =>
                      h.div
                        .key(String(index))
                        .class(
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
                        )
                        .style({
                          left: `calc(${(run.from / length) * 100}% + 1px)`,
                          width: `calc(${((run.to - run.from) / length) * 100}% - 2px)`,
                          background: run.color,
                        })
                        .attr('title', `${lane.name}: ${run.label}`)
                        .children((run.to - run.from) / length > 0.08 ? run.label : ''),
                    ),
                  ),
              ),
          ),
          h.div
            .class(
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
            )
            .children(
              h.span.children(hhmm(first)),
              h.span.children(hhmm(first + (last - first) / 2)),
              h.span.children(hhmm(last)),
            ),
          ...(legend.length === 0
            ? []
            : [
                h.div
                  .class(
                    css({
                      display: 'flex',
                      flexWrap: 'wrap',
                      columnGap: '3',
                      rowGap: '1',
                      paddingLeft: '124px',
                      fontSize: 'type.10',
                    }),
                  )
                  .children(...legend),
              ]),
        ),
    ],
    h,
  )

const stateTimeline = (
  model: Model,
  tracks: ReadonlyArray<NodeTrack>,
  span: string,
  h: H<Message>,
): Content =>
  lazyStateTimeline(stateTimelineView, [
    tracks,
    Math.floor(model.board.game.time / NODE_HISTORY_EVERY_SIM_SECONDS) *
      NODE_HISTORY_EVERY_SIM_SECONDS,
    span,
    h,
  ])

const lazyStateTimeline = lazy()

const stateTimelineView = (
  tracks: ReadonlyArray<NodeTrack>,
  last: number,
  span: string,
  h: H<Message>,
): Content => {
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

const mix = (ledger: Ledger, shown: (kind: RequestKind) => boolean, h: H<Message>): Content => {
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
      h.div
        .class(
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
        )
        .children(
          h.div
            .class(
              css({
                width: '118px',
                flexShrink: '0',
              }),
            )
            .children(
              pieChart(
                {
                  title: t.dashboard.requestMix,
                  data: kinds.map(([kind, entry]) => ({ name: kind, value: entry.rate })),
                  width: 120,
                  height: 120,
                  responsive: true,
                  dataKey: 'value',
                  nameKey: 'name',
                  innerRadius: '58%',
                  outerRadius: '96%',
                  paddingAngle: 2,
                  stroke: 'var(--card)',
                  colors: kinds.map(([kind]) => kindColor(kind)),
                },
                h,
              ),
            ),
          h.table
            .class(
              css({
                width: '100%',
                fontSize: 'type.11-5',
              }),
            )
            .children(
              h.tbody.children(
                kinds.map(([kind, entry]) =>
                  h.tr.key(kind).children(
                    h.td
                      .class(
                        css({
                          paddingBlock: '0.5',
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
                            h.span
                              .class(
                                css({
                                  width: '2',
                                  height: '2',
                                  borderRadius: '2xs',
                                }),
                              )
                              .style({ background: kindColor(kind) })
                              .children(),
                            h.span
                              .class(
                                css({
                                  fontFamily: 'mono',
                                  fontSize: 'type.11',
                                }),
                              )
                              .children(kind),
                          ),
                      ),
                    h.td
                      .class(
                        cx(
                          FIGURE,
                          css({
                            paddingBlock: '0.5',
                            textAlign: 'right',
                          }),
                        ),
                      )
                      .children(t.dashboard.s(compact(entry.rate))),
                    h.td
                      .class(
                        cx(
                          FIGURE,
                          css({
                            width: '12',
                            paddingBlock: '0.5',
                            textAlign: 'right',
                            color: 'mutedForeground',
                          }),
                        ),
                      )
                      .children(percent(total > 0 ? entry.rate / total : 0)),
                  ),
                ),
              ),
            ),
        ),
    ],
    h,
  )
}

const causes = (ledger: Ledger, h: H<Message>): Content => {
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
      h.div
        .class(
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
        )
        .children(
          entries.length === 0
            ? [
                h.span
                  .key('none')
                  .class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.28',
                        color: 'ok',
                      }),
                    ),
                  )
                  .children(t.dashboard.n0Errors),
              ]
            : entries.map(([cause, rate]) =>
                h.div
                  .key(cause)
                  .class(
                    css({
                      display: 'grid',
                      gridTemplateColumns: '72px minmax(0,1fr) 56px',
                      alignItems: 'center',
                      gap: '2',
                    }),
                  )
                  .children(
                    h.span
                      .class(
                        css({
                          fontFamily: 'mono',
                          fontSize: 'type.11',
                          color: 'mutedForeground',
                        }),
                      )
                      .children(t.dashboard.errorCauses[cause]),
                    h.div
                      .class(
                        css({
                          height: '3.5',
                          borderRadius: 'xs',
                          backgroundColor: 'card',
                          boxShadow: 'lineStrong',
                        }),
                      )
                      .children(
                        h.div
                          .class(
                            css({
                              height: '100%',
                              borderRadius: '2xs',
                            }),
                          )
                          .style({
                            width: `${(rate / max) * 100}%`,
                            background: `linear-gradient(90deg, color-mix(in oklab, ${RED} 35%, transparent), ${RED})`,
                          })
                          .children(),
                      ),
                    h.span
                      .class(
                        cx(
                          FIGURE,
                          css({
                            textAlign: 'right',
                            fontSize: 'type.11-5',
                          }),
                        ),
                      )
                      .children(t.dashboard.s(compact(rate))),
                  ),
              ),
        ),
    ],
    h,
  )
}

const timeouts = (game: Game, ledger: Ledger, h: H<Message>): Content => {
  const t = copy(h)

  const names = namesOf(t, game.nodes)
  const percentiles = has(game, 'percentiles')
  const phone = isPhone()
  const rows = ledger.links
    .flatMap((link) => {
      const policy = game.links.find((entry) => entry.from === link.from && entry.to === link.to)
      if (policy === undefined || link.timeout <= 0.0005) return []
      const source = game.nodes.find((node) => node.id === link.from)
      const applied = policyOf(game, policy, source)
      const budget = applied.bulkhead ? Math.min(applied.timeout, 1000) : applied.timeout
      return [{ link, budget, lost: link.rate * link.timeout }]
    })
    .sort((a, b) => b.lost - a.lost)
  return tablePanel(
    'timeouts',
    SPAN.full,
    t.dashboard.timeouts,
    t.dashboard.byLinkNow,
    [
      t.dashboard.link,
      t.dashboard.timeoutBudget,
      ...(phone ? [] : [t.dashboard.mean]),
      ...(percentiles ? ['p99'] : []),
      t.dashboard.overBudget,
    ],
    rows.map(({ link, budget }) => ({
      key: `${link.from}>${link.to}`,
      cells: [
        { text: `${names.get(link.from) ?? link.from} → ${names.get(link.to) ?? link.to}` },
        { text: formats(t).ms(budget) },
        ...(phone ? [] : [{ text: formats(t).ms(link.mean) }]),
        ...(percentiles ? [{ text: formats(t).ms(link.p99) }] : []),
        {
          text: '',
          content: h.div
            .class(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '2',
              }),
            )
            .children(
              h.div
                .class(
                  css({
                    height: '1.5',
                    minWidth: '2rem',
                    flex: '1 1 0%',
                    overflow: 'hidden',
                    borderRadius: 'full',
                    backgroundColor: 'well',
                    boxShadow: 'well',
                  }),
                )
                .children(
                  h.div
                    .class(
                      css({
                        height: '100%',
                        borderRadius: 'full',
                      }),
                    )
                    .style({
                      width: `${Math.min(1, link.timeout) * 100}%`,
                      background: RED,
                    })
                    .children(),
                ),
              h.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      width: '11',
                      textAlign: 'right',
                    }),
                  ),
                )
                .children(percent(link.timeout, link.timeout < 0.1 ? 1 : 0)),
            ),
        },
      ],
    })),
    h,
  )
}

const nodeRow = (id: string, name: string, own: NodeLedger | undefined, h: H<Message>): Content => {
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
  return h.tr
    .key(id)
    .class(
      css({
        _hover: {
          backgroundColor: 'color-mix(in oklab, var(--foreground) 3%, transparent)',
        },
      }),
    )
    .children(
      h.td
        .class(
          cx(
            cell,
            css({
              fontWeight: 'medium',
            }),
          ),
        )
        .children(name),
      h.td
        .class(
          cx(
            cell,
            FIGURE,
            css({
              textAlign: 'right',
            }),
          ),
        )
        .children(t.dashboard.s(compact(own?.inbound ?? 0))),
      h.td
        .class(
          cx(
            cell,
            FIGURE,
            css({
              textAlign: 'right',
              color: 'mutedForeground',
            }),
          ),
        )
        .children(t.dashboard.s(compact(own?.capacity ?? 0))),
      h.td.class(cell).children(
        h.div
          .class(
            css({
              display: 'flex',
              height: '3.5',
              alignItems: 'center',
              gap: '2',
            }),
          )
          .children(
            lcd(`nodes:${id}`, share, h, 24),
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    width: '11',
                    textAlign: 'right',
                  }),
                ),
              )
              .style({ color: LEVEL_COLOR[levelOf(share, UTILIZATION)] })
              .children(percent(Math.min(share, 9.99))),
          ),
      ),
      h.td
        .class(
          cx(
            cell,
            FIGURE,
            css({
              textAlign: 'right',
            }),
          ),
        )
        .children(formats(t).ms(own?.latency ?? 0)),
      h.td
        .class(
          cx(
            cell,
            FIGURE,
            css({
              textAlign: 'right',
            }),
          ),
        )
        .children(formats(t).ms(own?.p99 ?? 0)),
      h.td
        .class(
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
        )
        .children(t.dashboard.s(compact(own?.dropped ?? 0))),
      h.td
        .class(
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
        )
        .style({
          background: `color-mix(in oklab, ${LEVEL_COLOR[level]} 85%, transparent)`,
        })
        .children(own?.status === 'down' ? t.dashboard.down : stateLabelOf(t)[level]),
    )
}

const lazyNodeRow = keyedLazy()

const nodeTable = (ledger: Ledger, tracks: ReadonlyArray<NodeTrack>, h: H<Message>): Content => {
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
      h.div
        .class(
          cx(
            SCREEN,
            css({
              paddingInline: '1',
              paddingBottom: '1',
            }),
            SCROLL,
          ),
        )
        .children(
          h.table
            .class(
              css({
                width: '100%',
                minWidth: '720px',
                borderCollapse: 'collapse',
                fontSize: 'type.12',
              }),
            )
            .children(
              h.thead.children(
                h.tr
                  .class(
                    css({
                      fontSize: 'type.11',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(
                    ...head.map((label, index) =>
                      h.th
                        .key(label)
                        .class(
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
                        )
                        .children(label),
                    ),
                  ),
              ),
              h.tbody.children(
                sorted.map((track) =>
                  lazyNodeRow(track.id, nodeRow, [track.id, track.name, ledger.nodes[track.id], h]),
                ),
              ),
            ),
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
  content?: Content | undefined
}>

const tablePanel = (
  key: string,
  span: string,
  title: string,
  unit: string,
  head: ReadonlyArray<string>,
  rows: ReadonlyArray<Readonly<{ key: string; cells: ReadonlyArray<Cell> }>>,
  h: H<Message>,
  extra: ReadonlyArray<Child> = [],
): Content => {
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
      h.div
        .class(
          cx(
            SCREEN,
            css({
              paddingInline: '1',
              paddingBottom: '1',
            }),
            SCROLL,
          ),
        )
        .children(
          ...(rows.length === 0
            ? [
                h.span
                  .key('none')
                  .class(
                    cx(
                      FIGURE,
                      css({
                        paddingInline: '2',
                        paddingBlock: '3',
                        fontSize: 'type.12',
                        color: 'mutedForeground',
                      }),
                    ),
                  )
                  .children(copy(h).dashboard.nothingToShowYet),
              ]
            : [
                h.table
                  .class(
                    css({
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 'type.12',
                    }),
                  )
                  .children(
                    h.thead.children(
                      h.tr
                        .class(
                          css({
                            fontSize: 'type.11',
                            color: 'mutedForeground',
                          }),
                        )
                        .children(
                          ...head.map((label, index) =>
                            h.th
                              .key(label)
                              .class(
                                cx(
                                  border,
                                  css({
                                    fontWeight: 'medium',
                                  }),
                                  columnClass(index),
                                ),
                              )
                              .children(label),
                          ),
                        ),
                    ),
                    h.tbody.children(
                      ...rows.map((row) =>
                        h.tr
                          .key(row.key)
                          .class(
                            css({
                              _hover: {
                                backgroundColor:
                                  'color-mix(in oklab, var(--foreground) 3%, transparent)',
                              },
                            }),
                          )
                          .children(
                            ...row.cells.map((cell, index) => {
                              const base = h.td.key(head[index] ?? String(index)).class(
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
                              )
                              const filled =
                                cell.fill === undefined
                                  ? base
                                  : base.style({
                                      background: `color-mix(in oklab, ${cell.fill} 85%, transparent)`,
                                    })
                              const hinted =
                                cell.hint === undefined ? filled : filled.attr('title', cell.hint)
                              const label =
                                cell.color === undefined
                                  ? h.span
                                  : h.span.style({ color: cell.color })
                              return hinted.children(
                                cell.content !== undefined
                                  ? cell.content
                                  : cell.bar === undefined
                                    ? cell.onClick === undefined
                                      ? label.children(cell.text)
                                      : h.button
                                          .attr('type', 'button')
                                          .on('click', () => cell.onClick)
                                          .class(
                                            css({
                                              textAlign: 'left',
                                              fontWeight: 'medium',
                                              textUnderlineOffset: '2',
                                              _hover: {
                                                textDecorationLine: 'underline',
                                              },
                                            }),
                                          )
                                          .attr('title', cell.hint)
                                          .children(cell.text)
                                    : h.div
                                        .class(
                                          css({
                                            display: 'flex',
                                            height: '3.5',
                                            minWidth: '4.5rem',
                                            alignItems: 'center',
                                            gap: '2',
                                          }),
                                        )
                                        .children(
                                          lcd(
                                            `${key}:${row.key}:${index}`,
                                            cell.bar.share,
                                            h,
                                            12,
                                            cell.bar.color,
                                          ),
                                          h.span
                                            .class(
                                              cx(
                                                FIGURE,
                                                css({
                                                  width: '11',
                                                  textAlign: 'right',
                                                }),
                                              ),
                                            )
                                            .children(cell.text),
                                        ),
                              )
                            }),
                          ),
                      ),
                    ),
                  ),
              ]),
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
  h: H<Message>,
): Content => {
  const widest = Math.max(...entries.map((entry) => Math.abs(entry.value)), 1e-9)
  return panel(
    key,
    span,
    title,
    unit,
    [
      h.div
        .class(
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
        )
        .children(
          entries.length === 0
            ? [
                h.span
                  .key('none')
                  .class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.12',
                        color: 'mutedForeground',
                      }),
                    ),
                  )
                  .children(copy(h).dashboard.noNodeToShow),
              ]
            : entries.map((entry) => {
                const color = entry.color ?? BLUE
                return h.div
                  .key(entry.key)
                  .class(
                    css({
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr) 60px',
                      alignItems: 'center',
                      gap: '2',
                    }),
                  )
                  .children(
                    h.span
                      .class(
                        css({
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 'type.11-5',
                          color: 'mutedForeground',
                        }),
                      )
                      .children(entry.name),
                    h.div
                      .class(
                        css({
                          height: '3.5',
                          borderRadius: 'xs',
                          backgroundColor: 'card',
                          boxShadow: 'lineStrong',
                        }),
                      )
                      .children(
                        h.div
                          .class(
                            css({
                              height: '100%',
                              borderRadius: '2xs',
                            }),
                          )
                          .style({
                            width: `${Math.max(2, (Math.abs(entry.value) / widest) * 100)}%`,
                            background: `linear-gradient(90deg, color-mix(in oklab, ${color} 35%, transparent), ${color})`,
                          })
                          .children(),
                      ),
                    h.span
                      .class(
                        cx(
                          FIGURE,
                          css({
                            textAlign: 'right',
                            fontSize: 'type.11-5',
                          }),
                        ),
                      )
                      .children(entry.text),
                  )
              }),
        ),
    ],
    h,
  )
}

const cashSpark = (rows: ReadonlyArray<Row>, h: H<Message>): Content => {
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
  return h.div
    .class(
      css({
        marginTop: '1.5',
        display: 'flex',
        flexShrink: '0',
        flexDirection: 'column',
        gap: '0.5',
      }),
    )
    .children(
      h.div
        .class(
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
        )
        .children(
          composedChart(
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
        ),
      seriesLegend(rows, spec.series, spec, undefined, h),
    )
}

const teamName = (t: Messages, team: Game['teams'][number]): string => {
  if (team.id === 'core' && team.name === 'Core') return t.team.coreTeam
  const numbered = /^Team (\d+)$/.exec(team.name)
  return numbered ? t.team.teamN(Number(numbered[1])) : team.name
}

const serviceName = (t: Messages, service: Game['services'][number]): string => {
  if (service.id === 'monolith' && service.name === 'Monolith') return t.team.monolith
  const numbered = /^Service (\d+)$/.exec(service.name)
  return numbered ? t.team.serviceN(Number(numbered[1])) : service.name
}

const companyPanels = (
  model: Model,
  ledger: Ledger,
  rows: ReadonlyArray<Row>,
  h: H<Message>,
): ReadonlyArray<Content> => {
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

const incidentTimeline = (model: Model, rows: ReadonlyArray<Row>, h: H<Message>): Content => {
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
  const incident = activeIncident(game)
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
        h.div
          .class(
            cx(
              SCREEN,
              css({
                paddingInline: '2',
                paddingBlock: '3',
              }),
            ),
          )
          .children(
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'type.12',
                    color: 'mutedForeground',
                  }),
                ),
              )
              .children(t.dashboard.noRunInThisRange),
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

const runningIncident = (game: Game, h: H<Message>): Content => {
  const t = copy(h)

  const incident = activeIncident(game)
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

const incidentHistory = (game: Game, h: H<Message>): Content => {
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

const postmortemDetail = (game: Game, postmortem: Postmortem, h: H<Message>): Content => {
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
      h.div
        .class(
          cx(
            SCREEN,
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '3',
              padding: '3',
            }),
          ),
        )
        .children(
          h.p
            .class(
              css({
                fontSize: 'type.12',
                lineHeight: 'snug',
                color: 'mutedForeground',
              }),
            )
            .children(def.cause),
          h.div
            .class(
              css({
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                '& > :not(:last-child)': {
                  borderRightWidth: '1px',
                  borderRightStyle: 'solid',
                  borderColor: 'hairline',
                },
              }),
            )
            .children(
              ...facts.map(([name, value]) =>
                h.div
                  .key(name)
                  .class(
                    css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1',
                      paddingInline: '2.5',
                      paddingBlock: '1.5',
                    }),
                  )
                  .children(
                    h.span.class(EYEBROW).children(name),
                    h.span
                      .class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'type.12-5',
                          }),
                        ),
                      )
                      .children(value),
                  ),
              ),
            ),
          h.p
            .class(
              css({
                fontSize: 'type.12',
                lineHeight: 'snug',
              }),
            )
            .children(def.prevention),
          h.p
            .class(
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
            )
            .children(
              postmortem.action === null
                ? t.dashboard.noActionItem
                : has(game, postmortem.action)
                  ? t.dashboard.actionItemDone(t.catalog.research[postmortem.action].name)
                  : t.dashboard.actionItemOpen(t.catalog.research[postmortem.action].name),
            ),
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
  h: H<Message>,
): ReadonlyArray<Content> => {
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

const alertTimeline = (model: Model, rows: ReadonlyArray<Row>, h: H<Message>): Content => {
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

const thresholdPicker = (rule: Rule, chosen: number, h: H<Message>): Content => {
  const t = copy(h)

  const label = (threshold: number): string =>
    rule === 'latency' || rule === 'budget'
      ? `${threshold}×`
      : rule === 'queue'
        ? t.dashboard.s3(threshold)
        : `${Math.round(threshold * 1000) / 10}%`
  return h.div
    .class(
      cx(
        css({
          display: 'inline-flex',
          gap: '0.75',
          padding: '0.75',
        }),
        WELL,
      ),
    )
    .children(
      ...ALERT_THRESHOLDS[rule].map((threshold) =>
        h.button
          .key(`${rule}-${threshold}`)
          .attr('type', 'button')
          .attr('aria-pressed', threshold === chosen ? 'true' : 'false')
          .on('click', () => Message.AlertRuleChosen({ rule, threshold }))
          .class(
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
          )
          .children(label(threshold)),
      ),
    )
}

const alertTable = (game: Game, ledger: Ledger, h: H<Message>): Content => {
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
  h: H<Message>,
): Content => {
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

const serviceTable = (game: Game, ledger: Ledger, only: string | null, h: H<Message>): Content => {
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

const waterfallTable = (game: Game, ledger: Ledger, kind: RequestKind, h: H<Message>): Content => {
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
    const id = queue.shift()
    if (id === undefined || seen.has(id)) continue
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
      const own = ledger.nodes[id]
      const node = byId.get(id)
      if (!node || !own) return []
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

const resourceTimeline = (model: Model, tracks: ReadonlyArray<NodeTrack>, h: H<Message>): Content =>
  lazyResourceTimeline(resourceTimelineView, [
    model.board.nodeHistory,
    tracks,
    Math.floor(model.board.game.time / NODE_HISTORY_EVERY_SIM_SECONDS) *
      NODE_HISTORY_EVERY_SIM_SECONDS,
    h,
  ])

const lazyResourceTimeline = lazy()

const resourceTimelineView = (
  history: Model['board']['nodeHistory'],
  tracks: ReadonlyArray<NodeTrack>,
  last: number,
  h: H<Message>,
): Content => {
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

const usersTable = (game: Game, ledger: Ledger, only: RegionId | null, h: H<Message>): Content => {
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

const deviceTable = (ledger: Ledger, h: H<Message>): Content => {
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

const loadBalancer = (nodes: Game['nodes'], ledger: Ledger, h: H<Message>): Content => {
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

const appServers = (nodes: Game['nodes'], ledger: Ledger, h: H<Message>): Content => {
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

const autoscaling = (game: Game, ledger: Ledger, h: H<Message>): Content => {
  const t = copy(h)

  const titleOf = (id: string): string => {
    const node = game.nodes.find((entry) => entry.id === id)
    return node === undefined ? id : nodeTitle(t, game, node)
  }
  const scalers = game.nodes.filter((node) => node.type === 'autoscaler')
  return tablePanel(
    'autoscaling',
    SPAN.half,
    t.dashboard.autoscaling,
    t.dashboard.autoscalingHint,
    [t.dashboard.node, t.dashboard.signal, t.dashboard.copies, t.dashboard.next],
    scalers.flatMap((scaler) => {
      const view = autoscalerViewOf(game, ledger, scaler)
      if (view.members.length === 0)
        return [
          {
            key: scaler.id,
            cells: [
              { text: titleOf(scaler.id) },
              { text: '—' },
              { text: '—' },
              { text: t.inspectorAutoscaler.linkAHint },
            ],
          },
        ]
      return view.members.map((member) => ({
        key: `${scaler.id}-${member.nodeId}`,
        cells: [
          {
            text:
              scalers.length > 1
                ? `${titleOf(scaler.id)} → ${titleOf(member.nodeId)}`
                : titleOf(member.nodeId),
          },
          { text: readingOf(t, member) },
          {
            text:
              member.booting > 0
                ? t.dashboard.copiesBooting(member.copies, member.booting)
                : String(member.copies),
          },
          { text: view.active ? nextOf(t, member) : t.inspectorAutoscaler.paused },
        ],
      }))
    }),
    h,
  )
}

const databases = (nodes: Game['nodes'], ledger: Ledger, h: H<Message>): Content => {
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

const evictions = (game: Game, ledger: Ledger, h: H<Message>): Content => {
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
  h: H<Message>,
): Content => {
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

const queues = (nodes: Game['nodes'], ledger: Ledger, h: H<Message>): Content => {
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

const managed = (nodes: Game['nodes'], ledger: Ledger, h: H<Message>): Content => {
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

const topBar = (model: Model, h: H<Message>): Content => {
  const t = copy(h)

  const now = clockOf(model.board.game.time)
  const open = boardSandbox(model.board)
  const place = open
    ? open.id === null
      ? t.dashboard.freeSandbox
      : t.dashboard.sandbox
    : t.dashboard.company
  return h.div
    .class(
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
    )
    .children(
      h.div
        .class(
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
        )
        .children(
          icon(
            h,
            LayoutGrid,
            css({
              width: '4',
              height: '4',
              color: 'mutedForeground',
            }),
          ),
          h.span
            .class(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '1.5',
                fontSize: 'type.13',
                color: 'mutedForeground',
              }),
            )
            .children(
              t.dashboard.dashboards,
              h.span.children('/'),
              place,
              h.span.children('/'),
              h.span
                .class(
                  css({
                    fontSize: 'type.15',
                    fontWeight: 'semibold',
                    letterSpacing: 'body',
                    color: 'foreground',
                  }),
                )
                .children(t.dashboard.overview),
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
        ),
      h.span
        .class(
          css({
            flex: '1 1 0%',
          }),
        )
        .children(),
      h.div
        .class(
          cx(
            PANEL,
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '1.5',
              padding: '1.5',
            }),
          ),
        )
        .children(
          h.span
            .class(
              css({
                display: 'grid',
                height: '7',
                placeItems: 'center',
                paddingInline: '1.5',
                color: 'mutedForeground',
              }),
            )
            .children(
              icon(
                h,
                Clock3,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
            ),
          h.div
            .class(
              cx(
                css({
                  display: 'flex',
                  gap: '0.75',
                  padding: '0.75',
                }),
                WELL,
              ),
            )
            .children(
              ...DASHBOARD_RANGE_MINUTES.map((minutes) =>
                h.button
                  .key(`range-${minutes}`)
                  .attr('type', 'button')
                  .attr('aria-pressed', minutes === model.board.dashboard.range ? 'true' : 'false')
                  .on('click', () =>
                    Message.DashboardChanged({
                      message: DashboardMessage.RangeChosen({ minutes }),
                    }),
                  )
                  .class(
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
                  )
                  .children(rangeLabel(t, minutes)),
              ),
            ),
          h.span
            .class(
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
            )
            .children(
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
            ),
        ),
      h.div
        .class(
          cx(
            PANEL,
            css({
              padding: '1',
            }),
          ),
        )
        .children(
          button(
            h,
            {
              onClick: Message.PanelClosed(),
              variant: 'ghost',
              size: 'icon',
              className: css({
                color: 'mutedForeground',
              }),
              attributes: { 'aria-label': t.dashboard.closeEsc },
            },
            icon(
              h,
              X,
              css({
                width: '4',
                height: '4',
              }),
            ),
          ),
        ),
    )
}

const variables = (model: Model, slo: number, h: H<Message>): Content => {
  const t = copy(h)

  const game = model.board.game
  const dashboard = model.board.dashboard
  const chip = (name: string, value: string) =>
    h.span
      .key(name)
      .class(
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
      )
      .children(
        h.span
          .class(
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
          )
          .children(name),
        h.span
          .class(
            css({
              display: 'grid',
              placeItems: 'center',
              paddingInline: '2',
              fontFamily: 'mono',
              fontSize: 'type.11-5',
            }),
          )
          .children(value),
      )
  const select = (
    name: string,
    value: string,
    options: ReadonlyArray<readonly [string, string]>,
    chosen: (value: string) => Message,
  ) =>
    h.label
      .key(name)
      .attr('data-variable', name)
      .class(
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
      )
      .children(
        h.span
          .class(
            css({
              color: 'mutedForeground',
            }),
          )
          .children(name),
        h.select
          .value(value)
          .attr('aria-label', name)
          .on('change', ({ value: next }) => chosen(next))
          .class(
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
          )
          .children(
            options.map(([option, label]) =>
              h.option
                .attr('value', option)
                .selected(option === value)
                .children(label),
            ),
          ),
      )
  const toggle = (name: string, on: boolean, click: Message, color?: string) =>
    h.button
      .key(name)
      .attr('type', 'button')
      .attr('aria-pressed', on ? 'true' : 'false')
      .on('click', () => click)
      .class(
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
      )
      .children(
        ...(color === undefined
          ? []
          : [
              h.span
                .class(
                  css({
                    height: '3',
                    borderLeftWidth: '1px',
                    borderLeftStyle: 'solid',
                    borderStyle: 'dashed',
                  }),
                )
                .style({ borderColor: color, opacity: on ? '1' : '0.4' })
                .children(),
            ]),
        h.span.children(name),
      )
  return h.div
    .class(
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
    )
    .children(
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
      h.span
        .class(
          css({
            flex: '1 1 0%',
          }),
        )
        .children(),
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
      h.div
        .class(
          css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '1',
          }),
        )
        .children(
          ANNOTATION_GROUPS.map((group) =>
            toggle(
              annotationNameOf(t)[group],
              dashboard.groups.includes(group),
              Message.DashboardChanged({ message: DashboardMessage.GroupToggled({ group }) }),
              ANNOTATION_COLOR[group],
            ),
          ),
        ),
    )
}

export const dashboardPanel = (
  h: H<Message>,
  model: Model,
  ledger: Ledger,
): View.Input<Message> | undefined => {
  if (model.panel !== 'dashboard') return undefined
  const localized = speak(model.prefs.locale, h)
  const t = copy(localized)

  const game = model.board.game
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
  const nodePanels: ReadonlyArray<Content> = [
    ...(hasNode('lb')
      ? [lazyPanel('load-balancer', loadBalancer, [game.nodes, ledger, localized])]
      : []),
    ...(hasNode('server')
      ? [lazyPanel('app-server', appServers, [game.nodes, ledger, localized])]
      : []),
    ...(hasNode('autoscaler')
      ? [lazyPanel('autoscaling', autoscaling, [game, ledger, localized])]
      : []),
    ...(hasNode('database') || hasNode('replica')
      ? [lazyPanel('databases', databases, [game.nodes, ledger, localized])]
      : []),
    ...(hasNode('queue') ? [lazyPanel('queues', queues, [game.nodes, ledger, localized])] : []),
    ...(hasNode('cache')
      ? [
          lazyPanel('cache', hits, [
            'cache',
            t.dashboard.cache,
            t.dashboard.hitRatioNow,
            'cache',
            game.nodes,
            ledger,
            localized,
          ]),
          evictions(game, ledger, localized),
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
            localized,
          ]),
        ]
      : []),
    ...(game.nodes.some((node) => MANAGED.includes(node.type))
      ? [lazyPanel('managed', managed, [game.nodes, ledger, localized])]
      : []),
  ]
  const userPanels: ReadonlyArray<Content> = has(game, 'multi-region')
    ? [
        usersTable(game, ledger, region, localized),
        ...(has(game, 'rum') ? [deviceTable(ledger, localized)] : []),
      ]
    : []
  const marks = annotationsOf(model)
  const series = (spec: SeriesSpec): Content =>
    timeSeries(
      model,
      rows,
      marks,
      spec.key === 'latency' && has(game, 'tracing') ? exemplars : NO_EXEMPLARS,
      spec,
      localized,
    )

  const panels: ReadonlyArray<Child> =
    rows.length < 2 || !latest
      ? [
          h.div
            .key('empty')
            .class(
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
            )
            .children(t.dashboard.chartsFillInAsTheClock),
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
            localized,
          ),
          stat(
            'cash-rate',
            t.dashboard.cashPerSecond,
            t.dashboard.s2(cashRate >= 0 ? '+' : '', money(cashRate)),
            cashRate > 0 ? 'ok' : cashRate < 0 ? 'danger' : 'plain',
            rows,
            'cashRate',
            GREEN,
            localized,
            false,
            true,
          ),
          gauge(
            'apdex',
            'Apdex',
            regionApdex ?? latest.apdex,
            (regionApdex ?? latest.apdex).toFixed(2),
            { warn: 0.85, danger: 0.7, invert: true },
            localized,
          ),
          gauge(
            'bottleneck',
            bottleneck ? t.dashboard.hottestNode(bottleneck.name) : t.dashboard.hottestNode2,
            Math.min(1, bottleneck ? (ledger.nodes[bottleneck.id]?.utilization ?? 0) : 0),
            percent(
              Math.min(9.99, bottleneck ? (ledger.nodes[bottleneck.id]?.utilization ?? 0) : 0),
            ),
            UTILIZATION,
            localized,
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
                localized,
                true,
              )
            : locked(t.dashboard.errors2, SPAN.stat, t.dashboard.errorRate, 'logs', localized),
          stat(
            'latency-now',
            percentiles ? t.dashboard.p99Latency : t.dashboard.meanLatency,
            formats(t).ms(percentiles ? latest.p99 : latest.latency),
            'plain',
            rows,
            percentiles ? 'p99' : 'latency',
            PURPLE,
            localized,
          ),

          rowHeader(t.dashboard.goldenSignals, 5, localized),
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
          ...(has(game, 'tracing') ? [exemplarStrip(exemplars, localized)] : []),
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
            : locked('errors-series', SPAN.third, t.dashboard.errors, 'logs', localized),
          causes(ledger, localized),
          mix(ledger, shownKind, localized),
          ...(has(game, 'logs') ? [timeouts(game, ledger, localized)] : []),

          ...(alerting
            ? [
                rowHeader(t.dashboard.alerts, 2, localized),
                alertTable(game, ledger, localized),
                alertTimeline(model, rows, localized),
              ]
            : []),
          ...(has(game, 'tracing')
            ? [
                rowHeader(
                  t.dashboard.servicesRed,
                  1 + (game.services.length > 1 ? 1 : 0) + (kind ? 1 : 0),
                  localized,
                ),
                servicesTable(ledger, shownKind, localized),
                ...(game.services.length > 1
                  ? [serviceTable(game, ledger, service, localized)]
                  : []),
                ...(kind ? [waterfallTable(game, ledger, kind, localized)] : []),
              ]
            : []),

          rowHeader(t.dashboard.saturation, resourcesShown ? 4 : 3, localized),
          lazyPanel('bar-gauge', barGauge, [ledger, tracks, localized]),
          stateTimeline(model, tracks, resourcesShown ? SPAN.third : SPAN.twoThirds, localized),
          ...(has(game, 'profiling')
            ? [resourceTimeline(model, tracks, localized)]
            : has(game, 'tracing')
              ? [locked('resources', SPAN.third, t.dashboard.resourcesUse, 'profiling', localized)]
              : []),
          lazyNodeTable('nodes', nodeTable, [ledger, tracks, localized]),

          rowHeader(t.dashboard.money, 1, localized),
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
                rowHeader('SLO', 4, localized),
                stat(
                  'availability',
                  t.dashboard.availabilityWeek,
                  percent(budget.availability, 2),
                  budget.availability >= budget.slo ? 'ok' : 'danger',
                  rows,
                  'availability',
                  GREEN,
                  localized,
                ),
                gauge(
                  'error-budget',
                  t.dashboard.errorBudgetLeft,
                  Math.max(0, Math.min(1, budget.left)),
                  budget.left > 0
                    ? `${Math.round(Math.min(1, budget.left) * 100)}%`
                    : t.dashboard.spent,
                  { warn: 0.5, danger: 0.05, invert: true },
                  localized,
                ),
                panel(
                  'sla-credit',
                  SPAN.stat,
                  t.dashboard.sLACredits,
                  credit > 0 ? t.dashboard.paid : '',
                  [
                    h.div
                      .class(
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
                      )
                      .children(
                        h.span
                          .class(
                            css(FIGURE_STYLE, {
                              fontSize: 'type.30',
                              lineHeight: 'none',
                              fontWeight: 'medium',
                              letterSpacing: 'title',
                            }),
                          )
                          .style({ color: credit > 0 ? RED : MUTED })
                          .attr(
                            'title',
                            credit > 0
                              ? t.dashboard.slaPaysBack(
                                  t.units.perSecond(money(credit)),
                                  sloText(budget.slo),
                                )
                              : t.dashboard.noSlaCredit,
                          )
                          .children(credit > 0 ? `−${t.units.perSecond(money(credit))}` : '—'),
                      ),
                  ],
                  localized,
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
                rowHeader('SLO', 1, localized),
                locked(
                  'burn-rate',
                  SPAN.half,
                  t.dashboard.errorBudgetBurnRate,
                  'slo-dashboards',
                  localized,
                ),
              ]),

          ...(nodePanels.length === 0
            ? []
            : [rowHeader(t.dashboard.nodes, nodePanels.length, localized), ...nodePanels]),

          ...(userPanels.length === 0
            ? []
            : [rowHeader(t.dashboard.users, userPanels.length, localized), ...userPanels]),

          ...(game.sandbox
            ? []
            : [
                rowHeader(t.dashboard.company, 3, localized),
                ...companyPanels(model, ledger, rows, localized),
              ]),
          ...(activeIncident(game) === null && game.postmortems.length === 0
            ? []
            : [
                rowHeader(
                  t.dashboard.incidents,
                  game.postmortems.some(
                    (postmortem) => postmortem.id === model.board.dashboard.postmortem,
                  )
                    ? 4
                    : 3,
                  localized,
                ),
                ...incidentPanels(model, rows, localized),
              ]),
        ]

  return h.div
    .key('dashboard')
    .attr('data-dashboard', '')
    .attr('data-exit', 'gesture')
    .class(
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
    )
    .children(
      topBar(model, localized),
      h.div
        .key('scroll')
        .attr('data-scroll', 'dashboard')
        .attr('tabindex', '0')
        .attr('role', 'region')
        .attr('aria-label', t.dashboard.dashboardScrollForTheCompanyAnd)
        .class(
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
        )
        .children(
          variables(model, slo, localized),
          h.div
            .class(
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
            )
            .children(...panels),
        ),
    )
}
