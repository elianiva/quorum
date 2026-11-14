import { HOME_REGION } from '@quorum/simulation/catalog'
import { nodeOrdinals } from '@quorum/simulation/labels'
import { solveFlow } from '@quorum/simulation/solve'
import {
  attachBoard,
  fitBoard,
  setBoard,
  watchBoardTheme,
  type BoardState,
} from '@quorum/ui/board/board'
import { DESIGNS } from '../patterns/designs/index.ts'

const NOOP = () => {}
watchBoardTheme()

export const drawDesign = (id: string, host: HTMLElement): (() => void) => {
  const design = DESIGNS[id]
  if (!design) return NOOP
  const key = `design-${id}`
  const game = design.game
  const state: BoardState = {
    locale: 'en',
    translate: (text) => text,
    game,
    ledger: solveFlow(game),
    selected: null,
    selection: [],
    placing: null,
    stamp: null,
    history: {},
    ordinals: nodeOrdinals(game),
    region: HOME_REGION,
    paused: true,
    speed: 1,
    suspended: false,
    cue: null,
    readOnly: true,
    animate: false,
    inset: { top: 16, bottom: 16, left: 0 },
    pad: 16,
    minScale: 0.6,
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
  // The board starts asynchronously and draws the state it was mounted with; fit it once the host
  // has its size, and again after the cards' layout settles. The board itself freezes after its
  // first frames, so a card is a picture, not a running game.
  const frame = requestAnimationFrame(() => fitBoard(key))
  const fitTimer = setTimeout(() => fitBoard(key), 400)
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(fitTimer)
    detach()
  }
}
