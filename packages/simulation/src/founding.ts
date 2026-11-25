import {
  CALENDAR_DAY,
  CHAOS_FROM_STAGE,
  CHAOS_WEIGHT,
  COMPONENTS,
  ERAS,
  HN_WEIGHT,
  HOME_REGION,
  LANGUAGES,
  MONOLITH_DEBT,
  MONOLITH_KLOC,
  MUTATORS,
  MUTATOR_BANS,
  OPEN_ACTION_WEIGHT,
  PERKS,
  RESEARCH,
  RUNTIMES,
  SLO_LEVELS,
  STEAL_MAX,
  STEAL_SECONDS,
  VENTURES,
  type ComponentId,
  type IncidentId,
  type LanguageId,
  type MutatorId,
  type ResearchId,
  type RuntimeId,
  type VentureDef,
} from './catalog.ts'
import { nextRandom } from './random.ts'
import { headStartGame, newGame } from './company.ts'
import { restarting, type Life } from './life.ts'
import { perkLevel, sreStaffed } from './lookups.ts'
import { NEW_ENGINEER } from './state.ts'
import type { Founding, Game, GameNode, RegionId, Retries } from './state.ts'

export { perkLevel }

export const ventureOf = (game: Game): VentureDef =>
  game.sandbox ? VENTURES['b2b-saas'] : VENTURES[game.founding.venture]

export const stealOf = (game: Game, node: GameNode): number => {
  if (!hasMutator(game, 'shared-tenancy')) return 0
  let hash = game.seed
  for (const char of node.id) hash = (hash * 31 + char.charCodeAt(0)) % 2_147_483_647
  const [first] = nextRandom((hash + Math.floor(game.time / STEAL_SECONDS) * 7_919) % 2_147_483_647)
  const [roll] = nextRandom(Math.floor(first * 2_147_483_647))
  return STEAL_MAX * roll
}

export const hasMutator = (game: Game, id: MutatorId): boolean =>
  !game.sandbox && game.founding.mutators.includes(id)

export const legacyMultiplier = (founding: Founding): number =>
  VENTURES[founding.venture].legacy *
  (1 + founding.mutators.reduce((sum, id) => sum + MUTATORS[id].legacy, 0))

export const angelFactor = (level: number): number => {
  let factor = 1
  for (let index = 0; index < level; index += 1) factor *= 2
  return factor
}

export const insightPerk = (game: Game): number => 1 + 0.2 * perkLevel(game, 'pattern-recognition')
export const growthPerk = (game: Game): number => 1 + 0.1 * perkLevel(game, 'founders-reputation')

export const dilutionOf = (game: Game, dilution: number): number =>
  Math.max(0, dilution - 0.02 * perkLevel(game, 'better-terms'))

export const grantOf = (game: Game, grant: number): number =>
  hasMutator(game, 'tight-budget') ? grant / 2 : grant

export const openActionWeight = (game: Game): number => {
  let excess = OPEN_ACTION_WEIGHT - 1
  for (let level = 0; level < perkLevel(game, 'war-stories'); level += 1) excess /= 2
  if (sreStaffed(game)) excess /= 2
  return 1 + excess
}

export const mutatorWeight = (game: Game, kind: IncidentId): number =>
  (kind === 'spike' && hasMutator(game, 'hn-front-page') ? HN_WEIGHT : 1) *
  (kind === 'spike' ? ventureOf(game).constraint.spikeWeight : 1) *
  (kind === 'instance' && hasMutator(game, 'chaos-monkey') && game.stage >= CHAOS_FROM_STAGE
    ? CHAOS_WEIGHT
    : 1)

export const FOUNDING_LANGUAGE: LanguageId = 'php'

export const placeRefusal = (game: Game, type: ComponentId, region: RegionId): string | null => {
  for (const id of game.founding.mutators) {
    if (game.sandbox) break
    if (MUTATOR_BANS[id]?.includes(type))
      return `${MUTATORS[id].name}: no ${COMPONENTS[type].name}.`
  }
  if (region !== HOME_REGION && hasMutator(game, 'one-region'))
    return `${MUTATORS['one-region'].name}: the home region only.`
  return venturePlaceRefusal(game, type, region)
}

export const SIGNATURE_WEIGHT = 4
export const SIGNATURE_WEAKNESS = 2

export const signatureOf = (game: Game): IncidentId | null => ventureOf(game).signature

export const isSignature = (game: Game, kind: IncidentId): boolean =>
  !game.sandbox && signatureOf(game) === kind

export const signatureWeight = (game: Game, kind: IncidentId): number =>
  isSignature(game, kind) ? SIGNATURE_WEIGHT : 1

export const signatureWeakness = (game: Game, kind: IncidentId): number =>
  isSignature(game, kind) ? SIGNATURE_WEAKNESS : 0

export const venturePlaceRefusal = (
  game: Game,
  type: ComponentId,
  region: RegionId,
): string | null => {
  const venture = ventureOf(game)
  const { residency, hubsPerRegion, gpus } = venture.constraint
  if (gpus > 0 && type === 'gpu') {
    const held = game.nodes.filter((node) => node.type === 'gpu').length
    if (held >= gpus) return `${venture.name}: GPUs are scarce, ${gpus} GPU Nodes at most.`
  }
  if (
    hubsPerRegion !== null &&
    game.stage >= hubsPerRegion &&
    type === 'ws' &&
    game.nodes.some((node) => node.type === 'ws' && node.region === region)
  ) {
    const from = ERAS[hubsPerRegion]?.name ?? 'here'
    return `${venture.name}: one Realtime Hub per region from ${from}.`
  }
  if (residency === null || game.stage < residency || region === HOME_REGION) return null
  if (COMPONENTS[type].group !== 'data') return null
  return `${venture.name}: data stays in the home region from ${ERAS[residency]?.name ?? 'here'}.`
}

export const retryRefusal = (game: Game, retries: Retries): string | null => {
  const venture = ventureOf(game)
  return venture.constraint.noNaiveRetries && retries === 'naive'
    ? `${venture.name}: customers write their own retry loops.`
    : null
}

export const placedLife = (game: Game, node: GameNode): Life =>
  ventureOf(game).constraint.procurement ? restarting(CALENDAR_DAY, 'restart', 0) : node.life

export const runtimeRefusal = (game: Game, runtime: RuntimeId): string | null => {
  const venture = ventureOf(game)
  const languages = venture.constraint.languages
  if (languages !== null && !languages.includes(RUNTIMES[runtime].language)) {
    const names = languages.map((id) => LANGUAGES[id].name).join(' or ')
    return `${venture.name}: the service runs ${names}.`
  }
  return hasMutator(game, 'single-language') && RUNTIMES[runtime].language !== FOUNDING_LANGUAGE
    ? `${MUTATORS['single-language'].name}: every App Server runs PHP.`
    : null
}

const stricterSlo = (slo: number): number => SLO_LEVELS.find((level) => level > slo) ?? slo

export const sloOf = (game: Game, slo: number): number => {
  const sla = game.sandbox ? null : ventureOf(game).constraint.sla
  const signed = sla !== null && game.stage >= sla
  return hasMutator(game, 'strict-slo') || signed ? stricterSlo(slo) : slo
}

const startBoard = (seed: number, founding: Founding): Game => {
  const venture = VENTURES[founding.venture]
  const headStart = Math.min(PERKS['head-start'].costs.length, founding.perks['head-start'] ?? 0)
  if (headStart >= 1 || venture.start.stage >= 1) return headStartGame(seed, headStart)
  const garage = newGame(seed)
  return { ...garage, cash: venture.start.cash, equity: venture.start.equity }
}

const ventureStart = (game: Game, venture: VentureDef): Game => {
  const { runtime, researched } = venture.start
  if (runtime === null && researched.length === 0) return game
  const firstServer = game.nodes.find((node) => node.type === 'server')?.id ?? null
  const known = researched.filter((id) => !game.researched.includes(id))
  return {
    ...game,
    researched: [...game.researched, ...known],
    nodes:
      runtime === null
        ? game.nodes
        : game.nodes.map((node) =>
            node.id === firstServer ? { ...node, framework: 'none', runtime } : node,
          ),
  }
}

export const foundCompany = (
  seed: number,
  founding: Founding,
  keep: ReadonlyArray<ResearchId> = [],
): Game => {
  const venture = VENTURES[founding.venture]
  const start = startBoard(seed, founding)
  const founded: Game = ventureStart({ ...start, founding }, venture)
  const kept = keep.filter((id) => RESEARCH[id] && !founded.researched.includes(id))
  const monolith = founding.mutators.includes('legacy-monolith')
  const service = founded.services[0]
  const alumni = founded.stage >= 1 ? perkLevel(founded, 'alumni-network') : 0
  return {
    ...founded,
    cash: founded.cash * angelFactor(perkLevel(founded, 'angel-network')),
    researched: [...founded.researched, ...kept],
    equity: venture.bootstrapped ? 1 : founded.equity,
    services:
      monolith && service
        ? [
            { ...service, codebase: MONOLITH_KLOC, debt: MONOLITH_DEBT },
            ...founded.services.slice(1),
          ]
        : founded.services,
    engineers: [...founded.engineers, ...alumniOf(founded, alumni)],
    workSeq: founded.workSeq + alumni,
  }
}

export const alumniOf = (game: Game, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `e${game.workSeq + index + 1}`,
    team: game.teams[0]?.id ?? 'core',
    language: FOUNDING_LANGUAGE,
    hiredAt: Number.MIN_SAFE_INTEGER,
    ...NEW_ENGINEER,
  }))

export const startEra = (founding: Founding): string =>
  ERAS[Math.min(PERKS['head-start'].costs.length, founding.perks['head-start'] ?? 0)]?.name ?? ''
