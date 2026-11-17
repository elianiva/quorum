import { HOME_REGION, type ComponentId } from '@quorum/simulation/catalog'
import { nodeOrdinals } from '@quorum/simulation/labels'
import { solveFlow } from '@quorum/simulation/solve'
import { wired } from './node-sample.ts'
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
  const { game: full, node } = wired(type)
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
  const frame = requestAnimationFrame(() => fitBoard(key))
  const fitTimer = setTimeout(() => fitBoard(key), 400)
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(fitTimer)
    detach()
  }
}
