import { Machine } from '@typeonce/effect-machine'
import { Effect, Schema } from 'effect'

export const HOLD_S = 0.6
export const DRAG_THRESHOLD_PX = 4

const snapshotOf = (state: Readonly<{ _tag: string }>): unknown => ({
  path: '',
  value: undefined,
  state: { path: state._tag, value: state },
})

const planState = <State extends Readonly<{ _tag: string }>>(
  machine: unknown,
  state: State,
  event: unknown,
): State => {
  const plan = Effect.runSync(
    Machine.plan(machine as never, snapshotOf(state) as never, event as never),
  )
  const transitions = plan.microsteps as ReadonlyArray<{ transitions: ReadonlyArray<unknown> }>
  if (transitions.every((step) => step.transitions.length === 0)) return state
  return (plan.next as unknown as Readonly<{ state: { value: State } }>).state.value
}

export const Point = Schema.Struct({ x: Schema.Finite, y: Schema.Finite })
export type Point = typeof Point.Type

export const LinkRef = Schema.Struct({ from: Schema.String, to: Schema.String })
export type LinkRef = typeof LinkRef.Type

export const TouchPoint = Schema.Struct({
  id: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
})
export type TouchPoint = typeof TouchPoint.Type

export const GestureState = Schema.TaggedUnion({
  Idle: {},
  PressPending: {
    pointerId: Schema.Finite,
    id: Schema.String,
    dx: Schema.Finite,
    dy: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
    since: Schema.NullOr(Schema.Finite),
  },
  Holding: {
    pointerId: Schema.Finite,
    id: Schema.String,
    dx: Schema.Finite,
    dy: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
    since: Schema.Finite,
    progress: Schema.Finite,
  },
  Panning: {
    pointerId: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
    moved: Schema.Boolean,
    cut: Schema.NullOr(LinkRef),
  },
  Dragging: {
    pointerId: Schema.Finite,
    id: Schema.String,
    dx: Schema.Finite,
    dy: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
    at: Point,
    moved: Schema.Boolean,
    frame: Schema.Boolean,
    footer: Schema.Boolean,
  },
  Linking: {
    pointerId: Schema.Finite,
    from: Schema.String,
    at: Point,
    snapTo: Schema.NullOr(Schema.String),
  },
  Boxing: {
    pointerId: Schema.Finite,
    from: Point,
    at: Point,
    snapTo: Schema.NullOr(Schema.String),
  },
  Pinching: {
    touches: Schema.Array(TouchPoint),
    distance: Schema.Finite,
  },
})
export type GestureState = typeof GestureState.Type

export const GestureEvent = Schema.TaggedUnion({
  EmptyPressed: {
    pointerId: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
    at: Point,
    cut: Schema.NullOr(LinkRef),
    box: Schema.Boolean,
  },
  NodePressed: {
    pointerId: Schema.Finite,
    id: Schema.String,
    dx: Schema.Finite,
    dy: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
    at: Point,
    frame: Schema.Boolean,
  },
  FooterPressed: {
    pointerId: Schema.Finite,
    id: Schema.String,
    dx: Schema.Finite,
    dy: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
    since: Schema.NullOr(Schema.Finite),
  },
  PortPressed: {
    pointerId: Schema.Finite,
    from: Schema.String,
    at: Point,
  },
  PointerMoved: {
    pointerId: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
    at: Point,
    over: Schema.NullOr(Schema.String),
  },
  PointerReleased: {
    at: Point,
    over: Schema.NullOr(Schema.String),
  },
  PointerCancelled: {},
  SecondTouch: {
    touches: Schema.Array(TouchPoint),
  },
  TouchEnded: {
    pointerId: Schema.Finite,
  },
  HoldTicked: {
    now: Schema.Finite,
  },
})
export type GestureEvent = typeof GestureEvent.Type

export const IDLE_GESTURE: GestureState = GestureState.cases.Idle.make({})

export const holdProgress = (since: number, now: number): number =>
  Math.max(0, Math.min(1, (now - since) / 1000 / HOLD_S))

const spreadOf = (touches: ReadonlyArray<TouchPoint>): number => {
  const [a, b] = touches
  return a && b ? Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) : 1
}

export const touchCenter = (touches: ReadonlyArray<TouchPoint>): Point => {
  const [a, b] = touches
  return a && b
    ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    : a
      ? { x: a.x, y: a.y }
      : { x: 0, y: 0 }
}

export const holdOf = (gesture: GestureState): Readonly<{ id: string; since: number }> | null =>
  GestureState.match(gesture, {
    Idle: () => null,
    PressPending: ({ id, since }) => (since === null ? null : { id, since }),
    Holding: ({ id, since }) => ({ id, since }),
    Panning: () => null,
    Dragging: () => null,
    Linking: () => null,
    Boxing: () => null,
    Pinching: () => null,
  })

export const pressedNode = (gesture: GestureState): string | null =>
  GestureState.match(gesture, {
    Idle: () => null,
    PressPending: ({ id }) => id,
    Holding: ({ id }) => id,
    Panning: () => null,
    Dragging: ({ id, footer }) => (footer ? id : null),
    Linking: () => null,
    Boxing: () => null,
    Pinching: () => null,
  })

const movedEnough = (
  state: Readonly<{ x: number; y: number }>,
  event: Readonly<{ x: number; y: number }>,
): boolean => Math.hypot(event.x - state.x, event.y - state.y) >= DRAG_THRESHOLD_PX

const dragFrom = (
  state: Readonly<{
    pointerId: number
    id: string
    dx: number
    dy: number
    x: number
    y: number
  }>,
  event: Readonly<{ at: Point }>,
): typeof GestureState.cases.Dragging.Type =>
  GestureState.cases.Dragging.make({
    pointerId: state.pointerId,
    id: state.id,
    dx: state.dx,
    dy: state.dy,
    x: state.x,
    y: state.y,
    at: event.at,
    moved: true,
    frame: false,
    footer: true,
  })

const pinchFrom = (
  event: Readonly<{ touches: ReadonlyArray<TouchPoint> }>,
): typeof GestureState.cases.Pinching.Type =>
  GestureState.cases.Pinching.make({
    touches: [...event.touches],
    distance: spreadOf(event.touches),
  })

const States = Machine.state({ states: GestureState.cases })
const Events = Machine.eventsFromSchemas(GestureEvent)

export const gestureMachine = Machine.make({
  root: States,
  events: Events,
  branches: {
    empty: {
      pan: { target: 'Panning' },
      box: { target: 'Boxing' },
    },
    hold: {
      held: { target: 'Holding' },
      done: { target: 'Idle' },
    },
    pinch: {
      held: { target: 'Pinching' },
      idle: { target: 'Idle' },
    },
  },
}).handle({
  initial: { target: 'Idle' },
  states: {
    Idle: {
      on: {
        EmptyPressed: {
          branches: 'empty',
          resolve: ({ event, select }) =>
            event.box
              ? select.box({
                  data: GestureState.cases.Boxing.make({
                    pointerId: event.pointerId,
                    from: event.at,
                    at: event.at,
                    snapTo: null,
                  }),
                })
              : select.pan({
                  data: GestureState.cases.Panning.make({
                    pointerId: event.pointerId,
                    x: event.x,
                    y: event.y,
                    moved: false,
                    cut: event.cut,
                  }),
                }),
        },
        NodePressed: {
          target: 'Dragging',
          data: ({ event }) =>
            GestureState.cases.Dragging.make({
              pointerId: event.pointerId,
              id: event.id,
              dx: event.dx,
              dy: event.dy,
              x: event.x,
              y: event.y,
              at: event.at,
              moved: false,
              frame: event.frame,
              footer: false,
            }),
        },
        FooterPressed: {
          target: 'PressPending',
          data: ({ event }) =>
            GestureState.cases.PressPending.make({
              pointerId: event.pointerId,
              id: event.id,
              dx: event.dx,
              dy: event.dy,
              x: event.x,
              y: event.y,
              since: event.since,
            }),
        },
        PortPressed: {
          target: 'Linking',
          data: ({ event }) =>
            GestureState.cases.Linking.make({
              pointerId: event.pointerId,
              from: event.from,
              at: event.at,
              snapTo: null,
            }),
        },
      },
    },
    PressPending: {
      on: {
        PointerMoved: {
          target: 'Dragging',
          guard: ({ state, event }) => movedEnough(state, event),
          data: ({ state, event }) => dragFrom(state, event),
        },
        PointerReleased: { target: 'Idle' },
        PointerCancelled: { target: 'Idle' },
        SecondTouch: {
          target: 'Pinching',
          data: ({ event }) => pinchFrom(event),
        },
        HoldTicked: {
          target: 'Holding',
          guard: ({ state, event }) =>
            state.since !== null && holdProgress(state.since, event.now) > 0,
          data: ({ state, event }) =>
            GestureState.cases.Holding.make({
              pointerId: state.pointerId,
              id: state.id,
              dx: state.dx,
              dy: state.dy,
              x: state.x,
              y: state.y,
              since: state.since ?? event.now,
              progress: state.since === null ? 0 : holdProgress(state.since, event.now),
            }),
        },
      },
    },
    Holding: {
      on: {
        PointerMoved: {
          target: 'Dragging',
          guard: ({ state, event }) => movedEnough(state, event),
          data: ({ state, event }) => dragFrom(state, event),
        },
        HoldTicked: {
          branches: 'hold',
          resolve: ({ state, event, select }) => {
            const progress = holdProgress(state.since, event.now)
            return progress >= 1
              ? select.done()
              : select.held({
                  data: GestureState.cases.Holding.make({ ...state, progress }),
                })
          },
        },
        PointerReleased: { target: 'Idle' },
        PointerCancelled: { target: 'Idle' },
        SecondTouch: {
          target: 'Pinching',
          data: ({ event }) => pinchFrom(event),
        },
      },
    },
    Panning: {
      on: {
        PointerMoved: {
          target: 'Panning',
          guard: ({ state, event }) => state.moved || movedEnough(state, event),
          data: ({ state, event }) =>
            GestureState.cases.Panning.make({
              ...state,
              x: event.x,
              y: event.y,
              moved: true,
            }),
        },
        PointerReleased: { target: 'Idle' },
        PointerCancelled: { target: 'Idle' },
        SecondTouch: {
          target: 'Pinching',
          data: ({ event }) => pinchFrom(event),
        },
      },
    },
    Dragging: {
      on: {
        PointerMoved: {
          target: 'Dragging',
          guard: ({ state, event }) => state.moved || movedEnough(state, event),
          data: ({ state, event }) =>
            GestureState.cases.Dragging.make({ ...state, at: event.at, moved: true }),
        },
        PointerReleased: { target: 'Idle' },
        PointerCancelled: { target: 'Idle' },
        SecondTouch: {
          target: 'Pinching',
          data: ({ event }) => pinchFrom(event),
        },
      },
    },
    Linking: {
      on: {
        PointerMoved: {
          target: 'Linking',
          data: ({ state, event }) =>
            GestureState.cases.Linking.make({
              ...state,
              at: event.at,
              snapTo: event.over !== null && event.over !== state.from ? event.over : null,
            }),
        },
        PointerReleased: { target: 'Idle' },
        PointerCancelled: { target: 'Idle' },
        SecondTouch: {
          target: 'Pinching',
          data: ({ event }) => pinchFrom(event),
        },
      },
    },
    Boxing: {
      on: {
        PointerMoved: {
          target: 'Boxing',
          data: ({ state, event }) =>
            GestureState.cases.Boxing.make({ ...state, at: event.at, snapTo: event.over }),
        },
        PointerReleased: { target: 'Idle' },
        PointerCancelled: { target: 'Idle' },
        SecondTouch: {
          target: 'Pinching',
          data: ({ event }) => pinchFrom(event),
        },
      },
    },
    Pinching: {
      on: {
        SecondTouch: {
          target: 'Pinching',
          guard: ({ state }) => state.touches.length < 2,
          data: ({ event }) => pinchFrom(event),
        },
        PointerMoved: {
          target: 'Pinching',
          guard: ({ state, event }) => state.touches.some((touch) => touch.id === event.pointerId),
          data: ({ state, event }) => {
            const touches = state.touches.map((touch) =>
              touch.id === event.pointerId ? { id: touch.id, x: event.x, y: event.y } : touch,
            )
            return GestureState.cases.Pinching.make({
              touches,
              distance: touches.length >= 2 ? spreadOf(touches) : state.distance,
            })
          },
        },
        TouchEnded: {
          branches: 'pinch',
          resolve: ({ state, event, select }) => {
            const touches = state.touches.filter((touch) => touch.id !== event.pointerId)
            return touches.length === 0
              ? select.idle()
              : select.held({
                  data: GestureState.cases.Pinching.make({ touches, distance: state.distance }),
                })
          },
        },
      },
    },
  },
})

export const gestureStep = (gesture: GestureState, event: GestureEvent): GestureState =>
  planState(gestureMachine, gesture, event)
