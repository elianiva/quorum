import { type SeatActivity } from '@quorum/simulation/room'
import { BoardController } from './controller.ts'
import { type SeatCursor } from './cursors.ts'
import { resetPalette } from './palette.ts'
import type { BoardEvents, BoardState } from './types.ts'

export type { BoardEvents, BoardSound, BoardState, Stamp } from './types.ts'

export const ZOOM_STEP = 1.2

const desired = new Map<string, BoardState>()
const controllers = new Map<string, BoardController>()

export const setBoard = (key: string, state: BoardState): void => {
  desired.set(key, state)
  controllers.get(key)?.draw(state)
}

export const fitBoard = (key: string): void => controllers.get(key)?.fit()

export const zoomBoard = (key: string, direction: 1 | -1): void =>
  controllers.get(key)?.zoomBy(direction === 1 ? ZOOM_STEP : 1 / ZOOM_STEP)

export const focusBoard = (key: string, nodeId: string): void => controllers.get(key)?.focus(nodeId)

export const repaintBoards = (): void => {
  resetPalette()
  for (const controller of controllers.values()) controller.repaint()
}

let watchingTheme = false

export const watchBoardTheme = (): void => {
  if (watchingTheme) return
  watchingTheme = true
  window.addEventListener('quorum:theme', repaintBoards)
}

const hasWebgl = (): boolean => {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export const attachBoard = (key: string, host: HTMLElement, events: BoardEvents): (() => void) => {
  if (!hasWebgl()) {
    host.dataset['boardUnavailable'] = 'webgl'
    return () => undefined
  }
  const controller = new BoardController(host, events)
  controllers.set(key, controller)
  controller
    .start(desired.get(key))
    .then(() => controller.fit())
    .catch((error: unknown) => {
      console.error(`Quorum: the "${key}" board failed to start`, error)
      host.dataset['boardUnavailable'] = 'error'
      events.onStartFailed?.(error)
    })
  return () => {
    controller.destroy()
    if (controllers.get(key) === controller) controllers.delete(key)
  }
}

export const moveSeatCursor = (key: string, cursor: SeatCursor): void => {
  controllers.get(key)?.moveSeatCursor(cursor)
}

export const hideSeatCursor = (key: string, seat: string): void => {
  controllers.get(key)?.hideSeatCursor(seat)
}

export const clearSeatCursors = (key: string): void => {
  controllers.get(key)?.clearSeatCursors()
}

export const setSeatActivity = (key: string, activity: SeatActivity | null): void => {
  controllers.get(key)?.setCursorActivity(activity)
}
