import {
  BAD_DEPLOY_BASE,
  BAD_DEPLOY_ERRORS,
  BAD_DEPLOY_MAX,
  BUILD_CACHE,
  CALENDAR_DAY,
  CI_DEPLOY_MINUTES,
  CODE_REVIEW_FACTOR,
  COORDINATION,
  DEPLOY_STRATEGIES,
  DEV_ENVIRONMENT_RAMP,
  DEV_HOURS_PER_DAY,
  ERAS,
  FEATURES,
  FOREIGN_OUTPUT,
  FORMAL_VERIFICATION_FACTOR,
  FOUNDER_OUTPUT,
  FRAMEWORKS,
  HIRE_DAYS,
  HIRING_PIPELINE,
  LANGUAGES,
  LAYOFF_MORALE,
  LEARN_COST,
  LEARN_DAYS,
  LEARN_OUTPUT,
  LIVE_TUNING,
  MANUAL_DEPLOY_MINUTES,
  MESH_TAX,
  MORALE_DAYS,
  POLICIES,
  PLATFORM_TAX,
  POLICY_SWITCH_DAYS,
  QUARTER_DAYS,
  RAMP_DAYS,
  RAMP_OUTPUT,
  ROLLOUT_ALL,
  RETROGRADE,
  RUNTIMES,
  RUSH_BUG_CHANCE,
  SALARY_BASE_PER_SECOND,
  SHARED_DB_COORDINATION,
  SIGNING_BASE,
  STATIC_ANALYSIS_FACTOR,
  SUPPORTED_QUARTERS,
  TESTS_FACTOR,
  TRUNK_FREQUENCY,
  UPKEEP_CEILING,
  UPKEEP_HALF,
  UPKEEP_SHARE,
  UNHAPPY_MOOD,
  VERIFY_MINUTES,
  WORK_MINUTES,
  type DeployStrategyDef,
  type FeatureId,
  type FixId,
  type FrameworkId,
  type LanguageId,
  type PolicyDef,
  type RequestKind,
  type RuntimeId,
  type Tuning,
} from './catalog.ts'
import { teamBoosting, teamReady } from './research-team.ts'
import type { Ledger } from './ledger.ts'
import {
  dataGroupOfService,
  databasesOfGroup,
  eraOf,
  groupServicesOf,
  has,
  isDown,
  languageOf,
  perkLevel,
  topologyOfGroup,
} from './lookups.ts'
import { awaitingFeatures, liveFeatures } from './features.ts'
import { rolloutOf as rolloutShareOf } from './feature-machine.ts'
import { budgetVelocity } from './slo.ts'
import {
  CORE_TEAM,
  Migration,
  activeIncident,
  monolith,
  type Engineer,
  type Game,
  type GameNode,
  type Service,
  type Team,
  type Training,
  type WorkItem,
} from './state.ts'

export const effectiveEngineers = (n: number, structure = 1, shared = false): number => {
  if (n <= 0) return 0
  const k = COORDINATION * structure * (shared ? 1 + SHARED_DB_COORDINATION : 1)
  return n / (1 + k * (n - 1) + RETROGRADE * n * (n - 1))
}

export const serviceOf = (game: Game): Service => game.services[0] ?? monolith([])

export const serviceOfId = (game: Game, id: string | undefined): Service =>
  (id === undefined ? undefined : game.services.find((service) => service.id === id)) ??
  serviceOf(game)

export const withService = (game: Game, change: Partial<Service>): Game => ({
  ...game,
  services: [{ ...serviceOf(game), ...change }, ...game.services.slice(1)],
})

export const withServiceId = (game: Game, id: string, change: Partial<Service>): Game => ({
  ...game,
  services: game.services.map((service) =>
    service.id === id ? { ...service, ...change } : service,
  ),
})

export const ownerOf = (game: Game, service: Service): Team =>
  game.teams.find((team) => team.id === service.owner) ?? game.teams[0] ?? CORE_TEAM

export const serviceOwnedBy = (game: Game, team: Team): Service =>
  game.services.find((service) => service.owner === team.id) ?? serviceOf(game)

export const pagedTeam = (game: Game): Team =>
  ownerOf(game, serviceOfId(game, activeIncident(game)?.service ?? undefined))

const featureTouches = (id: FeatureId, kind: RequestKind): boolean => {
  const def = FEATURES[id]
  return def !== undefined && (kind in def.load || def.unlocks?.kind === kind)
}

export const serviceOfFeature = (game: Game, id: FeatureId): Service =>
  game.services.slice(1).find((service) => service.features.includes(id)) ?? serviceOf(game)

export const serviceOfKind = (game: Game, kind: RequestKind): Service => {
  const carrier = game.services
    .slice(1)
    .find((service) => service.features.some((id) => featureTouches(id, kind)))
  return carrier ?? serviceOf(game)
}

export const blastService = (game: Game): Service =>
  serviceOfId(game, activeIncident(game)?.service ?? undefined)

export const failsKind = (game: Game, kind: RequestKind): boolean =>
  activeIncident(game)?.kind === 'bad-deploy' &&
  serviceOfKind(game, kind).id === blastService(game).id

const datastoreOf = (game: Game, service: Service): string =>
  service.datastore._tag === 'Pinned'
    ? service.datastore.id
    : (game.nodes.find((node) => node.type === 'database')?.id ?? '')

export const sharesDatabase = (game: Game, service: Service): boolean => {
  const group = dataGroupOfService(game, service)
  if (
    group !== null &&
    topologyOfGroup(game, group) === 'multi' &&
    databasesOfGroup(game, group).length > 1
  )
    return groupServicesOf(game, group).length > 1
  const key = datastoreOf(game, service)
  return key !== '' && game.services.filter((entry) => datastoreOf(game, entry) === key).length > 1
}

export const fixed = (game: Game, fix: FixId): boolean =>
  (game.sandbox && !game.scenario?.tasks) || serviceOf(game).fixes.includes(fix)

const servers = (game: Game) => game.nodes.filter((node) => node.type === 'server')

export const stackOf = (game: Game): Readonly<{ runtime: RuntimeId; framework: FrameworkId }> => {
  const counts = new Map<string, number>()
  for (const node of servers(game)) {
    const key = `${node.runtime}/${node.framework}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: string | null = null
  for (const [key, count] of counts)
    if (best === null || count > (counts.get(best) ?? 0)) best = key
  const first = servers(game)[0]
  if (best === null || !first) return { runtime: 'mod_php', framework: 'none' }
  const [runtime, framework] = best.split('/') as [RuntimeId, FrameworkId]
  return { runtime, framework }
}

export const languageOfService = (game: Game): LanguageId => {
  const node = servers(game).find((entry) => entry.runtime === stackOf(game).runtime)
  return node ? languageOf(node) : 'php'
}

export const coordinationOf = (game: Game): number =>
  FRAMEWORKS[stackOf(game).framework].coordination ?? 1

export const debtGrowthOf = (game: Game): number => FRAMEWORKS[stackOf(game).framework].debt ?? 1

export const featureHoursOn = (game: Game, service: Service): number =>
  liveFeatures(game).reduce(
    (sum, id) => (serviceOfFeature(game, id).id === service.id ? sum + FEATURES[id].dh : sum),
    0,
  )

export const upkeepShare = (game: Game, service: Service): number => {
  const hours = featureHoursOn(game, service)
  if (hours <= 0) return 0
  return Math.min(
    UPKEEP_CEILING,
    (UPKEEP_SHARE * hours * (1 + service.debt)) / (hours + UPKEEP_HALF),
  )
}

export const serviceBurnOf = (game: Game, ledger: Ledger, service: Service): number => {
  const total = game.services.reduce((sum, entry) => sum + entry.codebase, 0)
  return total > 0 ? (ledger.burn * service.codebase) / total : ledger.burn
}

export const paidIndex = (game: Game, engineer: Engineer): number =>
  engineer.salary ?? eraOf(game).salaryIndex

export const payOf = (game: Game, engineer: Engineer): number =>
  SALARY_BASE_PER_SECOND * paidIndex(game, engineer) * LANGUAGES[engineer.language].salary

export const payGapOf = (game: Game, engineer: Engineer): number => {
  const rate = eraOf(game).salaryIndex
  if (rate <= 0) return 0
  return Math.max(0, Math.min(1, 1 - paidIndex(game, engineer) / rate))
}

export const unhappy = (engineer: Engineer): boolean => engineer.mood <= UNHAPPY_MOOD

export const dataStaffed = (game: Game): boolean =>
  game.teams.some(
    (team) =>
      team.kind === 'data' &&
      teamReady(game, team) &&
      !teamBoosting(game, team) &&
      game.engineers.some((engineer) => engineer.team === team.id),
  )

export const memberOf = (game: Game, teamId: string, salt: number): Engineer | undefined => {
  const members = game.engineers.filter((engineer) => engineer.team === teamId)
  return members[Math.abs(Math.trunc(salt)) % Math.max(1, members.length)]
}

export const days = (count: number, tuning: Tuning): number =>
  (count * CALENDAR_DAY) / tuning.calendarPace

export const KIND_CHANGE_DAYS = 3
export const KIND_CHANGE_OUTPUT = 0.5
export const kindChangeSeconds = (tuning: Tuning = LIVE_TUNING): number =>
  days(KIND_CHANGE_DAYS, tuning)

export const policyNow = (game: Game, team: Team, tuning: Tuning = LIVE_TUNING): PolicyDef =>
  game.time - team.since < days(POLICY_SWITCH_DAYS, tuning)
    ? POLICIES[team.previous]
    : POLICIES[team.policy]

export const rampSeconds = (game: Game, tuning: Tuning = LIVE_TUNING): number => {
  const framework = stackOf(game).framework
  const factor = framework === 'rails' ? 0.5 : framework === 'none' ? 1 + serviceOf(game).debt : 1
  return (
    days(RAMP_DAYS, tuning) * factor * (has(game, 'dev-environment') ? DEV_ENVIRONMENT_RAMP : 1)
  )
}

export const trainingOf = (engineer: Engineer): Training | null => engineer.learning

export const fluencyOf = (
  game: Game,
  engineer: Engineer,
  language: LanguageId = languageOfService(game),
): number =>
  trainingOf(engineer) ? LEARN_OUTPUT : engineer.language === language ? 1 : FOREIGN_OUTPUT

export const outputOf = (
  game: Game,
  engineer: Engineer,
  tuning: Tuning = LIVE_TUNING,
  language: LanguageId = languageOfService(game),
): number =>
  game.time < engineer.offUntil
    ? 0
    : (game.time - engineer.hiredAt < rampSeconds(game, tuning) ? RAMP_OUTPUT : 1) *
      fluencyOf(game, engineer, language)

export const learnTargetOf = (game: Game): LanguageId => {
  const migration = serviceOf(game).migration
  return Migration.guards.Idle(migration)
    ? languageOfService(game)
    : RUNTIMES[migration.runtime].language
}

export const trainSeconds = (language: LanguageId, tuning: Tuning = LIVE_TUNING): number =>
  days(LEARN_DAYS * LANGUAGES[language].hireTime, tuning)

export const trainCost = (game: Game, language: LanguageId): number =>
  Math.round(LEARN_COST * signingOf(game, language))

export const finishTraining = (game: Game): Game => {
  const done = game.engineers.filter(
    (engineer) => engineer.learning !== null && engineer.learning.readyAt <= game.time,
  )
  if (done.length === 0) return game
  return {
    ...game,
    engineers: game.engineers.map((engineer) =>
      engineer.learning !== null && engineer.learning.readyAt <= game.time
        ? { ...engineer, language: engineer.learning.language, learning: null }
        : engineer,
    ),
  }
}

export const hireSeconds = (
  game: Game,
  language: LanguageId,
  tuning: Tuning = LIVE_TUNING,
): number => {
  const factor = has(game, 'hiring-pipeline') ? HIRING_PIPELINE : 1
  return days(HIRE_DAYS * LANGUAGES[language].hireTime * factor, tuning)
}

export const moraleSeconds = (tuning: Tuning = LIVE_TUNING): number => days(MORALE_DAYS, tuning)

export const platformStaffed = (game: Game): boolean =>
  game.teams.some(
    (team) =>
      team.kind === 'platform' &&
      teamReady(game, team) &&
      !teamBoosting(game, team) &&
      game.engineers.some((engineer) => engineer.team === team.id),
  )

const liveClusters = (game: Game): number =>
  game.nodes.filter((node) => node.type === 'cluster' && !isDown(node)).length

const liveMeshes = (game: Game): number =>
  game.nodes.filter((node) => node.type === 'mesh' && !isDown(node) && node.service._tag !== 'Shut')
    .length

export const quarterSeconds = (tuning: Tuning = LIVE_TUNING): number => days(QUARTER_DAYS, tuning)

export const quartersBehind = (
  game: Game,
  cluster: GameNode,
  tuning: Tuning = LIVE_TUNING,
): number =>
  Math.max(0, (game.time - cluster.upgradedAt) / quarterSeconds(tuning) - SUPPORTED_QUARTERS)

export const devHoursPerk = (game: Game): number => 1 + 0.1 * perkLevel(game, 'night-shift')

export const platformTax = (game: Game): number =>
  platformStaffed(game) ? 0 : PLATFORM_TAX * liveClusters(game) + MESH_TAX * liveMeshes(game)

export type TeamOutput = Readonly<{
  team: Team
  headcount: number
  effective: number
  velocity: number
  devHoursPerSecond: number
}>

export const membersOf = (game: Game, team: Team): ReadonlyArray<Engineer> =>
  game.engineers.filter((engineer) => engineer.team === team.id)

export const teamOutputs = (
  game: Game,
  ledger: Ledger,
  tuning: Tuning = LIVE_TUNING,
): ReadonlyArray<TeamOutput> => {
  if (game.sandbox) return []
  const morale = game.time < game.moraleUntil ? LAYOFF_MORALE : 1
  const language = languageOfService(game)
  const outputs = game.teams.map((team, index) => {
    const owned = serviceOwnedBy(game, team)
    const members = membersOf(game, team)
    const founder = index === 0 ? FOUNDER_OUTPUT : 0
    const headcount = members.length + (index === 0 ? 1 : 0)
    const output = members.reduce(
      (sum, engineer) => sum + outputOf(game, engineer, tuning, language),
      founder,
    )
    const effective =
      headcount > 0
        ? (effectiveEngineers(headcount, coordinationOf(game), sharesDatabase(game, owned)) *
            output) /
          headcount
        : 0
    const velocity =
      ledger.velocity *
      (1 - 0.5 * owned.debt) *
      policyNow(game, team, tuning).velocity *
      morale *
      budgetVelocity(game)
    const upkeep = team.kind === 'product' ? 1 - upkeepShare(game, owned) : 1
    const ramp = teamReady(game, team) ? 1 : KIND_CHANGE_OUTPUT
    const rate =
      (effective *
        velocity *
        upkeep *
        DEV_HOURS_PER_DAY *
        tuning.calendarPace *
        devHoursPerk(game) *
        ramp) /
      CALENDAR_DAY
    return { team, headcount, effective, velocity, devHoursPerSecond: rate }
  })
  const tax = platformTax(game)
  if (tax <= 0) return outputs
  const product = outputs.filter((entry) => entry.team.kind === 'product')
  const engineers = product.reduce((sum, entry) => sum + entry.effective, 0)
  const kept = engineers > 0 ? Math.max(0, 1 - tax / engineers) : 0
  return outputs.map((entry) =>
    entry.team.kind === 'product'
      ? { ...entry, devHoursPerSecond: entry.devHoursPerSecond * kept }
      : entry,
  )
}

export const devHoursRate = (game: Game, ledger: Ledger, tuning: Tuning = LIVE_TUNING): number =>
  teamOutputs(game, ledger, tuning).reduce(
    (sum, entry) => sum + (teamBoosting(game, entry.team) ? 0 : entry.devHoursPerSecond),
    0,
  )

export const salaryOf = (game: Game, language: LanguageId): number =>
  SALARY_BASE_PER_SECOND * eraOf(game).salaryIndex * LANGUAGES[language].salary

export const payrollOf = (game: Game): number =>
  game.engineers.reduce((sum, engineer) => sum + payOf(game, engineer), 0)

export const signingOf = (game: Game, language: LanguageId): number =>
  Math.round(
    (SIGNING_BASE * LANGUAGES[language].salary * eraOf(game).salaryIndex) /
      (ERAS[1]?.salaryIndex ?? 1),
  )

export const pipelineOf = (game: Game): GameNode | null =>
  game.nodes.find((node) => node.type === 'ci') ?? null

export const deployStrategyOf = (game: Game): DeployStrategyDef | null => {
  const pipeline = pipelineOf(game)
  return pipeline ? DEPLOY_STRATEGIES[pipeline.strategy] : null
}

export const buildMinutesOf = (game: Game): number => {
  const { runtime, framework } = stackOf(game)
  const extra = RUNTIMES[runtime].build ?? 1
  const native = extra > 1 ? extra * (FRAMEWORKS[framework].nativeBuild ?? 1) : extra
  const cached = has(game, 'build-cache') ? BUILD_CACHE : 1
  return LANGUAGES[languageOfService(game)].buildMinutes * native * cached
}

export const deployMinutesOf = (game: Game): number => {
  const strategy = deployStrategyOf(game)
  return strategy
    ? strategy.deployMinutes
    : has(game, 'ci')
      ? CI_DEPLOY_MINUTES
      : MANUAL_DEPLOY_MINUTES
}

const PLATFORM_DEPLOY_FACTOR = 0.5

export const deploysPerDay = (game: Game, tuning: Tuning = LIVE_TUNING): number => {
  const team = game.teams[0]
  const policy = team ? policyNow(game, team, tuning) : POLICIES.balanced
  const deploy = deployMinutesOf(game) * (platformStaffed(game) ? PLATFORM_DEPLOY_FACTOR : 1)
  const build = buildMinutesOf(game)
  const base = Math.min(policy.deploysPerDay, WORK_MINUTES / (build + deploy + VERIFY_MINUTES))
  return base * (has(game, 'trunk-based') ? TRUNK_FREQUENCY : 1)
}

export const deployEvery = (game: Game, tuning: Tuning = LIVE_TUNING): number =>
  CALENDAR_DAY / deploysPerDay(game, tuning) / tuning.calendarPace

export const badDeployChance = (
  game: Game,
  tuning: Tuning = LIVE_TUNING,
  service: Service = serviceOf(game),
): number => {
  const team = ownerOf(game, service)
  const policy = policyNow(game, team, tuning)
  return (
    (BAD_DEPLOY_BASE[game.stage] ?? BAD_DEPLOY_BASE.at(-1) ?? 0) *
    policy.badDeploy *
    (1 + 2 * service.debt) *
    (has(game, 'testing-culture') ? 1 - TESTS_FACTOR : 1) *
    (has(game, 'code-review') ? 1 - CODE_REVIEW_FACTOR : 1) *
    (has(game, 'static-analysis') ? 1 - STATIC_ANALYSIS_FACTOR : 1) *
    (has(game, 'formal-verification') ? 1 - FORMAL_VERIFICATION_FACTOR : 1)
  )
}

export const nextBadDeployChance = (
  game: Game,
  tuning: Tuning = LIVE_TUNING,
  service: Service = serviceOf(game),
): number => {
  const base = badDeployChance(game, tuning, service)
  if (base <= 0) return 0
  const batch = awaitingFeatures(game).filter((id) => serviceOfFeature(game, id).id === service.id)
  const rush = batch.reduce((sum, id) => sum + RUSH_BUG_CHANCE * (game.rushedFeatures[id] ?? 0), 0)
  return Math.min(1, base + rush)
}

export type DoraMetrics = Readonly<{
  deploysPerDay: number
  leadTime: number
  changeFailureRate: number
  mttr: number | null
}>

export const doraMetrics = (game: Game, tuning: Tuning = LIVE_TUNING): DoraMetrics => {
  const recovered = game.postmortems.filter((entry) => entry.kind === 'bad-deploy')
  const mttr =
    recovered.length > 0
      ? recovered.reduce((sum, entry) => sum + entry.mttr, 0) / recovered.length
      : null
  return {
    deploysPerDay: deploysPerDay(game, tuning),
    leadTime: deployEvery(game, tuning),
    changeFailureRate: game.deploys > 0 ? game.badDeploys / game.deploys : 0,
    mttr,
  }
}

export const rolloutOf = (game: Game, feature: string): number => {
  const flags = game.nodes.some((node) => node.type === 'ff' && !isDown(node))
  const phase = game.features[feature]
  if (!flags || phase === undefined) return ROLLOUT_ALL
  return Math.max(0, Math.min(ROLLOUT_ALL, rolloutShareOf(phase)))
}

export const badDeployShareOf = (game: Game, service: Service): number => {
  const batch = service.lastDeploy
  const reached = batch.reduce((sum, feature) => sum + rolloutOf(game, feature), 0)
  return Math.min(
    deployStrategyOf(game)?.blast ?? BAD_DEPLOY_MAX,
    BAD_DEPLOY_ERRORS * Math.max(batch.length === 0 ? 1 : 0, reached),
  )
}

export const badDeployShare = (game: Game): number => badDeployShareOf(game, serviceOf(game))

export const enqueue = (
  game: Game,
  kind: WorkItem['kind'],
  ref: string,
  cost: number,
  top = false,
  extra: Pick<WorkItem, 'due' | 'target' | 'service' | 'step'> = {},
): Game => {
  const item: WorkItem = {
    id: game.workSeq + 1,
    kind,
    ref,
    cost,
    spent: 0,
    block: { _tag: 'Free' },
    answered: null,
    ...extra,
  }
  return {
    ...game,
    workSeq: game.workSeq + 1,
    backlog: top ? [item, ...game.backlog] : [...game.backlog, item],
  }
}

export const buggy = (game: Game, node: GameNode): boolean => {
  const migration = serviceOf(game).migration
  return (
    !Migration.guards.Idle(migration) &&
    migration.bugs &&
    node.type === 'server' &&
    node.runtime === migration.runtime &&
    node.framework === migration.framework
  )
}
