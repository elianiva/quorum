import * as Sentry from '@sentry/cloudflare'
import { DurableObject } from 'cloudflare:workers'
import { Option, Result, Schema } from 'effect'
import {
  ClientMessage,
  ROOM_SEATS,
  ROOM_SPEEDS,
  ServerMessage,
  type SeatActivity,
  type VoteKind,
} from '@quorum/simulation/room'
import type { Region } from '@quorum/simulation/state'
import type { PublishInput, RoomStub } from '../contexts/room/directory.ts'
import {
  advance,
  apply,
  ballot,
  enter,
  expired,
  finalOf,
  kick,
  leave,
  openRoom,
  restoreRoom,
  setSpeed,
  snapshotOf,
  startVote,
  ALARM_MS,
  ROOM_IDLE_MS,
  type RoomState,
} from '../contexts/room/room.ts'
import { SIM_VERSION } from '@quorum/simulation/version'

/* ==========================================================================
   The Room Durable Object: storage, the alarm that steps the Company, and the
   sockets. The rules live in contexts/room, so this file only knows the host.
   ========================================================================== */

export type RoomEnv = Readonly<{ SENTRY_DSN?: string }>

type Attachment = Readonly<{ seat: string; sampleAt: number }>

const NO_SEAT: Attachment = { seat: '', sampleAt: 0 }

/**
 * The connections a Room accepts. A reload opens its new socket before the old one
 * closes, so each Seat gets room for two, and a few more wait for a Seat.
 */
const MAX_SOCKETS = ROOM_SEATS * 3

/** The largest frame the Room reads. A full batch of Intents is far smaller. */
const MAX_FRAME = 256 * 1024

/**
 * What a connection may ask of the Room. A frame that changes or reads the Company
 * costs a whole Game: the Room checks it, saves it, and sends it to every Seat.
 * So each connection has a budget that refills over time. A pointer frame costs
 * one, and a board sends 25 a second at most; a frame that costs a Game costs ten.
 */
const BUDGET = 240
const REFILL_PER_SECOND = 120
const HEAVY = 10

type Budget = { left: number; at: number }

const encode = Schema.encodeSync(ServerMessage)
const decode = Schema.decodeUnknownOption(ClientMessage)

/**
 * The Seat id the Room shows for the id a browser sent. Every Seat sees every Seat
 * id, and a browser takes its Seat back by sending its own id again. So the id a
 * browser sends stays between it and the Room, and the Seats see only its hash:
 * knowing a Seat's public id is not enough to claim it.
 */
const seatIdOf = async (secret: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return Array.from(new Uint8Array(digest).subarray(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

const textOf = (raw: string | ArrayBuffer): string | null => {
  if (typeof raw === 'string') return raw
  try {
    return new TextDecoder().decode(raw)
  } catch {
    return null
  }
}

class RoomObjectBase extends DurableObject<RoomEnv> implements RoomStub {
  private state: RoomState | null = null
  private savedAt = 0
  /** In memory only: a Room that hibernated had no frames to count. */
  private readonly budgets = new WeakMap<WebSocket, Budget>()

  constructor(ctx: DurableObjectState, env: RoomEnv) {
    super(ctx, env)
    // Storage is async and the constructor is not, so the runtime waits here.
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<RoomState>('room')
      if (stored === null || stored === undefined) return
      const restored = restoreRoom(stored, SIM_VERSION)
      if (restored === null) {
        await ctx.storage.deleteAll()
        return
      }
      this.state = restored
    })
  }

  /* ---------- The methods the API Worker calls ---------- */

  async publish(input: PublishInput): Promise<void> {
    const { token, ...rest } = input
    // The Room's clock is the object's, not the browser's: a browser clock that is
    // behind would read as minutes of owed Steps, a whole CPU budget of catch-up on
    // the first wake. The later `wall` wins over the one the browser uploaded.
    this.state = openRoom({ ...rest, token, wall: Date.now() })
    await this.save()
  }

  async info(): Promise<Readonly<{ exists: boolean; seats: number }>> {
    if (this.state === null) return { exists: false, seats: 0 }
    if (expired(this.state, Date.now())) {
      await this.clear()
      return { exists: false, seats: 0 }
    }
    return { exists: true, seats: this.state.seats.length }
  }

  /* ---------- Sockets ---------- */

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket')
      return new Response('Expected a WebSocket', { status: 426 })
    if (this.state === null) return new Response('No such Room', { status: 404 })
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS)
      return new Response('The Room is busy', { status: 429 })

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
    // `acceptWebSocket` rather than `accept`, so the object can hibernate.
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment(NO_SEAT)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if ((typeof raw === 'string' ? raw.length : raw.byteLength) > MAX_FRAME) return
    const text = textOf(raw)
    if (text === null) return
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return
    }
    const decoded = decode(body)
    if (Option.isNone(decoded)) return
    const message = decoded.value
    const light =
      message._tag === 'Cursor' || message._tag === 'HideCursor' || message._tag === 'Ping'
    if (!this.spend(ws, light ? 1 : HEAVY)) {
      // A Seat waits for an answer to its Intents, so a dropped batch is refused aloud.
      if (message._tag === 'Intents')
        this.send(ws, {
          _tag: 'Refused',
          id: message.id,
          refusal: { _tag: 'NotAllowed', reason: 'Too many moves at once. Try again.' },
        })
      return
    }

    await ClientMessage.match(message, {
      Hello: (frame) => this.hello(ws, frame.seat, frame.name, frame.token),
      Intents: (frame) => this.intents(ws, frame.id, frame.intents),
      Ballot: (frame) => this.ballot(ws, frame.vote, frame.yes),
      StartVote: (frame) => this.startVote(ws, frame.kind),
      Cursor: (frame) =>
        Promise.resolve(this.cursor(ws, frame.x, frame.y, frame.region, frame.activity)),
      HideCursor: () => Promise.resolve(this.hideCursor(ws)),
      Speed: (frame) => this.speed(ws, frame.value),
      Kick: (frame) => this.kick(ws, frame.seat),
      TakeOffline: () => this.takeOffline(ws),
      Resync: () => Promise.resolve(this.resync(ws)),
      Ping: () => Promise.resolve(),
    })
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.part(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.part(ws)
  }

  /* ---------- The clock ---------- */

  async alarm(): Promise<void> {
    const state = this.state
    if (state === null) return
    // Nobody is in the Room: no Step runs and no alarm stays set, so an empty Room
    // costs nothing until a connection comes back.
    // The alarm an empty Room keeps is its end: nobody came back for the Company.
    if (this.nobody() && expired(state, Date.now())) return this.clear()
    if (!state.open || state.ended !== null || this.nobody()) return this.stop()
    this.advanceNow()
    this.broadcast()
    if (Date.now() - this.savedAt > 4_000) await this.save()
    await this.ctx.storage.setAlarm(Date.now() + ALARM_MS)
  }

  /* ---------- Each message ---------- */

  private async hello(
    ws: WebSocket,
    id: string,
    name: string,
    token: string | undefined,
  ): Promise<void> {
    const seatId = await seatIdOf(id)
    // The hash awaited, so another frame may have moved the Room meanwhile.
    const current = this.state
    if (current === null) return this.end(ws, 'removed')
    const entering = token === undefined ? { id: seatId, name } : { id: seatId, name, token }
    const held = this.seatOf(ws)
    const joined = enter(current, held, entering, Date.now())
    if (Result.isFailure(joined)) {
      this.end(ws, joined.failure === 'stale' ? 'stale' : 'removed')
      return
    }
    const next = joined.success
    this.state = next.state
    const seat = next.seat
    if (held !== '' && held !== seat.id) this.everyone({ _tag: 'CursorGone', seat: held }, ws)
    // A reload takes its own Seat back from the socket that held it.
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue
      if (this.seatOf(other) === seat.id) other.close(4000, 'Seat moved')
    }
    ws.serializeAttachment({ seat: seat.id, sampleAt: 0 } satisfies Attachment)
    await this.save()
    this.send(ws, {
      _tag: 'Welcome',
      revision: next.state.revision,
      simVersion: next.state.simVersion,
      seat: seat.id,
      game: next.state.game,
      samples: next.state.samples,
      seats: next.state.seats,
      owner: next.state.ownerSeat,
      speed: next.state.speed,
      vote: next.state.vote,
    })
    ws.serializeAttachment({
      seat: seat.id,
      sampleAt: next.state.samples.length,
    } satisfies Attachment)
    this.seats()
    if (next.newSeat) this.everyone({ _tag: 'Joined', seat }, ws)
    await this.schedule()
  }

  private async intents(
    ws: WebSocket,
    id: number,
    intents: ReadonlyArray<Parameters<typeof apply>[1][number]>,
  ): Promise<void> {
    if (this.state === null) return this.end(ws, 'removed')
    const seat = this.seatOf(ws)
    if (seat === '') return
    if (this.state.ended !== null) {
      this.send(ws, {
        _tag: 'Refused',
        id,
        refusal: { _tag: 'NotAllowed', reason: 'The session has ended.' },
      })
      return
    }
    this.advanceNow()
    const current = this.state
    if (current === null) return
    const applied = apply(current, intents)
    if (Result.isFailure(applied)) {
      this.send(ws, { _tag: 'Refused', id, refusal: applied.failure })
      return
    }
    this.state = applied.success
    await this.save()
    this.broadcast()
    await this.schedule()
  }

  private async ballot(ws: WebSocket, vote: number, yes: boolean): Promise<void> {
    if (this.state === null) return this.end(ws, 'removed')
    const seat = this.seatOf(ws)
    if (seat === '' || this.state.vote === null || this.state.vote.id !== vote) return
    this.advanceNow()
    const current = this.state
    if (current === null) return
    const outcome = ballot(current, seat, yes)
    this.state = outcome.state
    await this.save()
    this.broadcast()
    if (outcome.passed === 'exit') {
      await this.ctx.storage.deleteAlarm()
      this.handOver()
    }
  }

  private async startVote(ws: WebSocket, kind: VoteKind): Promise<void> {
    if (this.state === null) return this.end(ws, 'removed')
    const started = startVote(this.state, this.seatOf(ws), kind)
    if (Result.isFailure(started)) {
      const reason =
        started.failure === 'vote-open' ? 'A vote is already open.' : 'You cannot start that vote.'
      this.send(ws, { _tag: 'Refused', id: 0, refusal: { _tag: 'NotAllowed', reason } })
      return
    }
    this.state = started.success
    await this.save()
    this.broadcast()
  }

  /**
   * Presence only. The Room stamps the Seat from the socket, not from the
   * frame, so one Seat cannot move another's cursor, and it relays the frame
   * without saving it or waiting for the next snapshot.
   */
  private cursor(
    ws: WebSocket,
    x: number,
    y: number,
    region: Region,
    activity: SeatActivity | undefined,
  ): void {
    const current = this.state
    if (current === null) return
    const seat = current.seats.find((entry) => entry.id === this.seatOf(ws))
    if (seat === undefined) return
    this.everyone(
      {
        _tag: 'Cursor',
        seat: seat.id,
        name: seat.name,
        colour: seat.colour,
        x,
        y,
        region,
        ...(activity === undefined ? {} : { activity }),
      },
      ws,
    )
  }

  private hideCursor(ws: WebSocket): void {
    const seat = this.seatOf(ws)
    if (seat === '') return
    this.everyone({ _tag: 'CursorGone', seat }, ws)
  }

  private async speed(ws: WebSocket, value: number): Promise<void> {
    if (this.state === null || this.seatOf(ws) !== this.state.ownerSeat) return
    if (!(ROOM_SPEEDS as ReadonlyArray<number>).includes(value)) return
    this.advanceNow()
    const current = this.state
    if (current === null) return
    this.state = setSpeed(current, value)
    await this.save()
    this.broadcast()
  }

  private async kick(ws: WebSocket, seat: string): Promise<void> {
    if (this.state === null || this.seatOf(ws) !== this.state.ownerSeat) return
    this.state = kick(this.state, seat, Date.now())
    this.everyone({ _tag: 'CursorGone', seat })
    for (const other of this.ctx.getWebSockets()) {
      if (this.seatOf(other) !== seat) continue
      this.end(other, 'removed')
    }
    await this.save()
    this.broadcast()
  }

  /**
   * The Seats voted to end the session. The owner takes the Company as it is
   * now, and the guests are told the Room is over.
   */
  private async handOver(): Promise<void> {
    const current = this.state
    if (current === null) return
    const final = finalOf(current)
    for (const other of this.ctx.getWebSockets())
      if (this.seatOf(other) === current.ownerSeat)
        this.send(other, {
          _tag: 'Final',
          revision: current.revision,
          game: final.game,
          samples: final.samples,
        })
    for (const other of this.ctx.getWebSockets())
      if (this.seatOf(other) !== current.ownerSeat) this.end(other, 'handover')
    await this.clear()
  }

  private async takeOffline(ws: WebSocket): Promise<void> {
    const current = this.state
    if (current === null) return
    if (this.seatOf(ws) !== current.ownerSeat) return
    const final = finalOf(current)
    this.send(ws, {
      _tag: 'Final',
      revision: current.revision,
      game: final.game,
      samples: final.samples,
    })
    this.everyone({ _tag: 'Ended', reason: 'offline' }, ws)
    for (const other of this.ctx.getWebSockets()) other.close(1000, 'Company offline')
    await this.clear()
  }

  private resync(ws: WebSocket): void {
    const current = this.state
    if (current === null) return
    // Only a Seat reads the Company: a connection that never took one, or lost it, gets nothing.
    if (!current.seats.some((seat) => seat.id === this.seatOf(ws))) return
    this.send(ws, {
      _tag: 'Snapshot',
      revision: current.revision,
      time: current.game.time,
      game: current.game,
      samples: current.samples,
      seats: current.seats,
      owner: current.ownerSeat,
      speed: current.speed,
      vote: current.vote,
    })
    ws.serializeAttachment({
      seat: this.seatOf(ws),
      sampleAt: current.samples.length,
    } satisfies Attachment)
  }

  private async part(ws: WebSocket): Promise<void> {
    if (this.state === null) return
    const seat = this.seatOf(ws)
    if (seat === '') return this.rest()
    ws.serializeAttachment(NO_SEAT)
    this.state = leave(this.state, seat, Date.now())
    this.everyone({ _tag: 'CursorGone', seat }, ws)
    this.seats()
    this.broadcast()
    // The Room holds nobody now: it saves once, dates itself, and stops the clock.
    if (this.state.seats.length === 0) {
      this.rest()
      await this.stop()
      return
    }
    await this.save()
    await this.schedule()
  }

  /* ---------- Plumbing ---------- */

  /** No connection is attached: nobody is in the Room, whatever the Seats say. */
  private nobody(): boolean {
    return this.ctx.getWebSockets().length === 0
  }

  /**
   * The Room holds nobody: stop the clock and date the Room so the twenty-four
   * hours it keeps the Company start now. The one alarm left is set for the end of
   * those hours, when the Room deletes itself; without it a Room nobody asks for
   * again keeps its Company in storage for good. With no connection the runtime
   * evicts the object, and the Company waits in storage for the next Seat. `ctx.abort` would stop it at once, but it discards the write this
   * departure made, which leaves the Room holding a Seat nobody sits in.
   */
  private async stop(): Promise<void> {
    const state = this.state
    if (state === null) return
    const idleAt = state.idleAt ?? Date.now()
    if (state.idleAt === null) this.state = { ...state, idleAt }
    await this.save()
    await this.ctx.storage.setAlarm(idleAt + ROOM_IDLE_MS + 1_000)
  }

  /** The Room holds no Seat: close the connections that never took one. */
  private rest(): void {
    if (this.state === null || this.state.seats.length > 0) return
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1000, 'Room empty')
      } catch {
        // Already closing.
      }
    }
  }

  /** Takes `cost` from the connection's budget, or answers false when it has too little. */
  private spend(ws: WebSocket, cost: number): boolean {
    const now = Date.now()
    const budget = this.budgets.get(ws) ?? { left: BUDGET, at: now }
    const left = Math.min(BUDGET, budget.left + ((now - budget.at) / 1_000) * REFILL_PER_SECOND)
    const allowed = left >= cost
    this.budgets.set(ws, { left: allowed ? left - cost : left, at: now })
    return allowed
  }

  private seatOf(ws: WebSocket): string {
    const attachment = ws.deserializeAttachment() as Attachment | null
    return attachment?.seat ?? ''
  }

  private advanceNow(): void {
    if (this.state === null) return
    this.state = advance(this.state, Date.now()).state
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    this.sendText(ws, JSON.stringify(encode(message)))
  }

  private sendText(ws: WebSocket, text: string): void {
    try {
      ws.send(text)
    } catch {
      // The runtime closes a socket it can no longer write to. Closing it here would
      // re-enter `webSocketClose`, which leaves the Seat and broadcasts, from inside
      // the broadcast that just failed.
    }
  }

  private end(
    ws: WebSocket,
    reason: 'offline' | 'handover' | 'expired' | 'stale' | 'removed',
  ): void {
    this.send(ws, { _tag: 'Ended', reason })
    try {
      ws.close(1000, reason)
    } catch {
      // Already closed.
    }
  }

  private everyone(message: ServerMessage, except?: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) this.send(ws, message)
  }

  private seats(): void {
    const current = this.state
    if (current === null) return
    this.everyone({
      _tag: 'Seats',
      seats: current.seats,
      owner: current.ownerSeat,
      speed: current.speed,
      vote: current.vote,
    })
  }

  /**
   * One snapshot per Seat, carrying the samples that Seat has not seen. Encoding a
   * snapshot costs more than the Steps it reports, and Seats that have seen the
   * same samples get the same text, so the Room encodes it once for all of them.
   */
  private broadcast(): void {
    const current = this.state
    if (current === null) return
    const texts = new Map<number, string>()
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = (ws.deserializeAttachment() as Attachment | null) ?? NO_SEAT
      if (attachment.seat === '') continue
      const text =
        texts.get(attachment.sampleAt) ??
        JSON.stringify(encode({ _tag: 'Snapshot', ...snapshotOf(current, attachment.sampleAt) }))
      texts.set(attachment.sampleAt, text)
      this.sendText(ws, text)
      ws.serializeAttachment({
        seat: attachment.seat,
        sampleAt: current.samples.length,
      } satisfies Attachment)
    }
  }

  private async schedule(): Promise<void> {
    const state = this.state
    if (state !== null && state.open && state.ended === null && !this.nobody()) {
      await this.ctx.storage.setAlarm(Date.now() + ALARM_MS)
      return
    }
    if (this.nobody()) return this.stop()
    await this.ctx.storage.deleteAlarm()
  }

  private async save(): Promise<void> {
    if (this.state === null) return
    await this.ctx.storage.put('room', this.state)
    this.savedAt = Date.now()
  }

  private async clear(): Promise<void> {
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    this.state = null
  }
}

/** The instance type a namespace stub carries. */
export type RoomInstance = RoomObjectBase

/**
 * The handlers Sentry starts a trace of their own for, by the span name it gives
 * them. A running Room fires its alarm twice a second and a Seat sends up to 25
 * pointer frames a second, so a sampled tenth of them is thousands of traces a day
 * per Room, each one saying the same thing.
 */
const UNTRACED = new Set(['alarm', 'webSocketMessage'])

/**
 * Errors and traces for the Room, with the same DSN the Workers use. An error in
 * an untraced handler is still reported: sampling decides traces only.
 */
export const RoomObject = Sentry.instrumentDurableObjectWithSentry(
  (env: RoomEnv) => ({
    dsn: env.SENTRY_DSN,
    // A call from the API Worker follows that Worker's choice, as it did under a plain rate.
    tracesSampler: ({ name, inheritOrSampleWith }) =>
      UNTRACED.has(name) ? 0 : inheritOrSampleWith(0.1),
    initialScope: { tags: { service: 'room-object' } },
  }),
  RoomObjectBase,
)
