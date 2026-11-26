import { Refusal } from '@quorum/simulation/actions'
import { copyIn, type Messages } from './messages.ts'

type Name = (t: Messages) => string

const names = (() => {
  const index = new Map<string, Name>()
  const english = copyIn('en')
  const catalog = english.catalog as unknown as Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, unknown>>>>>
  >
  for (const [table, entries] of Object.entries(catalog))
    for (const [id, fields] of Object.entries(entries))
      for (const field of ['name', 'label'])
        if (typeof fields?.[field] === 'string' && !index.has(fields[field] as string))
          index.set(fields[field] as string, (t) => {
            const entry = (
              t.catalog as unknown as Record<string, Record<string, Record<string, string>>>
            )[table]?.[id]
            return entry?.[field] ?? (fields[field] as string)
          })
  for (const [key, text] of Object.entries(english.toasts.whats))
    if (!index.has(text))
      index.set(
        text,
        (t) => (t.toasts.whats as unknown as Readonly<Record<string, string>>)[key] ?? text,
      )
  return index
})()

const reasonIds = new Map(
  Object.entries(copyIn('en').toasts.reasons).map(([id, text]) => [text, id] as const),
)

const kindIds = new Map(
  Object.entries(copyIn('en').catalog.kinds).map(
    ([id, entry]) => [entry.label.toLowerCase(), id] as const,
  ),
)

const lowerFirst = (text: string): string =>
  /^[A-Z][a-z]/.test(text) ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text

/** A Request kind label inside a sentence, in the reader's language. */
export const kindIn = (t: Messages, text: string): string => {
  if (t === copyIn('en')) return text
  const id = kindIds.get(text.toLowerCase())
  if (id === undefined) return text
  const kinds = t.catalog.kinds as unknown as Readonly<Record<string, Readonly<{ label: string }>>>
  const label = kinds[id]?.label
  return label === undefined ? text : lowerFirst(label)
}

export const nameIn = (t: Messages, text: string): string => names.get(text)?.(t) ?? text

const patterns: ReadonlyArray<
  readonly [RegExp, (t: Messages, found: ReadonlyArray<string>) => string]
> = [
  [
    /^Every (.+) is at its largest size\.$/,
    (t, [a]) => t.toasts.reason.everyLargestSize(nameIn(t, a!)),
  ],
  [/^(.+) is at its largest size\.$/, (t, [a]) => t.toasts.reason.largestSize(nameIn(t, a!))],
  [/^(.+) is at its smallest size\.$/, (t, [a]) => t.toasts.reason.smallestSize(nameIn(t, a!))],
  [/^(.+) cannot be placed\.$/, (t, [a]) => t.toasts.reason.cannotBePlaced(nameIn(t, a!))],
  [/^(.+) has not failed\.$/, (t, [a]) => t.toasts.reason.notFailed(nameIn(t, a!))],
  [/^(.+) needs (\d+) Legacy\.$/, (t, [a, b]) => t.toasts.reason.needsLegacy(nameIn(t, a!), b!)],
  [/^(.+) is at its top level\.$/, (t, [a]) => t.toasts.reason.topLevel(nameIn(t, a!))],
  [/^(.+) is already on the Board\.$/, (t, [a]) => t.toasts.reason.onTheBoard(nameIn(t, a!))],
  [/^(.+) is not Postgres\.$/, (t, [a]) => t.toasts.reason.notPostgres(nameIn(t, a!))],
  [/^Every Playbook slot is full \((\d+)\)\. .*$/, (t, [a]) => t.toasts.reason.slotsFull(a!)],
  [
    /^That save is from another version \((.+); this build reads (.+)\)\.$/,
    (t, [a, b]) => t.toasts.reason.otherBuild(a!, b!),
  ],
  [
    /^The Design needs (.+) Dev Hours; the budget is (.+)\.$/,
    (t, [a, b]) => t.toasts.reason.devHours(a!, b!),
  ],
  [
    /^(.+) needs (.+) first\.$/,
    (t, [a, b]) => t.toasts.reason.needsFirst(nameIn(t, a!), nameIn(t, b!)),
  ],
  [
    /^The queue holds (\d+) Studies, and (.+) needs (\d+) of them\.$/,
    (t, [a, b, c]) => t.toasts.reason.queueTooShort(a!, nameIn(t, b!), c!),
  ],
  [
    /^Link App Servers or Workers into the (.+)\.$/,
    (t, [a]) => t.toasts.reason.linkInto(nameIn(t, a!)),
  ],
  [
    /^(.+) already has a (.+)\.$/,
    (t, [a, b]) => t.toasts.reason.alreadyHas(nameIn(t, a!), nameIn(t, b!)),
  ],
  [
    /^Link (.+) into a Kubernetes Cluster first: the sidecar rides in its pod\.$/,
    (t, [a]) => t.toasts.reason.linkIntoClusterFirst(nameIn(t, a!)),
  ],
  [
    /^Link a Database into the (.+): it reads its write log\.$/,
    (t, [a]) => t.toasts.reason.linkDatabaseInto(nameIn(t, a!)),
  ],
  [
    /^(.+) has no traffic to sample\.$/,
    (t, [a]) => t.toasts.reason.noTrafficToSample(nameIn(t, a!)),
  ],
  [
    /^(.+) sends nothing on\. Link it into Analytics to sample it\.$/,
    (t, [a]) => t.toasts.reason.sendsNothingOn(nameIn(t, a!)),
  ],
  [/^(.+) has no input\.$/, (t, [a]) => t.toasts.reason.hasNoInput(nameIn(t, a!))],
  [
    /^(.+) does not call (.+)\.$/,
    (t, [a, b]) => t.toasts.reason.cannotCall(nameIn(t, a!), nameIn(t, b!)),
  ],
  [/^(.+) takes (\d+) links\.$/, (t, [a, b]) => t.toasts.reason.takesLinks(nameIn(t, a!), b!)],
  [
    /^(.+) takes (.+)\. (.+) sends (.+)\.$/,
    (t, [target, takes, source, sends]) =>
      t.toasts.reason.takesSends(
        nameIn(t, target!),
        takes!
          .split(', ')
          .map((kind) => kindIn(t, kind))
          .join(', '),
        nameIn(t, source!),
        sends!
          .split(', ')
          .map((kind) => kindIn(t, kind))
          .join(', '),
      ),
  ],
  [/^(.+) has no Product lever\.$/, (t, [a]) => t.levers.noLever(nameIn(t, a!))],
  [/^A Challenge pins its mix\.$/, (t) => t.levers.pinned],
  [/^The (.+) lever is at its last step\.$/, (t, [a]) => t.levers.lastStep(nameIn(t, a!))],
  [/^The Company does not serve (.+)\.$/, (t, [a]) => t.levers.notServed(nameIn(t, a!))],
  [
    /^A (.+) lever step is already on the backlog\.$/,
    (t, [a]) => t.levers.onBacklog(nameIn(t, a!)),
  ],
  [
    /^The (.+) lever step (\d+) opens in (.+)\.$/,
    (t, [a, b, c]) => t.levers.opens(nameIn(t, a!), Number(b), nameIn(t, c!)),
  ],
  [
    /^(.+) caps the (.+) lever at its first step\.$/,
    (t, [a, b]) => t.levers.capped(nameIn(t, a!), nameIn(t, b!)),
  ],
  [/^The (.+) lever is already off\.$/, (t, [a]) => t.levers.alreadyOff(nameIn(t, a!))],
  [/^A (.+) lever step is on the backlog\.$/, (t, [a]) => t.levers.onBacklogRemove(nameIn(t, a!))],
]

export const reasonIn = (t: Messages, text: string): string => {
  const id = reasonIds.get(text)
  if (id !== undefined) return (t.toasts.reasons as Readonly<Record<string, string>>)[id] ?? text
  for (const [pattern, write] of patterns) {
    const found = pattern.exec(text)
    if (found) return write(t, found.slice(1))
  }
  return text
}

export const refusalIn = (t: Messages, refusal: Refusal): string =>
  Refusal.$match(refusal, {
    Locked: ({ what, research }) => t.team.refusal.locked(nameIn(t, what), nameIn(t, research)),
    TooEarly: ({ what, era }) => t.team.refusal.tooEarly(nameIn(t, what), nameIn(t, era)),
    Unaffordable: ({ what, price }) =>
      t.toasts.costs(nameIn(t, what), `$${Math.round(price).toLocaleString('en-US')}`),
    NotAllowed: ({ reason }) => reasonIn(t, reason),
    Missing: () => t.toasts.missing,
  })

const toggleIds = new Map(
  Object.entries(copyIn('en').changes.toggles).map(([id, text]) => [text, id] as const),
)
const policyIds = new Map(
  Object.entries(copyIn('en').changes.policies).map(([id, text]) => [text, id] as const),
)

type Topology = 'singlePrimary' | 'sharded' | 'multiLeader'
const topologyIds = new Map<string, Topology>(
  (['singlePrimary', 'sharded', 'multiLeader'] as const).map(
    (id) => [copyIn('en').inspectorDatabase[id], id] as const,
  ),
)

export const changeIn = (t: Messages, text: string): string => {
  const toggle = toggleIds.get(text)
  if (toggle !== undefined)
    return (t.changes.toggles as Readonly<Record<string, string>>)[toggle] ?? text
  const lever = /^(Raised|Lowered) the (.+) lever$/.exec(text)
  if (lever)
    return (lever[1] === 'Raised' ? t.changes.leverRaised : t.changes.leverLowered)(
      nameIn(t, lever[2]!),
    )
  const policy = /^(Set|Cleared) the (.+) policy$/.exec(text)
  if (policy) {
    const id = policyIds.get(policy[2]!)
    const name =
      id === undefined
        ? policy[2]!
        : ((t.changes.policies as Readonly<Record<string, string>>)[id] ?? policy[2]!)
    return (policy[1] === 'Set' ? t.changes.policySet : t.changes.policyCleared)(name)
  }
  const topology = /^Topology: (.+)$/.exec(text)
  if (topology) {
    const id = topologyIds.get(topology[1]!)
    return t.changes.topology(id === undefined ? topology[1]! : t.inspectorDatabase[id])
  }
  return text
}
