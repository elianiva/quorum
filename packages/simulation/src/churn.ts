import { Schema } from 'effect'
import {
  CALENDAR_DAY,
  DEVICES,
  DEVICE_INFO,
  type DeviceId,
  PROFILES,
  REGIONS,
  REGION_INFO,
  type RegionId,
  type RequestKind,
} from './catalog.ts'
import { ERROR_CAUSES, type ErrorCause } from './distribution.ts'
import type { Ledger } from './ledger.ts'
import { eraOf, has } from './lookups.ts'
import { openRegions, regional, regionApdexOf, regionUsers } from './regions.ts'
import type { Game } from './state.ts'
import { forecastUsers, regionGrowth } from './step.ts'

export type ChurnCause = 'far' | 'slow' | 'failed' | ErrorCause

const RegionIdSchema = Schema.Literals(REGIONS)

export const ChurnFix = Schema.TaggedUnion({
  region: { region: RegionIdSchema },
  research: { research: Schema.Literals(['multi-region', 'geo-dns']) },
  node: { nodeId: Schema.String },
  advice: { text: Schema.String },
})
export type ChurnFix = typeof ChurnFix.Type

export type ChurnRow = Readonly<{
  kind: RequestKind
  cause: ChurnCause
  points: number
  p99: number | null
  target: number
  needed: boolean
  fix: ChurnFix
  hop: Readonly<{ nodeId: string; ms: number }> | null
  device: Readonly<{ device: DeviceId; ms: number }> | null
}>

export type RegionChurn = Readonly<{
  region: RegionId
  users: number
  apdex: number
  now: number
  target: number
  perHour: number
  inADay: number
  rows: ReadonlyArray<ChurnRow>
}>

const MIN_POINTS = 0.002

const FAILURE_FIX: Readonly<Record<ErrorCause, string>> = {
  stranded: 'Link a Node that accepts this kind.',
  dropped: 'Add capacity: a Node is past its backlog.',
  refused: 'Add a Connection Pooler: a connection limit is full.',
  down: 'Replace or restore the Node that is down.',
  stale: 'Read this kind from the primary, or turn on read-your-writes.',
  oom: 'Give the Node more RAM, or fewer workers.',
  timeout: 'Add capacity behind the Link, or raise its timeout.',
  crash: 'Restart the Node, and give it more RAM or copies.',
  blocked: 'Lower the WAF paranoia level.',
  upstream: 'Wait out the provider, or add a fallback.',
  throttled: 'Raise the rate limit.',
  duplicate: 'Research Idempotency keys.',
}

const farFix = (game: Game, region: RegionId): ChurnFix => {
  if (!has(game, 'multi-region')) return { _tag: 'research', research: 'multi-region' }
  if (!openRegions(game).includes(region)) return { _tag: 'region', region }
  if (!has(game, 'geo-dns')) return { _tag: 'research', research: 'geo-dns' }
  return { _tag: 'region', region }
}

const slowestHopOf = (
  ledger: Ledger,
  kind: RequestKind,
): Readonly<{ nodeId: string; ms: number }> | null => {
  let best: Readonly<{ nodeId: string; ms: number }> | null = null
  for (const [nodeId, entry] of Object.entries(ledger.nodes)) {
    const ms = entry.hopByKind[kind] ?? 0
    if (ms > 0 && (best === null || ms > best.ms)) best = { nodeId, ms }
  }
  return best
}

const slowestHop = (
  game: Game,
  ledger: Ledger,
  kind: RequestKind,
): Readonly<{ nodeId: string; ms: number }> | null =>
  has(game, 'tracing') ? slowestHopOf(ledger, kind) : null

const slowestDevice = (game: Game): Readonly<{ device: DeviceId; ms: number }> | null => {
  if (!has(game, 'rum')) return null
  const slowest = DEVICES.reduce((best, device) =>
    DEVICE_INFO[device].rttMs > DEVICE_INFO[best].rttMs ? device : best,
  )
  return { device: slowest, ms: DEVICE_INFO[slowest].rttMs }
}

const rowsOf = (game: Game, ledger: Ledger, region: RegionId, gap: number): Array<ChurnRow> => {
  const kinds = ledger.regionKinds[region] ?? {}
  const total = Object.values(kinds).reduce((sum, entry) => sum + (entry?.rate ?? 0), 0)
  if (total <= 0) return []
  const logs = has(game, 'logs')
  const percentiles = has(game, 'percentiles')
  const rows: Array<Omit<ChurnRow, 'needed' | 'hop' | 'device'>> = []
  for (const [kind, entry] of Object.entries(kinds) as Array<
    [RequestKind, NonNullable<(typeof kinds)[RequestKind]>]
  >) {
    const share = entry.rate / total
    const target = PROFILES[kind].apdex
    const p99 = percentiles ? entry.p99 : null
    const far = share * entry.success * Math.max(0, entry.near - entry.apdex)
    const slow = share * entry.success * (1 - Math.max(entry.near, entry.apdex))
    if (far >= MIN_POINTS)
      rows.push({ kind, cause: 'far', points: far, p99, target, fix: farFix(game, region) })
    if (slow >= MIN_POINTS) {
      const hop = slowestHopOf(ledger, kind)
      rows.push({
        kind,
        cause: 'slow',
        points: slow,
        p99,
        target,
        fix: hop
          ? { _tag: 'node', nodeId: hop.nodeId }
          : {
              _tag: 'advice',
              text: 'Check the heaviest hop on this kind for its limiting resource.',
            },
      })
    }
    if (logs) {
      for (const cause of ERROR_CAUSES) {
        const points = share * (entry.fail[cause] ?? 0)
        if (points >= MIN_POINTS)
          rows.push({
            kind,
            cause,
            points,
            p99,
            target,
            fix: { _tag: 'advice', text: FAILURE_FIX[cause] },
          })
      }
    } else {
      const points = share * (1 - entry.success)
      if (points >= MIN_POINTS)
        rows.push({
          kind,
          cause: 'failed',
          points,
          p99,
          target,
          fix: { _tag: 'advice', text: 'Research Structured logs to see why.' },
        })
    }
  }
  rows.sort((a, b) => b.points - a.points)
  let won = 0
  return rows.map((row) => {
    const needed = gap > 0 && won < gap
    won += row.points
    return {
      ...row,
      needed,
      hop: row.cause === 'slow' ? slowestHop(game, ledger, row.kind) : null,
      device: row.cause === 'slow' || row.cause === 'far' ? slowestDevice(game) : null,
    }
  })
}

export const churnOf = (game: Game, ledger: Ledger): ReadonlyArray<RegionChurn> => {
  const target = eraOf(game).apdexTarget
  const users = regionUsers(game)
  const growth = regionGrowth(game, ledger)
  const day = forecastUsers(game, ledger, CALENDAR_DAY)
  const regions = regional(game) ? REGIONS : REGIONS.filter((region) => users[region] > 0)
  return regions
    .filter((region) => users[region] >= 1)
    .map((region) => {
      const now = ledger.regions[region] ?? ledger.apdex
      return {
        region,
        users: users[region],
        apdex: regionApdexOf(game, region),
        now,
        target,
        perHour: growth[region] * 60,
        inADay: day[region],
        rows: rowsOf(game, ledger, region, target - now),
      }
    })
    .toSorted((a, b) => a.perHour - b.perHour)
}

export const regionName = (region: RegionId): string => REGION_INFO[region].name
