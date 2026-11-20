import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { planState } from './machine.ts'

export const PwaInstall = Schema.TaggedUnion({
  Unavailable: {},
  Installable: {},
  Prompting: {},
  Installed: {},
})
export type PwaInstall = typeof PwaInstall.Type

export const PwaEvent = Schema.TaggedUnion({
  Snapshot: { installable: Schema.Boolean, installed: Schema.Boolean },
  Prompted: {},
  Accepted: {},
  Dismissed: {},
  Unavailable: {},
})
export type PwaEvent = typeof PwaEvent.Type

const States = Machine.state({ states: PwaInstall.cases })
const Events = Machine.eventsFromSchemas(PwaEvent)

export const pwaMachine = Machine.make({ root: States, events: Events }).handle({
  initial: { target: 'Unavailable' },
  states: {
    Unavailable: {
      on: {
        Prompted: { target: 'Unavailable', data: () => ({ _tag: 'Unavailable' }) },
        Accepted: { target: 'Installed', data: () => ({ _tag: 'Installed' }) },
      },
    },
    Installable: {
      on: {
        Prompted: { target: 'Prompting', data: () => ({ _tag: 'Prompting' }) },
        Accepted: { target: 'Installed', data: () => ({ _tag: 'Installed' }) },
      },
    },
    Prompting: {
      on: {
        Accepted: { target: 'Installed', data: () => ({ _tag: 'Installed' }) },
        Dismissed: { target: 'Installable', data: () => ({ _tag: 'Installable' }) },
        Unavailable: { target: 'Unavailable', data: () => ({ _tag: 'Unavailable' }) },
      },
    },
    Installed: {
      on: {
        Prompted: { target: 'Installed', data: () => ({ _tag: 'Installed' }) },
      },
    },
  },
})

export const pwaStep = (state: PwaInstall, event: PwaEvent): PwaInstall =>
  event._tag === 'Snapshot' ? pwaFrom(event) : planState(pwaMachine, state, event)

export const pwaFrom = (snapshot: { installable: boolean; installed: boolean }): PwaInstall =>
  snapshot.installed
    ? PwaInstall.cases.Installed.make({})
    : snapshot.installable
      ? PwaInstall.cases.Installable.make({})
      : PwaInstall.cases.Unavailable.make({})

export const pwaInstalled = PwaInstall.guards.Installed
export const pwaInstallable = PwaInstall.guards.Installable
