import { Effect, Queue, Stream } from 'effect'
import { Message } from '../../game/message.ts'

type KeyMessage = ReturnType<typeof Message.KeyPressed>

const keyNameOf = (key: string, shift: boolean): string =>
  key.length !== 1
    ? shift && key.startsWith('Arrow')
      ? `Shift+${key}`
      : key
    : shift && key.toLowerCase() === 'z'
      ? 'Z'
      : shift && /^[a-z]$/i.test(key)
        ? `Shift+${key.toLowerCase()}`
        : key.toLowerCase()

export const keys = Stream.callback<KeyMessage>((queue) =>
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
          const target = event.target instanceof Element ? event.target : null
          if (target?.closest('[data-language-picker], [role="listbox"]')) return
          if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
          if (event.altKey) return
          const mod = event.metaKey || event.ctrlKey
          const lower = event.key.toLowerCase()
          if (mod) {
            const edit = ['a', 'c', 'x', 'v', 'd'].includes(lower)
            const history = lower === 'z' || lower === 'y'
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

export const blurs = Stream.callback<Message>((queue) =>
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
