import { CHALLENGE_TUNING, LIVE_TUNING, type Tuning } from '@quorum/simulation/catalog'
import { liveFeatures } from '@quorum/simulation/features'
import { runBot, type BotRun, type Milestone } from '@quorum/simulation/pacing'
import { budgetOf } from '@quorum/simulation/slo'
import type { Founding } from '@quorum/simulation/state'

export const PACING_SEEDS = [1, 2, 3, 4, 5] as const
export const DEEP_SEEDS = [1, 3] as const
export const LEGACY_SEEDS = [1, 2, 3] as const

const NINETY_MINUTES = 90 * 60
const ONE_THIRTY_MINUTES = 130 * 60

export type Row = Readonly<{ label: string; value: string }>

export type LegacyRow = Readonly<{
  seed: string
  first: Readonly<{ preseed: string; seed: string }>
  second: Readonly<{ preseed: string; seed: string }>
}>

export type Measurements = Readonly<{
  version: string
  takenOn: string
  pacing: ReadonlyArray<Row>
  live: ReadonlyArray<Row>
  seed: ReadonlyArray<Row>
  series: ReadonlyArray<Row>
  legacy: ReadonlyArray<LegacyRow>
  reach: string
}>

const one = (value: number): string => value.toFixed(1)

const group = (value: number): string => {
  const digits = String(Math.round(value))
  let out = ''
  for (let index = 0; index < digits.length; index += 1) {
    const fromEnd = digits.length - index
    out += digits[index] ?? ''
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += ','
  }
  return out
}

const span = (
  values: ReadonlyArray<number | null>,
  format: (value: number) => string = one,
  never = 'never',
): string => {
  const seen = values.filter((value): value is number => value !== null)
  if (seen.length === 0) return never
  const low = Math.min(...seen)
  const high = Math.max(...seen)
  const range = format(low) === format(high) ? format(low) : `${format(low)}–${format(high)}`
  return seen.length === values.length ? range : `${range}, ${never} on some seeds`
}

const timesOf = (runs: ReadonlyArray<BotRun>, milestone: Milestone): ReadonlyArray<number | null> =>
  runs.map((run) => minutesOf(run.milestones[milestone]))

const minutesOf = (seconds: number | undefined): number | null =>
  seconds === undefined ? null : seconds / 60

const play = (
  seed: number,
  until: number,
  tuning: Tuning,
  untilStage = 8,
  founding: Founding | null = null,
): BotRun => runBot(seed, until, tuning, 'balanced', untilStage, founding)

const SECOND: Founding = {
  venture: 'b2b-saas',
  mutators: [],
  perks: { 'angel-network': 1, 'pattern-recognition': 1, 'founders-reputation': 1 },
}

export type MeasurementInput = Readonly<{ version: string; takenOn: string }>

export const measure = ({ version, takenOn }: MeasurementInput): Measurements => {
  const paced = PACING_SEEDS.map((seed) => play(seed, NINETY_MINUTES, CHALLENGE_TUNING))
  const throughSeed = PACING_SEEDS.map((seed) => play(seed, NINETY_MINUTES, CHALLENGE_TUNING, 2))

  const deep = DEEP_SEEDS.map((seed) => play(seed, ONE_THIRTY_MINUTES, CHALLENGE_TUNING))
  const toSeriesA = DEEP_SEEDS.map((seed) => play(seed, NINETY_MINUTES, CHALLENGE_TUNING, 3))
  const live = DEEP_SEEDS.map((seed) => play(seed, ONE_THIRTY_MINUTES, LIVE_TUNING))

  const legacy = LEGACY_SEEDS.map((seed) => ({
    seed,
    first: play(seed, NINETY_MINUTES, CHALLENGE_TUNING, 2),
    second: play(seed, NINETY_MINUTES, CHALLENGE_TUNING, 2, SECOND),
  }))

  const seedLength = toSeriesA.map((run) => {
    const start = run.milestones.seed
    const end = run.milestones['series-a']
    return start === undefined || end === undefined ? null : minutesOf(end - start)
  })

  const seedMargins = throughSeed.flatMap((run) => [
    run.margins.find((entry) => entry.stage === 1)?.live ?? null,
  ])

  return {
    version,
    takenOn,
    pacing: [
      { label: 'First research', value: span(timesOf(paced, 'first-research')) },
      { label: 'First upgrade', value: span(timesOf(paced, 'first-upgrade')) },
      { label: 'Database split', value: span(timesOf(paced, 'db-split')) },
      { label: 'First Feature live', value: span(timesOf(paced, 'first-feature')) },
      { label: 'Pre-seed', value: span(timesOf(paced, 'preseed')) },
      { label: 'First hire', value: span(timesOf(paced, 'first-hire')) },
      {
        label: 'Second App Server',
        value: span(timesOf(paced, 'second-server'), one, 'never inside 90 minutes'),
      },
      { label: 'First incident', value: span(timesOf(paced, 'first-incident')) },
      { label: 'Seed', value: span(timesOf(paced, 'seed')) },
      {
        label: 'Engineers at Seed',
        value: span(
          throughSeed.map((run) => run.game.engineers.length),
          (value) => String(value),
        ),
      },
      {
        label: 'Features live at Seed',
        value: span(
          throughSeed.map((run) => liveFeatures(run.game).length),
          (value) => String(value),
        ),
      },
      {
        label: 'Margin at Seed entry',
        value: span(seedMargins, (value) => `${Math.round(value * 100)}%`, 'not measured'),
      },
    ],
    live: [
      { label: 'Pre-seed', value: span(timesOf(live, 'preseed')) },
      { label: 'Seed', value: span(timesOf(live, 'seed')) },
      { label: 'Series A', value: span(timesOf(live, 'series-a')) },
      { label: 'Series B', value: span(timesOf(live, 'series-b')) },
    ],
    seed: [
      { label: 'Seed', value: span(timesOf(toSeriesA, 'seed')) },
      { label: 'Search Engine placed', value: span(timesOf(toSeriesA, 'search-engine')) },
      { label: 'WAF placed', value: span(timesOf(toSeriesA, 'waf')) },
      { label: 'Second App Server', value: span(timesOf(toSeriesA, 'second-server')) },
      { label: 'Series A', value: span(timesOf(toSeriesA, 'series-a')) },
      { label: 'Seed length', value: span(seedLength) },
    ],
    series: [
      { label: 'Series A', value: span(timesOf(deep, 'series-a')) },
      { label: 'Second zone and standbys', value: span(timesOf(deep, 'second-zone')) },
      { label: 'Series B', value: span(timesOf(deep, 'series-b')) },
      {
        label: 'Users at 130 min',
        value: span(
          deep.map((run) => run.game.users),
          group,
          'not reached',
        ),
      },
      {
        label: 'Availability at 130 min',
        value: span(
          deep.map((run) => budgetOf(run.game).availability * 100),
          (value) => `${value.toFixed(2)}%`,
        ),
      },
    ],
    legacy: legacy.map(({ seed, first, second }) => ({
      seed: String(seed),
      first: {
        preseed: one(minutesOf(first.milestones.preseed) ?? 0),
        seed: one(minutesOf(first.milestones.seed) ?? 0),
      },
      second: {
        preseed: one(minutesOf(second.milestones.preseed) ?? 0),
        seed: one(minutesOf(second.milestones.seed) ?? 0),
      },
    })),
    reach: span(
      deep.map((run) => run.game.users),
      group,
      'not reached',
    ),
  }
}
