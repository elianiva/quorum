import { css } from '@quorum/styled-system/css'
import { localizeBuilder } from '../i18n/builder.ts'
import { copy } from '../i18n/messages.ts'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'
import { toast } from '@/components/lab/toast.ts'
import { roomPanel, settingsPanel } from '@/components/lab/panels.ts'
import { labScreen } from './screens.ts'
import { titleScreen } from './title.ts'
import type { Message } from './message.ts'
import { boardChallenge, boardSandbox, type Model } from './model.ts'
import { isPlaying } from './company-machine.ts'
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

const offlineStatus = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return model.pwa.online
    ? h.empty
    : h.p(
        [
          h.Class('offline-status'),
          h.Role('status'),
          h.AriaLabel(t.pwa.offlineStatus),
          h.Title(t.pwa.offlineStatus),
        ],
        [
          h.span([h.Class('offline-status-dot'), h.AriaHidden(true)], []),
          h.span([], [t.pwa.offline]),
        ],
      )
}

export const view = (model: Model, builder: HtmlBuilder<Message>): Document => {
  const h = localizeBuilder(model.prefs.locale, builder)
  const screen = onBoard(model.route) && !connecting(model.boot)
  const board = screen && boardFilled(model)
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
          [h.Key(board ? 'board' : 'title'), h.Class(css({ height: '100%' }))],
          [
            board
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
