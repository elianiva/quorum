import { describe, expect, test } from 'vitest'
import { Scene } from 'foldkit/test'
import { newGame, preseedGame } from '@quorum/simulation/company'
import { MAX_STUDIES, RESEARCH, researchList, type ResearchId } from '@quorum/simulation/catalog'
import { priceOf, researchReady } from '@quorum/simulation/lookups'
import { studyList, type Study, type StudyQueue } from '@quorum/simulation/study-machine'
import { money } from '@quorum/ui/game/format'
import { AppendLog, ClearToast, PlaySound, SyncBoard } from './commands.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { firstStepsBar } from '../components/lab/first-steps.ts'
import { dock } from '../components/lab/dock.ts'
import { detail, ResearchResize } from '../components/lab/research.ts'
import { copyIn } from '../i18n/messages.ts'
import { EMPTY_INBOX, InboxMessage, mailed } from './inbox.ts'
import { firstStepOf, upgradePriceOf } from './first-steps.ts'
import { linkPreviewOf } from './link-preview.ts'
import { Message } from './message.ts'
import { AppRoute } from './route.ts'
import { initialModel, update } from './update.ts'
import type { Model } from './model.ts'

const inLab = (): Model => {
  const model = initialModel()
  return { ...model, route: AppRoute.Company(), board: { ...model.board, game: newGame() } }
}

const screen = (model: Model, h: HtmlBuilder<Message>, body: Html): Html =>
  h.div([h.Key('screen')], [body])

const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div([h.Key('screen')], [firstStepsBar(model, h)])

const queued = (id: ResearchId): Study => ({ id, phase: { _tag: 'Queued', progress: 0 } })

const queueOf = (studies: ReadonlyArray<Study>): StudyQueue =>
  studies.length === 0
    ? { _tag: 'Empty' }
    : { _tag: 'Working', current: studies[0]!, queued: studies.slice(1) }

describe('the first step after founding', () => {
  test('asks for the Payments revenue first, then the App Server upgrade', () => {
    const fresh = inLab()
    expect(firstStepOf(fresh)).toBe('collect')
    const paid = {
      ...fresh,
      board: {
        ...fresh.board,
        game: { ...fresh.board.game, pending: 0, earned: 40, spilled: 0 },
      },
    }
    expect(firstStepOf(paid)).toBe('upgrade')
    const upgraded = {
      ...paid,
      board: {
        ...paid.board,
        game: {
          ...paid.board.game,
          nodes: paid.board.game.nodes.map((node) =>
            node.type === 'server' ? { ...node, size: 2 } : node,
          ),
        },
      },
    }
    expect(firstStepOf(upgraded)).toBeNull()
  })

  test('a founder who has exited before never sees it', () => {
    const model = inLab()
    const veteran = {
      ...model,
      founder: { ...model.founder, history: [{ id: 'c-old' } as never] },
    }
    expect(firstStepOf(veteran)).toBeNull()
  })

  test('the callout collects the drawer and moves to the upgrade in one click', () => {
    const t = copyIn('en')
    const model = {
      ...inLab(),
      board: { ...inLab().board, game: { ...newGame(), pending: 42, earned: 42 } },
    }
    Scene.scene(
      { update, view },
      Scene.given(model),
      Scene.expect(Scene.text(t.panels.collectTheRevenue)).toExist(),
      Scene.expect(Scene.role('button', { name: /Collect/ })).toBeEnabled(),
      Scene.click(Scene.role('button', { name: /Collect/ })),
      Scene.expectHandled(),
      Scene.Command.resolveAll(
        [ClearToast, Message.ToastCleared({ id: 1 })],
        [PlaySound, Message.Synced()],
        [SyncBoard, Message.Synced()],
        [AppendLog, Message.Synced()],
      ),
      Scene.expect(Scene.text(t.panels.upgradeTheAppServer)).toExist(),
    )
  })

  test('the upgrade step shows its price and is disabled while Cash is short', () => {
    const base = inLab()
    const model: Model = {
      ...base,
      board: {
        ...base.board,
        game: { ...base.board.game, cash: 0, pending: 0, earned: 10, spilled: 0 },
      },
    }
    const price = upgradePriceOf(model)
    expect(price).not.toBeNull()
    const t = copyIn('en')
    Scene.scene(
      { update, view },
      Scene.given(model),
      Scene.expect(Scene.text(t.panels.upgradeTheAppServer)).toExist(),
      Scene.expect(Scene.role('button', { name: /Larger/ })).toBeDisabled(),
      Scene.expect(Scene.role('button', { name: /Larger/ })).toContainText(money(price ?? 0)),
    )
  })
})

describe('the unaffordable dock row', () => {
  test('shows its price and is disabled before a click', () => {
    const base = inLab()
    const model = {
      ...base,
      board: {
        ...base.board,
        game: { ...base.board.game, cash: 0 },
        buildGroup: 'compute' as const,
      },
    }
    Scene.scene(
      { update, view: (state: Model, h: HtmlBuilder<Message>) => screen(state, h, dock(state, h)) },
      Scene.given(model),
      Scene.expect(Scene.role('button', { name: 'App Server' })).toBeDisabled(),
      Scene.expect(Scene.role('button', { name: 'App Server' })).toContainText(
        money(priceOf(model.board.game, 'server')),
      ),
    )
  })
})

describe('the full Study queue', () => {
  test('says it is full and disables the buy button', () => {
    const t = copyIn('en')
    const base = inLab()
    const game = base.board.game
    const target = researchList.find((entry) => researchReady(game, entry.id))!
    const full = researchList
      .filter((entry) => entry.id !== target.id)
      .slice(0, MAX_STUDIES)
      .map((entry) => queued(entry.id))
    const model: Model = {
      ...base,
      panel: 'research',
      board: {
        ...base.board,
        game: { ...game, studies: queueOf(full) },
        research: { ...base.board.research, focus: target.id },
      },
    }
    expect(studyList(model.board.game.studies)).toHaveLength(MAX_STUDIES)
    Scene.scene(
      {
        update,
        view: (state: Model, h: HtmlBuilder<Message>) =>
          screen(state, h, detail(state, RESEARCH[target.id], h)),
      },
      Scene.given(model),
      Scene.Mount.resolve(ResearchResize, Message.Synced()),
      Scene.expect(Scene.role('button', { name: t.research.queueFull })).toBeDisabled(),
      Scene.expect(Scene.text(t.research.queueFullHelp(MAX_STUDIES))).toExist(),
    )
  })
})

describe('a legal Link preview', () => {
  test('names the duplicate and the dead end, and clears a legal pair', () => {
    const game = newGame()
    expect(linkPreviewOf(game, 'en', 'users', 'server')).toBe('Already linked.')
    expect(linkPreviewOf(game, 'en', 'server', 'payments')).toBe('Payments has no input.')
    const preseed = preseedGame()
    const unlinked = { ...preseed, links: preseed.links.filter((link) => link.to !== 'database') }
    expect(linkPreviewOf(unlinked, 'en', 'server', 'database')).toBeNull()
  })
})

describe('a click that has nothing to do', () => {
  test('a duplicate Link is a no-op instead of a refusal', () => {
    const model = inLab()
    const before = model.board.game
    const result = update(model, Message.LinkRequested({ from: 'users', to: 'server' }))
    expect(result.model.toast).toBeNull()
    expect(result.model.board.game).toBe(before)
  })

  test('an unaffordable footer is a no-op, and its price was already on the card', () => {
    const base = inLab()
    const model = {
      ...base,
      board: { ...base.board, game: { ...base.board.game, cash: 0 } },
    }
    const before = model.board.game
    const result = update(model, Message.FooterPressed({ nodeId: 'server' }))
    expect(result.model.toast).toBeNull()
    expect(result.model.board.game).toBe(before)
  })

  test('a stale Inbox action leaves the Mail and the Game alone', () => {
    const inbox = mailed(
      EMPTY_INBOX,
      {
        key: 'team:hire:stale',
        sender: 'mate:e1',
        subject: 'Can we hire?',
        text: 'One more pair of hands?',
        actions: [{ id: 'approve:999', label: 'Approve hire' }],
        spam: false,
      },
      1,
      true,
    )
    const base = inLab()
    const model: Model = {
      ...base,
      panel: 'inbox',
      board: { ...base.board, inbox },
    }
    const mail = model.board.inbox.mail[0]!
    const result = update(
      model,
      Message.InboxChanged({ message: InboxMessage.Acted({ id: mail.id, action: 'approve:999' }) }),
    )
    expect(result.model.toast).toBeNull()
    expect(result.model.board.inbox.mail[0]?.phase._tag).toBe('Active')
  })
})
