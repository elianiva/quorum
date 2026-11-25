import { Match } from 'effect'
import {
  ALERT_RULES,
  CASCADE_FROM_STAGE,
  CASCADES,
  CALENDAR_DURATION,
  COMPONENTS,
  ERAS,
  ESCALATION,
  FAILOVER_SECONDS,
  INCIDENTS,
  INCIDENT_GAP_SECONDS,
  INCIDENT_IDS,
  LEAK_RATE,
  MIN_WEAKNESS,
  ON_CALL_ACK,
  POD_RESCHEDULE_SECONDS,
  RUNTIMES,
  SECURITY_TEAM_SUPPLY_CHAIN,
  SLO_FROM_STAGE,
  SPOT_WARNING,
  SRE_MTTR,
  STORM_TRIGGER,
  SPIKE_MAGNITUDE,
  SUPPLY_CHAIN_CHURN,
  PAGE_LEAK_CHURN,
  CACHE_KEYS,
  DB_ENGINES,
  MIGRATION_LOCK_PER_GB,
  RESTORE_MIN_MINUTES,
  RESTORE_MINUTES_PER_GB,
  WARMED,
  type ComponentId,
  type IncidentId,
  type ResearchId,
  HOME_REGION,
} from './catalog.ts'
import { StepEvent, type AlertRule } from './events.ts'
import { mutatorWeight, openActionWeight, signatureWeakness, signatureWeight } from './founding.ts'
import type { Ledger } from './ledger.ts'
import {
  clusterOf,
  eraOf,
  has,
  isDown,
  podsOf,
  pricingOf,
  ramOf,
  researchReady,
  restarted,
  securityStaffed,
  sreStaffed,
  zoned,
  rampedOf,
} from './lookups.ts'
import {
  IncidentPhase,
  ackIncident,
  hasAck,
  incidentPhaseOf,
  signalIncident,
  signalAtOf,
  ackAtOf,
  step as incidentStateStep,
  resolveIncident,
  beginIncident,
} from './incident-machine.ts'
import { step as featureStep } from './feature-machine.ts'
import { nodeLabel } from './labels.ts'

export { zoned }
import { Life, causeOf, down as takeDown, withWarm } from './life.ts'
import { drillPassed, step as drillStep } from './drill-machine.ts'
import { PROMOTE_DATA_LOSS } from './generated/replica.ts'
import { nextRandom, pickWeighted } from './random.ts'
import type { Game, GameLink, GameNode, Incident, Postmortem, RegionId, Zone } from './state.ts'
import { activeIncident } from './state.ts'
import { isGlobal, survivesRegion } from './regions.ts'
import {
  fixed,
  platformStaffed,
  quartersBehind,
  serviceOf,
  serviceOfId,
  withServiceId,
} from './team.ts'

export const incidentDuration = (game: Game, kind: IncidentId, node?: GameNode): number => {
  const def = INCIDENTS[kind]
  const clock = (): number => {
    if (kind === 'retry-storm') return game.sandbox ? SANDBOX_STORM : def.duration
    if (kind === 'spot-reclaim') return def.duration
    if (kind === 'migration-lock') {
      const migration = node?.type === 'database' ? DB_ENGINES[node.dbEngine].migration : 1
      return Math.min(
        def.duration * 4,
        def.duration + game.data * MIGRATION_LOCK_PER_GB * migration,
      )
    }
    return !game.sandbox && game.stage >= SLO_FROM_STAGE
      ? Math.min(def.duration, CALENDAR_DURATION[def.severity])
      : def.duration
  }
  return clock() * (sreStaffed(game) ? 1 - SRE_MTTR : 1)
}

export const restoreSeconds = (game: Game, backup: GameNode['backup']): number =>
  RESTORE_MIN_MINUTES + game.data * RESTORE_MINUTES_PER_GB * (backup === 'pitr' ? 2 : 1)

const SANDBOX_STORM = 3_600

export const failoverSeconds = (game: Game): number =>
  (FAILOVER_SECONDS * incidentDuration(game, 'zone')) / INCIDENTS.zone.duration

export const rescheduleSeconds = (game: Game): number =>
  (POD_RESCHEDULE_SECONDS * incidentDuration(game, 'instance')) / INCIDENTS.instance.duration

const REPEAT_WEIGHT = 0.3

const busy = (ledger: Ledger, node: GameNode): boolean => (ledger.nodes[node.id]?.inbound ?? 0) > 0

const busiest = (game: Game, ledger: Ledger, type: ComponentId): GameNode | undefined =>
  game.nodes
    .filter((node) => node.type === type && !isDown(node) && busy(ledger, node))
    .reduce<GameNode | undefined>(
      (best, node) =>
        !best || (ledger.nodes[node.id]?.inbound ?? 0) > (ledger.nodes[best.id]?.inbound ?? 0)
          ? node
          : best,
      undefined,
    )

const retriesInto = (game: Game, type: ComponentId): ReadonlyArray<GameLink['retries']> =>
  has(game, 'timeouts')
    ? game.links
        .filter((link) => game.nodes.some((node) => node.id === link.to && node.type === type))
        .map((link) => link.retries)
    : []

const gcTargets = (game: Game, ledger: Ledger): ReadonlyArray<readonly [GameNode, number]> =>
  game.nodes
    .filter(
      (node) =>
        node.type === 'server' &&
        RUNTIMES[node.runtime].gc !== null &&
        !isDown(node) &&
        busy(ledger, node),
    )
    .map((node) => {
      const ram = ledger.nodes[node.id]?.resources.ramGb
      const heap = ram && ram.total > 0 ? ram.used / ram.total : 0
      return [node, heap > 0.9 ? 3 : heap > 0.7 ? 1.5 : 0.3] as const
    })

const gpuTargets = (game: Game, ledger: Ledger): ReadonlyArray<readonly [GameNode, number]> =>
  game.nodes
    .filter((node) => node.type === 'gpu' && !isDown(node) && busy(ledger, node))
    .map((node) => [node, node.gpu === 'h100' ? 3 : 1] as const)

const spotTargets = (game: Game, ledger: Ledger): ReadonlyArray<GameNode> =>
  game.nodes.filter(
    (node) => pricingOf(game, node) === 'spot' && !isDown(node) && busy(ledger, node),
  )

const wsTargets = (game: Game, ledger: Ledger): ReadonlyArray<GameNode> =>
  game.nodes.filter((node) => node.type === 'ws' && !isDown(node) && busy(ledger, node))

const autoscaled = (game: Game): ReadonlyArray<GameNode> =>
  game.nodes.filter(
    (node) =>
      (node.type === 'server' || node.type === 'worker') &&
      game.links.some((link) => {
        if (link.from !== node.id) return false
        const target = game.nodes.find((entry) => entry.id === link.to)
        return target?.type === 'autoscaler' && !isDown(target)
      }),
  )

const autoscalerInto = (game: Game, node: GameNode): boolean =>
  game.links.some((link) => {
    if (link.from !== node.id) return false
    const target = game.nodes.find((entry) => entry.id === link.to)
    return target?.type === 'autoscaler' && !isDown(target)
  })

const javaTargets = (game: Game, ledger: Ledger): ReadonlyArray<readonly [GameNode, number]> =>
  game.nodes
    .filter(
      (node) =>
        node.type === 'server' &&
        RUNTIMES[node.runtime].language === 'java' &&
        RUNTIMES[node.runtime].warmup > 0 &&
        !isDown(node) &&
        busy(ledger, node),
    )
    .map((node) => [node, rampedOf(game, node) ? 0.3 : autoscalerInto(game, node) ? 3 : 1] as const)

const stackTargets = (
  game: Game,
  ledger: Ledger,
  hit: (node: GameNode) => boolean,
): ReadonlyArray<GameNode> =>
  game.nodes.filter(
    (node) => node.type === 'server' && hit(node) && !isDown(node) && busy(ledger, node),
  )

const opcacheTargets = (game: Game, ledger: Ledger): ReadonlyArray<GameNode> =>
  has(game, 'opcache')
    ? stackTargets(game, ledger, (node) => RUNTIMES[node.runtime].language === 'php')
    : []

const clusterHubs = (game: Game, ledger: Ledger): ReadonlyArray<GameNode> =>
  has(game, 'distributed-erlang')
    ? game.nodes.filter(
        (node) =>
          node.type === 'ws' &&
          RUNTIMES[node.runtime].language === 'elixir' &&
          !isDown(node) &&
          busy(ledger, node),
      )
    : []

const runtimeTarget = (
  game: Game,
  ledger: Ledger,
  kind: IncidentId,
  roll: number,
): GameNode | undefined => {
  const targets =
    kind === 'stale-opcache'
      ? opcacheTargets(game, ledger)
      : kind === 'bun-compat'
        ? stackTargets(game, ledger, (node) => node.runtime === 'bun')
        : kind === 'gevent-compat'
          ? stackTargets(game, ledger, (node) => node.runtime === 'gevent')
          : kind === 'split-brain'
            ? clusterHubs(game, ledger)
            : []
  return targets[Math.floor(roll * targets.length)]
}

const DATA_TYPES: ReadonlyArray<ComponentId> = ['database', 'replica', 'wide', 'dsql', 'doc']

const dataTarget = (game: Game, ledger: Ledger): GameNode | undefined =>
  DATA_TYPES.map((type) => busiest(game, ledger, type)).find((node) => node !== undefined)

const leakyCdns = (game: Game, ledger: Ledger): ReadonlyArray<GameNode> =>
  has(game, 'esi')
    ? game.nodes.filter(
        (node) =>
          node.type === 'cdn' && node.cacheKey !== 'full' && !isDown(node) && busy(ledger, node),
      )
    : []

const instanceTargets = (game: Game, ledger: Ledger): ReadonlyArray<readonly [GameNode, number]> =>
  game.nodes
    .filter((node) => COMPONENTS[node.type].limiting && !isDown(node) && busy(ledger, node))
    .map((node) => {
      const copies = game.nodes.filter((other) => other.type === node.type).length
      return [node, copies === 1 ? 3 : 0.5] as const
    })

const leakTargets = (game: Game, ledger: Ledger): ReadonlyArray<GameNode> =>
  game.nodes.filter(
    (node) =>
      node.type === 'server' &&
      RUNTIMES[node.runtime].persistent &&
      !node.recycle &&
      !isDown(node) &&
      busy(ledger, node),
  )

const hasNode = (game: Game, type: ComponentId): boolean =>
  game.nodes.some((node) => node.type === type && !isDown(node))

const cacheTargets = (game: Game, ledger: Ledger): ReadonlyArray<GameNode> =>
  game.nodes.filter((node) => node.type === 'cache' && !isDown(node) && busy(ledger, node))

const clusterTargets = (game: Game): ReadonlyArray<readonly [GameNode, number]> =>
  platformStaffed(game)
    ? []
    : game.nodes
        .filter(
          (node) =>
            node.type === 'cluster' &&
            !isDown(node) &&
            podsOf(game, node).length > 0 &&
            quartersBehind(game, node) > 0,
        )
        .map((node) => [node, Math.min(3, 1 + quartersBehind(game, node))] as const)

const poisonTargets = (game: Game): ReadonlyArray<GameNode> =>
  game.nodes.filter((node) => node.type === 'queue' && !node.dlq)

export const fragileZones = (game: Game): ReadonlyArray<Zone> => {
  const live = game.nodes.filter((node) => zoned(node) && !isDown(node))
  const zones = new Set<Zone>()
  for (const node of live) {
    if (node.standby) continue
    const copies = live.filter((other) => other.type === node.type)
    if (copies.every((other) => other.zone === node.zone)) zones.add(node.zone)
  }
  return [...zones].toSorted()
}

const crossRegionLinks = (game: Game): number =>
  game.links.filter((link) => {
    const from = game.nodes.find((node) => node.id === link.from)
    const to = game.nodes.find((node) => node.id === link.to)
    return (
      from &&
      to &&
      from.region !== to.region &&
      !isGlobal(from) &&
      !isGlobal(to) &&
      from.type !== 'users'
    )
  }).length

const hotKeyTargets = (game: Game, ledger: Ledger): ReadonlyArray<GameNode> =>
  game.nodes.filter(
    (node) =>
      (node.type === 'cache' || node.type === 'wide') && !isDown(node) && busy(ledger, node),
  )

const configured = (node: GameNode): boolean => node.type === 'server' || node.type === 'worker'

const configRegion = (game: Game): RegionId | null => {
  const source = game.mirrors[0]?.source
  if (source) return source
  const counts = new Map<RegionId, number>()
  for (const node of game.nodes)
    if (configured(node) && !isDown(node))
      counts.set(node.region, (counts.get(node.region) ?? 0) + 1)
  return (
    [...counts.entries()].reduce<readonly [RegionId, number] | undefined>(
      (best, entry) => (!best || entry[1] > best[1] ? entry : best),
      undefined,
    )?.[0] ?? null
  )
}

export const configReach = (game: Game, region: RegionId): ReadonlyArray<RegionId> =>
  game.iac._tag === 'Chosen' && game.iac.sync === 'all'
    ? [
        region,
        ...game.mirrors.filter((mirror) => mirror.source === region).map((mirror) => mirror.region),
      ]
    : [region]

const busiestRegion = (game: Game): RegionId | undefined => {
  const counts = new Map<RegionId, number>()
  for (const node of game.nodes)
    if (!survivesRegion(game, node) && !isDown(node))
      counts.set(node.region, (counts.get(node.region) ?? 0) + 1)
  return [...counts.entries()].reduce<readonly [RegionId, number] | undefined>(
    (best, entry) => (!best || entry[1] > best[1] ? entry : best),
    undefined,
  )?.[0]
}

export const weaknessOf = (game: Game, ledger: Ledger, kind: IncidentId): number => {
  if (INCIDENTS[kind].era > game.stage) return 0
  const weakness = Math.max(rawWeakness(game, ledger, kind), signatureWeakness(game, kind))
  return weakness > 0 ? Math.max(MIN_WEAKNESS, weakness) : 0
}

const rawWeakness = (game: Game, ledger: Ledger, kind: IncidentId): number => {
  const weakness: Record<IncidentId, () => number> = {
    spike: () => {
      const hottest = Math.max(
        0,
        ...game.nodes
          .filter((node) => COMPONENTS[node.type].limiting)
          .map((node) => ledger.nodes[node.id]?.utilization ?? 0),
      )
      return hottest > 0.5 ? 2 : 1
    },
    instance: () => Math.max(0, ...instanceTargets(game, ledger).map(([, weight]) => weight)),
    connections: () => {
      if (game.nodes.some((node) => node.type === 'pooler')) return 0.1
      const fullest = Math.max(
        0,
        ...Object.values(ledger.nodes).map((entry) =>
          entry.connections ? entry.connections.used / entry.connections.max : 0,
        ),
      )
      return fullest > 0.5 ? 2.5 : fullest > 0.2 ? 0.8 : 0
    },
    loop: () =>
      !has(game, 'libuv-pool') &&
      game.nodes.some(
        (node) =>
          node.type === 'server' && RUNTIMES[node.runtime].model === 'loop' && busy(ledger, node),
      ) &&
      (ledger.kinds.login?.rate ?? 0) > 0
        ? 3
        : 0,
    leak: () =>
      leakTargets(game, ledger).length > 0 && !(fixed(game, 'fix-leak') && !game.sandbox) ? 2 : 0,
    'slow-query': () =>
      game.nodes.some((node) => node.type === 'database' && busy(ledger, node))
        ? 1.5 * (1 + Math.max(0, ...game.services.map((service) => service.shapes)))
        : 0,
    'bad-deploy': () => 0,
    'bot-surge': () => (hasNode(game, 'waf') ? 0.5 : 2),
    ddos: () => (hasNode(game, 'waf') ? 0.5 : 1.5),
    stuffing: () =>
      (ledger.kinds.login?.rate ?? 0) > 0
        ? hasNode(game, 'waf')
          ? has(game, 'credential-protection')
            ? 0.25
            : 0.5
          : 2
        : 0,
    stampede: () =>
      cacheTargets(game, ledger).some(
        (node) => !(node.coalesce && has(game, 'stampede-protection')),
      )
        ? 2
        : cacheTargets(game, ledger).length > 0
          ? 0.5
          : 0,
    poison: () => (poisonTargets(game).length > 0 ? 2 : 0),
    certificate: () => (has(game, 'cert-automation') ? 0 : 0.5),
    'psp-outage': () =>
      game.nodes.some(
        (node) => node.type === 'psp' && node.provider === 'first' && busy(ledger, node),
      )
        ? 1
        : 0,
    zone: () =>
      game.nodes.some((node) => zoned(node) && !isDown(node))
        ? fragileZones(game).length > 0
          ? has(game, 'multi-az')
            ? 3
            : 0.5
          : 0.2
        : 0,
    'disk-full': () => (busiest(game, ledger, 'database') ? 1 : 0),
    'repl-lag': () =>
      game.nodes.some((node) => node.type === 'replica' && busy(ledger, node))
        ? game.nodes.some((node) => node.type === 'server' && node.ryw) && has(game, 'ryw-routing')
          ? 0.3
          : 2
        : 0,
    'gc-storm': () => Math.max(0, ...gcTargets(game, ledger).map(([, weight]) => weight)),
    'latency-regression': () => 0,
    'deadline-day': () => 0,
    'hot-shard': () => 0,
    'premiere-spike': () => 0,
    'launch-day': () => 0,
    'flash-sale': () => 0,
    'retry-storm': () => {
      if (!busiest(game, ledger, 'database')) return 0
      const retries = retriesInto(game, 'database')
      return retries.includes('naive') ? 3 : retries.includes('backoff') ? 0.5 : 0.2
    },
    'double-charge': () =>
      game.nodes.some((node) => node.type === 'psp' && busy(ledger, node)) &&
      retriesInto(game, 'psp').some((retry) => retry !== 'none') &&
      !(has(game, 'idempotency-keys') && fixed(game, 'idempotency-keys'))
        ? 2.5
        : 0,
    'report-db': () =>
      (ledger.kinds.report?.rate ?? 0) > 0 && busiest(game, ledger, 'database')
        ? hasNode(game, 'warehouse')
          ? 0
          : 3
        : 0,
    'gpu-shortage': () =>
      gpuTargets(game, ledger).length > 0 ? (hasNode(game, 'llm') ? 0.5 : 2) : 0,
    'spot-reclaim': () => (spotTargets(game, ledger).length > 0 ? 1.5 : 0),
    'stale-read': () => {
      const targets = cacheTargets(game, ledger).filter(
        (node) => (ledger.nodes[node.id]?.traffic['q-write'] ?? 0) > 0,
      )
      if (targets.length === 0) return 0
      return targets.some((node) => node.ttl >= 3_600) ? 2 : 1
    },
    reconnect: () => {
      const targets = wsTargets(game, ledger)
      if (targets.length === 0) return 0
      return targets.some((node) => !node.backoff) ? 2 : 0.5
    },
    'runaway-bill': () => (autoscaled(game).length > 0 ? 2 : 0),
    mtu: () => ((ledger.kinds.upload?.rate ?? 0) > 0 ? 1.5 : 0),
    regex: () => (hasNode(game, 'waf') ? 1 : 0),
    region: () => {
      const bound = game.nodes.filter((node) => !survivesRegion(game, node) && !isDown(node))
      if (bound.length === 0) return 0
      const regions = new Set(bound.map((node) => node.region))
      return regions.size === 1 ? (has(game, 'multi-region') ? 3 : 0.5) : 0.3
    },
    partition: () => (crossRegionLinks(game) > 0 ? (hasNode(game, 'dsql') ? 0.5 : 2) : 0),
    'hot-key': () => {
      const targets = hotKeyTargets(game, ledger)
      if (targets.length === 0 || (ledger.kinds.feed?.rate ?? 0) <= 0) return 0
      return targets.every((node) => node.split) && has(game, 'hybrid-fanout') ? 0.3 : 2
    },
    bgp: () => 0.2,
    config: () => (has(game, 'infra-as-code') && configRegion(game) !== null ? 1 : 0),
    audit: () => (drillPassed(game.drill) && !has(game, 'security-team') ? 1.5 : 0),
    'dr-drill': () => 0,
    breach: () => 0,
    'credential-leak': () => 0,
    'cluster-upgrade': () => Math.max(0, ...clusterTargets(game).map(([, weight]) => weight)),
    'jvm-warmup': () => Math.max(0, ...javaTargets(game, ledger).map(([, weight]) => weight)),
    'migration-lock': () => {
      const database = busiest(game, ledger, 'database')
      if (!database) return 0
      const base = has(game, 'expand-contract') ? 0 : has(game, 'online-migrations') ? 0.3 : 2.5
      return base * DB_ENGINES[database.dbEngine].migration
    },
    'supply-chain': () =>
      game.nodes.some((node) => node.type === 'server' && busy(ledger, node))
        ? (has(game, 'dependency-scanning') ? 0.5 : 2) *
          (securityStaffed(game) ? SECURITY_TEAM_SUPPLY_CHAIN : 1)
        : 0,
    'accidental-delete': () => {
      const database = busiest(game, ledger, 'database')
      if (!database) return 0
      if (database.backup === 'none' || database.restore === 'failed') return 3
      return has(game, 'restore-drills') ? 0.5 : 1
    },
    'table-bloat': () => {
      const database = busiest(game, ledger, 'database')
      if (!database || !DB_ENGINES[database.dbEngine].bloat) return 0
      return database.keep === 'keep' ? 1.5 : 0.5
    },
    'stale-opcache': () =>
      opcacheTargets(game, ledger).length > 0 ? (has(game, 'ci') ? 0.3 : 1.5) : 0,
    'bun-compat': () =>
      stackTargets(game, ledger, (node) => node.runtime === 'bun').length > 0
        ? has(game, 'testing-culture')
          ? 0.3
          : 1
        : 0,
    'gevent-compat': () =>
      stackTargets(game, ledger, (node) => node.runtime === 'gevent').length > 0
        ? has(game, 'testing-culture')
          ? 0.3
          : 1
        : 0,
    'split-brain': () =>
      clusterHubs(game, ledger).length > 0 ? (has(game, 'chaos-engineering') ? 0.3 : 1) : 0,
    'page-leak': () =>
      Math.max(0, ...leakyCdns(game, ledger).map((node) => CACHE_KEYS[node.cacheKey].leak)),
    'operator-typo': () => {
      const target = dataTarget(game, ledger)
      if (!target) return 0
      return has(game, 'infra-as-code') ? 0.5 : 2
    },
    'leap-second': () =>
      game.nodes.some((node) => node.type === 'server' && !isDown(node) && busy(ledger, node))
        ? has(game, 'leap-smearing')
          ? 0.3
          : 1.5
        : 0,
  }
  return weakness[kind]()
}

const unaddressed = (game: Game, kind: IncidentId): boolean =>
  INCIDENTS[kind].actions.some((id) => game.openActions.includes(id) && !has(game, id))

export const pentestWeakness = (game: Game, ledger: Ledger): ResearchId | null => {
  let best: ResearchId | null = null
  let bestWeakness = 0
  for (const id of INCIDENT_IDS) {
    const action = INCIDENTS[id].actions.find((research) => !has(game, research))
    if (!action) continue
    const weakness = weaknessOf(game, ledger, id)
    if (weakness > bestWeakness) {
      bestWeakness = weakness
      best = action
    }
  }
  return best
}

export const startIncident = (
  game: Game,
  ledger: Ledger,
  kind: IncidentId,
  roll: number,
  only?: ComponentId,
  service?: string,
  causedBy: IncidentId | null = null,
): Readonly<{ game: Game; incident: Incident }> | null => {
  const target = Match.value(kind).pipe(
    Match.when('instance', () =>
      pickWeighted(
        instanceTargets(game, ledger).filter(([node]) => !only || node.type === only),
        roll,
      ),
    ),
    Match.when('leak', () => {
      const targets = leakTargets(game, ledger)
      return targets[Math.floor(roll * targets.length)]
    }),
    Match.when('slow-query', () =>
      game.nodes.find((node) => node.type === 'database' && busy(ledger, node)),
    ),
    Match.when('stampede', () => {
      const targets = cacheTargets(game, ledger)
      return targets[Math.floor(roll * targets.length)]
    }),
    Match.when('poison', () => {
      const exposed = poisonTargets(game)
      const targets =
        exposed.length > 0 ? exposed : game.nodes.filter((node) => node.type === 'queue')
      return targets[Math.floor(roll * targets.length)]
    }),
    Match.when('disk-full', () => busiest(game, ledger, 'database')),
    Match.when('retry-storm', () => busiest(game, ledger, 'database')),
    Match.when('gc-storm', () =>
      pickWeighted(
        gcTargets(game, ledger).filter(([node]) => !only || node.type === only),
        roll,
      ),
    ),
    Match.when('gpu-shortage', () => pickWeighted(gpuTargets(game, ledger), roll)),
    Match.when('spot-reclaim', () => {
      const targets = spotTargets(game, ledger)
      return targets[Math.floor(roll * targets.length)]
    }),
    Match.when('stale-read', () => {
      const targets = cacheTargets(game, ledger).filter(
        (node) => (ledger.nodes[node.id]?.traffic['q-write'] ?? 0) > 0,
      )
      return targets[Math.floor(roll * targets.length)]
    }),
    Match.when('reconnect', () => busiest(game, ledger, 'ws')),
    Match.when('cluster-upgrade', () => pickWeighted(clusterTargets(game), roll)),
    Match.when(
      (id) =>
        id === 'hot-shard' ||
        id === 'migration-lock' ||
        id === 'accidental-delete' ||
        id === 'table-bloat',
      () => busiest(game, ledger, 'database'),
    ),
    Match.when('page-leak', () => leakyCdns(game, ledger)[0]),

    Match.when('jvm-warmup', () => pickWeighted(javaTargets(game, ledger), roll)),
    Match.when(
      (id) => id === 'supply-chain' || id === 'leap-second',
      () => busiest(game, ledger, 'server'),
    ),
    Match.when('operator-typo', () => dataTarget(game, ledger)),
    Match.when('hot-key', () => {
      const targets = hotKeyTargets(game, ledger)
      return targets[Math.floor(roll * targets.length)]
    }),
    Match.orElse(() => runtimeTarget(game, ledger, kind, roll)),
  )
  const fragile = fragileZones(game)
  const used = [
    ...new Set(game.nodes.filter((node) => zoned(node) && !isDown(node)).map((node) => node.zone)),
  ].toSorted()
  const pool = fragile.length > 0 ? fragile : used
  const zone = kind === 'zone' ? (pool[Math.floor(roll * pool.length)] ?? null) : null
  if (kind === 'zone' && zone === null) return null
  const targeted = [
    'instance',
    'leak',
    'slow-query',
    'stampede',
    'poison',
    'disk-full',
    'retry-storm',
    'gc-storm',
    'gpu-shortage',
    'spot-reclaim',
    'stale-read',
    'reconnect',
    'hot-key',
    'cluster-upgrade',
    'hot-shard',
    'jvm-warmup',
    'migration-lock',
    'supply-chain',
    'accidental-delete',
    'operator-typo',
    'leap-second',
    'table-bloat',
    'page-leak',
    'stale-opcache',
    'bun-compat',
    'gevent-compat',
    'split-brain',
  ] as const
  if ((targeted as ReadonlyArray<IncidentId>).includes(kind) && !target) return null
  const region =
    kind === 'dr-drill'
      ? HOME_REGION
      : kind === 'leap-second'
        ? (target?.region ?? null)
        : kind === 'region'
          ? (busiestRegion(game) ?? null)
          : kind === 'config'
            ? configRegion(game)
            : null
  if ((kind === 'region' || kind === 'config') && region === null) return null
  const pushed = kind === 'config' && region !== null ? configReach(game, region) : []
  const incident: Incident = {
    kind,
    remaining: incidentDuration(game, kind, target ?? undefined),
    nodeId: target?.id ?? null,
    startedAt: game.time,
    baseline: ledger.revenue,
    usersAtStart: game.users,
    impaired: 0,
    lostRevenue: 0,
    failed: 0,
    phase: IncidentPhase.cases.Pending.make({}),
    severity: INCIDENTS[kind].severity,
    magnitude:
      kind === 'spike'
        ? SPIKE_MAGNITUDE[0] + (SPIKE_MAGNITUDE[1] - SPIKE_MAGNITUDE[0]) * roll
        : SPIKE_MAGNITUDE[0],
    zone,
    region,
    service: kind === 'bad-deploy' ? (service ?? serviceOf(game).id) : null,
    causedBy,
  }
  const nodes = game.nodes.map((node) =>
    pushed.includes(node.region) && configured(node) && !isDown(node)
      ? {
          ...node,
          ...takeDown(node.life, incidentDuration(game, kind), 'failure'),
          downAt: game.time,
        }
      : (kind === 'region' || kind === 'dr-drill') &&
          region !== null &&
          node.region === region &&
          !survivesRegion(game, node) &&
          !isDown(node)
        ? {
            ...node,
            ...takeDown(node.life, incidentDuration(game, kind), 'failure'),
            downAt: game.time,
          }
        : kind === 'operator-typo' &&
            target !== undefined &&
            node.type === target.type &&
            node.region === target.region &&
            !isDown(node)
          ? {
              ...node,
              ...takeDown(node.life, incidentDuration(game, kind), 'failure'),
              downAt: game.time,
            }
          : zone !== null && zoned(node) && node.zone === zone && !isDown(node)
            ? {
                ...node,
                ...takeDown(
                  node.life,
                  node.standby ? failoverSeconds(game) : incidentDuration(game, 'zone'),
                  'failure',
                ),
                downAt: game.time,
              }
            : node.id !== target?.id
              ? node
              : kind === 'reconnect'
                ? { ...node, life: withWarm(node.life, 0) }
                : kind === 'instance' && node.type === 'wide'
                  ? { ...node, lost: incidentDuration(game, kind) }
                  : kind === 'instance'
                    ? {
                        ...node,
                        ...takeDown(
                          node.life,
                          node.standby
                            ? failoverSeconds(game)
                            : clusterOf(game, node) !== undefined
                              ? rescheduleSeconds(game)
                              : -1,
                          'failure',
                        ),
                        downAt: game.time,
                      }
                    : kind === 'stampede'
                      ? {
                          ...node,
                          life: withWarm(
                            node.life,
                            node.warming && has(game, 'cache-warming') ? WARMED : 0,
                          ),
                        }
                      : kind === 'gpu-shortage'
                        ? {
                            ...node,
                            ...takeDown(node.life, incidentDuration(game, kind), 'failure'),
                            downAt: game.time,
                          }
                        : node,
  )
  const drill = kind === 'audit' ? drillStep(game.drill, { _tag: 'Reset' }) : game.drill
  const lost =
    kind === 'supply-chain'
      ? Math.floor(game.users * SUPPLY_CHAIN_CHURN)
      : kind === 'page-leak'
        ? Math.floor(game.users * PAGE_LEAK_CHURN)
        : 0
  const rpo = game.nodes.reduce(
    (factor, node) =>
      kind === 'zone' &&
      zone !== null &&
      zoned(node) &&
      node.zone === zone &&
      !isDown(node) &&
      node.standby &&
      !node.standbySync &&
      node.type === 'database'
        ? factor * (1 - PROMOTE_DATA_LOSS)
        : kind === 'instance' &&
            node.id === target?.id &&
            node.standby &&
            !node.standbySync &&
            node.type === 'database'
          ? factor * (1 - PROMOTE_DATA_LOSS)
          : factor,
    1,
  )
  return {
    game: {
      ...game,
      nodes,
      drill,
      incident: beginIncident(game.incident, incident),
      lastIncident: kind,
      users: game.users - lost,
      data: game.data * rpo,
    },
    incident,
  }
}

export const directIncidents = (
  game: Game,
  ledger: Ledger,
  gap = INCIDENT_GAP_SECONDS,
): Readonly<{ game: Game; events: ReadonlyArray<StepEvent> }> => {
  if (
    game.sandbox ||
    activeIncident(game) !== null ||
    game.stage < 1 ||
    game.time < game.nextIncidentAt
  )
    return { game, events: [] }
  const [roll, afterRoll] = nextRandom(game.seed)
  const [spread, afterGap] = nextRandom(afterRoll)
  const [pick, afterPick] = nextRandom(afterGap)
  const interval = eraOf(game).incidentInterval / (ERAS[1]?.incidentInterval ?? 720)
  const scheduled: Game = {
    ...game,
    seed: afterPick,
    nextIncidentAt: game.time + gap * interval * (0.6 + 0.8 * spread),
  }
  const cap = eraOf(game).maxSeverity
  const kind = pickWeighted(
    INCIDENT_IDS.map(
      (id) =>
        [
          id,
          (INCIDENTS[id].severity < cap ? 0 : weaknessOf(game, ledger, id)) *
            signatureWeight(game, id) *
            (1 + Math.max(0, ...game.services.map((service) => service.debt))) *
            (id === game.lastIncident ? REPEAT_WEIGHT : 1) *
            (unaddressed(game, id) ? openActionWeight(game) : 1) *
            mutatorWeight(game, id),
        ] as const,
    ),
    roll,
  )
  if (!kind) return { game: scheduled, events: [] }
  const started = startIncident(scheduled, ledger, kind, pick)
  if (!started) return { game: scheduled, events: [] }
  return { game: started.game, events: [StepEvent.IncidentStarted({ incident: started.incident })] }
}

const postmortemOf = (game: Game, incident: Incident, auto = false): Postmortem => {
  const target = game.nodes.find((node) => node.id === incident.nodeId)
  return {
    id: game.postmortemSeq + 1,
    kind: incident.kind,
    target: target ? nodeLabel(game, target) : null,
    duration: game.time - incident.startedAt,
    mttr: incident.impaired,
    mttd: (() => {
      const signalAt = signalAtOf(incident.phase)
      return signalAt === null ? null : Math.max(0, signalAt - incident.startedAt)
    })(),
    mtta: (() => {
      const ackAt = ackAtOf(incident.phase)
      const signalAt = signalAtOf(incident.phase)
      return ackAt === null || signalAt === null ? null : Math.max(0, ackAt - signalAt)
    })(),
    lostUsers: Math.max(0, incident.usersAtStart - game.users),
    lostRevenue: incident.lostRevenue,
    failed: incident.failed,
    severity: incident.severity,
    endedAt: game.time,
    causedBy: incident.causedBy,
    action: game.sandbox
      ? null
      : (INCIDENTS[incident.kind].actions.find((id) => !has(game, id) && researchReady(game, id)) ??
        null),
    ...(auto ? { auto: true } : {}),
    ...(incident.service ? { service: incident.service } : {}),
  }
}

export const runbookCovers = (game: Game, kind: IncidentId): boolean => game.runbooks.includes(kind)

const resolvesItself = (game: Game, incident: Incident, target: GameNode | undefined): boolean => {
  if (incident.kind === 'instance')
    return target !== undefined && (target.standby || clusterOf(game, target) !== undefined)
  if (incident.kind === 'spot-reclaim')
    return target !== undefined && pricingOf(game, target) === 'spot'
  if (incident.kind === 'retry-storm')
    return game.links.some(
      (link) =>
        link.retries === 'backoff' &&
        game.nodes.some((node) => node.id === link.to && node.type === 'database'),
    )
  return false
}

export const leftAlone = (incident: Incident): boolean =>
  !hasAck(incident.phase) && incident.remaining <= 0 && incident.causedBy === null

const cascadesInto = (game: Game, ledger: Ledger, incident: Incident): IncidentId | null => {
  if (game.sandbox || game.stage < CASCADE_FROM_STAGE) return null
  if (!leftAlone(incident)) return null
  const next = CASCADES[incident.kind]
  if (!next) return null
  return weaknessOf(game, ledger, next) > 0 ? next : null
}

const resolve = (
  game: Game,
  auto = false,
  ledger?: Ledger,
): Readonly<{ game: Game; events: ReadonlyArray<StepEvent> }> => {
  const incident = activeIncident(game)
  if (!incident) return { game, events: [] }
  const recovered =
    incident.kind === 'bad-deploy' && incident.rollingBack
      ? (() => {
          const service = serviceOfId(game, incident.service ?? undefined)
          const batch = service.lastDeploy
          const gone = new Set<string>(batch)
          const rest = Object.entries(game.features).filter(([id]) => !gone.has(id))
          const waiting = batch.map((id) => {
            const phase = game.features[id]
            return [id, featureStep(phase ?? { _tag: 'Awaiting' }, { _tag: 'RolledBack' })] as const
          })
          return withServiceId(
            { ...game, features: Object.fromEntries([...waiting, ...rest]) },
            service.id,
            { lastDeploy: [] },
          )
        })()
      : game
  const postmortem = postmortemOf(recovered, incident, auto)
  const killed = recovered.nodes.find(
    (node) => node.id === incident.nodeId && incident.kind === 'leak' && node.leak > 0,
  )
  const nodes = recovered.nodes.map((node) => {
    if (
      incident.kind === 'config' &&
      configured(node) &&
      causeOf(node.life) === 'failure' &&
      node.downAt === incident.startedAt &&
      Life.guards.Restarting(node.life)
    )
      return { ...node, ...restarted(node) }
    if (
      auto &&
      node.downAt === incident.startedAt &&
      causeOf(node.life) === 'failure' &&
      Life.guards.Restarting(node.life)
    )
      return { ...node, ...restarted(node) }
    if (node.id !== incident.nodeId) return node
    if (incident.kind === 'instance' && Life.guards.Stopped(node.life))
      return { ...node, ...restarted(node) }
    if (incident.kind === 'leak' && node.leak > 0)
      return { ...node, ...restarted(node, 'oom'), leak: 0, downAt: game.time }
    if (incident.kind === 'retry-storm' && node.depth > 0) return { ...node, depth: 0 }
    return node
  })
  const cleared: Game = {
    ...recovered,
    nodes,
    incident: resolveIncident(recovered.incident),
    postmortems: recovered.sandbox
      ? recovered.postmortems
      : [...recovered.postmortems, postmortem].slice(-4),
    postmortemSeq: postmortem.id,
    openActions:
      postmortem.action && !recovered.openActions.includes(postmortem.action)
        ? [...recovered.openActions, postmortem.action]
        : recovered.openActions,
    handled:
      auto || recovered.handled.includes(incident.kind)
        ? recovered.handled
        : [...recovered.handled, incident.kind],
  }
  const events: Array<StepEvent> = [
    ...(killed ? [StepEvent.OutOfMemory({ nodeId: killed.id })] : []),
    StepEvent.IncidentResolved({ postmortem }),
  ]
  if (!ledger) return { game: cleared, events }
  const cascade = cascadesInto(cleared, ledger, incident)
  if (cascade === null) return { game: cleared, events }
  const [roll, seed] = nextRandom(cleared.seed)
  const started = startIncident(
    { ...cleared, seed },
    ledger,
    cascade,
    roll,
    undefined,
    undefined,
    incident.kind,
  )
  if (!started) return { game: cleared, events }
  events.push(StepEvent.IncidentStarted({ incident: started.incident }))
  return {
    game: {
      ...started.game,
      nextIncidentAt: Math.max(
        cleared.nextIncidentAt,
        started.game.time + started.incident.remaining + INCIDENT_GAP_SECONDS,
      ),
    },
    events,
  }
}

export const markSignal = (game: Game, ledger: Ledger): Game => {
  const incident = activeIncident(game)
  if (!incident || signalAtOf(incident.phase) !== null) return game
  const rules = Object.keys(ALERT_RULES) as ReadonlyArray<AlertRule>
  const signalled = has(game, 'alerting')
    ? rules.some((rule) => game.alarms[rule] > 0)
    : ledger.errorShare > ALERT_RULES.errors.threshold
  return signalled ? { ...game, incident: signalIncident(game.incident, game.time) } : game
}

export const advanceIncident = (
  game: Game,
  ledger: Ledger,
  seconds: number,
): Readonly<{ game: Game; events: ReadonlyArray<StepEvent> }> => {
  const incident = activeIncident(game)
  if (!incident) return { game, events: [] }
  if (runbookCovers(game, incident.kind)) return resolve(game, true)
  const counted: Incident = {
    ...incident,
    remaining: incident.remaining - seconds,
    impaired: incident.impaired + (ledger.errorShare > 0.01 ? seconds : 0),
    lostRevenue: incident.lostRevenue + Math.max(0, incident.baseline - ledger.revenue) * seconds,
    failed: incident.failed + ledger.errorShare * ledger.demand * seconds,
  }
  const def = INCIDENTS[incident.kind]
  const half = incidentDuration(game, incident.kind) / 2
  const elapsed = game.time - incident.startedAt
  const stepsTo =
    def.escalatesTo !== null &&
    !game.sandbox &&
    incident.severity === def.severity &&
    elapsed >= half &&
    elapsed - seconds < half &&
    counted.impaired > elapsed / 2
      ? def.escalatesTo
      : null
  const tracked: Incident =
    stepsTo !== null
      ? {
          ...counted,
          severity: stepsTo,
          remaining: counted.remaining * ESCALATION,
          magnitude:
            incident.kind === 'spike' ? incident.magnitude * ESCALATION : incident.magnitude,
        }
      : counted
  const signalledAt = signalAtOf(tracked.phase)
  const onCall =
    !hasAck(tracked.phase) &&
    has(game, 'on-call') &&
    signalledAt !== null &&
    game.time >= signalledAt + ON_CALL_ACK
  const ackedState = onCall
    ? ackIncident(game.incident, (signalledAt ?? game.time) + ON_CALL_ACK)
    : game.incident
  const acked: Incident = { ...tracked, phase: incidentPhaseOf(ackedState) ?? tracked.phase }
  const target = game.nodes.find((node) => node.id === incident.nodeId)
  const reclaims =
    incident.kind === 'spot-reclaim' &&
    target !== undefined &&
    pricingOf(game, target) === 'spot' &&
    !isDown(target) &&
    elapsed >= SPOT_WARNING
  const nodes =
    incident.kind === 'leak' && target
      ? game.nodes.map((node) =>
          node.id === target.id && !node.recycle
            ? { ...node, leak: node.leak + ramOf(node) * LEAK_RATE * seconds }
            : node,
        )
      : reclaims && target
        ? game.nodes.map((node) =>
            node.id === target.id
              ? {
                  ...node,
                  ...takeDown(node.life, acked.remaining, 'failure'),
                  downAt: game.time,
                }
              : node,
          )
        : game.nodes
  const next: Game = {
    ...game,
    nodes,
    incident: incidentStateStep(game.incident, { _tag: 'Updated', incident: acked }),
  }
  const elapsedAfter = game.time - incident.startedAt
  const held = nodes.find((node) => node.id === incident.nodeId)
  const fixed =
    (incident.kind === 'instance' && (!target || !Life.guards.Stopped(target.life))) ||
    (incident.kind === 'leak' &&
      (!target || (target.leak === 0 && incident.remaining < incidentDuration(game, 'leak')))) ||
    (incident.kind === 'gc-storm' && (!target || Life.guards.Restarting(target.life))) ||
    (incident.kind === 'retry-storm' &&
      elapsedAfter >= STORM_TRIGGER &&
      (!target || target.depth <= 0)) ||
    (incident.kind === 'double-charge' &&
      !game.links.some(
        (link) =>
          link.retries !== 'none' &&
          game.nodes.some((node) => node.id === link.to && node.type === 'psp'),
      )) ||
    (incident.kind === 'spot-reclaim' &&
      elapsedAfter >= SPOT_WARNING &&
      (!held || !Life.guards.Restarting(held.life))) ||
    ((incident.kind === 'stale-opcache' || incident.kind === 'split-brain') &&
      (!target || Life.guards.Restarting(target.life))) ||
    (incident.kind === 'loop' &&
      hasAck(incident.phase) &&
      !game.nodes.some(
        (node) =>
          node.type === 'server' &&
          RUNTIMES[node.runtime].blocking === 'loop' &&
          (ledger.nodes[node.id]?.traffic.login ?? 0) > 0,
      )) ||
    (incident.kind === 'reconnect' && (!held || Life.guards.Running(held.life))) ||
    (incident.kind === 'operator-typo' &&
      target !== undefined &&
      game.nodes.some(
        (node) =>
          node.id !== target.id &&
          node.type === target.type &&
          node.region === target.region &&
          !isDown(node),
      ))
  const healed = fixed && acked.remaining > 0 && resolvesItself(game, incident, target)
  return acked.remaining <= 0 || fixed ? resolve(next, healed, ledger) : { game: next, events: [] }
}

export const forceIncident = (
  game: Game,
  ledger: Ledger,
  kind: IncidentId,
  only?: ComponentId,
): Game | null => {
  if (activeIncident(game) !== null) return null
  const [roll, seed] = nextRandom(game.seed)
  return startIncident({ ...game, seed }, ledger, kind, roll, only)?.game ?? null
}
