import { Subscription } from '@effect/ui'
import { Html } from '@effect/ui/html'
import { css, cx } from '@quorum/styled-system/css'
import { Duration, Stream } from 'effect'
import { Message } from '../../game/message.ts'
import {
  Model,
  boardChallenge,
  boardSandbox,
  confirmSellOf,
  ledgerOf,
  stampedPlaybook,
} from '../../game/model.ts'
import { DEFAULT_LOGO } from '../../game/logos.ts'
import { AppRoute as OldAppRoute } from '../../game/route.ts'
import { fileFor } from '../../game/saves.ts'
import { TICK_MS, initialModel, update } from '../../game/update.ts'
import { isExited } from '../../game/company-machine.ts'
import { freshBoard, sync } from '../../game/update/shared.ts'
import { dockItems } from '../../game/reveal.ts'
import { activeIncident } from '@quorum/simulation/state'
import { boardHost } from './BoardHost.ts'
import { dock } from './Dock.ts'
import * as Legacy from './Legacy.ts'
import { challengeBar, challengeHud, challengePanel } from './Challenge.ts'
import { objectiveBar, passedPanel, sandboxHud } from './Sandbox.ts'
import { inboxButton, inboxPanel, mailQueueRow, peek } from './Inbox.ts'
import { nodeList } from './NodeList.ts'
import { alertsNotice, incidentNotice, researchOffer } from './Notices.ts'
import { commandPalette } from './Palette.ts'
import { researchPanel } from './Research.ts'
import { dashboardPanel } from './Dashboard.ts'
import {
  devPanel,
  endPanel,
  eraPanel,
  helpPanel,
  menuPanel,
  offerPanel,
  roomPanel,
  settingsPanel,
} from './Panels.ts'
import { toast } from './Toast.ts'
import { tradeoffCard } from './Tradeoff.ts'
import { firstStepsBar } from './FirstSteps.ts'
import {
  changeBar,
  hud,
  phoneOffer,
  regionTabs,
  screenshotExit,
  toolbar,
  vitalsPanel,
} from './Hud.ts'
import { inspector } from './Inspector.ts'
import { Shop } from './Shop.ts'
import { blurs, keys } from './keys.ts'
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
    Subscription.make('keys', keys),
    Subscription.make('blurs', blurs),
    Subscription.make(
      'tick',
      Stream.tick(Duration.millis(TICK_MS)).pipe(
        Stream.map(() => Message.Ticked({ elapsedMs: TICK_MS })),
      ),
    ),
  ],

  view: (h, model) => {
    const ledger = ledgerOf(model)
    const sandbox = boardSandbox(model.board)
    const challenge = boardChallenge(model.board)
    const hudWidth = sandbox !== null || challenge !== null ? 248 : 276
    if (isExited(model.companyPhase))
      return h.div.class(STAGE).children(Legacy.exitScreen(h, model))
    if (model.board.screenshot)
      return h.div
        .class(STAGE)
        .children(nodeList(h, model, ledger), boardHost(h, model), screenshotExit(h))
    return h.div.class(STAGE).children(
      nodeList(h, model, ledger),
      boardHost(h, model),
      h.div.class(TOP).children(
        challenge !== null
          ? challengeHud(h, model, ledger)
          : sandbox !== null
            ? sandboxHud(h, model, ledger)
            : hud(h, model, ledger),
        h.div
          .class(TOP_ROW)
          .style({ left: `calc(${hudWidth + 24}px * var(--type-scale))` })
          .children(
            h.div
              .attr('data-flip', 'notice')
              .class(LANE)
              .children(
                regionTabs(h, model),
                challenge !== null
                  ? challengeBar(h, model)
                  : sandbox !== null
                    ? objectiveBar(h, model)
                    : firstStepsBar(h, model),
                incidentNotice(h, model),
                activeIncident(model.board.game) !== null ? null : mailQueueRow(h, model),
                alertsNotice(h, model),
              ),
            toolbar(h, model),
          ),
      ),
      h.div
        .attr('data-flip', 'gesture')
        .class(BOTTOM)
        .children(
          changeBar(h, model, cx('enter-pop', css({ _compact: { display: 'none' } }))),
          h.div
            .class(css({ display: 'none', _compact: { display: 'contents' } }))
            .children(phoneOffer(h, model)),
          confirmSellOf(model.board) !== null
            ? Legacy.sellBar(h, model)
            : model.board.selection.length > 0
              ? Legacy.selectionBar(h, model)
              : stampedPlaybook(model)
                ? Legacy.stampBar(h, model)
                : dock(h, model),
        ),
      inspector(h, model, ledger),
      tradeoffCard(h, model),
      model.panel === 'research' ? researchPanel(h, model) : null,
      model.panel === 'exit' ? Legacy.exitPanel(h, model) : null,
      model.panel === 'playbooks' ? Legacy.playbooksPanel(h, model) : null,
      model.panel === 'help' ? helpPanel(h, model) : null,
      model.panel === 'menu' ? menuPanel(h, model) : null,
      model.panel === 'room' ? roomPanel(h, model) : null,
      model.panel === 'settings' ? settingsPanel(h, model) : null,
      model.panel === 'inbox' ? inboxPanel(h, model) : null,
      model.panel === 'dashboard' ? dashboardPanel(h, model, ledger) : null,
      model.panel === 'vitals' ? vitalsPanel(h, model, ledger) : null,
      model.panel === 'shop' ? Shop(h, model) : null,
      model.panel === 'offer' ? offerPanel(h, model) : null,
      model.panel === 'era' ? eraPanel(h, model) : null,
      model.panel === 'end' ? endPanel(h, model) : null,
      model.panel === 'dev' ? devPanel(h, model) : null,
      model.panel === 'passed' ? passedPanel(h, model) : null,
      model.panel === 'challenge' ? challengePanel(h, model) : null,
      h.div
        .class(css({ display: 'contents', _compact: { display: 'none' } }))
        .children(peek(h, model), researchOffer(h, model)),
      challenge !== null || model.board.game.nodes.some((node) => node.id === model.board.selected)
        ? null
        : inboxButton(h, model),
      commandPalette(h, model),
      toast(
        h,
        model.toast,
        model.panel !== 'none' && !model.board.screenshot,
        model.board.buildGroup === null
          ? 0
          : dockItems(model.board.game, model.board.buildGroup).length,
      ),
    )
  },
})
