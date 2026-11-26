import * as Effect from 'effect/Effect'
import { css } from '@quorum/styled-system/css'
import * as Queue from 'effect/Queue'
import * as Stream from 'effect/Stream'
import { Mount } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { attachBoard } from '@quorum/ui/board/board'
import { copy } from '@/i18n/messages.ts'
import { Message } from './message.ts'
import { surfaceUnavailable } from './board-surface-machine.ts'
import type { Model } from './model.ts'
import { play } from './sound.ts'
import { reportBoardFailure } from '@/platform/sentry.ts'
import { hideCursor, sendCursor } from '@/platform/room-socket.ts'

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

const BoardMounted = Mount.defineStream('BoardMounted', {
  args: {},
  messages: [
    Message.BoardReady,
    Message.BoardFailed,
    Message.NodeTapped,
    Message.ShopOpened,
    Message.NodeMoved,
    Message.LinkRequested,
    Message.LinkCut,
    Message.NodePlaced,
    Message.EmptyTapped,
    Message.FooterPressed,
    Message.NodeToggled,
    Message.SelectionBoxed,
  ],
  execute: ({ element }) =>
    Stream.callback<BoardMessage>((queue) =>
      Effect.gen(function* () {
        const offer = (message: BoardMessage) => Queue.offerUnsafe(queue, message)
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            attachBoard('board', element as HTMLElement, {
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
            }),
          ),
          (detach) => Effect.sync(detach),
        )
        return yield* Effect.never
      }),
    ),
})

/* A browser without WebGL gets a readable message instead of an empty canvas; each line names
   the reason it belongs to, and the host shows only the lines for its own reason. */
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

export const boardHost = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const surface = model.board.surface
  const reason = surfaceUnavailable(surface) ? surface.reason : null
  return h.div(
    [
      h.Key('board'),
      h.Class(BOARD_HOST),
      ...(reason === null
        ? [h.OnMount(BoardMounted({}))]
        : [h.DataAttribute('board-unavailable', reason === 'webgl' ? 'webgl' : 'error')]),
    ],
    reason === null
      ? []
      : [
          h.div(
            [h.Class(UNAVAILABLE), h.Role('status')],
            [
              h.p([h.DataAttribute('unavailable', 'webgl')], [t.panels.webglUnavailable]),
              h.a(
                [
                  h.DataAttribute('unavailable', 'webgl'),
                  h.Href('https://get.webgl.org'),
                  h.Target('_blank'),
                  h.Rel('noreferrer noopener'),
                ],
                [t.panels.webglHelp],
              ),
              h.p([h.DataAttribute('unavailable', 'error')], [t.panels.boardFailed]),
            ],
          ),
        ],
  )
}
