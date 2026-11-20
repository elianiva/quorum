import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { planState } from './machine.ts'

export const QuarterPhase = Schema.TaggedUnion({
  AwaitingGuidance: {},
  Running: {},
})
export type QuarterPhase = typeof QuarterPhase.Type

export const QuarterResult = Schema.Struct({
  beat: Schema.Boolean,
  growth: Schema.Finite,
  margin: Schema.Finite,
})
export type QuarterResult = typeof QuarterResult.Type

const QUARTER_FIELDS = {
  index: Schema.Finite,
  startedAt: Schema.Finite,
  growth: Schema.Finite,
  margin: Schema.Finite,
  revenue: Schema.Finite,
  streak: Schema.Finite,
  bonus: Schema.Finite,
  last: Schema.NullOr(QuarterResult),
  phase: QuarterPhase,
} as const

export const Quarter = Schema.Struct(QUARTER_FIELDS)
export type Quarter = typeof Quarter.Type

export const QuarterState = Schema.TaggedUnion({
  NotStarted: {},
  Active: QUARTER_FIELDS,
})
export type QuarterState = typeof QuarterState.Type

export const QuarterEvent = Schema.TaggedUnion({
  Started: {
    startedAt: Schema.Finite,
    revenue: Schema.Finite,
  },
  GuidanceSet: {
    growth: Schema.Finite,
    margin: Schema.Finite,
  },
  Ended: {
    startedAt: Schema.Finite,
    revenue: Schema.Finite,
    streak: Schema.Finite,
    bonus: Schema.Finite,
    last: QuarterResult,
  },
})
export type QuarterEvent = typeof QuarterEvent.Type

const States = Machine.state({ states: QuarterState.cases })
const Events = Machine.eventsFromSchemas(QuarterEvent)

export const quarterMachine = Machine.make({ root: States, events: Events }).handle({
  initial: { target: 'NotStarted' },
  states: {
    NotStarted: {
      on: {
        Started: {
          target: 'Active',
          data: ({ event }) => ({
            _tag: 'Active',
            index: 1,
            startedAt: event.startedAt,
            growth: 0,
            margin: 0,
            revenue: event.revenue,
            streak: 0,
            bonus: 0,
            last: null,
            phase: { _tag: 'AwaitingGuidance' },
          }),
        },
      },
    },
    Active: {
      on: {
        GuidanceSet: {
          target: 'Active',
          guard: ({ state }) => QuarterPhase.guards.AwaitingGuidance(state.phase),
          data: ({ state, event }) => ({
            ...state,
            growth: event.growth,
            margin: event.margin,
            phase: { _tag: 'Running' },
          }),
        },
        Ended: {
          target: 'Active',
          data: ({ state, event }) => ({
            ...state,
            index: state.index + 1,
            startedAt: event.startedAt,
            revenue: event.revenue,
            streak: event.streak,
            bonus: event.bonus,
            last: event.last,
            phase: { _tag: 'AwaitingGuidance' },
          }),
        },
      },
    },
  },
})

export const step = (state: QuarterState, event: QuarterEvent): QuarterState =>
  planState(quarterMachine, state, event)
