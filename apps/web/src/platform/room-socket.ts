import { Option, Schema } from 'effect'
import { ROOMS_FULL_CLOSE_CODE, ROOM_SOCKET_PATH } from '@quorum/rpc'
import { ROOM_NAME_LENGTH, randomName } from '../game/names.ts'
import { ROOM_NAME_KEY, readStored, writeStored } from '../game/storage.ts'
import {
  ClientMessage,
  ServerMessage,
  type ClientMessage as Client,
  type SeatActivity,
} from '@quorum/simulation/room'
import type { Region } from '@quorum/simulation/state'

export type RoomConfig = Readonly<{
  code: string
  seat: string
  name: string
  token?: string
}>

export type RoomStatus = 'open' | 'closed' | 'error' | 'full'

const encode = Schema.encodeSync(ClientMessage)
const decode = Schema.decodeUnknownOption(ServerMessage)

let socket: WebSocket | null = null
let config: RoomConfig | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let attempt = 0
let stopped = true
let generation = 0

const messages = new Set<(message: ServerMessage) => void>()
const statuses = new Set<(status: RoomStatus) => void>()

const announce = (status: RoomStatus) => {
  for (const listener of statuses) listener(status)
}

const urlOf = (code: string): string => {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}${ROOM_SOCKET_PATH}?code=${encodeURIComponent(code)}`
}

const helloOf = (current: RoomConfig): Client => ({
  _tag: 'Hello',
  seat: current.seat,
  name: current.name,
  ...(current.token === undefined ? {} : { token: current.token }),
})

const open = (): void => {
  const current = config
  if (!current) return
  const thisSocketGeneration = (generation += 1)
  const next = new WebSocket(urlOf(current.code))
  socket = next
  next.addEventListener('open', () => {
    if (thisSocketGeneration !== generation) return next.close(1000, 'Superseded')
    attempt = 0
    next.send(JSON.stringify(encode(helloOf(current))))
    announce('open')
  })
  next.addEventListener('message', (event) => {
    if (thisSocketGeneration !== generation) return
    if (typeof event.data !== 'string') return
    let body: unknown
    try {
      body = JSON.parse(event.data)
    } catch {
      return
    }
    const decoded = decode(body)
    if (Option.isNone(decoded)) return
    for (const listener of messages) listener(decoded.value)
  })
  next.addEventListener('close', (event) => {
    if (thisSocketGeneration !== generation) return
    if (socket === next) socket = null
    if (event.code === ROOMS_FULL_CLOSE_CODE) {
      stopped = true
      return announce('full')
    }
    announce('closed')
    if (stopped || config === null) return
    attempt += 1
    const wait = Math.min(10_000, 500 * 2 ** Math.min(attempt, 5))
    timer = setTimeout(() => {
      timer = null
      if (!stopped) open()
    }, wait)
  })
  next.addEventListener('error', () => {
    if (thisSocketGeneration === generation) announce('error')
  })
}

export const connect = (next: RoomConfig): void => {
  const same =
    config !== null &&
    socket !== null &&
    config.code === next.code &&
    config.seat === next.seat &&
    config.name === next.name &&
    config.token === next.token
  config = next
  if (same) return
  stopped = false
  if (timer !== null) clearTimeout(timer)
  timer = null
  generation += 1
  const old = socket
  socket = null
  old?.close(1000, 'Reconnecting')
  attempt = 0
  open()
}

export const stop = (): void => {
  stopped = true
  config = null
  generation += 1
  if (timer !== null) clearTimeout(timer)
  timer = null
  const old = socket
  socket = null
  old?.close(1000, 'Left')
}

export const send = (message: Client): void => {
  if (socket === null || socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(encode(message)))
}

export const sendCursor = (
  at: Readonly<{
    x: number
    y: number
    region: Region
    activity: SeatActivity | null
  }>,
): void =>
  send({
    _tag: 'Cursor',
    x: at.x,
    y: at.y,
    region: at.region,
    ...(at.activity === null ? {} : { activity: at.activity }),
  })

export const hideCursor = (): void => send({ _tag: 'HideCursor' })

export const onMessage = (listener: (message: ServerMessage) => void): (() => void) => {
  messages.add(listener)
  return () => messages.delete(listener)
}

export const onStatus = (listener: (status: RoomStatus) => void): (() => void) => {
  statuses.add(listener)
  return () => statuses.delete(listener)
}

const SEAT_KEY = 'quorum.room.seat'

export const seatOf = (): string => {
  const stored = window.sessionStorage.getItem(SEAT_KEY)
  if (stored !== null && stored !== '') return stored
  const seat = crypto.randomUUID()
  window.sessionStorage.setItem(SEAT_KEY, seat)
  return seat
}

export const nameOf = (): string => {
  const stored = readStored(ROOM_NAME_KEY)
  if (stored !== null && stored.trim() !== '') return stored
  const name = randomName()
  writeStored(ROOM_NAME_KEY, name)
  return name
}

export const setRoomName = (name: string): void => {
  writeStored(ROOM_NAME_KEY, name.trim().slice(0, ROOM_NAME_LENGTH))
}
