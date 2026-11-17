import { Option, Schema } from 'effect'
import { AGENT_ROOM_PATH } from '@quorum/rpc'
import type { Ack } from '@quorum/agent/snapshot'
import { newWriteKey, roomIdOf } from '@quorum/agent/room-id'
import { uploadOf, type SyncState } from '@quorum/agent/sync'
import { snapshotOfModel } from './agent-tools.ts'
import { playingId, type Model } from './model.ts'
import { AGENT_ROOMS_KEY, readStored, writeStored } from './storage.ts'

const INTERVAL_MS = 5_000

type RoomRecord = Readonly<{ writeKey: string; roomId: string; epoch: string }>

const RoomRecord = Schema.Struct({
  writeKey: Schema.String,
  roomId: Schema.String,
  epoch: Schema.String,
})
const Rooms = Schema.Record(Schema.String, RoomRecord)
const decodeRooms = Schema.decodeUnknownOption(Schema.fromJsonString(Rooms))

let memory: Record<string, RoomRecord> = {}
const pending = new Map<string, Promise<RoomRecord>>()
let wanted = false
let timer: ReturnType<typeof setInterval> | undefined
let latest: Model | null = null
let active: Readonly<{ companyId: string; room: RoomRecord }> | null = null
let sync: SyncState | null = null
let busy = false

const readRooms = (): Record<string, RoomRecord> => {
  const stored = readStored(AGENT_ROOMS_KEY)
  return stored === null ? memory : Option.getOrElse(decodeRooms(stored), () => memory)
}

const writeRooms = (rooms: Record<string, RoomRecord>): void => {
  memory = rooms
  writeStored(AGENT_ROOMS_KEY, JSON.stringify(rooms))
}

export const agentRoomId = (companyId: string): string | null =>
  readRooms()[companyId]?.roomId ?? null

export const pruneAgentRooms = (companyIds: ReadonlySet<string>): void => {
  const rooms = readRooms()
  const kept = Object.fromEntries(Object.entries(rooms).filter(([id]) => companyIds.has(id)))
  if (Object.keys(kept).length !== Object.keys(rooms).length) writeRooms(kept)
}

const ensureRoom = (companyId: string): Promise<RoomRecord> => {
  const existing = readRooms()[companyId]
  if (existing) return Promise.resolve(existing)
  const waiting = pending.get(companyId)
  if (waiting) return waiting
  const made = (async () => {
    const writeKey = newWriteKey()
    const record: RoomRecord = {
      writeKey,
      roomId: await roomIdOf(writeKey),
      epoch: crypto.randomUUID(),
    }
    const rooms = readRooms()
    if (rooms[companyId] === undefined) {
      rooms[companyId] = record
      writeRooms(rooms)
    }
    return rooms[companyId] ?? record
  })().finally(() => pending.delete(companyId))
  pending.set(companyId, made)
  return made
}

const send = async (): Promise<void> => {
  if (!wanted || busy || latest === null) return
  const companyId = playingId(latest)
  if (companyId === null) return
  const room = await ensureRoom(companyId)
  if (active?.room.roomId !== room.roomId) {
    active = { companyId, room }
    sync = { epoch: room.epoch, rev: 0, acked: null, headJson: null }
  }
  if (sync === null) return

  const upload = uploadOf(snapshotOfModel(latest), sync)
  if (upload === null) return

  busy = true
  try {
    const response = await fetch(AGENT_ROOM_PATH, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${room.writeKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upload),
    })
    if (!response.ok) return
    if (!wanted) {
      await fetch(AGENT_ROOM_PATH, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${room.writeKey}` },
      })
      return
    }
    const ack = (await response.json()) as Ack
    sync = { epoch: ack.epoch, rev: ack.rev, acked: ack, headJson: JSON.stringify(upload.head) }
  } catch {
  } finally {
    busy = false
  }
}

let roomed: string | null = null

const clearAll = async (): Promise<void> => {
  active = null
  roomed = null
  sync = null
  const rooms = Object.values(readRooms())
  await Promise.allSettled(
    rooms.map((room) =>
      fetch(AGENT_ROOM_PATH, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${room.writeKey}` },
      }),
    ),
  )
}

export const syncAgent = (model: Model): void => {
  latest = model
  if (!model.prefs.agentAccess) return
  const companyId = playingId(model)
  if (companyId === null || companyId === roomed) return
  if (agentRoomId(companyId) === null) void ensureRoom(companyId)
  else roomed = companyId
}

export const setAgentAccess = (on: boolean): void => {
  if (on === wanted) return
  wanted = on
  if (on) {
    timer ??= setInterval(() => void send(), INTERVAL_MS)
    void send()
  } else {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
    void clearAll()
  }
}
