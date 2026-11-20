import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { RESEARCH_IDS } from './catalog.ts'
import { planState } from './machine.ts'

export const StudyId = Schema.Literals(RESEARCH_IDS)
export type StudyId = typeof StudyId.Type

export const StudyPhase = Schema.TaggedUnion({
  Queued: { progress: Schema.Finite },
  Running: { progress: Schema.Finite },
})
export type StudyPhase = typeof StudyPhase.Type

export const StudyEvent = Schema.TaggedUnion({
  Queued: { progress: Schema.Finite },
  Started: {},
  Ticked: { progress: Schema.Finite },
})
export type StudyEvent = typeof StudyEvent.Type

export const Study = Schema.Struct({ id: StudyId, phase: StudyPhase })
export type Study = typeof Study.Type

export const StudyQueue = Schema.TaggedUnion({
  Empty: {},
  Working: {
    current: Study,
    queued: Schema.Array(Study),
  },
})
export type StudyQueue = typeof StudyQueue.Type

export type Working = Extract<StudyQueue, { _tag: 'Working' }>

export const StudyQueueEvent = Schema.TaggedUnion({
  Added: { studies: Schema.Array(Study), first: Schema.Boolean },
  Cancelled: { ids: Schema.Array(StudyId) },
  Moved: { id: StudyId, to: Schema.Finite },
  Ticked: { study: Study },
  Finished: {},
})
export type StudyQueueEvent = typeof StudyQueueEvent.Type

export const studyList = (queue: StudyQueue): ReadonlyArray<Study> =>
  queue._tag === 'Empty' ? [] : [queue.current, ...queue.queued]

export const studyCount = (queue: StudyQueue): number =>
  queue._tag === 'Empty' ? 0 : 1 + queue.queued.length

export const currentStudy = (queue: StudyQueue): Study | undefined =>
  queue._tag === 'Empty' ? undefined : queue.current

export const studyOf = (queue: StudyQueue, id: StudyId): Study | undefined =>
  studyList(queue).find((entry) => entry.id === id)

const working = (studies: ReadonlyArray<Study>): Working => ({
  _tag: 'Working',
  current: studies[0] as Study,
  queued: studies.slice(1),
})

const queueOf = (studies: ReadonlyArray<Study>): StudyQueue =>
  studies.length === 0 ? { _tag: 'Empty' } : working(studies)

const merge = (state: Working, studies: ReadonlyArray<Study>, first: boolean): Working => {
  const incoming = new Set(studies.map((entry) => entry.id))
  const kept = [state.current, ...state.queued].filter((entry) => !incoming.has(entry.id))
  return working(first ? [...studies, ...kept] : [...kept, ...studies])
}

const without = (queue: StudyQueue, ids: ReadonlyArray<StudyId>): StudyQueue => {
  const gone = new Set(ids)
  return queueOf(studyList(queue).filter((entry) => !gone.has(entry.id)))
}

const moved = (state: Working, id: StudyId, to: number): Working => {
  const list = [...studyList(state)]
  const from = list.findIndex((entry) => entry.id === id)
  const [entry] = list.splice(from, 1)
  if (!entry) return state
  list.splice(Math.max(0, Math.min(list.length, Math.trunc(to))), 0, entry)
  return working(list)
}

const PhaseStates = Machine.state({ states: StudyPhase.cases })
const PhaseEvents = Machine.eventsFromSchemas(StudyEvent)

export const studyMachine = Machine.make({ root: PhaseStates, events: PhaseEvents }).handle({
  initial: { target: 'Queued', data: { progress: 0 } },
  states: {
    Queued: {
      on: {
        Queued: {
          target: 'Queued',
          data: ({ event }) => ({ _tag: 'Queued', progress: event.progress }),
        },
        Started: {
          target: 'Running',
          data: ({ state }) => ({ _tag: 'Running', progress: state.progress }),
        },
      },
    },
    Running: {
      on: {
        Ticked: {
          target: 'Running',
          data: ({ event }) => ({ _tag: 'Running', progress: event.progress }),
        },
      },
    },
  },
})

export const phaseStep = (phase: StudyPhase, event: StudyEvent): StudyPhase =>
  planState(studyMachine, phase, event)

const QueueStates = Machine.state({ states: StudyQueue.cases })
const QueueEvents = Machine.eventsFromSchemas(StudyQueueEvent)

export const studyQueueMachine = Machine.make({
  root: QueueStates,
  events: QueueEvents,
  branches: {
    insert: { empty: { target: 'Empty' }, working: { target: 'Working' } },
    remove: { empty: { target: 'Empty' }, working: { target: 'Working' } },
  },
}).handle({
  initial: { target: 'Empty' },
  states: {
    Empty: {
      on: {
        Added: {
          branches: 'insert',
          resolve: ({ event, select }) =>
            event.studies.length === 0
              ? select.empty()
              : select.working({ data: working(event.studies) }),
        },
      },
    },
    Working: {
      on: {
        Added: {
          target: 'Working',
          data: ({ state, event }) => merge(state, event.studies, event.first),
        },
        Cancelled: {
          branches: 'remove',
          resolve: ({ state, event, select }) => {
            const left = without(state, event.ids)
            return left._tag === 'Working' ? select.working({ data: left }) : select.empty()
          },
        },
        Moved: {
          target: 'Working',
          guard: ({ state, event }) => studyList(state).some((entry) => entry.id === event.id),
          data: ({ state, event }) => moved(state, event.id, event.to),
        },
        Ticked: {
          target: 'Working',
          guard: ({ state, event }) => state.current.id === event.study.id,
          data: ({ state, event }) => ({
            _tag: 'Working',
            current: event.study,
            queued: state.queued,
          }),
        },
        Finished: {
          branches: 'remove',
          resolve: ({ state, select }) => {
            const left = queueOf(studyList(state).slice(1))
            return left._tag === 'Working' ? select.working({ data: left }) : select.empty()
          },
        },
      },
    },
  },
})

export const queueStep = (queue: StudyQueue, event: StudyQueueEvent): StudyQueue =>
  planState(studyQueueMachine, queue, event)
