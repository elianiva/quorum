import { describe, expect, test } from 'vitest'
import {
  ERAS,
  ERA_RECIPES,
  FEATURES,
  FEATURE_IDS,
  RESEARCH,
  INSIGHT_YIELD,
  RECIPE,
  RPS_PER_USER,
  STUDY_SECONDS,
  researchList,
  type FeatureId,
  type InsightPool,
  type RequestKind,
  type ResearchId,
} from '../src/catalog.ts'
import { newGame } from '../src/company.ts'
import { demandOf } from '../src/solve-demand.ts'
import type { Game } from '../src/state.ts'

const PACK_FLOOR = 0.02
const SLOWEST = 2
const LOOSEST = 3

const live = { _tag: 'Live' as const, rollout: 1, adoption: 1, lift: null }

const insightAt = (users: number, share: number) =>
  INSIGHT_YIELD * Math.sqrt(0.1 * users * RPS_PER_USER * share)

const poolsOf = (id: ResearchId): ReadonlyArray<[RequestKind, number]> =>
  (Object.entries(RECIPE[id]) as Array<[InsightPool, number]>).filter(
    (entry): entry is [RequestKind, number] => entry[0] !== 'failure',
  )

const itemsOf = (stage: number) => {
  const exit = ERAS[stage]?.raiseAt ?? 1_000_000
  const mix = ERAS[stage]?.mix ?? {}
  return researchList
    .filter((entry) => entry.era === stage)
    .map((entry) => ({
      id: entry.id,
      total: Object.values(RECIPE[entry.id]).reduce((sum, cost) => sum + cost, 0),
      slowest: Math.max(
        0,
        ...poolsOf(entry.id).map(
          ([pool, cost]) =>
            cost / (STUDY_SECONDS[stage] ?? 3_600) / insightAt(exit, mix[pool] ?? 0),
        ),
      ),
    }))
    .toSorted((a, b) => a.total - b.total)
}

const medianOf = (items: ReadonlyArray<{ slowest: number }>) =>
  items[Math.floor(items.length / 2)]?.slowest ?? 0

const onDefaults = (stage: number, id: ResearchId) =>
  Object.keys(RECIPE[id]).toSorted().join() === (ERA_RECIPES[stage] ?? []).toSorted().join()

describe('an Era pays for its research in its own packs', () => {
  test('each Era mix sums to one', () => {
    for (const era of ERAS)
      expect(Object.values(era.mix).reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 9)
  })

  test('every default recipe kind keeps a share of its Era demand', () => {
    for (let stage = 0; stage < 6; stage += 1)
      for (const kind of ERA_RECIPES[stage] ?? [])
        if (kind !== 'failure')
          expect(ERAS[stage]?.mix[kind] ?? 0).toBeGreaterThanOrEqual(PACK_FLOOR)
  })

  test('the packs pay a median Study in a couple of its base durations', () => {
    for (let stage = 0; stage < 6; stage += 1) {
      const items = itemsOf(stage)
      const defaults = items.filter((entry) => onDefaults(stage, entry.id))
      expect(medianOf(defaults)).toBeLessThanOrEqual(SLOWEST)
      expect(medianOf(items)).toBeLessThanOrEqual(LOOSEST)
    }
  })
})

const shareOf = (
  stage: number,
  kind: 'login' | 'upload',
  ...ids: ReadonlyArray<FeatureId>
): number => {
  const game: Game = {
    ...newGame(1),
    stage,
    users: 25_000,
    features: Object.fromEntries(ids.map((id) => [id, live])),
  }
  const demand = demandOf(game)
  const total = Object.values(demand).reduce((sum, rate) => sum + (rate ?? 0), 0)
  return (demand[kind] ?? 0) / total
}

describe('a Feature whose kind needs a fixing component', () => {
  const gated: ReadonlyArray<FeatureId> = [
    'checkout',
    'chat',
    'ai-assistant',
    'activity-feed',
    'push-notifications',
  ]

  test('is gated on the research that fixes it, so the fix lands before the pain', () => {
    for (const id of gated) expect(FEATURES[id].research, id).not.toBeNull()
  })

  test('that research is paid in kinds other than the one the Feature brings, and opens in time', () => {
    for (const id of FEATURE_IDS) {
      const { research, unlocks, era } = FEATURES[id]
      if (!research) continue
      expect(RESEARCH[research].era, id).toBeLessThanOrEqual(era)
      if (unlocks) expect(Object.keys(RECIPE[research]), id).not.toContain(unlocks.kind)
    }
  })
})

describe('login and upload traffic', () => {
  test('the Era that introduces a kind keeps a real share of its demand', () => {
    expect(shareOf(1, 'login', 'signup-flow', 'password-login')).toBeGreaterThanOrEqual(0.05)
    expect(
      shareOf(2, 'upload', 'signup-flow', 'password-login', 'profile-photos'),
    ).toBeGreaterThanOrEqual(0.05)
  })
})

describe('Profile photos puts uploads on the wire', () => {
  const seeded = (features: Game['features']): Game => {
    const game = newGame(1)
    return { ...game, stage: 2, users: 25_000, features }
  }
  const shipped = seeded({ 'profile-photos': live })

  test('uploads are a pack the Seed Era can sample', () => {
    const demand = demandOf(shipped)
    const total = Object.values(demand).reduce((sum, rate) => sum + (rate ?? 0), 0)
    expect(demand.upload ?? 0).toBeGreaterThanOrEqual(30)
    expect((demand.upload ?? 0) / total).toBeGreaterThanOrEqual(PACK_FLOOR)
  })

  test('without the Feature, the Seed Era sends no uploads at all', () => {
    expect(demandOf(seeded({})).upload ?? 0).toBe(0)
  })
})
