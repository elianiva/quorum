import {
  attachBoard,
  fitBoard,
  setBoard,
  watchBoardTheme,
  zoomBoard,
  type BoardState,
} from '@quorum/ui/board/board'

const NOOP = () => {}
watchBoardTheme()

export const BOARD_KEY = 'catalog-stage'

export const draw = (state: BoardState): void => {
  setBoard(BOARD_KEY, state)
  requestAnimationFrame(() => fitBoard(BOARD_KEY))
}

export const zoom = (direction: 1 | -1): void => zoomBoard(BOARD_KEY, direction)

export const fit = (): void => fitBoard(BOARD_KEY)

export const attach = (host: HTMLElement): (() => void) => {
  const detach = attachBoard(BOARD_KEY, host, {
    onSlot: NOOP,
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
  const timer = setTimeout(fit, 400)
  return () => {
    clearTimeout(timer)
    detach()
  }
}

export const meter = (element: HTMLElement): (() => void) => {
  let frames = 0
  let since = performance.now()
  let id = requestAnimationFrame(function tick(now) {
    frames += 1
    if (now - since >= 1000) {
      element.textContent = `${Math.round((frames * 1000) / (now - since))} fps`
      frames = 0
      since = now
    }
    id = requestAnimationFrame(tick)
  })
  return () => cancelAnimationFrame(id)
}
