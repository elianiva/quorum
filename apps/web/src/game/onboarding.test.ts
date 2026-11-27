import { describe, expect, test } from 'vitest'
import { newGame, node, preseedGame } from '@quorum/simulation/company'
import { copyIn, loadLocale } from '../i18n/messages.ts'
import { reasonIn } from '../i18n/refusal.ts'
import { EMPTY_INBOX, InboxMessage, mailed } from './inbox.ts'
import { firstStepOf } from './first-steps.ts'
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
