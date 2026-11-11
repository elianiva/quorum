import * as Effect from 'effect/Effect'
import * as Queue from 'effect/Queue'
import * as Stream from 'effect/Stream'
import { Option, Schema } from 'effect'
import { DragAndDrop } from '@foldkit/ui'
import * as VolumeSlider from '@quorum/ui/primitives/slider'
import { clearSeatCursors, hideSeatCursor, moveSeatCursor } from '@quorum/ui/board/board'
import { Subscription } from 'foldkit'
import { Message } from './message.ts'
import { TeamMessage } from './team.ts'
import { ResearchMessage } from './research.ts'
import { clockAway, halted, onlineFileOf, roomCode, type Model } from './model.ts'
import { seatColour } from './seat-colour.ts'
import { inRoom } from './room-machine.ts'
import { MicTranscriber } from '@moonshine-ai/moonshine-wasm'
import { meterOf } from './mic-meter.ts'
import { connect, onMessage, onStatus, seatOf, stop } from '@/platform/room-socket.ts'
import { ServerMessage } from '@quorum/simulation/room'
import { onBoard } from './route.ts'
import { TICK_MS } from './update.ts'

/* ==========================================================================
   Time and keys. The Company runs while the lab is open and not paused, even
   with a panel up. Unless the player turns it off, it pauses when the window
   loses focus and resumes when it gets focus back. Closing the page stops it:
   no time passes while the player is gone. Keys only matter in the lab.
   ========================================================================== */

type KeyMessage = ReturnType<typeof Message.KeyPressed>

/**
 * The name a keydown becomes in the Model (15 "Accessibility"). Single keys
 * arrive lower case, arrows keep their name, and Shift is part of the name so
 * `Shift+T` can tidy while `T` opens the Team. Shift+Z stays `Z`, which redo
 * has always used.
 */
export const keyNameOf = (key: string, shift: boolean): string =>
  key.length !== 1
    ? shift && key.startsWith('Arrow')
      ? `Shift+${key}`
      : key
    : shift && key.toLowerCase() === 'z'
      ? 'Z'
      : shift && /^[a-z]$/i.test(key)
        ? `Shift+${key.toLowerCase()}`
        : key.toLowerCase()

const keys = Stream.callback<KeyMessage>((queue) =>
  Effect.gen(function* () {
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const listener = (event: KeyboardEvent) => {
          if (event.defaultPrevented) return
          if (
            event.key === 'Escape' &&
            (document.querySelector('[data-team-drag-active]') ||
              document.querySelector('[data-research-drag-active]'))
          )
            return
          // A keydown dispatched on the window itself has the window as its target.
          const target = event.target instanceof Element ? event.target : null
          if (target?.closest('[data-language-picker], [role="listbox"]')) return
          if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
          if (event.altKey) return
          const mod = event.metaKey || event.ctrlKey
          const lower = event.key.toLowerCase()
          if (mod) {
            // Ctrl or Cmd: edit the Nodes, or leave copy alone while text is selected.
            const edit = ['a', 'c', 'x', 'v', 'd'].includes(lower)
            const history = lower === 'z' || lower === 'y'
            // Cmd+K or Ctrl+K opens the command palette.
            const command = lower === 'k'
            if (!edit && !history && !command) return
            if (lower !== 'v' && !command && window.getSelection()?.toString()) return
            event.preventDefault()
            Queue.offerUnsafe(
              queue,
              Message.KeyPressed({
                key: command
                  ? 'Mod+k'
                  : edit
                    ? `Mod+${lower}`
                    : lower === 'z' && event.shiftKey
                      ? 'Z'
                      : lower,
              }),
            )
            return
          }
          // Arrows and Enter move over the board only when no control has focus.
          const onBoard = !target || target === document.body || target.tagName === 'CANVAS'
          if ((event.key.startsWith('Arrow') || event.key === 'Enter') && !onBoard) return
          if (event.key === ' ' || event.key.startsWith('Arrow')) event.preventDefault()
          Queue.offerUnsafe(
            queue,
            Message.KeyPressed({
              key: keyNameOf(event.key, event.shiftKey),
            }),
          )
        }
        window.addEventListener('keydown', listener)
        return listener
      }),
      (listener) => Effect.sync(() => window.removeEventListener('keydown', listener)),
    )
    return yield* Effect.never
  }),
)

/** The game's own words, so the recognizer hears them the way the board spells them. */
const KEYTERMS: ReadonlyArray<string> = [
  'App Server',
  'Worker',
  'Database',
  'Postgres',
  'MySQL',
  'Cache',
  'Redis',
  'Queue',
  'CDN',
  'WAF',
  'Load Balancer',
  'Autoscaler',
  'Replica',
  'Pooler',
  'Search Engine',
  'Object Storage',
  'Stripe',
  'Research',
  'Team',
  'Dashboard',
  'Bottleneck',
  'Upsize',
  'Downsize',
]

/**
 * The microphone, while dictation is on. Moonshine listens in the page: it owns
 * the capture, the voice-activity detection, and the model, all downloaded once
 * and then run locally. A finished line is an utterance; the text still in
 * flight is the grey part of the bar.
 */
/** A transcriber that is listening, and the level meter reading its stream. */
type Opened = Readonly<{ mic: MicTranscriber; unwatch: (() => void) | null }>

const speech = Stream.callback<Message>((queue) =>
  Effect.gen(function* () {
    let shown = -1
    // No `modelArch`: English's default is MediumStreaming, the most accurate streaming model,
    // and BaseStreaming is not in the English catalog at all.
    const mic = new MicTranscriber()
      .language('en')
      .audioConstraints({
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      })
      .onProgress((fraction) => {
        // One Message per whole percent, not per file chunk.
        const percent = Math.round(fraction * 100)
        if (percent === shown) return
        shown = percent
        Queue.offerUnsafe(queue, Message.VoiceLoading({ progress: fraction }))
      })
      .onText((text) => {
        Queue.offerUnsafe(queue, Message.VoiceHeard({ text }))
      })
      .onLine((line) => {
        if (line.text.trim() !== '')
          Queue.offerUnsafe(queue, Message.VoiceUttered({ text: line.text }))
      })
      .onError((error) => {
        Queue.offerUnsafe(queue, Message.VoiceFailed({ clause: '', reason: error.message }))
      })

    const opened = yield* Effect.tryPromise({
      try: async () => {
        await mic.load()
        mic.setKeyterms([...KEYTERMS])
        await mic.start()
        const unwatch = meterOf(mic)
        Queue.offerUnsafe(queue, Message.VoiceLoading({ progress: null }))
        return { mic, unwatch }
      },
      catch: (error) => (error instanceof Error ? error.message : 'The microphone did not open.'),
    }).pipe(
      Effect.match({
        onSuccess: (started) => started,
        onFailure: (reason): Opened | null => {
          Queue.offerUnsafe(queue, Message.VoiceFailed({ clause: '', reason }))
          return null
        },
      }),
    )
    if (opened === null) return yield* Effect.never

    yield* Effect.acquireRelease(Effect.succeed(opened), (running) =>
      Effect.sync(() => running.unwatch?.()).pipe(
        Effect.flatMap(() => Effect.tryPromise(() => running.mic.stop())),
        Effect.ignore,
        Effect.flatMap(() => Effect.sync(() => running.mic.close())),
      ),
    )
    return yield* Effect.never
  }),
)

/** The window loses or gets back focus, or the tab is hidden or shown. */
const blurs = Stream.callback<Message>((queue) =>
  Effect.gen(function* () {
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const blurred = () => Queue.offerUnsafe(queue, Message.WindowBlurred())
        const focused = () => Queue.offerUnsafe(queue, Message.WindowFocused())
        const changed = () => {
          if (document.visibilityState === 'hidden') blurred()
          else if (document.hasFocus()) focused()
        }
        window.addEventListener('blur', blurred)
        window.addEventListener('focus', focused)
        document.addEventListener('visibilitychange', changed)
        return () => {
          window.removeEventListener('blur', blurred)
          window.removeEventListener('focus', focused)
          document.removeEventListener('visibilitychange', changed)
        }
      }),
      (cleanup) => Effect.sync(cleanup),
    )
    return yield* Effect.never
  }),
)

const teamDrag = Subscription.lift(DragAndDrop.subscriptions)<Model, Message>({
  read: (model) => (model.panel === 'team' ? Option.some(model.board.team.drag) : Option.none()),
  toParentMessage: (message) =>
    Message.TeamChanged({ message: TeamMessage.DragChanged({ message }) }),
})

const researchDrag = Subscription.lift(DragAndDrop.subscriptions)<Model, Message>({
  read: (model) =>
    model.panel === 'research' ? Option.some(model.board.research.drag) : Option.none(),
  toParentMessage: (message) =>
    Message.ResearchChanged({ message: ResearchMessage.DragChanged({ message }) }),
})

/** The Settings panel's sound slider drags while it is open. */
const volumeDrag = Subscription.lift(VolumeSlider.subscriptions)<Model, Message>({
  read: (model) => (model.panel === 'settings' ? Option.some(model.volumeSlider) : Option.none()),
  toParentMessage: (message) => Message.VolumeSliderChanged({ message }),
})

const teamDragScroll = Stream.callback<Message>((queue) =>
  Effect.gen(function* () {
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        let pointer: PointerEvent | null = null
        let frame = 0
        let lastTime = 0
        const scroll = (time: number) => {
          frame = 0
          const floor = document.querySelector<HTMLElement>(
            '[data-team-drag-floor][data-team-drag-active]',
          )
          if (!floor || !pointer) return
          const rect = floor.getBoundingClientRect()
          const { clientX, clientY, screenX, screenY } = pointer
          if (
            clientX < rect.left ||
            clientX > rect.right ||
            clientY < rect.top ||
            clientY > rect.bottom
          )
            return
          const edge = 52
          const distance = Math.min(clientY - rect.top, rect.bottom - clientY)
          if (distance >= edge) return
          const direction = clientY - rect.top < rect.bottom - clientY ? -1 : 1
          const elapsed = lastTime ? Math.min(time - lastTime, 50) : 16
          lastTime = time
          const before = floor.scrollTop
          floor.scrollTop += direction * 600 * (1 - distance / edge) * (elapsed / 1000)
          if (floor.scrollTop !== before) {
            const container = document
              .elementsFromPoint(clientX, clientY)
              .find(
                (element) => element.hasAttribute('data-droppable-id') && floor.contains(element),
              )
            const containerId = container?.getAttribute('data-droppable-id')
            const items = container
              ? Array.from(container.querySelectorAll('[data-sortable-id]'))
              : []
            const index = items.findIndex((item) => {
              const bounds = item.getBoundingClientRect()
              return clientY < bounds.top + bounds.height / 2
            })
            Queue.offerUnsafe(
              queue,
              Message.TeamChanged({
                message: TeamMessage.DragChanged({
                  message: DragAndDrop.Message.MovedPointer({
                    screenX,
                    screenY,
                    clientX,
                    clientY,
                    maybeDropTarget: containerId
                      ? Option.some({ containerId, index: index < 0 ? items.length : index })
                      : Option.none(),
                  }),
                }),
              }),
            )
            frame = requestAnimationFrame(scroll)
          }
        }
        const move = (event: PointerEvent) => {
          pointer = event
          if (!frame) {
            lastTime = 0
            frame = requestAnimationFrame(scroll)
          }
        }
        document.addEventListener('pointermove', move)
        return () => {
          document.removeEventListener('pointermove', move)
          cancelAnimationFrame(frame)
        }
      }),
      (cleanup) => Effect.sync(cleanup),
    )
    return yield* Effect.never
  }),
)

/**
 * The clock's ticks, each carrying the wall time that really passed since the previous one, so the
 * Simulation keeps the speed the player chose even when a tick takes longer than its interval. The
 * first tick of a run owes one interval: a pause or a hidden tab rests the clock, never catches up.
 */
const ticks = (): Stream.Stream<Message> =>
  Stream.tick(TICK_MS).pipe(
    Stream.mapAccum(
      () => 0,
      (at) => {
        const now = Date.now()
        return [now, [Message.Ticked({ elapsedMs: at === 0 ? TICK_MS : Math.max(0, now - at) })]]
      },
    ),
  )

export const subscriptions = {
  ...teamDrag,
  ...volumeDrag,
  researchDragPointer: researchDrag.documentPointer,
  researchDragEscape: researchDrag.documentEscape,
  researchDragKeyboard: researchDrag.documentKeyboard,
  researchDragAutoScroll: researchDrag.autoScroll,
  ...Subscription.make<Model, Message>()((entry) => ({
    tick: entry(
      { running: Schema.Boolean },
      {
        modelToDependencies: (model: Model) => ({
          running: onBoard(model.route) && !halted(model),
        }),
        dependenciesToStream: ({ running }: { running: boolean }) =>
          running ? ticks() : Stream.empty,
      },
    ),

    blurs: entry(
      { watching: Schema.Boolean },
      {
        modelToDependencies: (model: Model) => ({
          watching:
            model.prefs.blurPause && onBoard(model.route) && (!halted(model) || clockAway(model)),
        }),
        dependenciesToStream: ({ watching }: { watching: boolean }) =>
          watching ? blurs : Stream.empty,
      },
    ),

    keys: entry(
      { lab: Schema.Boolean, dragging: Schema.Boolean },
      {
        modelToDependencies: (model: Model) => ({
          lab: onBoard(model.route),
          dragging:
            (model.panel === 'team' && model.board.team.drag.dragState._tag !== 'Idle') ||
            (model.panel === 'research' && model.board.research.drag.dragState._tag !== 'Idle'),
        }),
        dependenciesToStream: ({ lab, dragging }: { lab: boolean; dragging: boolean }) =>
          lab && !dragging ? keys : Stream.empty,
      },
    ),

    /**
     * The Room socket. It opens while this tab is in a Room, sends Hello with
     * the Seat's name and the owner token, and feeds every frame back as a
     * Message. A dropped socket reconnects and the Room answers with a snapshot.
     */
    room: entry(
      {
        code: Schema.NullOr(Schema.String),
        seat: Schema.String,
        name: Schema.String,
        token: Schema.NullOr(Schema.String),
        live: Schema.Boolean,
      },
      {
        modelToDependencies: (model: Model) => {
          const code = roomCode(model)
          return {
            code,
            seat: seatOf(),
            name: model.room.name,
            token: code === null ? null : (onlineFileOf(model, code)?.online?.token ?? null),
            // Wait for the save list: the first Hello must carry the owner token,
            // or the tab joins as a guest and the Room sees two Seats for one tab.
            live: inRoom(model.room.phase) && model.savesReady,
          }
        },
        dependenciesToStream: ({
          code,
          seat,
          name,
          token,
          live,
        }: {
          code: string | null
          seat: string
          name: string
          token: string | null
          live: boolean
        }) =>
          live && code !== null
            ? Stream.callback<Message>((queue) =>
                Effect.acquireRelease(
                  Effect.sync(() => {
                    const offMessage = onMessage((message) => {
                      // A Welcome starts the Seat list over, so a pointer from a socket
                      // that dropped does not outlive it.
                      if (ServerMessage.guards.Welcome(message)) clearSeatCursors('board')
                      // A cursor is Presence. It moves the Board's overlay and never the
                      // Model, so a whole Room of pointers does not repaint the Company.
                      if (ServerMessage.guards.Cursor(message)) {
                        moveSeatCursor('board', {
                          seat: message.seat,
                          name: message.name,
                          colour: seatColour(message.colour),
                          x: message.x,
                          y: message.y,
                          region: message.region,
                          activity: message.activity ?? null,
                        })
                        return
                      }
                      if (ServerMessage.guards.CursorGone(message)) {
                        hideSeatCursor('board', message.seat)
                        return
                      }
                      Queue.offerUnsafe(queue, Message.RoomReceived({ message }))
                    })
                    const offStatus = onStatus((status) =>
                      Queue.offerUnsafe(queue, Message.RoomStatusChanged({ status })),
                    )
                    connect({ code, seat, name, ...(token === null ? {} : { token }) })
                    return () => {
                      offMessage()
                      offStatus()
                      clearSeatCursors('board')
                      stop()
                    }
                  }),
                  () => Effect.void,
                ),
              )
            : Stream.empty,
      },
    ),

    /** Dictation stays on until the player switches it off, across Boards and panels. */
    dictation: entry(
      { listening: Schema.Boolean },
      {
        modelToDependencies: (model: Model) => ({ listening: model.voice.on }),
        dependenciesToStream: ({ listening }: { listening: boolean }) =>
          listening ? speech : Stream.empty,
      },
    ),

    teamDragScroll: entry(
      { active: Schema.Boolean },
      {
        modelToDependencies: (model: Model) => ({
          active:
            model.panel === 'team' &&
            (model.board.team.drag.dragState._tag === 'Pending' ||
              model.board.team.drag.dragState._tag === 'Dragging'),
        }),
        dependenciesToStream: ({ active }: { active: boolean }) =>
          active ? teamDragScroll : Stream.empty,
      },
    ),
  })),
}
