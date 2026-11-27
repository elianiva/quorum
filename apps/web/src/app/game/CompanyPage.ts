import { Subscription } from '@effect/ui'
import { Html } from '@effect/ui/html'
import { css, cx } from '@quorum/styled-system/css'
import { Duration, Stream } from 'effect'
import { Message } from '../../game/message.ts'
import { Model, ledgerOf } from '../../game/model.ts'
import { DEFAULT_LOGO } from '../../game/logos.ts'
import { AppRoute as OldAppRoute } from '../../game/route.ts'
import { fileFor } from '../../game/saves.ts'
import { TICK_MS, initialModel, update } from '../../game/update.ts'
import { freshBoard, sync } from '../../game/update/shared.ts'
import { boardHost } from './BoardHost.ts'
import { changeBar, hud, regionTabs, toolbar } from './Hud.ts'
import { inspector } from './Inspector.ts'
import { Shop } from './Shop.ts'
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

const TOP = css({
  display: 'contents',
  _compact: {
    pointerEvents: 'none',
    position: 'absolute',
    left: '0',
    right: '0',
    top: '0',
    zIndex: '20',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5',
    '--toolbar-w': 'calc(184px * var(--type-scale))',
    paddingTop: 'max(8px, env(safe-area-inset-top))',
    paddingRight: 'max(8px, env(safe-area-inset-right))',
    paddingBottom: '0',
    paddingLeft: 'max(8px, env(safe-area-inset-left))',
  },
})

const TOP_ROW = css({
  pointerEvents: 'none',
  position: 'absolute',
  top: '3',
  right: '3',
  zIndex: '20',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '3',
  _compact: { display: 'contents' },
})

const LANE = css({
  display: 'flex',
  minWidth: '0',
  flex: '1 1 0%',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2',
  _compact: { alignItems: 'stretch', gap: '1.5' },
})

const BOTTOM = css({
  pointerEvents: 'none',
  position: 'absolute',
  bottom: '3',
  left: '50%',
  zIndex: '20',
  display: 'flex',
  translate: '-50% 0',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2',
  _compact: {
    right: 'max(8px, env(safe-area-inset-right))',
    bottom: 'max(8px, env(safe-area-inset-bottom))',
    left: 'max(8px, env(safe-area-inset-left))',
    translate: '0 0',
    alignItems: 'stretch',
  },
})

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
    const ledger = ledgerOf(model)
    return h.div.class(STAGE).children(
      boardHost(h, model),
      h.div.class(TOP).children(
        hud(h, model, ledger),
        h.div
          .class(TOP_ROW)
          .style({ left: `calc(${276 + 24}px * var(--type-scale))` })
          .children(
            h.div.attr('data-flip', 'notice').class(LANE).children(regionTabs(h, model)),
            toolbar(h, model),
          ),
      ),
      h.div
        .attr('data-flip', 'gesture')
        .class(BOTTOM)
        .children(changeBar(h, model, cx('enter-pop', css({ _compact: { display: 'none' } })))),
      inspector(h, model, ledger),
      model.panel === 'shop' ? Shop(h, model) : null,
    )
  },
})
