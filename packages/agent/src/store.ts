import type { Sample } from '@quorum/simulation/state'
import type { NodeSample } from './node-metrics.ts'
import type { Ack, AgentHead, AgentMail, AgentSnapshot, Status, Upload } from './snapshot.ts'

export const SAMPLES_KEPT = 600
export const NODE_SAMPLES_KEPT = 24
export const INBOX_KEPT = 40

export type AgentMeta = Readonly<{
  epoch: string
  rev: number
  sampleSeq: number
  nodeTime: number
  inboxHash: string
  at: number
}>

export type AgentStore = Readonly<{
  meta: AgentMeta
  head: AgentHead | null
  samples: ReadonlyArray<Sample>
  nodes: Readonly<Record<string, ReadonlyArray<NodeSample>>>
  inbox: ReadonlyArray<AgentMail>
}>

export const EMPTY_META: AgentMeta = {
  epoch: '',
  rev: 0,
  sampleSeq: 0,
  nodeTime: 0,
  inboxHash: '',
  at: 0,
}

export const emptyStore = (): AgentStore => ({
  meta: EMPTY_META,
  head: null,
  samples: [],
  nodes: {},
  inbox: [],
})

const lastNodeTime = (nodes: Readonly<Record<string, ReadonlyArray<NodeSample>>>): number => {
  let latest = 0
  for (const samples of Object.values(nodes)) {
    const last = samples[samples.length - 1]
    if (last && last.time > latest) latest = last.time
  }
  return latest
}

const appendSamples = (
  existing: ReadonlyArray<Sample>,
  items: ReadonlyArray<Sample>,
): ReadonlyArray<Sample> =>
  (items.length === 0 ? existing : [...existing, ...items]).slice(-SAMPLES_KEPT)

const appendNodeSamples = (
  existing: ReadonlyArray<NodeSample>,
  items: ReadonlyArray<NodeSample>,
): ReadonlyArray<NodeSample> => {
  const last = existing[existing.length - 1]?.time ?? Number.NEGATIVE_INFINITY
  const fresh = items.filter((sample) => sample.time > last)
  if (fresh.length === 0) return existing
  return [...existing, ...fresh].slice(-NODE_SAMPLES_KEPT)
}

export const ackOf = (store: AgentStore): Ack => ({
  epoch: store.meta.epoch,
  rev: store.meta.rev,
  sampleSeq: store.meta.sampleSeq,
  nodeTime: store.meta.nodeTime,
  inboxHash: store.meta.inboxHash,
  at: store.meta.at,
})

export const applyUpload = (
  store: AgentStore,
  upload: Upload,
  now: number,
): Readonly<{ store: AgentStore; ack: Ack }> => {
  const reset = upload.reset || upload.epoch !== store.meta.epoch
  const base = reset ? emptyStore() : store
  if (!reset && upload.rev <= base.meta.rev) return { store: base, ack: ackOf(base) }

  const samples = appendSamples(base.samples, upload.samples.items)
  const nodes: Record<string, ReadonlyArray<NodeSample>> = reset ? {} : { ...base.nodes }
  for (const [id, items] of Object.entries(upload.nodes.items)) {
    const existing = nodes[id] ?? []
    const merged = appendNodeSamples(existing, items)
    if (merged.length > 0) nodes[id] = merged
  }

  const inbox = upload.inbox === null ? (reset ? [] : base.inbox) : upload.inbox.slice(-INBOX_KEPT)

  const meta: AgentMeta = {
    epoch: upload.epoch,
    rev: upload.rev,
    sampleSeq: reset ? upload.samples.to : Math.max(base.meta.sampleSeq, upload.samples.to),
    nodeTime: reset ? lastNodeTime(nodes) : Math.max(base.meta.nodeTime, lastNodeTime(nodes)),
    inboxHash: upload.head.inboxHash,
    at: now,
  }

  const next: AgentStore = { meta, head: upload.head, samples, nodes, inbox }
  return { store: next, ack: ackOf(next) }
}

export const SAMPLES_PER_CHUNK = 200

export const NODE_PREFIX = 'node:'
export const CHUNK_PREFIX = 'samples:'

export type StoredChanges = Readonly<{
  puts: Readonly<Record<string, unknown>>
  deletes: ReadonlyArray<string>
}>

export const changesOf = (next: AgentStore, previous: AgentStore): StoredChanges => {
  const puts: Record<string, unknown> = {}
  const deletes: Array<string> = []
  if (next.meta !== previous.meta) puts.meta = next.meta
  if (next.head !== previous.head) puts.head = next.head
  if (next.inbox !== previous.inbox) puts.inbox = next.inbox

  const count = Math.ceil(next.samples.length / SAMPLES_PER_CHUNK)
  for (let index = 0; index < count; index += 1) {
    const from = index * SAMPLES_PER_CHUNK
    const to = Math.min(next.samples.length, from + SAMPLES_PER_CHUNK)
    const before = Math.min(previous.samples.length, from + SAMPLES_PER_CHUNK)
    const same =
      before === to &&
      previous.samples[from] === next.samples[from] &&
      previous.samples[to - 1] === next.samples[to - 1]
    if (!same) puts[`${CHUNK_PREFIX}${index}`] = next.samples.slice(from, to)
  }
  const previousCount = Math.ceil(previous.samples.length / SAMPLES_PER_CHUNK)
  for (let index = count; index < previousCount; index += 1) deletes.push(`${CHUNK_PREFIX}${index}`)

  for (const [id, samples] of Object.entries(next.nodes))
    if (previous.nodes[id] !== samples) puts[`${NODE_PREFIX}${id}`] = samples
  for (const id of Object.keys(previous.nodes))
    if (next.nodes[id] === undefined) deletes.push(`${NODE_PREFIX}${id}`)

  return { puts, deletes }
}

export const snapshotOfStore = (store: AgentStore): AgentSnapshot | null => {
  const head = store.head
  if (head === null) return null
  return {
    game: head.game,
    mode: head.mode,
    screen: head.screen,
    paused: head.paused,
    speed: head.speed,
    bottleneck: head.bottleneck,
    whatIfs: head.whatIfs,
    samples: store.samples,
    nodeSamples: store.nodes,
    inbox: store.inbox,
    updatedAt: store.meta.at,
  }
}

export const statusOfStore = (store: AgentStore): Status | null => {
  if (store.head === null) return null
  return {
    mode: store.head.mode,
    updatedAt: store.meta.at,
    sampleSeq: store.meta.sampleSeq,
    nodeTime: store.meta.nodeTime,
    samples: store.samples.length,
    nodes: Object.keys(store.nodes).length,
    inbox: store.inbox.length,
    epoch: store.meta.epoch,
    rev: store.meta.rev,
  }
}
