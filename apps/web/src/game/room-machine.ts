import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { planState } from './machine.ts'

export const RoomEnd = Schema.Literals(['offline', 'handover', 'expired', 'stale', 'removed'])
export type RoomEnd = typeof RoomEnd.Type

export const RoomPhase = Schema.TaggedUnion({
  Idle: {},
  Connecting: { code: Schema.String },
  Online: {
    code: Schema.String,
    seat: Schema.String,
    owner: Schema.Boolean,
  },
  Reconnecting: {
    code: Schema.String,
    seat: Schema.String,
    owner: Schema.Boolean,
  },
  Closed: { code: Schema.String, reason: RoomEnd },
})
export type RoomPhase = typeof RoomPhase.Type

export const RoomEvent = Schema.TaggedUnion({
  Connecting: { code: Schema.String },
  Joined: { seat: Schema.String, owner: Schema.Boolean },
  Dropped: {},
  Ended: { reason: RoomEnd },
  Left: {},
})
export type RoomEvent = typeof RoomEvent.Type

const States = Machine.state({ states: RoomPhase.cases })
const Events = Machine.eventsFromSchemas(RoomEvent)

export const roomMachine = Machine.make({ root: States, events: Events }).handle({
  initial: { target: 'Idle' },
  states: {
    Idle: {
      on: {
        Connecting: { target: 'Connecting', data: ({ event }) => ({ code: event.code }) },
      },
    },
    Connecting: {
      on: {
        Joined: {
          target: 'Online',
          data: ({ state, event }) => ({
            code: state.code,
            seat: event.seat,
            owner: event.owner,
          }),
        },
        Ended: { target: 'Closed', data: (args) => ended(args) },
        Left: { target: 'Idle' },
      },
    },
    Online: {
      on: {
        Dropped: {
          target: 'Reconnecting',
          data: ({ state }) => ({ code: state.code, seat: state.seat, owner: state.owner }),
        },
        Ended: { target: 'Closed', data: (args) => ended(args) },
        Left: { target: 'Idle' },
        Connecting: { target: 'Connecting', data: ({ event }) => ({ code: event.code }) },
      },
    },
    Reconnecting: {
      on: {
        Joined: {
          target: 'Online',
          data: ({ state, event }) => ({
            code: state.code,
            seat: event.seat,
            owner: event.owner,
          }),
        },
        Ended: { target: 'Closed', data: (args) => ended(args) },
        Left: { target: 'Idle' },
      },
    },
    Closed: {
      on: {
        Connecting: { target: 'Connecting', data: ({ event }) => ({ code: event.code }) },
        Left: { target: 'Idle' },
      },
    },
  },
})

const ended = ({
  state,
  event,
}: {
  state: RoomPhase
  event: Extract<RoomEvent, { _tag: 'Ended' }>
}) =>
  RoomPhase.match(state, {
    Idle: () => ({ code: '', reason: event.reason }),
    Connecting: ({ code }) => ({ code, reason: event.reason }),
    Online: ({ code }) => ({ code, reason: event.reason }),
    Reconnecting: ({ code }) => ({ code, reason: event.reason }),
    Closed: ({ code }) => ({ code, reason: event.reason }),
  })

export const roomStep = (phase: RoomPhase, event: RoomEvent): RoomPhase =>
  planState(roomMachine, phase, event)

export const inRoom = RoomPhase.isAnyOf(['Connecting', 'Online', 'Reconnecting'])
