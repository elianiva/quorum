import { HOME_REGION, ZONES, type ComponentId } from '@quorum/simulation/catalog'
import { blankNode } from '@quorum/simulation/actions'
import { RUNNING, stopped, warming } from '@quorum/simulation/life'
import type { Ledger, NodeLedger, NodeStatus } from '@quorum/simulation/ledger'
import { freeSandbox } from '@quorum/simulation/sandbox'
import { solveFlow } from '@quorum/simulation/solve'
import type { Game } from '@quorum/simulation/state'
import type { BoardState } from '@quorum/ui/board/board'
import { heightOf } from '@quorum/ui/board/size'
import { RESEARCH, type Args, type Story } from './stories.ts'

const num = (args: Args, key: string): number => Number(args[key])
const str = (args: Args, key: string): string => String(args[key])
const on = (args: Args, key: string): boolean => args[key] === true

const lifeOf = (name: string) =>
  name === 'warming'
    ? warming(0.4)
    : name === 'stopped'
      ? stopped('failure', 1)
      : name === 'restarting'
        ? ({ _tag: 'Restarting', left: 8, cause: 'failure', warm: 1 } as const)
        : RUNNING

const gameOf = (args: Args): Game => {
  const base = freeSandbox()
  const off = new Set(RESEARCH.filter(([key]) => !on(args, key)).map(([, id]) => id as string))
  return { ...base, researched: base.researched.filter((id) => !off.has(id)) }
}

const nodeWith = (game: Game, id: string, type: ComponentId, x: number, y: number, args: Args) => ({
  ...blankNode(game, id, type, x, y),
  ...(args['size'] === undefined ? {} : { size: num(args, 'size') }),
  zone: str(args, 'zone') as (typeof ZONES)[number],
  replicas: num(args, 'replicas'),
  life: lifeOf(str(args, 'life')),
  ...(args['depth'] === undefined ? {} : { depth: num(args, 'depth') }),
})

const ledgerEntry = (own: NodeLedger, args: Args): NodeLedger => ({
  ...own,
  status: str(args, 'status') as NodeStatus,
  utilization: num(args, 'utilization'),
  inbound: num(args, 'inbound'),
  capacity: num(args, 'capacity'),
  latency: num(args, 'latency'),
  p99: num(args, 'p99'),
  dropped: num(args, 'dropped'),
  stranded: num(args, 'stranded'),
  ...(args['hitRatio'] === undefined ? {} : { hitRatio: num(args, 'hitRatio') }),
  ...(args['connections'] === undefined
    ? {}
    : { connections: { used: num(args, 'connections'), max: 100 } }),
  ...(args['lagMs'] === undefined ? {} : { lagMs: num(args, 'lagMs') }),
  ...(args['age'] === undefined ? {} : { age: num(args, 'age') }),
})

const boardOf = (
  game: Game,
  nodes: Game['nodes'],
  ledger: Ledger,
  selected: string | null,
  extra: Partial<BoardState>,
): BoardState => ({
  locale: 'en',
  translate: (text) => text,
  game: { ...game, nodes, links: [] },
  ledger: { ...ledger, bottleneck: null },
  selected,
  selection: [],
  placing: null,
  stamp: null,
  history: {},
  ordinals: {},
  region: HOME_REGION,
  paused: true,
  speed: 1,
  suspended: false,
  cue: null,
  readOnly: true,
  animate: false,
  ...extra,
})

export const singleBoard = (story: Story, args: Args, animate: boolean): BoardState => {
  const game = gameOf(args)
  const node = nodeWith(game, `catalog-${story.id}`, story.id, 1080, 280, args)
  const solved = solveFlow({ ...game, nodes: [...game.nodes, node] })
  const own = solved.nodes[node.id] ?? Object.values(solved.nodes)[0]
  const ledger: Ledger = {
    ...solved,
    nodes: own ? { ...solved.nodes, [node.id]: ledgerEntry(own, args) } : solved.nodes,
  }
  return boardOf(game, [node], ledger, on(args, 'selected') ? node.id : null, {
    animate,
    inset: { top: 16, bottom: 16, left: 0 },
    pad: 8,
  })
}

const GAP_X = 40
const GAP_Y = 48
const CARD_W = 216
export const GRID_COLUMNS = 4

export const gridBoard = (story: Story, args: Args): BoardState => {
  const game = gameOf(args)
  const height = heightOf(story.id)
  const placed = story.states.map((state, index) => ({
    state,
    node: nodeWith(
      game,
      `catalog-${story.id}-${state.name}`,
      story.id,
      (index % GRID_COLUMNS) * (CARD_W + GAP_X),
      Math.floor(index / GRID_COLUMNS) * (height + GAP_Y),
      { ...args, ...state.args },
    ),
  }))
  const solved = solveFlow({
    ...game,
    nodes: [...game.nodes, ...placed.map((entry) => entry.node)],
  })
  const fallback = Object.values(solved.nodes)[0]
  const nodes = Object.fromEntries(
    placed.flatMap(({ state, node }) => {
      const own = solved.nodes[node.id] ?? fallback
      return own ? [[node.id, ledgerEntry(own, { ...args, ...state.args })] as const] : []
    }),
  )
  return boardOf(
    game,
    placed.map((entry) => entry.node),
    { ...solved, nodes },
    null,
    {
      animate: false,
      ordinals: Object.fromEntries(placed.map((entry, index) => [entry.node.id, index + 1])),
      inset: { top: 16, bottom: 16, left: 0 },
      pad: 24,
    },
  )
}

export const boardFor = (
  story: Story,
  args: Args,
  mode: 'single' | 'grid',
  animate: boolean,
): BoardState => (mode === 'grid' ? gridBoard(story, args) : singleBoard(story, args, animate))
