import { Mount } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css } from '@quorum/styled-system/css'
import { Effect, Queue, Stream } from 'effect'
import { attachBoard, type BoardEvents } from '@quorum/ui/board/board'
import { copyIn } from '../../i18n/messages.ts'
import { surfaceUnavailable } from '../../game/board-surface-machine.ts'
import { Message } from '../../game/message.ts'
import type { Model } from '../../game/model.ts'
import { play } from '../../game/sound.ts'
import { reportBoardFailure } from '../../platform/sentry.ts'
import { hideCursor, sendCursor } from '../../platform/room-socket.ts'

type BoardMessage =
  | ReturnType<typeof Message.BoardReady>
  | ReturnType<typeof Message.BoardFailed>
  | ReturnType<typeof Message.NodeTapped>
  | ReturnType<typeof Message.ShopOpened>
  | ReturnType<typeof Message.NodeMoved>
  | ReturnType<typeof Message.LinkRequested>
  | ReturnType<typeof Message.LinkCut>
  | ReturnType<typeof Message.NodePlaced>
  | ReturnType<typeof Message.EmptyTapped>
  | ReturnType<typeof Message.FooterPressed>
  | ReturnType<typeof Message.NodeToggled>
  | ReturnType<typeof Message.SelectionBoxed>

const BoardMounted = Mount.makeStream('BoardMounted', {}, (element: HTMLElement) =>
  Stream.callback<BoardMessage>((queue) =>
    Effect.gen(function* () {
      const offer = (message: BoardMessage) => Queue.offerUnsafe(queue, message)
      const events: BoardEvents = {
        onNodeTap: (nodeId) => offer(Message.NodeTapped({ nodeId })),
        onSlot: (nodeId, slot) => offer(Message.ShopOpened({ nodeId, slot })),
        onNodeMove: (nodeId, x, y) => offer(Message.NodeMoved({ nodeId, x, y })),
        onFooter: (nodeId) => offer(Message.FooterPressed({ nodeId })),
        onLink: (from, to) => offer(Message.LinkRequested({ from, to })),
        onUnlink: (from, to) => offer(Message.LinkCut({ from, to })),
        onPlace: (x, y) => offer(Message.NodePlaced({ x, y })),
        onEmptyTap: () => offer(Message.EmptyTapped()),
        onNodeToggle: (nodeId) => offer(Message.NodeToggled({ nodeId })),
        onBox: (ids, mode) => offer(Message.SelectionBoxed({ ids: [...ids], mode })),
        onCursor: sendCursor,
        onCursorGone: hideCursor,
        onSound: play,
        onReady: () => offer(Message.BoardReady()),
        onUnavailable: (reason) => offer(Message.BoardFailed({ reason })),
        onStartFailed: reportBoardFailure,
      }
      yield* Effect.acquireRelease(
        Effect.sync(() => attachBoard('board', element, events)),
        (detach) => Effect.sync(detach),
      )
      return yield* Effect.never
    }),
  ),
)

const BOARD_HOST = css({
  position: 'absolute',
  inset: '0',
  backgroundColor: 'canvas',
  '&[data-board-unavailable="webgl"] [data-unavailable="error"]': { display: 'none' },
  '&[data-board-unavailable="error"] [data-unavailable="webgl"]': { display: 'none' },
})

const UNAVAILABLE = css({
  position: 'absolute',
  inset: '0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  padding: '24px',
  textAlign: 'center',
  color: 'var(--muted-foreground)',
  background: 'var(--canvas)',
  '& p': { maxWidth: '380px', lineHeight: 'var(--quorum-line-heights-normal)' },
  '& a': { color: 'var(--signal)', textDecoration: 'underline', textUnderlineOffset: '3px' },
})

export const boardHost = (h: H<Message>, model: Model) => {
  const t = copyIn(model.prefs.locale)
  const surface = model.board.surface
  const reason = surfaceUnavailable(surface) ? surface.reason : null
  const base = h.div
    .key('board')
    .class(BOARD_HOST)
    .attr(
      'data-board-unavailable',
      reason === null ? undefined : reason === 'webgl' ? 'webgl' : 'error',
    )
  const mounted = reason === null ? base.onMount(BoardMounted({})) : base
  return mounted.children(
    ...(reason === null
      ? []
      : [
          h.div
            .class(UNAVAILABLE)
            .attr('role', 'status')
            .children(
              h.p.attr('data-unavailable', 'webgl').children(t.panels.webglUnavailable),
              h.a
                .attr('data-unavailable', 'webgl')
                .attr('href', 'https://get.webgl.org')
                .attr('target', '_blank')
                .attr('rel', 'noreferrer noopener')
                .children(t.panels.webglHelp),
              h.p.attr('data-unavailable', 'error').children(t.panels.boardFailed),
            ),
        ]),
  )
}
