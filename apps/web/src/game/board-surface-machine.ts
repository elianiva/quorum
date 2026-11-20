import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { planState } from './machine.ts'

export const BoardFault = Schema.Literals(['webgl', 'start'])
export type BoardFault = typeof BoardFault.Type

export const BoardSurface = Schema.TaggedUnion({
  Starting: {},
  Ready: {},
  Unavailable: { reason: BoardFault },
})
export type BoardSurface = typeof BoardSurface.Type

export const BoardSurfaceEvent = Schema.TaggedUnion({
  Started: {},
  Unavailable: { reason: BoardFault },
})
export type BoardSurfaceEvent = typeof BoardSurfaceEvent.Type

const States = Machine.state({ states: BoardSurface.cases })
const Events = Machine.eventsFromSchemas(BoardSurfaceEvent)

export const boardSurfaceMachine = Machine.make({ root: States, events: Events }).handle({
  initial: { target: 'Starting' },
  states: {
    Starting: {
      on: {
        Started: { target: 'Ready', data: () => ({ _tag: 'Ready' }) },
        Unavailable: {
          target: 'Unavailable',
          data: ({ event }) => ({ _tag: 'Unavailable', reason: event.reason }),
        },
      },
    },
    Ready: {
      on: {
        Unavailable: {
          target: 'Unavailable',
          data: ({ event }) => ({ _tag: 'Unavailable', reason: event.reason }),
        },
      },
    },
    Unavailable: {
      on: {
        Started: { target: 'Ready', data: () => ({ _tag: 'Ready' }) },
      },
    },
  },
})

export const boardSurfaceStep = (surface: BoardSurface, event: BoardSurfaceEvent): BoardSurface =>
  planState(boardSurfaceMachine, surface, event)

export const surfaceReady = BoardSurface.guards.Ready
export const surfaceUnavailable = BoardSurface.guards.Unavailable
