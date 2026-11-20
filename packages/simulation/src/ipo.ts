import { BACKUPS, DRILL_RPO, ERAS, HOME_REGION, type ComponentId } from './catalog.ts'
import type { Ledger } from './ledger.ts'
import { has, isDown, securityStaffed } from './lookups.ts'
import { survivesRegion } from './regions.ts'
import { budgetOf } from './slo.ts'
import {
  DrillState,
  drillPassed,
  drillRto,
  startDrill,
  step as drillStep,
} from './drill-machine.ts'
import type { Game, GameNode } from './state.ts'
import { valuationOf } from './valuation.ts'

export const PRE_IPO_STAGE = 6
export const IPO_BURN_SECONDS = 1_000
const LARGEST_FINITE_RPO = Number.MAX_SAFE_INTEGER

const DATA: ReadonlyArray<ComponentId> = [
  'database',
  'replica',
  'pooler',
  'cache',
  'search',
  'storage',
  'queue',
  'wide',
  'dsql',
  'warehouse',
]

export const rpoOf = (game: Game, ledger: Ledger | null): number => {
  let worst = 0
  for (const node of game.nodes) {
    if (node.region !== HOME_REGION) continue
    if (node.type === 'wide' || node.type === 'dsql') {
      if (!survivesRegion(game, node)) worst = Math.max(worst, Number.POSITIVE_INFINITY)
      continue
    }
    if (node.type !== 'database') continue
    if (node.backup !== 'none' && node.restore === 'failed') {
      worst = Number.POSITIVE_INFINITY
      continue
    }
    const remote = game.nodes.some(
      (other) => other.type === 'replica' && other.region !== node.region,
    )
    const replica = game.nodes.find(
      (other) => other.type === 'replica' && other.region !== node.region,
    )
    const lag = remote
      ? (ledger?.nodes[replica?.id ?? '']?.lagMs ?? 0) / 60_000
      : Number.POSITIVE_INFINITY
    worst = Math.max(worst, Math.min(lag, BACKUPS[node.backup].rpo))
  }
  return worst
}

export const newDrill = (game: Game, ledger: Ledger | null): DrillState =>
  startDrill(game.drill, game.time, Math.min(rpoOf(game, ledger), LARGEST_FINITE_RPO))

export const advanceDrill = (game: Game, ledger: Ledger): DrillState => {
  const drill = game.drill
  if (!DrillState.guards.Running(drill)) return drill
  const elapsed = game.time - drill.startedAt
  return drillStep(drill, { _tag: 'Ticked', elapsed, errorShare: ledger.errorShare })
}

export type ChecklistItem = Readonly<{
  id: 'users' | 'reliability' | 'soc2' | 'drill' | 'residency' | 'rule40'
  label: string
  met: boolean
  value: string
}>

const reachedData = (game: Game, from: GameNode): ReadonlyArray<GameNode> => {
  const seen = new Set<string>([from.id])
  const stack = [from.id]
  const found: Array<GameNode> = []
  while (stack.length > 0) {
    const at = stack.pop() as string
    for (const link of game.links) {
      if (link.from !== at || seen.has(link.to)) continue
      seen.add(link.to)
      const node = game.nodes.find((entry) => entry.id === link.to)
      if (!node) continue
      if (DATA.includes(node.type)) found.push(node)
      stack.push(node.id)
    }
  }
  return found
}

export const residencyMet = (game: Game): boolean => {
  if (!has(game, 'gdpr-residency') || !has(game, 'geo-dns')) return false
  const eu = game.nodes.find((node) => node.type === 'users' && node.region === 'eu')
  if (!eu || isDown(eu)) return false
  const data = reachedData(game, eu)
  return (
    data.length > 0 &&
    data.every(
      (node) =>
        node.region === 'eu' || ((node.type === 'wide' || node.type === 'dsql') && node.spread),
    )
  )
}

export const brokenRestore = (game: Game): boolean =>
  game.nodes.some(
    (node) =>
      node.type === 'database' &&
      node.region === HOME_REGION &&
      node.backup !== 'none' &&
      node.restore === 'failed',
  )

export const checklistOf = (game: Game, ledger: Ledger): ReadonlyArray<ChecklistItem> => {
  const era = ERAS[PRE_IPO_STAGE]
  const target = era?.raiseAt ?? 50_000_000
  const budget = budgetOf(game)
  const slo = era?.slo ?? 0.999
  const value = valuationOf(game, ledger)
  const drill = game.drill
  return [
    {
      id: 'users',
      label: 'Users',
      met: game.users >= target,
      value: `${Math.round(game.users).toLocaleString('en-US')} / ${target.toLocaleString('en-US')}`,
    },
    {
      id: 'reliability',
      label: 'Reliability',
      met: budget.requests > 0 && budget.availability >= slo,
      value: `${(budget.availability * 100).toFixed(3)}% / ${(slo * 100).toFixed(2)}%`,
    },
    {
      id: 'soc2',
      label: 'SOC 2',
      met: has(game, 'soc2') && securityStaffed(game),
      value: has(game, 'soc2') ? (securityStaffed(game) ? 'Done' : 'Security team') : 'SOC 2',
    },
    {
      id: 'drill',
      label: 'DR drill',
      met: drillPassed(drill),
      value: DrillState.match(drill, {
        Idle: () => 'Not run',
        Running: () => 'Running',
        Recovered: (phase) =>
          drillPassed(phase)
            ? `RTO ${Math.round(drillRto(phase) ?? 0)} min`
            : brokenRestore(game)
              ? 'Restore failed'
              : phase.rpo >= DRILL_RPO
                ? 'Data lost'
                : `RTO ${Math.round(drillRto(phase) ?? 0)} min`,
        Failed: () => (brokenRestore(game) ? 'Restore failed' : 'Not recovered'),
      }),
    },
    {
      id: 'residency',
      label: 'Data residency',
      met: residencyMet(game),
      value: residencyMet(game) ? 'EU' : 'Not yet',
    },
    {
      id: 'rule40',
      label: 'Rule of 40',
      met: value.ruleOf40 >= 40,
      value: `${Math.round(value.ruleOf40)}`,
    },
  ]
}

export const ipoReady = (game: Game, ledger: Ledger): boolean =>
  game.stage === PRE_IPO_STAGE && checklistOf(game, ledger).every((item) => item.met)
