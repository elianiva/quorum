import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { planState } from '@quorum/simulation/machine'

export const RoomLifecycle = Schema.TaggedUnion({
  Live: {},
  Abandoned: { since: Schema.Finite },
  Idle: { since: Schema.Finite },
  Ended: { reason: Schema.Literals(['handover']) },
})
export type RoomLifecycle = typeof RoomLifecycle.Type

export const RoomLifecycleEvent = Schema.TaggedUnion({
  Emptied: { at: Schema.Finite },
  Abandoned: { at: Schema.Finite },
  Joined: {},
  Ended: { reason: Schema.Literals(['handover']) },
  Revived: {},
})
export type RoomLifecycleEvent = typeof RoomLifecycleEvent.Type

const States = Machine.state({ states: RoomLifecycle.cases })
const Events = Machine.eventsFromSchemas(RoomLifecycleEvent)

export const roomLifecycleMachine = Machine.make({ root: States, events: Events }).handle({
  initial: { target: 'Idle', data: { since: 0 } },
  states: {
    Live: {
      on: {
        Emptied: { target: 'Idle', data: ({ event }) => ({ since: event.at }) },
        Abandoned: { target: 'Abandoned', data: ({ event }) => ({ since: event.at }) },
        Ended: { target: 'Ended', data: ({ event }) => ({ reason: event.reason }) },
      },
    },
    Abandoned: {
      on: {
        Joined: { target: 'Live' },
        Emptied: { target: 'Idle', data: ({ event }) => ({ since: event.at }) },
        Ended: { target: 'Ended', data: ({ event }) => ({ reason: event.reason }) },
        Revived: { target: 'Live' },
      },
    },
    Idle: {
      on: {
        Joined: { target: 'Live' },
        Revived: { target: 'Live' },
      },
    },
    Ended: {
      on: {
        Revived: { target: 'Live' },
      },
    },
  },
})

export const step = (lifecycle: RoomLifecycle, event: RoomLifecycleEvent): RoomLifecycle =>
  planState(roomLifecycleMachine, lifecycle, event)
