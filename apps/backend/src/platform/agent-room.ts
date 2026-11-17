import { DurableObject } from 'cloudflare:workers'
import type { NodeSample } from '@quorum/agent/node-metrics'
import type { AgentMail, AgentHead, Ack, Status, Upload } from '@quorum/agent/snapshot'
import { roomIdOf } from '@quorum/agent/room-id'
import {
  applyUpload,
  changesOf,
  CHUNK_PREFIX,
  NODE_PREFIX,
  EMPTY_META,
  emptyStore,
  snapshotOfStore,
  statusOfStore,
  type AgentMeta,
  type AgentStore,
} from '@quorum/agent/store'
import { readTool } from '@quorum/agent/view'
import type { Sample } from '@quorum/simulation/state'
import type { AgentRoomStub } from '../contexts/agent/room.ts'

const TTL_MS = 24 * 60 * 60 * 1000
const STORAGE_BATCH = 128

export type AgentRoomEnv = Readonly<Record<string, never>>

export class AgentRoom extends DurableObject<AgentRoomEnv> implements AgentRoomStub {
  private store: AgentStore | null = null

  private async load(): Promise<AgentStore> {
    if (this.store !== null) return this.store

    const [meta, head, inbox, chunks, nodes] = await Promise.all([
      this.ctx.storage.get<AgentMeta>('meta'),
      this.ctx.storage.get<AgentHead | null>('head'),
      this.ctx.storage.get<ReadonlyArray<AgentMail>>('inbox'),
      this.ctx.storage.list<ReadonlyArray<Sample>>({ prefix: CHUNK_PREFIX }),
      this.ctx.storage.list<ReadonlyArray<NodeSample>>({ prefix: NODE_PREFIX }),
    ])

    const samples = [...chunks.entries()]
      .sort(
        ([left], [right]) =>
          Number(left.slice(CHUNK_PREFIX.length)) - Number(right.slice(CHUNK_PREFIX.length)),
      )
      .flatMap(([, items]) => items)

    const store: AgentStore = {
      meta: meta ?? EMPTY_META,
      head: head ?? null,
      samples,
      nodes: Object.fromEntries(
        [...nodes.entries()].map(([key, items]) => [key.slice(NODE_PREFIX.length), items]),
      ),
      inbox: inbox ?? [],
    }
    this.store = store
    return store
  }

  private async save(next: AgentStore, previous: AgentStore): Promise<void> {
    const { puts, deletes } = changesOf(next, previous)
    const entries = Object.entries(puts)
    for (let index = 0; index < entries.length; index += STORAGE_BATCH)
      await this.ctx.storage.put(Object.fromEntries(entries.slice(index, index + STORAGE_BATCH)))
    for (let index = 0; index < deletes.length; index += STORAGE_BATCH)
      await this.ctx.storage.delete(deletes.slice(index, index + STORAGE_BATCH))
  }

  private async verify(key: string): Promise<void> {
    if ((await roomIdOf(key)) !== this.ctx.id.name)
      throw new Error('The write key does not match this Room.')
  }

  async write(upload: Upload, key: string): Promise<Ack> {
    await this.verify(key)
    const previous = await this.load()
    const { store, ack } = applyUpload(previous, upload, Date.now())
    await this.save(store, previous)
    this.store = store
    await this.ctx.storage.setAlarm(Date.now() + TTL_MS)
    return ack
  }

  async clear(key: string): Promise<void> {
    await this.verify(key)
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    this.store = emptyStore()
  }

  async read(name: string, input: Record<string, unknown>): Promise<string> {
    const snapshot = snapshotOfStore(await this.load())
    if (snapshot === null)
      throw new Error(
        'This Room has no snapshot yet. Ask the player to open the Company and turn on Agent access.',
      )
    return readTool(snapshot, name, input)
  }

  async status(): Promise<Status | null> {
    return statusOfStore(await this.load())
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll()
    this.store = emptyStore()
  }
}

export type AgentRoomInstance = AgentRoom
