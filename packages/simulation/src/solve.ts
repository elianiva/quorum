import { CALLOUT_MS, COMPONENTS, isBackendKind, type BackendKind, type Kind } from './catalog.ts'

import { type Calls } from './capacity.ts'
import type { Ledger } from './ledger.ts'
import { hopMs, isDown } from './lookups.ts'
import { type Pass, type Rates } from './rules.ts'
import { userRoutes } from './regions.ts'
import { type Game } from './state.ts'
import { demandOf } from './solve-demand.ts'
import { type Edge, graphOf, edgeOf } from './solve-graph.ts'
import { type Inputs, NO_CALLS, solverOf, probeCapacity, forward } from './solve-pass.ts'
import { passRepeats } from './solve-converge.ts'
import { outcomesOf } from './solve-outcomes.ts'
import { databaseSick, sumRates, ledgerOf, revenueOf } from './solve-ledger.ts'

const PASSES = 6

export { calendarMinute, clockOf, cosTurns } from './calendar.ts'
export { demandOf, diurnal, weekly } from './solve-demand.ts'
export { policyOf } from './solve-graph.ts'
export { attemptsAllowed } from './solve-pass.ts'
export { chaosRunning, chaosTarget } from './solve-outcomes.ts'

/**
 * What one solve converges to. The bottleneck search starts each candidate from
 * it, so a boosted Node only moves its own figures.
 */
type SolveState = Readonly<{
  callLatency: ReadonlyArray<Calls | undefined>
  inflight: ReadonlyArray<number | undefined>
  weights: ReadonlyArray<number | undefined>
  failures: ReadonlyArray<Partial<Record<Kind, number>> | undefined>
  taskFailure: ReadonlyArray<number | undefined>
  taskCapacity: ReadonlyArray<number | undefined>
  connectionUsed: ReadonlyArray<number | undefined>
  nominal: ReadonlyArray<number | undefined>
  sick: ReadonlyArray<boolean | undefined>
}>

type SolveOptions = Readonly<{
  /** A converged state to start from. A boosted Node then only moves its own figures. */
  start?: SolveState | null
  /** Passes to run; six by default, and convergence can stop it sooner. */
  passes?: number
  /** Skip the Node and Link rows: only the revenue is needed. */
  revenueOnly?: boolean
}>

const solveWith = (
  game: Game,
  boost: string | null,
  options: SolveOptions = {},
): { ledger: Ledger | null; revenue: number; state: SolveState } => {
  const { start = null, passes = PASSES, revenueOnly = false } = options
  const graph = graphOf(game)
  const demand = demandOf(game)
  let callLatency: Array<Calls | undefined> = start ? [...start.callLatency] : []
  let inflight: Array<number | undefined> = start ? [...start.inflight] : []
  let weights: Array<number | undefined> = start ? [...start.weights] : []
  // Retrying Links start from the failure share they saw last Step: retries carry a storm forward.
  let failures: Array<Partial<Record<Kind, number>> | undefined> = start ? [...start.failures] : []
  if (start === null)
    for (const link of game.links) {
      const edge = edgeOf(graph, link.from, link.to)
      if (link.failure <= 0 || !edge || edge.policy.retry === 'none') continue
      const byKind: Partial<Record<Kind, number>> = {}
      for (const kind of COMPONENTS[edge.to.type].accepts) byKind[kind] = link.failure
      failures[edge.index] = byKind
    }
  const at = graph.at
  const nominal: Array<number | undefined> = start ? [...start.nominal] : []
  const sick: Array<boolean | undefined> = start ? [...start.sick] : []
  const routes = userRoutes(game, (node) => (graph.routes.get(node.id)?.length ?? 0) > 0)
  const intake: Array<number | undefined> = []
  for (const entry of routes)
    if (entry.source) {
      const slot = at.get(entry.source.id) as number
      intake[slot] = (intake[slot] ?? 0) + entry.share
    }
  let taskFailure: Array<number | undefined> = start ? [...start.taskFailure] : []
  let taskCapacity: Array<number | undefined> = start ? [...start.taskCapacity] : []
  // A Database's connection memory follows the connections the last pass held open.
  let connectionUsed: Array<number | undefined> = start ? [...start.connectionUsed] : []
  const seed: Inputs = {
    game,
    graph,
    demand,
    boost,
    callLatency,
    inflight,
    weights,
    failures,
    nominal,
    sick,
    intake,
    taskFailure,
    taskCapacity,
    connectionUsed,
  }
  // The probe reads only each Node's utilization, so it asks for a capacity-only model.
  const seedSolver = solverOf({ ...seed, capacityOnly: true })
  if (start === null) {
    for (const node of game.nodes)
      nominal[at.get(node.id) as number] = probeCapacity(seed, seedSolver, node)
    weights = [...nominal]
  } else if (boost !== null) {
    // Only the boosted Node's probe changes, because the probe reads its boost.
    const boosted = game.nodes.find((node) => node.id === boost)
    if (boosted) nominal[at.get(boosted.id) as number] = probeCapacity(seed, seedSolver, boosted)
  }

  let pass: Pass | null = null
  let outcomes: ReturnType<typeof outcomesOf> | null = null
  // The pass loop is a relaxation that settles: once a pass repeats the figures
  // the Ledger reads, later passes cannot change the answer. Six stays the cap.
  let previousPass: Pass | null = null
  for (let index = 0; index < passes; index += 1) {
    const inputs: Inputs = {
      game,
      graph,
      demand,
      boost,
      callLatency,
      inflight,
      weights,
      failures,
      nominal,
      sick: [...sick],
      intake,
      taskFailure,
      taskCapacity,
      connectionUsed,
    }
    pass = forward(inputs)
    outcomes = outcomesOf(inputs, pass)
    if (previousPass !== null && passRepeats(previousPass, pass)) break
    previousPass = pass
    // A Worker's failed attempts come back: what its calls and code failed, not what it dropped,
    // since a dropped task waits in the Queue.
    const nextTaskFailure: Array<number | undefined> = []
    const nextTaskCapacity: Array<number | undefined> = []
    for (const node of game.nodes) {
      if (node.type !== 'worker') continue
      const slot = at.get(node.id) as number
      const utilization = pass.models[slot]?.utilization ?? 0
      const offered = pass.arriving[slot]?.task ?? 0
      if (utilization > 0 && offered > 0) nextTaskCapacity[slot] = offered / utilization
      if (!pass.tasks[slot]) continue
      const result = outcomes.outcome(node, 'task')
      const fresh = Math.max(0, 1 - (result.success + result.failDropped))
      const previous = taskFailure[slot]
      nextTaskFailure[slot] = previous === undefined ? fresh : (previous + fresh) / 2
    }
    taskFailure = nextTaskFailure
    taskCapacity = nextTaskCapacity
    connectionUsed = pass.connections.map((entry) => entry?.used ?? 0)
    const nextLatency: Array<Calls | undefined> = []
    const nextInflight: Array<number | undefined> = []
    const nextWeights: Array<number | undefined> = []
    for (const node of game.nodes) {
      const slot = at.get(node.id) as number
      const model = pass.models[slot]
      nextInflight[slot] = ((inflight[slot] ?? 0) + (model?.inflight ?? 0)) / 2
      const rate = sumRates(pass.arriving[slot] ?? {})
      nextWeights[slot] = isDown(node)
        ? 0
        : rate > 0 && model
          ? model.capacity
          : (weights[slot] ?? 1)
      // A Node that runs code holds its slot while it waits on each call it makes.
      if (!COMPONENTS[node.type].stack) continue
      const previous = callLatency[slot] ?? NO_CALLS
      const blended: Partial<Record<BackendKind, number>> = {}
      for (const kind of COMPONENTS[node.type].sends) {
        if (!isBackendKind(kind)) continue
        const fresh = kind === 'callout' ? CALLOUT_MS : outcomes.held(node, kind, hopMs(game))
        blended[kind] = index === 0 ? fresh : ((previous[kind] ?? 0) + fresh) / 2
      }
      nextLatency[slot] = blended
    }
    // Failure shares on retrying Links, blended like the call latencies.
    const nextFailures: Array<Partial<Record<Kind, number>> | undefined> = []
    for (const index of pass.linkOrder) {
      const edge = graph.edges[index] as Edge
      const carried = pass.links[index] as Rates
      if (edge.policy.retry === 'none') continue
      const byKind: Partial<Record<Kind, number>> = {}
      for (const kind of Object.keys(carried) as Array<Kind>) {
        const fresh = outcomes.failureOn(edge, kind)
        const previous = failures[index]?.[kind]
        byKind[kind] = previous === undefined ? fresh : (previous + fresh) / 2
      }
      nextFailures[index] = byKind
    }
    // Once a deep check fails a server in a pass, it stays out for the solve: no flapping.
    for (const node of game.nodes)
      if (node.type === 'server' && databaseSick(graph, pass, node))
        sick[at.get(node.id) as number] = true
    callLatency = nextLatency
    inflight = nextInflight
    weights = nextWeights
    failures = nextFailures
  }
  if (!pass || !outcomes) throw new Error('The solve ran no passes.')
  const ledger = revenueOnly ? null : ledgerOf(game, graph, demand, pass, outcomes, routes)
  return {
    ledger,
    revenue: ledger ? ledger.revenue : revenueOf(game, demand, pass, outcomes, routes),
    state: {
      callLatency,
      inflight,
      weights,
      failures,
      taskFailure,
      taskCapacity,
      connectionUsed,
      nominal,
      sick,
    },
  }
}

/**
 * When the async part of each kind is done (16 "Series B": completion-time
 * Apdex). A new task waits behind its Queue's backlog for as long as the
 * Workers take to drain it (Little's law), then runs. An attempt that fails
 * comes back after a backoff until the Queue's attempts run out, and then the
 * task is lost.
 */

/**
 * The Node whose doubled capacity would earn the most: re-solve with each of
 * the three busiest Nodes boosted and keep the largest gain.
 */
export const bottleneckOf = (game: Game, base: Ledger): string | null => {
  const busiest = game.nodes
    .filter((node) => COMPONENTS[node.type].limiting && !isDown(node))
    .map((node) => [node.id, base.nodes[node.id]?.utilization ?? 0] as const)
    .filter(([, utilization]) => utilization > 0.6)
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 3)
  // The base solve's converged state: a boosted Node then needs one pass, and
  // the search only needs the revenue, not the Node and Link rows.
  const start = states.get(game) ?? null
  let best: string | null = null
  let gain = Math.max(0.005, base.revenue * 0.01)
  for (const [id] of busiest) {
    const boosted =
      solveWith(game, id, start ? { start, passes: 1, revenueOnly: true } : { revenueOnly: true })
        .revenue - base.revenue
    if (boosted > gain) {
      gain = boosted
      best = id
    }
  }
  return best
}

const flows = new WeakMap<Game, Ledger>()
const marked = new WeakMap<Game, Ledger>()
/** The state each solved Game converged to, so the search can start there. */
const states = new WeakMap<Game, SolveState>()

/**
 * The Ledger without the bottleneck search: what each Step and each view
 * needs. The game runs the search once per sim second (04 "The bottleneck")
 * and keeps the answer itself. Cached per Game.
 */
export const solveFlow = (game: Game): Ledger => {
  const cached = flows.get(game)
  if (cached) return cached
  const { ledger, state } = solveWith(game, null)
  if (ledger === null) throw new Error('A flow solve builds a Ledger.')
  flows.set(game, ledger)
  states.set(game, state)
  return ledger
}

/** `to` reads the Ledger `from` solved: the Step that made it changed nothing the solve reads. */
export const carryLedger = (from: Game, to: Game): void => {
  const ledger = flows.get(from)
  if (ledger) flows.set(to, ledger)
  const state = states.get(from)
  if (state) states.set(to, state)
}

/** The full Ledger, with the bottleneck searched now. For tests and one-off checks. Cached per Game. */
export const solve = (game: Game): Ledger => {
  const cached = marked.get(game)
  if (cached) return cached
  const base = solveFlow(game)
  const ledger = { ...base, bottleneck: bottleneckOf(game, base) }
  marked.set(game, ledger)
  return ledger
}
