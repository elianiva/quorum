import { HOME_REGION, type ComponentId } from '@quorum/simulation/catalog'
import { blankNode } from '@quorum/simulation/actions'
import { nodeOrdinals } from '@quorum/simulation/labels'
import { freeSandbox } from '@quorum/simulation/sandbox'
import { solveFlow } from '@quorum/simulation/solve'
import {
  attachBoard,
  fitBoard,
  setBoard,
  watchBoardTheme,
  type BoardState,
} from '@quorum/ui/board/board'

const NOOP = () => {}
watchBoardTheme()

export const drawNodeCard = (key: string, type: ComponentId, host: HTMLElement): (() => void) => {
  const base = freeSandbox()
  const existing = base.nodes.find((node) => node.type === type)
  const node = existing ?? blankNode(base, `sample-${type}`, type, 1080, 280)
  const full = existing ? base : { ...base, nodes: [...base.nodes, node] }
  const ledger = solveFlow(full)
  const state: BoardState = {
    locale: 'en',
    translate: (text) => text,
    game: { ...full, nodes: [node], links: [] },
    ledger: { ...ledger, bottleneck: null },
    selected: null,
    selection: [],
    placing: null,
    stamp: null,
    history: {},
    ordinals: nodeOrdinals(full),
    region: HOME_REGION,
    paused: true,
    speed: 1,
    suspended: false,
    cue: null,
    readOnly: true,
    animate: false,
    inset: { top: 16, bottom: 16, left: 0 },
    pad: 8,
  }
  setBoard(key, state)
  const detach = attachBoard(key, host, {
    onNodeTap: NOOP,
    onNodeMove: NOOP,
    onFooter: NOOP,
    onLink: NOOP,
    onUnlink: NOOP,
    onPlace: NOOP,
    onEmptyTap: NOOP,
    onNodeToggle: NOOP,
    onBox: NOOP,
  })
  // The board draws the state it was mounted with; fit it once the host has its size, and again
  // after the card's layout settles. The board itself freezes after its first frames.
  const frame = requestAnimationFrame(() => fitBoard(key))
  const fitTimer = setTimeout(() => fitBoard(key), 400)
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(fitTimer)
    detach()
  }
}
