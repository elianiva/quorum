import { Subscription } from '@effect/ui'
import { Html } from '@effect/ui/html'
import type { H } from '@effect/ui/html/Html'
import { css } from '@quorum/styled-system/css'
import { clock, compact, money, ms } from '@quorum/ui/game/format'
import { Duration, Stream } from 'effect'
import { copyIn, eraWords, type Messages } from '../../i18n/messages.ts'
import { Message } from '../../game/message.ts'
import { Model, currentFile, ledgerOf } from '../../game/model.ts'
import { DEFAULT_LOGO } from '../../game/logos.ts'
import { AppRoute as OldAppRoute } from '../../game/route.ts'
import { fileFor } from '../../game/saves.ts'
import { TICK_MS, initialModel, update } from '../../game/update.ts'
import { freshBoard, sync } from '../../game/update/shared.ts'
import { boardHost } from './BoardHost.ts'
import { runCommands } from './bridge.ts'

const STAGE = css({
  position: 'relative',
  height: '100dvh',
  width: '100%',
  overflow: 'hidden',
  backgroundColor: 'canvas',
  color: 'foreground',
  userSelect: 'none',
})

const HUD = css({
  position: 'absolute',
  insetInline: '0',
  top: '0',
  zIndex: 20,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  padding:
    'max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 0 max(10px, env(safe-area-inset-left))',
  pointerEvents: 'none',
})

const PILL = css({
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '8px 12px',
  borderRadius: 'xl',
  layerStyle: 'surface',
  boxShadow: 'card',
  fontFamily: 'mono',
  fontSize: 'type.12',
})

const FIGURE = css({ display: 'flex', flexDirection: 'column', gap: '1px', lineHeight: 'none' })
const LABEL = css({
  color: 'mutedForeground',
  fontSize: 'type.10-5',
  letterSpacing: 'eyebrow',
  textTransform: 'uppercase',
})
const VALUE = css({
  color: 'foreground',
  fontSize: 'type.14',
  fontWeight: 'medium',
  fontVariantNumeric: 'tabular-nums',
})
const NAME = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  paddingRight: '4px',
  borderRightWidth: '1px',
  borderRightStyle: 'solid',
  borderColor: 'hairline',
})
const CONTROL = css({
  pointerEvents: 'auto',
  height: '8',
  paddingInline: '3',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  layerStyle: 'raised',
  boxShadow: 'raised',
  fontSize: 'type.12-8',
  fontWeight: 'medium',
  whiteSpace: 'nowrap',
  outlineStyle: 'none',
  _hover: { filter: 'brightness(0.985)' },
  _focusVisible: { boxShadow: 'focus' },
})

const figure = (h: H<Message>, label: string, value: string) =>
  h.span
    .class(FIGURE)
    .children(h.span.class(LABEL).children(label), h.span.class(VALUE).children(value))

const hud = (h: H<Message>, model: Model, t: Messages) => {
  const game = model.board.game
  const ledger = ledgerOf(model)
  const file = currentFile(model)
  const paused = model.board.clock.mode._tag !== 'Running'
  return h.div.class(HUD).children(
    h.div
      .class(PILL)
      .children(
        h.span
          .class(NAME)
          .children(
            h.span.class(VALUE).children(file?.name ?? eraWords(t, game).name),
            h.span.class(LABEL).children(`${eraWords(t, game).name} · ${clock(game.time)}`),
          ),
        figure(h, t.hud.cash, money(game.cash)),
        figure(h, t.hud.users, compact(game.users)),
        figure(h, 'Apdex', game.apdex.toFixed(2)),
        figure(h, t.hud.latency, ms(ledger.latency)),
      ),
    h.div.class(PILL).children(
      h.button
        .class(CONTROL)
        .attr('type', 'button')
        .on('click', () => Message.PauseToggled())
        .children(paused ? t.panels.resume : t.panels.pause),
      h.button
        .class(CONTROL)
        .attr('type', 'button')
        .on('click', () => Message.SpeedCycled())
        .children(`×${model.board.clock.speed}`),
    ),
  )
}

export const CompanyPage = Html.component({
  name: 'CompanyPage',
  model: Model,
  message: Message,
}).make({
  init: ($) => {
    const base = initialModel()
    const game = base.board.game
    const file = fileFor({
      id: 'local',
      name: 'Quorum',
      logo: DEFAULT_LOGO,
      founding: game.founding,
      game,
      now: Date.now(),
    })
    const model: Model = {
      ...base,
      route: OldAppRoute.Company(),
      boot: { _tag: 'Ready' },
      companyPhase: { _tag: 'Open', id: file.id },
      saves: { _tag: 'Ready', index: { lastPlayed: file.id, companies: [file] } },
      board: freshBoard(game),
    }
    return $.set(model).run(...runCommands([sync(model, true)]))
  },

  update: ($, message) => {
    const result = update($.model, message)
    const next = $.set(result.model)
    return result.commands === undefined ? next : next.run(...runCommands(result.commands))
  },

  subscriptions: () => [
    Subscription.make(
      'tick',
      Stream.tick(Duration.millis(TICK_MS)).pipe(
        Stream.map(() => Message.Ticked({ elapsedMs: TICK_MS })),
      ),
    ),
  ],

  view: (h, model) => {
    const t = copyIn(model.prefs.locale)
    return h.div.class(STAGE).children(boardHost(h, model), hud(h, model, t))
  },
})
