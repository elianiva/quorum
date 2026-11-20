import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { planState } from './machine.ts'

export const DataMovePhase = Schema.TaggedUnion({
  Idle: {},
  Building: {},
  Copying: { until: Schema.Finite },
  Landed: {},
})
export type DataMovePhase = typeof DataMovePhase.Type

export const DataMoveEvent = Schema.TaggedUnion({
  Queued: {},
  Built: { until: Schema.Finite },
  Landed: {},
  Finished: {},
})
export type DataMoveEvent = typeof DataMoveEvent.Type

const States = Machine.state({ states: DataMovePhase.cases })
const Events = Machine.eventsFromSchemas(DataMoveEvent)

const idle = () => ({ _tag: 'Idle' as const })

export const dataMoveMachine = Machine.make({ root: States, events: Events }).handle({
  initial: { target: 'Idle' },
  states: {
    Idle: {
      on: {
        Queued: { target: 'Building', data: () => ({ _tag: 'Building' }) },
      },
    },
    Building: {
      on: {
        Built: {
          target: 'Copying',
          data: ({ event }) => ({ _tag: 'Copying', until: event.until }),
        },
        Finished: { target: 'Idle', data: idle },
      },
    },
    Copying: {
      on: {
        Landed: { target: 'Landed', data: () => ({ _tag: 'Landed' }) },
        Finished: { target: 'Idle', data: idle },
      },
    },
    Landed: {
      on: {
        Finished: { target: 'Idle', data: idle },
      },
    },
  },
})

export const step = (phase: DataMovePhase, event: DataMoveEvent): DataMovePhase =>
  planState(dataMoveMachine, phase, event)

export const isIdle = DataMovePhase.guards.Idle
export const finished = DataMovePhase.guards.Landed
