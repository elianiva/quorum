import { describe, expect, test } from 'vitest'
import { Scene } from 'foldkit/test'
import { newGame, node, preseedGame } from '@quorum/simulation/company'
import { MAX_STUDIES, RESEARCH, researchList, type ResearchId } from '@quorum/simulation/catalog'
import { priceOf, researchReady } from '@quorum/simulation/lookups'
import { studyList, type Study, type StudyQueue } from '@quorum/simulation/study-machine'
import { money } from '@quorum/ui/game/format'
import { AppendLog, ClearToast, PlaySound, SyncBoard } from './commands.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { firstStepsBar } from '../components/lab/first-steps.ts'
import { dock } from '../components/lab/dock.ts'
import { detail, ResearchResize } from '../components/lab/research.ts'
import { copyIn, loadLocale } from '../i18n/messages.ts'
import { reasonIn } from '../i18n/refusal.ts'
import { EMPTY_INBOX, InboxMessage, mailed } from './inbox.ts'
import { firstStepOf, upgradePriceOf } from './first-steps.ts'
import { linkPreviewOf } from './link-preview.ts'
import { Message } from './message.ts'
import { AppRoute } from './route.ts'
import { initialModel, update } from './update.ts'
import { placingOf, type Model } from './model.ts'
import { dockItems } from './reveal.ts'

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

  test('names a pair the catalog does not join', async () => {
    const preseed = preseedGame()
    const wired = {
      ...preseed,
      nodes: [
        ...preseed.nodes,
        node('cache', 'cache', 900, 120),
        node('storage', 'storage', 900, 400),
      ],
    }
    expect(linkPreviewOf(wired, 'en', 'cache', 'storage')).toBe(
      'Cache does not call Object Storage.',
    )
    await loadLocale('es')
    expect(linkPreviewOf(wired, 'es', 'cache', 'storage')).toBe(
      'Caché no llama a Almacenamiento de objetos.',
    )
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

describe('a keyboard action that has nothing to do', () => {
  test('an unaffordable hotkey placement does not start placing', () => {
    const base = inLab()
    const group = 'compute' as const
    const picked = dockItems(base.board.game, group)[0]!
    const poor: Model = {
      ...base,
      board: {
        ...base.board,
        game: { ...base.board.game, cash: 0 },
        buildGroup: group,
      },
    }
    const skipped = update(poor, Message.KeyPressed({ key: '1' }))
    expect(placingOf(skipped.model)).toBeNull()
    expect(skipped.model.toast).toBeNull()

    const rich: Model = {
      ...poor,
      board: { ...poor.board, game: { ...poor.board.game, cash: 100_000 } },
    }
    expect(placingOf(update(rich, Message.KeyPressed({ key: '1' })).model)).toBe(picked)
  })

  test('an unaffordable resize hotkey leaves the Node alone', () => {
    const base = inLab()
    const model: Model = {
      ...base,
      board: {
        ...base.board,
        game: { ...base.board.game, cash: 0 },
        selected: 'server',
      },
    }
    const before = model.board.game
    const result = update(model, Message.KeyPressed({ key: 'u' }))
    expect(result.model.board.game).toBe(before)
    expect(result.model.toast).toBeNull()

    const rich: Model = {
      ...model,
      board: { ...model.board, game: { ...model.board.game, cash: 100_000 } },
    }
    const resized = update(rich, Message.KeyPressed({ key: 'u' })).model
    expect(resized.board.game.nodes.find((node) => node.id === 'server')?.size).toBe(2)
  })
})

describe('a Link refusal in another language', () => {
  const reasons: ReadonlyArray<string> = [
    'A domain resolves to one host. Put DNS or a Load Balancer in front to reach more.',
    'One caller reads one Data Group. Box the Databases into one group, or route a second store through an API Gateway and its own App Server.',
    'A Connection Pooler pools to one host. Put a Load Balancer after it to reach more.',
    'An L7 Load Balancer reads HTTP. Switch it to L4 to balance queries.',
    'A Worker takes tasks from a Queue or an Event Stream. Link the App Server into one first.',
    'A Read Replica copies one Database.',
    'Payments has no input.',
    'App Server takes 1 links.',
    'App Server already has a Load Balancer.',
    'Link App Servers or Workers into the Queue.',
    'Link a Database into the Event Stream: it reads its write log.',
    'Users has no traffic to sample.',
    'Mesh sends nothing on. Link it into Analytics to sample it.',
    'Link an App Server into a Kubernetes Cluster first: the sidecar rides in its pod.',
    'Cache does not call Object Storage.',
    'Load Balancer takes page view, api read. App Server sends read query, write query.',
  ]

  for (const locale of ['es', 'fr', 'ja', 'zh-CN'] as const)
    test(`${locale} translates every Link reason`, async () => {
      await loadLocale(locale)
      for (const reason of reasons) expect(reasonIn(copyIn(locale), reason)).not.toBe(reason)
    })

  test('the Request kinds inside the reason are translated, and English is unchanged', async () => {
    const english =
      'Load Balancer takes page view, api read. App Server sends read query, write query.'
    expect(reasonIn(copyIn('en'), english)).toBe(english)
    await loadLocale('es')
    const spanish = reasonIn(copyIn('es'), english)
    expect(spanish).toContain('vista de página')
    expect(spanish).toContain('lectura de API')
    expect(spanish).toContain('consulta de lectura')
    expect(spanish).toContain('consulta de escritura')
  })
})
