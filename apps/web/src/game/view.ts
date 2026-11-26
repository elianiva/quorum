import { css } from '@quorum/styled-system/css'
import { localizeBuilder } from '../i18n/builder.ts'
import { copy } from '../i18n/messages.ts'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'
import { toast } from '@/components/lab/toast.ts'
import { roomPanel, settingsPanel } from '@/components/lab/panels.ts'
import { labScreen } from './screens.ts'
import { exitScreen } from '@/components/lab/legacy.ts'
import { titleScreen } from './title.ts'
import type { Message } from './message.ts'
import { boardChallenge, boardSandbox, type Model } from './model.ts'
import { isExited, isPlaying } from './company-machine.ts'
import { connecting } from './boot-machine.ts'
import { AppRoute, onBoard } from './route.ts'
import { RoomPhase } from './room-machine.ts'
import { dockItems } from './reveal.ts'

const boardFilled = (model: Model): boolean =>
  AppRoute.match(model.route, {
    Title: () => false,
    Menu: () => false,
    Company: () => isPlaying(model.companyPhase),
    Sandbox: () => boardSandbox(model.board) !== null,
    Challenge: () => boardChallenge(model.board) !== null,
    Room: () => RoomPhase.isAnyOf(['Online', 'Reconnecting'])(model.room.phase),
  })

/* The network is down. The Company keeps running in this browser; this says why Rooms wait. */
const OFFLINE = css({
  position: 'fixed',
  left: 'max(10px, env(safe-area-inset-left))',
  bottom: 'max(10px, env(safe-area-inset-bottom))',
  zIndex: '25',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '5px 9px',
  border: '1px solid color-mix(in oklch, var(--warn) 40%, transparent)',
  borderRadius: '999px',
  background: 'color-mix(in oklch, var(--page) 82%, transparent)',
  color: 'var(--warn)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--type-10-5)',
  fontWeight: 'var(--quorum-font-weights-semibold)',
  letterSpacing: 'var(--quorum-letter-spacings-eyebrow)',
  textTransform: 'uppercase',
  pointerEvents: 'none',
  backdropFilter: 'blur(6px)',
  /* On a phone the action bar sits along the bottom edge. */
  '@media (max-width: 639px), (max-height: 539px), (max-aspect-ratio: 1 / 1)': {
    bottom: 'calc(max(10px, env(safe-area-inset-bottom)) + 72px)',
  },
})

const offlineStatus = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return model.pwa.online
    ? h.empty
    : h.p(
        [
          h.Class(OFFLINE),
          h.Role('status'),
          h.AriaLabel(t.pwa.offlineStatus),
          h.Title(t.pwa.offlineStatus),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'currentColor',
                }),
              ),
              h.AriaHidden(true),
            ],
            [],
          ),
          h.span([], [t.pwa.offline]),
        ],
      )
}

export const view = (model: Model, builder: HtmlBuilder<Message>): Document => {
  const h = localizeBuilder(model.prefs.locale, builder)
  const screen = onBoard(model.route) && !connecting(model.boot)
  const board = screen && boardFilled(model)
  const exited = screen && AppRoute.guards.Company(model.route) && isExited(model.companyPhase)
  return {
    title: 'Quorum',
    lang: model.prefs.locale,
    body: h.div(
      [
        h.Class(
          css({
            height: '100dvh',
            width: '100%',
            overflow: 'hidden',
            backgroundColor: 'background',
            color: 'foreground',
            userSelect: 'none',
          }),
        ),
        h.DataAttribute('toast', model.toast ? 'on' : 'off'),
      ],
      [
        h.div(
          [h.Key(exited ? 'exit' : board ? 'board' : 'title'), h.Class(css({ height: '100%' }))],
          [
            exited
              ? exitScreen(model, h)
              : board
                ? labScreen(model, h)
                : screen
                  ? h.div([h.Class(css({ height: '100%', backgroundColor: 'canvas' }))])
                  : titleScreen(model, h),
          ],
        ),
        !onBoard(model.route) && model.panel === 'settings' ? settingsPanel(model, h) : h.empty,
        AppRoute.guards.Room(model.route) && model.panel === 'room' && !boardFilled(model)
          ? roomPanel(model, h)
          : h.empty,
        offlineStatus(model, h),
        toast(
          model.toast,
          model.panel !== 'none' && !model.board.screenshot,
          model.board.buildGroup === null
            ? 0
            : dockItems(model.board.game, model.board.buildGroup).length,
          h,
        ),
      ],
    ),
  }
}
