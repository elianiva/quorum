import { css, cx } from '@quorum/styled-system/css'
import { activeIncident } from '@quorum/simulation/state'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { dock } from '@/components/lab/dock.ts'
import {
  changeBar,
  hud,
  phoneOffer,
  regionTabs,
  screenshotExit,
  toolbar,
  vitalsPanel,
} from '@/components/lab/hud.ts'
import { alertsNotice, incidentNotice, researchOffer } from '@/components/lab/incidents.ts'
import { inspector } from '@/components/lab/inspector.ts'
import {
  devPanel,
  endPanel,
  eraPanel,
  helpPanel,
  menuPanel,
  roomPanel,
  offerPanel,
  settingsPanel,
} from '@/components/lab/panels.ts'
import { shopPanel } from '@/components/lab/shop.ts'
import { inboxButton, inboxPanel, mailQueueRow, peek } from '@/components/lab/inbox.ts'
import { churnPanel } from '@/components/lab/churn.ts'
import { costPanel } from '@/components/lab/cost.ts'
import { mirrorPanel } from '@/components/lab/mirror.ts'
import { dashboardPanel } from '@/components/lab/dashboard.ts'
import { researchPanel } from '@/components/lab/research.ts'
import { teamPanel } from '@/components/lab/team.ts'
import {
  exitPanel,
  exitedPanel,
  playbooksPanel,
  selectionBar,
  sellBar,
  stampBar,
} from '@/components/lab/legacy.ts'
import { objectiveBar, passedPanel, sandboxHud } from '@/components/lab/sandbox.ts'
import { challengeBar, challengeHud, challengePanel } from '@/components/lab/challenge.ts'
import { nodeList } from '@/components/lab/node-list.ts'
import { tradeoffCard } from '@/components/lab/tradeoff.ts'
import { commandPalette } from '@/components/lab/palette.ts'
import { boardHost } from './board-mount.ts'
import { Message } from './message.ts'
import {
  boardChallenge,
  ledgerOf,
  type Model,
  boardSandbox,
  confirmSellOf,
  stampedPlaybook,
} from './model.ts'

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

const bottomNotices = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class(css({ display: 'contents', _compact: { display: 'none' } }))],
    [peek(model, h), researchOffer(model, h)],
  )

export const labScreen = (model: Model, h: HtmlBuilder<Message>): Html => {
  const ledger = ledgerOf(model)
  if (model.board.screenshot)
    return h.main(
      [
        h.Class(
          css({
            position: 'relative',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: 'canvas',
          }),
        ),
      ],
      [nodeList(model, ledger, h), boardHost(model, h), screenshotExit(h)],
    )
  const hudWidth: 248 | 276 = boardChallenge(model.board) || boardSandbox(model.board) ? 248 : 276
  return h.main(
    [
      h.Class(
        css({
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: 'canvas',
        }),
      ),
    ],
    [
      nodeList(model, ledger, h),
      boardHost(model, h),
      h.div(
        [h.Class(TOP)],
        [
          boardChallenge(model.board)
            ? challengeHud(model, ledger, h)
            : boardSandbox(model.board)
              ? sandboxHud(model, ledger, h)
              : hud(model, ledger, h),
          h.div(
            [h.Class(TOP_ROW), h.Style({ left: `calc(${hudWidth + 24}px * var(--type-scale))` })],
            [
              h.div(
                [h.DataAttribute('flip', 'notice'), h.Class(LANE)],
                [
                  regionTabs(model, h),
                  boardChallenge(model.board)
                    ? challengeBar(model, h)
                    : boardSandbox(model.board)
                      ? objectiveBar(model, h)
                      : h.empty,
                  incidentNotice(model, h),
                  activeIncident(model.board.game) !== null ? h.empty : mailQueueRow(model, h),
                  alertsNotice(model, h),
                ],
              ),
              toolbar(model, h),
            ],
          ),
        ],
      ),
      h.div(
        [h.DataAttribute('flip', 'gesture'), h.Class(BOTTOM)],
        [
          changeBar(model, h, cx('enter-pop', css({ _compact: { display: 'none' } }))),
          h.div(
            [h.Class(css({ display: 'none', _compact: { display: 'contents' } }))],
            [phoneOffer(model, h)],
          ),
          confirmSellOf(model.board)
            ? sellBar(model, h)
            : model.board.selection.length > 0
              ? selectionBar(model, h)
              : stampedPlaybook(model)
                ? stampBar(model, h)
                : dock(model, h),
        ],
      ),
      inspector(model, ledger, h),
      tradeoffCard(model, h),
      bottomNotices(model, h),
      boardChallenge(model.board) ||
      model.board.game.nodes.some((node) => node.id === model.board.selected)
        ? h.empty
        : inboxButton(model, h),
      model.panel === 'research' ? researchPanel(model, h) : h.empty,
      model.panel === 'team' ? teamPanel(model, h) : h.empty,
      model.panel === 'exit' ? exitPanel(model, h) : h.empty,
      model.panel === 'exited' ? exitedPanel(model, h) : h.empty,
      model.panel === 'playbooks' ? playbooksPanel(model, h) : h.empty,
      model.panel === 'help' ? helpPanel(model, h) : h.empty,
      model.panel === 'menu' ? menuPanel(model, h) : h.empty,
      model.panel === 'room' ? roomPanel(model, h) : h.empty,
      model.panel === 'settings' ? settingsPanel(model, h) : h.empty,
      model.panel === 'inbox' ? inboxPanel(model, h) : h.empty,
      model.panel === 'dashboard' ? dashboardPanel(model, h) : h.empty,
      model.panel === 'churn' ? churnPanel(model, h) : h.empty,
      model.panel === 'cost' ? costPanel(model, h) : h.empty,
      model.panel === 'mirror' ? mirrorPanel(model, h) : h.empty,
      model.panel === 'vitals' ? vitalsPanel(model, ledger, h) : h.empty,
      model.panel === 'shop' ? shopPanel(model, h) : h.empty,
      model.panel === 'offer' ? offerPanel(model, h) : h.empty,
      model.panel === 'era' ? eraPanel(model, h) : h.empty,
      model.panel === 'end' ? endPanel(model, h) : h.empty,
      model.panel === 'dev' ? devPanel(model, h) : h.empty,
      model.panel === 'passed' ? passedPanel(model, h) : h.empty,
      model.panel === 'challenge' ? challengePanel(model, h) : h.empty,
      commandPalette(model, h),
    ],
  )
}
