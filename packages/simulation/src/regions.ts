import { cosTurns } from './calendar.ts'
import {
  ABROAD_SEED,
  ANYCAST_MS,
  CALENDAR_START,
  DIURNAL_AMPLITUDE,
  HOME_REGION,
  HTTP3_CUT,
  REGIONS,
  REGIONS_FROM_STAGE,
  REGION_INFO,
  SPREAD_REGIONS,
  USER_ROUND_TRIPS,
  rttOf,
  GLOBAL_COMPONENTS,
  type RegionId,
} from './catalog.ts'
import { has, zoneMs } from './lookups.ts'
import type { Game, GameNode, PerRegion } from './state.ts'

export const isGlobal = (node: GameNode): boolean => GLOBAL_COMPONENTS.includes(node.type)

export const regional = (game: Game): boolean => game.stage >= REGIONS_FROM_STAGE

export const openRegions = (game: Game): ReadonlyArray<RegionId> =>
  REGIONS.filter(
    (region) =>
      region === HOME_REGION ||
      game.nodes.some((node) => node.type === 'users' && node.region === region),
  )

export const usersOf = (game: Game, region: RegionId): GameNode | undefined =>
  game.nodes.find((node) => node.type === 'users' && node.region === region) ??
  (region === HOME_REGION ? game.nodes.find((node) => node.type === 'users') : undefined)

export const regionDiurnal = (time: number, region: RegionId): number => {
  const minute = (CALENDAR_START + time + REGION_INFO[region].offset) % 1440
  return 1 + DIURNAL_AMPLITUDE * cosTurns((minute - 20 * 60) / 1440)
}

export const perRegion = (figure: (region: RegionId) => number): PerRegion =>
  Object.fromEntries(REGIONS.map((region) => [region, figure(region)])) as PerRegion

export const MARKET_SHARES: PerRegion = perRegion((region) => REGION_INFO[region].share)

const AT_HOME: PerRegion = perRegion((region) => (region === HOME_REGION ? 1 : 0))

export const userSharesOf = (game: Game): PerRegion =>
  game.userShares ?? (regional(game) ? MARKET_SHARES : AT_HOME)

export const regionUsers = (game: Game): PerRegion => {
  const shares = userSharesOf(game)
  return perRegion((region) => game.users * shares[region])
}

export const withRegionUsers = (game: Game, users: PerRegion): Game => {
  const total = REGIONS.reduce((sum, region) => sum + users[region], 0)
  if (total <= 0) return { ...game, users: 0 }
  return { ...game, users: total, userShares: perRegion((region) => users[region] / total) }
}

export const goGlobal = (game: Game): Game => {
  const seed = (region: RegionId): number =>
    (ABROAD_SEED * game.users * REGION_INFO[region].share) / REGION_INFO[HOME_REGION].share
  return withRegionUsers(
    game,
    perRegion((region) => (region === HOME_REGION ? game.users : seed(region))),
  )
}

export const regionApdexOf = (game: Game, region: RegionId): number =>
  game.regionApdex?.[region] ?? game.apdex

export const regionalCycle = (time: number, shares: PerRegion = MARKET_SHARES): number => {
  let sum = 0
  for (const region of REGIONS) sum += shares[region] * regionDiurnal(time, region)
  return sum
}

export const regionShares = (game: Game): ReadonlyArray<readonly [RegionId, number]> => {
  if (!regional(game)) return [[HOME_REGION, 1]]
  const shares = userSharesOf(game)
  const weights = REGIONS.map(
    (region) =>
      [
        region,
        shares[region] *
          (game.sandbox && !game.scenario?.daily ? 1 : regionDiurnal(game.time, region)),
      ] as const,
  )
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0)
  return weights.map(([region, weight]) => [region, total > 0 ? weight / total : 0] as const)
}

export const outRegion = (game: Game): RegionId | null =>
  (game.incident?.kind === 'region' || game.incident?.kind === 'dr-drill') &&
  game.incident.region !== null
    ? game.incident.region
    : null

export const userRttMs = (game: Game, from: RegionId, to: RegionId): number => {
  const rtt = rttOf(from, to) * USER_ROUND_TRIPS
  if (rtt <= 0) return rtt
  const cut = has(game, 'http3') ? rtt * (1 - HTTP3_CUT) : rtt
  return has(game, 'anycast') ? Math.max(0, cut - ANYCAST_MS) : cut
}

export type UserRoute = Readonly<{
  region: RegionId
  source: GameNode | undefined
  share: number
  extraMs: number
}>

export const userRoutes = (
  game: Game,
  leadsSomewhere: (node: GameNode) => boolean,
): ReadonlyArray<UserRoute> => {
  const home = usersOf(game, HOME_REGION)
  const down = outRegion(game)
  const geo = has(game, 'geo-dns')
  const candidates = geo
    ? REGIONS.flatMap((region) => {
        const source = game.nodes.find(
          (node) => node.type === 'users' && node.region === region && region !== down,
        )
        return source && leadsSomewhere(source) ? [source] : []
      })
    : []
  return regionShares(game).map(([region, share]) => {
    const nearest = candidates.reduce<GameNode | undefined>(
      (best, node) =>
        !best || rttOf(region, node.region) < rttOf(region, best.region) ? node : best,
      undefined,
    )
    const source = nearest ?? home
    return {
      region,
      source,
      share,
      extraMs: source ? userRttMs(game, region, source.region) : 0,
    }
  })
}

export const placeMs = (game: Game, from: GameNode, to: GameNode): number => {
  if (isGlobal(from) || isGlobal(to)) return 0
  if (
    to.type === 'wide' &&
    to.spread &&
    spreadRegions(game, to, SPREAD_REGIONS).includes(from.region)
  )
    return 0
  if (from.region !== to.region)
    return from.type === 'users'
      ? userRttMs(game, from.region, to.region)
      : rttOf(from.region, to.region)
  return zoneMs(from, to)
}

export const survivesRegion = (game: Game, node: GameNode): boolean =>
  isGlobal(node) ||
  node.type === 'users' ||
  (node.type === 'wide' && node.spread && openRegions(game).length >= 2) ||
  (node.type === 'dsql' && node.spread && openRegions(game).length >= 3)

export const spreadRegions = (game: Game, node: GameNode, limit: number): ReadonlyArray<RegionId> =>
  node.spread
    ? openRegions(game)
        .toSorted((a, b) => rttOf(node.region, a) - rttOf(node.region, b))
        .slice(0, limit)
    : [node.region]

export const regionView = (game: Game, region: RegionId): Game => {
  const own = (node: GameNode): boolean =>
    node.region === region || ((node.type === 'wide' || node.type === 'dsql') && node.spread)
  const shown = new Set(game.nodes.filter(own).map((node) => node.id))
  const local = new Set(
    game.nodes.filter((node) => node.region === region && !isGlobal(node)).map((node) => node.id),
  )
  for (const link of game.links) if (local.has(link.from)) shown.add(link.to)
  if (shown.size === game.nodes.length) return game
  return {
    ...game,
    nodes: game.nodes.filter((node) => shown.has(node.id)),
    links: game.links.filter((link) => shown.has(link.from) && shown.has(link.to)),
  }
}
