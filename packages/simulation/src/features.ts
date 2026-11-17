import {
  ADOPTION_DAYS,
  CALENDAR_DAY,
  FEATURES,
  FEATURE_IDS,
  FLAG_PROPAGATION_SECONDS,
  KINDS,
  LIFT_Z_SCORE,
  LIFT_MAX_ROLLOUT,
  LIFT_MIN_ROLLOUT,
  LIFT_SPREAD,
  LEVER_KINDS,
  LIVE_TUNING,
  MARKET_GAIN_CAP,
  OUTCOME_BANDS,
  PAYING_SHARE,
  PLAN_PER_DAY,
  ROLLOUT_ALL,
  leverGrowthTotal,
  leverMultiplier,
  type BackendKind,
  type FeatureDef,
  type FeatureId,
  type RequestKind,
  type Tuning,
} from './catalog.ts'
import { ventureOf } from './founding.ts'
import {
  LiftSample,
  type FeaturePhase,
  adoptionOf,
  isLive,
  liftOf as liftSampleOf,
  rolloutOf as rolloutShareOf,
  step,
  targetRolloutOf,
} from './feature-machine.ts'
import { eraOf, has, isDown } from './lookups.ts'
import { nextRandom } from './random.ts'
import type { Game } from './state.ts'

const LIFT_SAMPLE_FLOOR = 0.01

const idsOf = (game: Game): ReadonlyArray<FeatureId> =>
  Object.keys(game.features).filter((id) =>
    (FEATURE_IDS as ReadonlyArray<string>).includes(id),
  ) as ReadonlyArray<FeatureId>

export const isBuilt = (game: Game, id: FeatureId): boolean => game.features[id] !== undefined

export const isFeatureLive = (game: Game, id: FeatureId): boolean => {
  const phase = game.features[id]
  return phase !== undefined && isLive(phase)
}

export const liveFeatures = (game: Game): ReadonlyArray<FeatureId> =>
  idsOf(game).filter((id) => isFeatureLive(game, id))

export const awaitingFeatures = (game: Game): ReadonlyArray<FeatureId> =>
  idsOf(game).filter((id) => !isFeatureLive(game, id))

export const adoptionShareOf = (game: Game, id: FeatureId): number => {
  const phase = game.features[id]
  return phase === undefined ? 0 : adoptionOf(phase)
}

const rolloutOf = (game: Game, feature: FeatureId): number => {
  const flags = game.nodes.some((node) => node.type === 'ff' && !isDown(node))
  const phase = game.features[feature]
  if (!flags || phase === undefined) return ROLLOUT_ALL
  return Math.max(0, Math.min(ROLLOUT_ALL, rolloutShareOf(phase)))
}

const shipped = (game: Game): ReadonlyArray<FeatureDef> =>
  game.sandbox ? [] : liveFeatures(game).map((id) => FEATURES[id])

export const exposureOf = (game: Game, id: FeatureId): number =>
  rolloutOf(game, id) * adoptionShareOf(game, id) * historyOf(game, id)

export const historyOf = (game: Game, id: FeatureId): number =>
  FEATURES[id].history < 1 &&
  game.nodes.some((node) => node.type === 'database' && node.keep === 'delete')
    ? FEATURES[id].history
    : 1

export const outcomeOf = (game: Game, id: FeatureId): number => game.outcomes[id] ?? 1

export const rollOutcome = (game: Game, id: FeatureId): Game => {
  const def = FEATURES[id]
  if (
    def.market === 1 &&
    def.growth === 1 &&
    def.churn === 1 &&
    Object.keys(def.value).length === 0
  )
    return game
  const [roll, seed] = nextRandom(game.seed)
  const band =
    OUTCOME_BANDS[Math.min(OUTCOME_BANDS.length - 1, Math.floor(roll * OUTCOME_BANDS.length))]
  const [spread, afterSpread] = nextRandom(seed)
  const share = band ? band.lo + spread * (band.hi - band.lo) : 1
  return { ...game, seed: afterSpread, outcomes: { ...game.outcomes, [id]: share } }
}

const atExposure = (effect: number, exposure: number, outcome = 1): number =>
  1 + (effect - 1) * exposure * outcome

const product = (game: Game, of: (feature: FeatureDef, exposure: number) => number): number =>
  shipped(game).reduce((total, feature) => total * of(feature, exposureOf(game, feature.id)), 1)

const rolledProduct = (
  game: Game,
  of: (feature: FeatureDef, exposure: number, outcome: number) => number,
): number =>
  shipped(game).reduce(
    (total, feature) =>
      total * of(feature, exposureOf(game, feature.id), outcomeOf(game, feature.id)),
    1,
  )

const baseMixOf = (game: Game): Partial<Record<RequestKind, number>> => {
  const era = eraOf(game).mix
  if (game.sandbox) return { ...(game.scenario?.mix ?? era) }
  const shares: Partial<Record<RequestKind, number>> = { ...era }
  for (const id of FEATURE_IDS) {
    const unlocks = FEATURES[id].unlocks
    if (unlocks?.gated && !isFeatureLive(game, id)) delete shares[unlocks.kind]
  }
  const total = Object.values(shares).reduce((sum, share) => sum + (share ?? 0), 0)
  for (const kind of Object.keys(shares) as Array<RequestKind>)
    shares[kind] = total > 0 ? (shares[kind] ?? 0) / total : 0
  return ventureMix(game, shares)
}

const withLevers = (
  game: Game,
  shares: Partial<Record<RequestKind, number>>,
): Partial<Record<RequestKind, number>> => {
  if (game.fixedMix) return shares
  const next = { ...shares }
  for (const kind of LEVER_KINDS) {
    const step = game.levers[kind] ?? 0
    if (step <= 0) continue
    const share = next[kind] ?? 0
    if (share <= 0) continue
    const target = share * leverMultiplier(step)
    if (target <= share || target > 1) continue
    const others = Object.entries(next).reduce(
      (sum, [other, value]) => (other === kind ? sum : sum + (value ?? 0)),
      0,
    )
    if (others <= 0) continue
    for (const other of Object.keys(next) as Array<RequestKind>)
      if (other !== kind) next[other] = ((next[other] ?? 0) * (1 - target)) / others
    next[kind] = target
  }
  return next
}

export const leverMixOf = (
  game: Game,
): Readonly<{
  base: Partial<Record<RequestKind, number>>
  levered: Partial<Record<RequestKind, number>>
}> => {
  const base = baseMixOf(game)
  return { base, levered: withLevers(game, base) }
}

const mixes = new WeakMap<Game, Partial<Record<RequestKind, number>>>()

export const mixOf = (game: Game): Partial<Record<RequestKind, number>> => {
  const cached = mixes.get(game)
  if (cached) return cached
  const built = computeMix(game)
  mixes.set(game, built)
  return built
}

const computeMix = (game: Game): Partial<Record<RequestKind, number>> => {
  const levered = leverMixOf(game).levered
  if (game.sandbox) return levered
  const shares = { ...levered }
  for (const feature of shipped(game)) {
    const unlocks = feature.unlocks
    if (!unlocks) continue
    const exposure = exposureOf(game, feature.id)
    if (!unlocks.gated) {
      const share = unlocks.share * exposure
      if ((shares[unlocks.kind] ?? 0) > 0) continue
      for (const kind of Object.keys(shares) as Array<RequestKind>)
        shares[kind] = (shares[kind] ?? 0) * (1 - share)
      shares[unlocks.kind] = share
    } else {
      shares[unlocks.kind] =
        shares[unlocks.kind] === undefined
          ? unlocks.share * exposure
          : (shares[unlocks.kind] ?? 0) * exposure
    }
  }
  for (const feature of shipped(game)) {
    const exposure = exposureOf(game, feature.id)
    for (const [kind, factor] of Object.entries(feature.load) as Array<[RequestKind, number]>)
      if (shares[kind] !== undefined)
        shares[kind] = (shares[kind] ?? 0) * atExposure(factor, exposure)
  }
  return shares
}

const ventureMix = (
  game: Game,
  shares: Partial<Record<RequestKind, number>>,
): Partial<Record<RequestKind, number>> => {
  const profile = ventureOf(game).shares
  if (profile === null) return shares
  const next: Partial<Record<RequestKind, number>> = {}
  let total = 0
  for (const kind of Object.keys(shares) as Array<RequestKind>) {
    const share = profile[kind] ?? 0
    if (share <= 0) continue
    next[kind] = share
    total += share
  }
  if (total <= 0) return shares
  for (const kind of Object.keys(next) as Array<RequestKind>) next[kind] = (next[kind] ?? 0) / total
  return next
}

export const marketOf = (game: Game): number =>
  eraOf(game).market *
  Math.min(
    MARKET_GAIN_CAP,
    rolledProduct(game, (feature, exposure, outcome) =>
      atExposure(feature.market, exposure, outcome),
    ),
  ) *
  ventureOf(game).market

export const growthFactor = (game: Game): number =>
  rolledProduct(game, (feature, exposure, outcome) => atExposure(feature.growth, exposure, outcome))

export const churnFactor = (game: Game): number =>
  rolledProduct(game, (feature, exposure, outcome) => atExposure(feature.churn, exposure, outcome))

export const leverGrowthFactor = (game: Game): number =>
  LEVER_KINDS.reduce((factor, kind) => factor * leverGrowthTotal(game.levers[kind] ?? 0), 1)

const baseValueFactor = (game: Game, kind: RequestKind): number =>
  rolledProduct(game, (feature, exposure, outcome) =>
    atExposure(feature.value[kind] ?? 1, exposure, outcome),
  ) *
  ventureOf(game).value *
  (game.scenario?.value?.[kind] ?? 1)

const leverValueFactor = (game: Game, kind: RequestKind): number => {
  const step = game.levers[kind] ?? 0
  if (step <= 0) return 1
  const { base, levered } = leverMixOf(game)
  const before = base[kind] ?? 0
  const after = levered[kind] ?? 0
  const added = after - before
  const own = KINDS[kind].value * baseValueFactor(game, kind)
  if (added <= 0 || own <= 0) return 1
  let displaced = 0
  let displacedShare = 0
  for (const other of Object.keys(base) as Array<RequestKind>) {
    if (other === kind) continue
    const lost = (base[other] ?? 0) - (levered[other] ?? 0)
    if (lost <= 0) continue
    displaced += lost * KINDS[other].value * baseValueFactor(game, other)
    displacedShare += lost
  }
  if (displacedShare <= 0) return 1
  return (before * own + added * (displaced / displacedShare)) / (after * own)
}

export const valueFactor = (game: Game, kind: RequestKind): number =>
  baseValueFactor(game, kind) * leverValueFactor(game, kind)

export const payloadFactor = (game: Game, kind: RequestKind): number =>
  product(game, (feature, exposure) => atExposure(feature.payload[kind] ?? 1, exposure))

export const subscriptionsOf = (game: Game): number => {
  const adopted = shipped(game).reduce(
    (sum, feature) => sum + (feature.subscription ? exposureOf(game, feature.id) : 0),
    0,
  )
  return adopted > 0 ? (game.users * PAYING_SHARE * PLAN_PER_DAY * adopted) / CALENDAR_DAY : 0
}

export const queryFactor = (game: Game, kind: BackendKind): number =>
  product(game, (feature, exposure) => atExposure(feature.queries[kind] ?? 1, exposure))

export const adoptionSeconds = (tuning: Tuning = LIVE_TUNING): number =>
  (ADOPTION_DAYS * CALENDAR_DAY) / tuning.calendarPace

export const advanceAdoption = (
  game: Game,
  seconds: number,
  tuning: Tuning = LIVE_TUNING,
): Game => {
  const live = liveFeatures(game)
  if (game.sandbox || live.length === 0) return game
  const share = Math.min(1, seconds / adoptionSeconds(tuning))
  const features = { ...game.features }
  for (const id of live) {
    const phase = features[id]
    if (phase === undefined || !isLive(phase)) continue
    features[id] = step(phase, {
      _tag: 'Adopted',
      share: phase.adoption + (1 - phase.adoption) * share,
    })
  }
  return { ...game, features }
}

export const liftSampleRate = (game: Game): number => {
  const rates = game.nodes
    .filter((node) => node.type === 'analytics' && !isDown(node))
    .map((node) => node.sampleRate)
  return Math.max(LIFT_SAMPLE_FLOOR, ...rates)
}

export const measurable = (game: Game, id: FeatureId): boolean => {
  if (!has(game, 'ab-testing') || !isFeatureLive(game, id)) return false
  const rollout = rolloutOf(game, id)
  return rollout >= LIFT_MIN_ROLLOUT && rollout <= LIFT_MAX_ROLLOUT
}

export const liftOf = (game: Game, id: FeatureId): number => {
  const def = FEATURES[id]
  const outcome = outcomeOf(game, id)
  const market = atExposure(def.market, 1, outcome)
  const growth = atExposure(def.growth, 1, outcome)
  const churn = atExposure(def.churn, 1, outcome)
  return (market * growth) / churn - 1
}

export type LiftVerdict = 'wins' | 'loses' | 'early'

export type LiftReading = Readonly<{
  lift: number
  halfWidth: number
  verdict: LiftVerdict
}>

export const liftReading = (game: Game, id: FeatureId): LiftReading | null => {
  if (!measurable(game, id)) return null
  const lift = liftOf(game, id)
  if (lift === 0) return null
  const phase = game.features[id]
  const sample: LiftSample | null = phase === undefined ? null : liftSampleOf(phase)
  const exposed = Math.max(0, sample?.exposed ?? 0)
  const holdout = Math.max(0, sample?.holdout ?? 0)
  if (exposed <= 0 || holdout <= 0)
    return { lift, halfWidth: Number.POSITIVE_INFINITY, verdict: 'early' }
  const halfWidth = LIFT_Z_SCORE * LIFT_SPREAD * Math.sqrt(1 / exposed + 1 / holdout)
  const verdict: LiftVerdict =
    lift - halfWidth > 0 ? 'wins' : lift + halfWidth < 0 ? 'loses' : 'early'
  return { lift, halfWidth, verdict }
}

export const advanceLifts = (game: Game, demand: number, seconds: number): Game => {
  if (game.sandbox || demand <= 0) return game
  const observable = liveFeatures(game).filter(
    (id) => measurable(game, id) && liftOf(game, id) !== 0,
  )
  if (observable.length === 0) return game
  const sampled = demand * liftSampleRate(game) * seconds
  const features = { ...game.features }
  for (const id of observable) {
    const phase = features[id]
    if (phase === undefined || !isLive(phase)) continue
    const rollout = rolloutOf(game, id)
    const prior = phase.lift
    const base = prior && prior.step === rollout ? prior : { exposed: 0, holdout: 0, step: rollout }
    features[id] = step(phase, {
      _tag: 'Sampled',
      lift: {
        step: rollout,
        exposed: base.exposed + sampled * rollout,
        holdout: base.holdout + sampled * (1 - rollout),
      },
    })
  }
  return { ...game, features }
}

export const advancePropagation = (game: Game, seconds: number): Game => {
  const live = liveFeatures(game)
  if (game.sandbox || live.length === 0) return game
  const rate = Math.min(1, seconds / FLAG_PROPAGATION_SECONDS)
  let features = game.features as Record<string, FeaturePhase>
  for (const id of live) {
    const phase = features[id]
    if (phase === undefined || !isLive(phase)) continue
    const target = targetRolloutOf(phase)
    if (phase.rollout === target) continue
    const rollout = phase.rollout + (target - phase.rollout) * rate
    const next = Math.abs(target - rollout) < 0.001 ? target : rollout
    if (next === phase.rollout) continue
    if (features === game.features) features = { ...features }
    features[id] = { ...phase, rollout: next, target }
  }
  return features === game.features ? game : { ...game, features }
}

export const advanceFeatures = (
  game: Game,
  demand: number,
  seconds: number,
  tuning: Tuning = LIVE_TUNING,
): Game =>
  advanceLifts(advancePropagation(advanceAdoption(game, seconds, tuning), seconds), demand, seconds)
