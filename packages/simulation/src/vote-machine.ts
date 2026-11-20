import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { planState } from './machine.ts'
import { Vote } from './room.ts'

export const RoomVote = Schema.TaggedUnion({
  Idle: {},
  Open: { vote: Vote },
})
export type RoomVote = typeof RoomVote.Type

export const RoomVoteEvent = Schema.TaggedUnion({
  Opened: { vote: Vote },
  Balloted: { vote: Vote },
  Closed: {},
})
export type RoomVoteEvent = typeof RoomVoteEvent.Type

const States = Machine.state({ states: RoomVote.cases })
const Events = Machine.eventsFromSchemas(RoomVoteEvent)

export const voteMachine = Machine.make({ root: States, events: Events }).handle({
  initial: { target: 'Idle' },
  states: {
    Idle: {
      on: {
        Opened: { target: 'Open', data: ({ event }) => ({ vote: event.vote }) },
      },
    },
    Open: {
      on: {
        Balloted: { update: 'Open', data: ({ event }) => ({ vote: event.vote }) },
        Closed: { target: 'Idle' },
      },
    },
  },
})

export const voteStep = (vote: RoomVote, event: RoomVoteEvent): RoomVote =>
  planState(voteMachine, vote, event)

export const openVoteOf = (vote: RoomVote): Vote | null =>
  RoomVote.match(vote, {
    Idle: () => null,
    Open: ({ vote }) => vote,
  })
