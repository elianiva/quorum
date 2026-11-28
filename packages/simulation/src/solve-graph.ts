import { COMPONENTS, SAMPLE_LATENCY, SAMPLE_OVERHEAD, LINK_TIMEOUT } from './catalog.ts'
import { has, meshOf, sampleIndex } from './lookups.ts'
import { isOpen } from './breaker-machine.ts'
import { accepts } from './rules.ts'
import { type Game, type GameLink, type GameNode } from './state.ts'
import { fixed } from './team.ts'

export type Edge = Readonly<{
  index: number
  key: string
  from: GameNode
  to: GameNode
  toAt: number
  link: GameLink
  policy: Policy
}>

export type Graph = Readonly<{
  byId: ReadonlyMap<string, GameNode>
  at: ReadonlyMap<string, number>
  slots: WeakMap<GameNode, number>
  edgeTo: ReadonlyMap<string, ReadonlyMap<string, Edge>>
  out: ReadonlyMap<string, ReadonlyArray<Edge>>
  mirrors: ReadonlyMap<string, ReadonlyArray<Edge>>
  edges: ReadonlyArray<Edge>
  routes: ReadonlyMap<string, ReadonlyArray<GameNode>>
  parents: ReadonlyMap<string, ReadonlyArray<GameNode>>
  taps: ReadonlyMap<string, ReadonlyArray<string>>
  order: ReadonlyArray<GameNode>
  healthChecked: boolean
  time: number
}>

export const graphs = new WeakMap<Game, Graph>()

const sameNodes = (a: ReadonlyArray<GameNode>, b: ReadonlyArray<GameNode>): boolean => {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false
  return true
}

let lastStructure: Readonly<{
  nodes: ReadonlyArray<GameNode>
  links: unknown
  researched: unknown
  features: unknown
  services: unknown
  graph: Graph
}> | null = null

export const graphOf = (game: Game): Graph => {
  const known = graphs.get(game)
  if (known) return known
  const previous = lastStructure
  let base: Graph
  if (
    previous !== null &&
    previous.links === game.links &&
    previous.researched === game.researched &&
    previous.features === game.features &&
    previous.services === game.services &&
    sameNodes(previous.nodes, game.nodes)
  ) {
    base = previous.graph
  } else {
    base = buildGraph(game)
    lastStructure = {
      nodes: game.nodes,
      links: game.links,
      researched: game.researched,
      features: game.features,
      services: game.services,
      graph: base,
    }
  }
  const healthChecked = has(game, 'health-checks') && fixed(game, 'health-check')
  const graph =
    base.time === game.time && base.healthChecked === healthChecked
      ? base
      : { ...base, time: game.time, healthChecked }
  graphs.set(game, graph)
  return graph
}

export const buildGraph = (game: Game): Graph => {
  const byId = new Map(game.nodes.map((node) => [node.id, node]))
  const at = new Map(game.nodes.map((node, index) => [node.id, index]))
  const slots = new WeakMap<GameNode, number>()
  game.nodes.forEach((node, index) => slots.set(node, index))
  const routes = new Map<string, Array<GameNode>>()
  const parents = new Map<string, Array<GameNode>>()
  const taps = new Map<string, Array<string>>()
  const routing: Array<readonly [GameNode, GameNode]> = []
  const mirroring: Array<readonly [GameNode, GameNode]> = []
  const last = new Map<string, GameLink>()
  for (const link of game.links) {
    const from = byId.get(link.from)
    const to = byId.get(link.to)
    if (!from || !to) continue
    if (COMPONENTS[to.type].control) continue
    if (from.type === 'database' && to.type === 'replica') continue
    if (COMPONENTS[to.type].mirror) {
      mirroring.push([from, to])
      last.set(`${from.id}>${to.id}`, link)
    } else if (COMPONENTS[to.type].tap) {
      const tapped = taps.get(to.id)
      if (tapped) tapped.push(from.id)
      else taps.set(to.id, [from.id])
    } else {
      routing.push([from, to])
      last.set(`${from.id}>${to.id}`, link)
      const fromRoutes = routes.get(from.id)
      if (fromRoutes) fromRoutes.push(to)
      else routes.set(from.id, [to])
      const toParents = parents.get(to.id)
      if (toParents) toParents.push(from)
      else parents.set(to.id, [from])
    }
  }
  const edgeTo = new Map<string, Map<string, Edge>>()
  const out = new Map<string, Array<Edge>>()
  const mirrors = new Map<string, Array<Edge>>()
  const edges: Array<Edge> = []
  const edgeOfPair = (from: GameNode, to: GameNode): Edge => {
    const byTo = edgeTo.get(from.id) ?? new Map<string, Edge>()
    edgeTo.set(from.id, byTo)
    const existing = byTo.get(to.id)
    if (existing) return existing
    const key = `${from.id}>${to.id}`
    const edge: Edge = {
      index: edges.length,
      key,
      from,
      to,
      toAt: at.get(to.id) as number,
      link: last.get(key) as GameLink,
      policy: policyOf(game, last.get(key), from),
    }
    byTo.set(to.id, edge)
    edges.push(edge)
    return edge
  }
  for (const [from, to] of routing) {
    const edge = edgeOfPair(from, to)
    const fromOut = out.get(from.id)
    if (fromOut) fromOut.push(edge)
    else out.set(from.id, [edge])
  }
  for (const [from, to] of mirroring) {
    const edge = edgeOfPair(from, to)
    const fromMirrors = mirrors.get(from.id)
    if (fromMirrors) fromMirrors.push(edge)
    else mirrors.set(from.id, [edge])
  }
  const mirrored = new Map<string, number>()
  for (const edges of mirrors.values())
    for (const edge of edges) mirrored.set(edge.to.id, (mirrored.get(edge.to.id) ?? 0) + 1)
  const indegree = new Map<string, number>(
    game.nodes.map((node) => [
      node.id,
      (parents.get(node.id)?.length ?? 0) + (mirrored.get(node.id) ?? 0),
    ]),
  )
  const order: Array<GameNode> = []
  const ready = game.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0)
  for (let cursor = 0; cursor < ready.length; cursor += 1) {
    const node = ready[cursor] as GameNode
    order.push(node)
    const children = [
      ...(routes.get(node.id) ?? []),
      ...(mirrors.get(node.id) ?? []).map((edge) => edge.to),
    ]
    for (const child of children) {
      const left = (indegree.get(child.id) ?? 0) - 1
      indegree.set(child.id, left)
      if (left === 0) ready.push(child)
    }
  }
  return {
    byId,
    at,
    slots,
    edgeTo,
    out,
    mirrors,
    edges,
    routes,
    parents,
    taps,
    order,
    healthChecked: has(game, 'health-checks') && fixed(game, 'health-check'),
    time: game.time,
  }
}

export type Policy = Readonly<{
  timeout: number
  retry: 'none' | 'naive' | 'backoff'
  open: boolean
  bulkhead: boolean
  hedge: boolean
}>

export const NO_POLICY: Policy = {
  timeout: LINK_TIMEOUT * 1000,
  retry: 'none',
  open: false,
  bulkhead: false,
  hedge: false,
}

export const policyOf = (game: Game, link: GameLink | undefined, from?: GameNode): Policy => {
  if (!link) return NO_POLICY
  const meshed = from !== undefined && meshOf(game, from)
  const blind = from !== undefined && from.type === 'lb' && from.variant === 'l4'
  if (blind || (!meshed && !has(game, 'timeouts'))) return NO_POLICY
  const retry =
    link.retries === 'none'
      ? meshed
        ? 'naive'
        : 'none'
      : link.retries === 'backoff'
        ? has(game, 'backoff-jitter')
          ? 'backoff'
          : 'naive'
        : link.retries
  return {
    timeout: link.timeout * 1000,
    retry,
    open: isOpen(link.fuse) && (has(game, 'circuit-breakers') || meshed),
    bulkhead: link.bulkhead && has(game, 'bulkheads'),
    hedge: link.hedge && has(game, 'hedged-requests'),
  }
}

export const edgeOf = (graph: Graph, from: string, to: string): Edge | undefined =>
  graph.edgeTo.get(from)?.get(to)

export const delegates = (graph: Graph, node: GameNode): boolean =>
  (graph.routes.get(node.id) ?? []).some((child) => accepts(child, 'auth'))

export const offloads = (graph: Graph, node: GameNode): boolean =>
  node.type === 'server' &&
  (graph.routes.get(node.id) ?? []).some((child) => child.type === 'queue' || child.type === 'log')

export const samplingOf = (game: Game, graph: Graph, node: GameNode): number => {
  let overhead = 0
  for (const [tapId, sources] of graph.taps) {
    if (!sources.includes(node.id)) continue
    const tap = graph.byId.get(tapId)
    if (tap) overhead = Math.max(overhead, SAMPLE_OVERHEAD[sampleIndex(tap)] ?? 0)
  }
  return overhead
}

export const samplingMsOf = (graph: Graph, node: GameNode): number => {
  let ms = 0
  for (const [tapId, sources] of graph.taps) {
    if (!sources.includes(node.id)) continue
    const tap = graph.byId.get(tapId)
    if (tap) ms = Math.max(ms, SAMPLE_LATENCY[sampleIndex(tap)] ?? 0)
  }
  return ms
}
