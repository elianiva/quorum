import { calendarMinute, cosTurns } from './calendar.ts'
import {
  SCALE_COOLDOWN_SECONDS,
  SCALE_IN,
  SCALE_QUEUE_DEPTH,
  SCALE_RPS_PER_VCPU,
  SCHEDULE_LEAD_MINUTES,
} from './catalog.ts'
import { ventureOf } from './founding.ts'
import type { Ledger } from './ledger.ts'
import { has, isDown, vcpuOf } from './lookups.ts'
import type { Game, GameNode, ScaleSignal } from './state.ts'

export type ScalePhase = 'steady' | 'booting' | 'up' | 'down' | 'paused'

export type ScaleState = Readonly<{
  nodeId: string
  signal: ScaleSignal
  target: number
  reading: number
  planned: number
  copies: number
  booting: number
  readyIn: number
  cooldown: number
  wanted: number
  minCopies: number
  maxCopies: number
  feeds: number
  phase: ScalePhase
  atLimit: 'min' | 'max' | null
}>

export type AutoscalerView = Readonly<{
  members: ReadonlyArray<ScaleState>
  active: boolean
  copies: number
  booting: number
  wanted: number
  floor: number
  ceiling: number
  readyIn: number
  cooldown: number
  phase: 'empty' | 'steady' | 'booting' | 'up' | 'down' | 'paused'
}>

const scalers = new WeakMap<Game, ReadonlyMap<string, GameNode>>()

const scalerMap = (game: Game): ReadonlyMap<string, GameNode> => {
  let found = scalers.get(game)
  if (found === undefined) {
    const byId = new Map(game.nodes.map((entry) => [entry.id, entry]))
    const scaled = new Map<string, GameNode>()
    for (const link of game.links) {
      const target = byId.get(link.to)
      if (target?.type === 'autoscaler' && !isDown(target) && !scaled.has(link.from))
        scaled.set(link.from, target)
    }
    found = scaled
    scalers.set(game, found)
  }
  return found
}

export const autoscalerFor = (game: Game, node: GameNode): GameNode | undefined => {
  if (node.type !== 'server' && node.type !== 'worker') return undefined
  return scalerMap(game).get(node.id)
}

const queueFeedsOf = (game: Game, node: GameNode): number => {
  const queues = new Set(
    game.nodes.filter((entry) => entry.type === 'queue').map((entry) => entry.id),
  )
  return game.links.filter((link) => link.to === node.id && queues.has(link.from)).length
}

export const scaleLoadOf = (
  game: Game,
  node: GameNode,
  own: Ledger['nodes'][string],
  signal: ScaleSignal,
): number => {
  const copies = Math.max(1, node.replicas)
  if (signal === 'rps')
    return own.inbound / (copies * Math.max(1, vcpuOf(node)) * SCALE_RPS_PER_VCPU)
  if (signal === 'queue') {
    let waiting = 0
    const queues = new Set(
      game.nodes.filter((entry) => entry.type === 'queue').map((entry) => entry.id),
    )
    for (const link of game.links) {
      if (link.to !== node.id || !queues.has(link.from)) continue
      const queue = game.nodes.find((entry) => entry.id === link.from)
      if (queue) waiting += queue.depth
    }
    return waiting / (copies * SCALE_QUEUE_DEPTH)
  }
  if (signal === 'cpu') {
    const cpu = own.resources.cpuCores
    return cpu && cpu.total > 0 ? cpu.used / cpu.total : 0
  }
  return own.utilization
}

export const peakLoadOf = (game: Game, load: number): number => {
  const venture = ventureOf(game)
  const minute = calendarMinute(game.time) % 1440
  const peak = venture.peak * 60
  const ahead = (((peak - minute) % 1440) + 1440) % 1440
  if (ahead > SCHEDULE_LEAD_MINUTES) return load
  const now = 1 + venture.amplitude * cosTurns((minute - peak) / 1440)
  return now > 0 ? (load * (1 + venture.amplitude)) / now : load
}

export const scaleStateOf = (
  game: Game,
  ledger: Ledger,
  node: GameNode,
  scaler: GameNode,
): ScaleState => {
  const own = ledger.nodes[node.id]
  const copies = Math.max(1, node.replicas)
  const booting = node.scaler._tag === 'Scaling' ? node.scaler.pending : 0
  const readyIn = node.scaler._tag === 'Scaling' ? Math.max(0, node.scaler.readyIn) : 0
  const cooldown = Math.max(0, SCALE_COOLDOWN_SECONDS - (game.time - node.scaledAt))
  const feeds = queueFeedsOf(game, node)
  const reading = own ? scaleLoadOf(game, node, own, scaler.signal) : 0
  const planned =
    scaler.schedule && has(game, 'scheduled-scaling') ? peakLoadOf(game, reading) : reading
  const most = scaler.maxCopies > 0 ? scaler.maxCopies : Number.POSITIVE_INFINITY
  const raw =
    game.incident?.kind === 'runaway-bill'
      ? Math.max(copies, most === Number.POSITIVE_INFINITY ? 16 : most)
      : Math.ceil((copies * Math.max(reading, planned)) / scaler.target)
  const demand = Math.min(most, Math.max(scaler.minCopies, raw))
  const falling =
    copies > scaler.minCopies &&
    reading < scaler.target * SCALE_IN &&
    (reading * copies) / (copies - 1) < scaler.target
  const phase: ScalePhase =
    node.scaler._tag === 'Scaling'
      ? 'booting'
      : isDown(node)
        ? 'paused'
        : own === undefined
          ? 'steady'
          : demand > copies
            ? 'up'
            : falling
              ? 'down'
              : 'steady'
  const wanted =
    phase === 'booting'
      ? copies + booting
      : phase === 'up'
        ? demand
        : phase === 'down'
          ? copies - 1
          : copies
  const atLimit: ScaleState['atLimit'] =
    scaler.maxCopies > 0 && copies >= scaler.maxCopies && raw > scaler.maxCopies
      ? 'max'
      : copies === scaler.minCopies && reading < scaler.target * SCALE_IN
        ? 'min'
        : null
  return {
    nodeId: node.id,
    signal: scaler.signal,
    target: scaler.target,
    reading,
    planned,
    copies,
    booting,
    readyIn,
    cooldown,
    wanted,
    minCopies: scaler.minCopies,
    maxCopies: scaler.maxCopies,
    feeds,
    phase,
    atLimit,
  }
}

export const autoscalerViewOf = (game: Game, ledger: Ledger, scaler: GameNode): AutoscalerView => {
  const linked = new Set(
    game.links.filter((link) => link.to === scaler.id).map((link) => link.from),
  )
  const members = game.nodes
    .filter((node) => (node.type === 'server' || node.type === 'worker') && linked.has(node.id))
    .map((node) => scaleStateOf(game, ledger, node, scaler))
  const active = !isDown(scaler)
  const copies = members.reduce((total, member) => total + member.copies, 0)
  const booting = members.reduce((total, member) => total + member.booting, 0)
  const wanted = members.reduce((total, member) => total + member.wanted, 0)
  const readyIn = Math.max(
    ...members.filter((member) => member.phase === 'booting').map((member) => member.readyIn),
  )
  const cooldown = Math.min(
    ...members
      .filter((member) => member.phase === 'up' || member.phase === 'down')
      .map((member) => member.cooldown),
  )
  const phase: AutoscalerView['phase'] =
    members.length === 0
      ? 'empty'
      : !active
        ? 'paused'
        : members.some((member) => member.phase === 'booting')
          ? 'booting'
          : members.some((member) => member.phase === 'up')
            ? 'up'
            : members.some((member) => member.phase === 'down')
              ? 'down'
              : 'steady'
  return {
    members,
    active,
    copies,
    booting,
    wanted,
    floor: scaler.minCopies * members.length,
    ceiling: scaler.maxCopies > 0 ? scaler.maxCopies * members.length : 0,
    readyIn: active && Number.isFinite(readyIn) ? readyIn : 0,
    cooldown: active && Number.isFinite(cooldown) ? cooldown : 0,
    phase,
  }
}
