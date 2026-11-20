import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { planState } from './machine.ts'

export const AgentSync = Schema.TaggedUnion({
  Off: {},
  Waiting: {},
  Creating: { companyId: Schema.String },
  Ready: {
    companyId: Schema.String,
    roomId: Schema.String,
    epoch: Schema.String,
    rev: Schema.Finite,
  },
  Uploading: {
    companyId: Schema.String,
    roomId: Schema.String,
    epoch: Schema.String,
    rev: Schema.Finite,
  },
  Failed: { reason: Schema.String },
})
export type AgentSync = typeof AgentSync.Type

export const AgentSyncEvent = Schema.TaggedUnion({
  Enabled: {},
  Disabled: {},
  Watching: { companyId: Schema.String },
  RoomCreated: {
    companyId: Schema.String,
    roomId: Schema.String,
    epoch: Schema.String,
  },
  Uploading: {},
  Uploaded: { rev: Schema.Finite },
  Failed: { reason: Schema.String },
})
export type AgentSyncEvent = typeof AgentSyncEvent.Type

const States = Machine.state({ states: AgentSync.cases })
const Events = Machine.eventsFromSchemas(AgentSyncEvent)

export const agentSyncMachine = Machine.make({ root: States, events: Events }).handle({
  initial: { target: 'Off' },
  states: {
    Off: {
      on: {
        Enabled: { target: 'Waiting', data: () => ({ _tag: 'Waiting' }) },
      },
    },
    Waiting: {
      on: {
        Disabled: { target: 'Off', data: () => ({ _tag: 'Off' }) },
        Watching: {
          target: 'Creating',
          data: ({ event }) => ({ _tag: 'Creating', companyId: event.companyId }),
        },
      },
    },
    Creating: {
      on: {
        Disabled: { target: 'Off', data: () => ({ _tag: 'Off' }) },
        RoomCreated: {
          target: 'Ready',
          data: ({ event }) => ({
            _tag: 'Ready',
            companyId: event.companyId,
            roomId: event.roomId,
            epoch: event.epoch,
            rev: 0,
          }),
        },
        Watching: {
          target: 'Creating',
          data: ({ event }) => ({ _tag: 'Creating', companyId: event.companyId }),
        },
        Failed: {
          target: 'Failed',
          data: ({ event }) => ({ _tag: 'Failed', reason: event.reason }),
        },
      },
    },
    Ready: {
      on: {
        Disabled: { target: 'Off', data: () => ({ _tag: 'Off' }) },
        Watching: {
          target: 'Creating',
          data: ({ event }) => ({ _tag: 'Creating', companyId: event.companyId }),
        },
        Uploading: {
          target: 'Uploading',
          data: ({ state }) => ({ ...state, _tag: 'Uploading' }),
        },
      },
    },
    Uploading: {
      on: {
        Disabled: { target: 'Off', data: () => ({ _tag: 'Off' }) },
        Uploaded: {
          target: 'Ready',
          data: ({ state, event }) => ({ ...state, _tag: 'Ready', rev: event.rev }),
        },
        Failed: {
          target: 'Failed',
          data: ({ event }) => ({ _tag: 'Failed', reason: event.reason }),
        },
      },
    },
    Failed: {
      on: {
        Disabled: { target: 'Off', data: () => ({ _tag: 'Off' }) },
        Enabled: { target: 'Waiting', data: () => ({ _tag: 'Waiting' }) },
        Watching: {
          target: 'Creating',
          data: ({ event }) => ({ _tag: 'Creating', companyId: event.companyId }),
        },
      },
    },
  },
})

export const agentSyncStep = (state: AgentSync, event: AgentSyncEvent): AgentSync =>
  planState(agentSyncMachine, state, event)

export const agentSyncEnabled = (state: AgentSync): boolean => !AgentSync.guards.Off(state)
