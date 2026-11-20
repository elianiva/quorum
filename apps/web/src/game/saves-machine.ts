import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { planState } from './machine.ts'
import { EMPTY_SAVE_INDEX, SaveIndex } from './saves.ts'

export const SavesState = Schema.TaggedUnion({
  Loading: {},
  Ready: { index: SaveIndex },
  Failed: { reason: Schema.String },
})
export type SavesState = typeof SavesState.Type

export const SavesEvent = Schema.TaggedUnion({
  Loaded: { index: SaveIndex },
  Failed: { reason: Schema.String },
  Changed: { index: SaveIndex },
})
export type SavesEvent = typeof SavesEvent.Type

const States = Machine.state({ states: SavesState.cases })
const Events = Machine.eventsFromSchemas(SavesEvent)

export const savesMachine = Machine.make({ root: States, events: Events }).handle({
  initial: { target: 'Loading' },
  states: {
    Loading: {
      on: {
        Loaded: { target: 'Ready', data: ({ event }) => ({ _tag: 'Ready', index: event.index }) },
        Failed: {
          target: 'Failed',
          data: ({ event }) => ({ _tag: 'Failed', reason: event.reason }),
        },
      },
    },
    Ready: {
      on: {
        Changed: { target: 'Ready', data: ({ event }) => ({ _tag: 'Ready', index: event.index }) },
        Failed: {
          target: 'Failed',
          data: ({ event }) => ({ _tag: 'Failed', reason: event.reason }),
        },
      },
    },
    Failed: {
      on: {
        Loaded: { target: 'Ready', data: ({ event }) => ({ _tag: 'Ready', index: event.index }) },
      },
    },
  },
})

export const savesStep = (state: SavesState, event: SavesEvent): SavesState =>
  planState(savesMachine, state, event)

export const savesOf = (state: SavesState): SaveIndex =>
  SavesState.match(state, {
    Loading: () => EMPTY_SAVE_INDEX,
    Ready: ({ index }) => index,
    Failed: () => EMPTY_SAVE_INDEX,
  })

export const savesReady = SavesState.guards.Ready

export const withSaves = (state: SavesState, index: SaveIndex): SavesState =>
  savesReady(state) ? { _tag: 'Ready', index } : state
