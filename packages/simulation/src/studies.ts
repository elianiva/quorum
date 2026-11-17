import { Schema } from 'effect'
import {
  BREADTH,
  REGION_BREADTH,
  ERA_RECIPES,
  FEATURES,
  INSIGHT_POOLS,
  POOL_FLOOR,
  RECIPE,
  SHAPE,
  STUDY_SHAPE_KINDS,
  VENDOR_DISCOUNT,
  RESEARCH,
  RETENTION_WINDOWS,
  SPIKE_SPEED,
  STUDY_SECONDS,
  STUDY_SPEEDUP,
  STUDY_SPEED_RESEARCH,
  researchList,
  type InsightPool,
  type RequestKind,
  type ResearchId,
} from './catalog.ts'
import { StepEvent } from './events.ts'
import type { Ledger } from './ledger.ts'
import { StudyPhase, step as studyStep } from './study-machine.ts'
import { has, researchReady } from './lookups.ts'
import { isFeatureLive } from './features.ts'
import { assignments } from './work.ts'
import { FeatureId as FeatureIdSchema } from './state.ts'
import type { Game, InsightPools, Study } from './state.ts'

export const retentionOf = (game: Game): number =>
  game.nodes.reduce(
    (longest, node) => (node.type === 'analytics' ? Math.max(longest, node.retention) : longest),
    0,
  ) || RETENTION_WINDOWS[0]

const FLOORS: ReadonlyArray<Readonly<Record<InsightPool, number>>> = STUDY_SECONDS.map(
  (_, stage) =>
    Object.fromEntries(
      INSIGHT_POOLS.map((pool) => [
        pool,
        researchList.reduce(
          (most, entry) =>
            entry.era <= stage ? Math.max(most, RECIPE[entry.id][pool] ?? 0) : most,
          POOL_FLOOR,
        ),
      ]),
    ) as Record<InsightPool, number>,
)

export const capOf = (game: Game, ledger: Ledger, pool: InsightPool): number =>
  Math.max(
    FLOORS[Math.min(game.stage, FLOORS.length - 1)]?.[pool] ?? POOL_FLOOR,
    retentionOf(game) * ledger.insight[pool],
  )

const migrated = (game: Game, ledger: Ledger): InsightPools => {
  if (game.insight <= 0) return game.pools
  const pools = { ...game.pools }
  const mix = (Object.keys(ledger.kinds) as Array<RequestKind>).filter((kind) => kind !== 'bot')
  const total = mix.reduce((sum, kind) => sum + (ledger.kinds[kind]?.rate ?? 0), 0)
  if (total <= 0) pools.page += game.insight
  else
    for (const kind of mix) pools[kind] += (game.insight * (ledger.kinds[kind]?.rate ?? 0)) / total
  return pools
}

export const accrue = (
  game: Game,
  ledger: Ledger,
  seconds: number,
  grants: ReadonlyArray<InsightPool>,
  grant: number,
): InsightPools => {
  const pools = migrated(game, ledger)
  const next = { ...pools }
  for (const pool of INSIGHT_POOLS) {
    const cap = capOf(game, ledger, pool)
    const held = pools[pool]
    if (held < cap) next[pool] = Math.min(cap, held + ledger.insight[pool] * seconds)
  }
  for (const pool of grants) next[pool] += grant
  return next
}

export const recipeOf = (
  game: Game,
  id: ResearchId,
): Readonly<Partial<Record<InsightPool, number>>> => {
  const recipe = RECIPE[id]
  if (!game.discounts.includes(id)) return recipe
  return Object.fromEntries(
    (Object.entries(recipe) as Array<[InsightPool, number]>).map(([pool, cost]) => [
      pool,
      cost * (1 - VENDOR_DISCOUNT),
    ]),
  )
}

const recipeKinds = (id: ResearchId): ReadonlyArray<RequestKind> =>
  (Object.keys(RECIPE[id]) as Array<InsightPool>).filter(
    (pool): pool is RequestKind => pool !== 'failure',
  )

export const breadthGap = (
  id: ResearchId,
  ledger: Ledger,
): Readonly<{
  unit: 'components' | 'regions'
  target: number
  current: number
}> | null => {
  const kinds = recipeKinds(id)
  if (kinds.length === 0) return null
  const components = BREADTH[id] ?? 0
  if (components > 0) {
    const current = Math.min(...kinds.map((kind) => ledger.breadth[kind] ?? 0))
    if (current < components) return { unit: 'components', target: components, current }
  }
  const regions = REGION_BREADTH[id] ?? 0
  if (regions > 0) {
    const current = Math.min(...kinds.map((kind) => ledger.breadthRegions[kind] ?? 0))
    if (current < regions) return { unit: 'regions', target: regions, current }
  }
  return null
}

export const broadEnough = (id: ResearchId, ledger: Ledger): boolean =>
  breadthGap(id, ledger) === null

export const spiked = (game: Game): boolean => {
  const running = game.studies[0]
  if (!running) return false
  return [...assignments(game).values()].some(
    (item) => item.kind === 'spike' && item.ref === running.id,
  )
}

export const studySpeed = (game: Game): number =>
  (spiked(game) ? SPIKE_SPEED : 1) *
  (1 + STUDY_SPEEDUP * STUDY_SPEED_RESEARCH.filter((id) => has(game, id)).length)

export const studySeconds = (id: ResearchId): number =>
  STUDY_SECONDS[RESEARCH[id].era] ?? STUDY_SECONDS[STUDY_SECONDS.length - 1] ?? 3_600

export const limitingPool = (game: Game): InsightPool | null => {
  const running = game.studies[0]
  if (!running) return null
  let worst: InsightPool | null = null
  let least = Number.POSITIVE_INFINITY
  for (const [pool, cost] of Object.entries(recipeOf(game, running.id)) as Array<
    [InsightPool, number]
  >) {
    const left = game.pools[pool] / cost
    if (left < least) {
      least = left
      worst = pool
    }
  }
  return worst
}

const InsightPoolSchema = Schema.Literals(INSIGHT_POOLS)

export const shapeValueOf = (id: ResearchId): number => {
  const shape = SHAPE[id]
  if (!shape) return 0
  switch (shape.kind) {
    case 'connections':
      return shape.moreThan
    case 'read-share':
    case 'report-share':
      return shape.share
    case 'cache-hit':
    case 'saturation':
      return shape.ratio
    case 'backlog':
      return shape.seconds
    case 'replica':
      return 1
  }
}

export const shapeCurrent = (game: Game, ledger: Ledger, id: ResearchId): number => {
  const shape = SHAPE[id]
  if (!shape) return 0
  let best = 0
  for (const node of game.nodes) {
    const entry = ledger.nodes[node.id]
    if (!entry) continue
    switch (shape.kind) {
      case 'connections':
        if (entry.connections !== null) best = Math.max(best, entry.connections.used)
        break
      case 'read-share':
        if (node.type === 'database') best = Math.max(best, entry.workShare['q-read'] ?? 0)
        break
      case 'cache-hit':
        if (node.type === 'cache') best = Math.max(best, entry.hitRatio ?? 0)
        break
      case 'backlog':
        if (node.type === 'queue') best = Math.max(best, entry.age ?? 0)
        break
      case 'report-share':
        if (node.type === 'database') best = Math.max(best, entry.workShare['q-scan'] ?? 0)
        break
      case 'saturation':
        if (entry.capacity > 0) best = Math.max(best, entry.utilization)
        break
      case 'replica':
        if (node.type === 'replica') return 1
        break
    }
  }
  return best
}

export const shapeHolds = (game: Game, ledger: Ledger, id: ResearchId): boolean => {
  const shape = SHAPE[id]
  if (!shape) return true
  const current = shapeCurrent(game, ledger, id)
  return shape.kind === 'connections' ? current > shape.moreThan : current >= shapeValueOf(id)
}

export const StudyStall = Schema.TaggedUnion({
  Breadth: {
    unit: Schema.Literals(['components', 'regions']),
    target: Schema.Finite,
    current: Schema.Finite,
  },
  Pool: { pool: InsightPoolSchema, feature: Schema.NullOr(FeatureIdSchema) },
  Shape: {
    shape: Schema.Literals(STUDY_SHAPE_KINDS),
    value: Schema.Finite,
    current: Schema.Finite,
  },
})
export type StudyStall = typeof StudyStall.Type

export const studyStall = (game: Game, ledger: Ledger, id: ResearchId): StudyStall | null => {
  const running = StudyPhase.guards.Running(game.studies.find((item) => item.id === id)?.phase)
  if (!running) {
    const breadth = breadthGap(id, ledger)
    if (breadth) return StudyStall.cases.Breadth.make(breadth)
    const shape = SHAPE[id]
    if (shape && !shapeHolds(game, ledger, id))
      return StudyStall.cases.Shape.make({
        shape: shape.kind,
        value: shapeValueOf(id),
        current: shapeCurrent(game, ledger, id),
      })
  }
  const left =
    1 -
    (() => {
      const phase = game.studies.find((item) => item.id === id)?.phase
      return StudyPhase.guards.Queued(phase) || StudyPhase.guards.Running(phase)
        ? phase.progress
        : 0
    })()
  for (const [pool, cost] of Object.entries(recipeOf(game, id)) as Array<[InsightPool, number]>) {
    if (ledger.insight[pool] > 0 || game.pools[pool] >= cost * left) continue
    const feature = Object.values(FEATURES).find(
      (entry) => entry.unlocks?.kind === pool && !isFeatureLive(game, entry.id),
    )
    return StudyStall.cases.Pool.make({ pool, feature: feature?.id ?? null })
  }
  return null
}

export const progressOf = (study: Study | undefined): number =>
  StudyPhase.guards.Queued(study?.phase) || StudyPhase.guards.Running(study?.phase)
    ? study.phase.progress
    : 0

export const advanceStudies = (
  game: Game,
  ledger: Ledger,
  seconds: number,
  events: Array<StepEvent>,
): Game => {
  const studies = game.studies.filter((entry) => !has(game, entry.id))
  const head = studies[0]
  if (!head || !researchReady(game, head.id))
    return studies.length === game.studies.length ? game : { ...game, studies }
  const starting = StudyPhase.guards.Queued(head.phase)
  if (starting && (!broadEnough(head.id, ledger) || !shapeHolds(game, ledger, head.id)))
    return studies.length === game.studies.length ? game : { ...game, studies }
  const started = starting ? studyStep(head.phase, { _tag: 'Started' }) : head.phase
  const running = { ...head, phase: started }
  const progress = started._tag === 'Queued' || started._tag === 'Running' ? started.progress : 0
  const speed = studySpeed(game)
  const share = (speed * seconds) / studySeconds(running.id)
  const recipe = Object.entries(recipeOf(game, running.id)) as Array<[InsightPool, number]>
  let paid = 1
  for (const [pool, cost] of recipe) {
    const draw = cost * share
    if (draw > 0) paid = Math.min(paid, game.pools[pool] / draw)
  }
  paid = Math.max(0, Math.min(1, paid))
  const pools = { ...game.pools }
  for (const [pool, cost] of recipe) pools[pool] = Math.max(0, pools[pool] - cost * share * paid)
  const reached = progress + share * paid
  if (reached < 1 - 1e-9)
    return {
      ...game,
      pools,
      studies: [
        { ...running, phase: studyStep(started, { _tag: 'Ticked', progress: reached }) },
        ...studies.slice(1),
      ],
    }
  events.push(StepEvent.StudyCompleted({ research: running.id }))
  return {
    ...game,
    pools,
    researched: [...game.researched, running.id],
    studies: studies.slice(1),
    backlog: game.backlog.filter((item) => !(item.kind === 'spike' && item.ref === running.id)),
  }
}

export const eraPools = (stage: number): ReadonlyArray<InsightPool> => ERA_RECIPES[stage] ?? []
