import { Result } from 'effect'
import { expect, test } from 'vitest'
import * as Actions from '@quorum/simulation/actions'
import { preseedGame } from '@quorum/simulation/company'
import { NEW_ENGINEER, activeIncident, type Game, type Postmortem } from '@quorum/simulation/state'
import {
  DIGEST_ID,
  EMPTY_INBOX,
  InboxMessage,
  digestOf,
  folderList,
  inboxOfSave,
  mailed,
  reading,
  resolvedExcept,
  savedInbox,
  updateInbox,
} from './inbox.ts'
import { eventMail, identityOf, postmortemFact, senderOf } from './mail.ts'
import type { Fact } from './mail.ts'
import { TEAMMATES } from './copy/senders.ts'
import { SAVE_FORMAT } from './save-file.ts'
import type { Inbox, Model } from './model.ts'
import { AppRoute } from './route.ts'
import { Message } from './message.ts'
import { initialModel, update } from './update.ts'

const answerOf = (mail?: { phase: { _tag: string; answer?: string } }) =>
  mail?.phase._tag === 'Answered' ? mail.phase.answer : null

const game = preseedGame()

const fact = (key: string, sender: string, subject: string, spam = false): Fact => ({
  key,
  sender,
  subject,
  text: `About ${subject}.`,
  actions: spam ? [{ id: 'trap:phish', label: 'Verify account' }] : [],
  spam,
})

const sent = (facts: ReadonlyArray<Fact>, folder: 'action' | 'fyi' | 'spam' | 'trash'): Inbox => {
  let inbox: Inbox = { ...EMPTY_INBOX, folder }
  facts.forEach((entry, index) => {
    inbox = mailed(inbox, entry, index + 1, true)
  })
  return inbox
}

const act = (inbox: Inbox, id: number, action: string, world: Game = game) =>
  updateInbox(inbox, InboxMessage.Acted({ id, action }), { game: world, open: true })

test('an engineer keeps one name, and the first hires have different ones', () => {
  const ids = Array.from({ length: TEAMMATES.length }, (_, index) => `e${index + 1}`)
  for (const id of ids) expect(senderOf(`mate:${id}`).name).toBe(identityOf(id).name)
  expect(new Set(ids.map((id) => identityOf(id).name)).size).toBe(ids.length)
  expect(senderOf('mate:e3').signIndex).toBe(identityOf('e3').index)
})

test('advice that moved on resolves for every Sender of its kind', () => {
  const inbox = sent(
    [
      fact('cloud:cpu:a', 'cloud-gooble', 'CPU at 100%'),
      fact('cloud:cpu:b', 'cloud', 'CPU at 100%'),
      fact('monitoring:workers:a', 'monitoring-centry', 'All workers busy'),
      fact('team:hire:1', 'mate:e1', 'Can we hire?'),
    ],
    'action',
  )
  const moved = resolvedExcept(inbox, 'cloud:cpu:c', 9)
  expect(moved.mail.map((mail) => [mail.key, mail.phase._tag])).toEqual([
    ['cloud:cpu:a', 'Resolved'],
    ['cloud:cpu:b', 'Resolved'],
    ['monitoring:workers:a', 'Resolved'],
    ['team:hire:1', 'Active'],
  ])
  expect(resolvedExcept(inbox, 'cloud:cpu:a', 9).mail[0]?.phase._tag).toBe('Active')
})

test('advice that moved on keeps a decision the player made and resolves a warning they read', () => {
  const inbox = sent(
    [
      fact('investor:round:0', 'investor-sequel', 'Seed round'),
      fact('cloud:cpu:a', 'cloud-gooble', 'CPU at 100%'),
    ],
    'action',
  )
  const answered = act(act(inbox, 1, 'decline').model, 2, 'ack').model
  const moved = resolvedExcept(answered, 'mentor:grow:1', 9)
  expect(moved.mail.map((mail) => [mail.key, mail.phase._tag])).toEqual([
    ['investor:round:0', 'Answered'],
    ['cloud:cpu:a', 'Resolved'],
  ])
})

test('the save keeps the Mail and the mutes, and a reload reads it back', () => {
  const inbox = sent(
    [fact('cloud:cpu:a', 'cloud', 'Capacity warning'), fact('security:CVE-1', 'security', 'CVE')],
    'action',
  )
  const muted = updateInbox(
    { ...inbox, mutes: [{ sender: 'cloud', until: 120 }] },
    InboxMessage.Trashed({ id: 1 }),
    { game, open: true },
  )
  const file = JSON.parse(JSON.stringify({ time: game.time, inbox: savedInbox(muted.model) }))
  const back = inboxOfSave(file)
  expect(back.mail.map((mail) => mail.subject)).toEqual(['Capacity warning', 'CVE'])
  expect(back.mail[0]?.trashed).toBe(true)
  expect(back.mutes).toEqual([{ sender: 'cloud', until: 120 }])
  expect(back.folder).toBe('action')
  expect(inboxOfSave({ time: 4 })).toEqual(EMPTY_INBOX)
  expect(inboxOfSave({ inbox: { mail: 'not mail' } })).toEqual(EMPTY_INBOX)
})

test('a label chip filters the list to one kind of Sender', () => {
  const inbox = sent(
    [
      fact('cloud:cpu:a', 'cloud', 'Capacity warning'),
      fact('security:CVE-1', 'security', 'CVE-2024-1'),
      fact('cloud:cpu:b', 'cloud', 'Out of CPU credits'),
    ],
    'fyi',
  )
  const security = updateInbox(inbox, InboxMessage.LabelChosen({ label: 'security' }), {
    game,
    open: true,
  })
  expect(folderList(security.model).map((mail) => mail.subject)).toEqual(['CVE-2024-1'])
  expect(security.model.focus).toBe(null)
  const all = updateInbox(security.model, InboxMessage.LabelChosen({ label: null }), {
    game,
    open: true,
  })
  expect(folderList(all.model)).toHaveLength(3)
  const other = updateInbox(security.model, InboxMessage.FolderChosen({ folder: 'fyi' }), {
    game,
    open: false,
  })
  expect(other.model.label).toBe(null)
})

test('past eight unread threads the oldest low-priority ones fold into one Digest', () => {
  const nine = sent(
    Array.from({ length: 9 }, (_, index) =>
      fact(`customers:ticket:${index}`, 'customers', `Ticket ${index + 1}`),
    ),
    'fyi',
  )
  const nineInbox = { ...nine, mail: nine.mail.map((mail) => ({ ...mail, read: true })) }
  expect(digestOf(nineInbox)).toEqual([])

  const unread = { ...nineInbox, mail: nineInbox.mail.map((mail) => ({ ...mail, read: false })) }
  const folded = digestOf(unread)
  expect(folded.map((mail) => mail.subject)).toEqual(['Ticket 1'])
  const list = folderList(unread)
  expect(list.map((mail) => mail.subject)).toEqual([
    'Ticket 9',
    'Ticket 8',
    'Ticket 7',
    'Ticket 6',
    'Ticket 5',
    'Ticket 4',
    'Ticket 3',
    'Ticket 2',
    'Digest: 1 older updates',
  ])
  expect(list.at(-1)?.id).toBe(DIGEST_ID)
  const decisions = sent(
    Array.from({ length: 10 }, (_, index) =>
      fact(`investor:round:${index}`, 'investor', `Offer ${index + 1}`),
    ),
    'action',
  )
  const withActions = {
    ...decisions,
    mail: decisions.mail.map((mail) => ({
      ...mail,
      read: false,
      actions: [{ id: 'raise', label: 'Raise' }],
    })),
  }
  expect(digestOf(withActions)).toEqual([])
})

const withEngineers: Game = {
  ...game,
  engineers: [{ ...NEW_ENGINEER, id: 'e1', team: 'core', language: 'go', hiredAt: 0 }],
}

test('a resolved incident asks a teammate to file the postmortem', () => {
  const postmortem: Postmortem = {
    id: 3,
    kind: 'zone',
    target: 'App Server',
    duration: 60,
    mttr: 40,
    mttd: 4,
    mtta: 9,
    lostUsers: 120,
    lostRevenue: 1_200,
    failed: 400,
    action: 'caching',
    severity: 2,
    endedAt: 600,
    causedBy: null,
  }
  const mail = postmortemFact(postmortem, withEngineers)
  expect(mail.sender.startsWith('mate:')).toBe(true)
  expect(mail.sender).toBe(`mate:${withEngineers.engineers[0]?.id}`)
  const lone = postmortemFact(postmortem, game)
  expect(senderOf(lone.sender).kind).toBe('mentor')
  expect(
    resolvedExcept(sent([lone], 'action'), 'mentor:grow:1', 9).mail.map(
      (entry) => entry.phase._tag,
    ),
  ).toEqual(['Active'])
  expect(mail.actions.map((action) => action.label)).toEqual([
    'File postmortem',
    'File and research the action item',
  ])
  expect(mail.text).toContain('App Server')

  const inbox = reading(mailed(EMPTY_INBOX, mail, game.time, true))
  const id = inbox.mail[0]?.id ?? 0
  const taken = act(inbox, id, `postmortem-take:${postmortem.id}`, {
    ...game,
    postmortems: [postmortem],
  })
  expect(taken.outMessage).toEqual({ _tag: 'ActionTaken', kind: 'postmortem-take', target: '3' })
  expect(answerOf(taken.model.mail[0])).toBe(
    'You filed the postmortem and put the action item in the study queue.',
  )
  expect(postmortemFact({ ...postmortem, action: null }, game).actions).toHaveLength(1)
})

test('a phishing trap leaks the credentials, and the Inbox keeps the record', () => {
  const inbox = sent([fact('spam:spam-awol', 'spam-awol', 'Verify your account', true)], 'spam')
  const phishing = inbox.mail[0]
  expect(phishing?.actions).toEqual([{ id: 'trap:phish', label: 'Verify account' }])
  const clicked = act({ ...inbox, folder: 'spam' }, phishing?.id ?? 0, 'trap:phish')
  expect(clicked.outMessage).toEqual({ _tag: 'ActionTaken', kind: 'trap', target: 'phish' })
  expect(answerOf(clicked.model.mail[0])).toContain('It was a trap')

  const phished = Actions.phished(game)
  expect(Result.isSuccess(phished)).toBe(true)
  if (Result.isFailure(phished)) return
  expect(activeIncident(phished.success)?.kind).toBe('credential-leak')
  expect(phished.success.users).toBeLessThan(game.users)

  const model: Model = {
    ...initialModel(),
    route: AppRoute.Company(),
    panel: 'inbox',
    board: { ...initialModel().board, game, inbox: reading(inbox, phishing?.id ?? 0) },
  }
  const clickedInTheApp = update(
    model,
    Message.InboxChanged({
      message: InboxMessage.Acted({ id: phishing?.id ?? 0, action: 'trap:phish' }),
    }),
  ).model
  expect(activeIncident(clickedInTheApp.board.game)?.kind).toBe('credential-leak')
  expect(
    clickedInTheApp.board.inbox.mail.filter((mail) => mail.key.includes('incident-phishing')),
  ).toHaveLength(1)

  const reported = updateInbox(inbox, InboxMessage.MarkedSpam({ id: phishing?.id ?? 0 }), {
    game,
    open: true,
  })
  expect(reported.model.mail[0]?.spam).toBe(false)
  const again = updateInbox(reported.model, InboxMessage.MarkedSpam({ id: phishing?.id ?? 0 }), {
    game,
    open: true,
  })
  expect(again.model.mail[0]?.spam).toBe(true)
  expect(again.model.mail[0]?.actions).toEqual([])
})

test('a reload opens the Company with the Mail it had', () => {
  const before = sent([fact('cloud:cpu:a', 'cloud', 'Capacity warning')], 'action')
  const json = JSON.stringify({ format: SAVE_FORMAT, ...game, inbox: savedInbox(before) })
  const loading = { ...initialModel(), companyPhase: { _tag: 'Opening' as const, id: 'c' } }
  const loaded = update(loading, Message.CompanyLoaded({ id: 'c', open: true, json })).model
  expect(loaded.board.inbox.mail.map((mail) => mail.subject)).toEqual(['Capacity warning'])
})

test('paying a fake invoice costs the Cash printed on it', () => {
  const invoice: Fact = {
    key: 'spam:spam-azzure',
    sender: 'spam-azzure',
    subject: 'INVOICE #AZ-88213 PAST DUE',
    text: 'Region: moon-central-0\n\nAmount due: $4,812.44',
    actions: [{ id: 'trap:invoice', label: 'Pay invoice' }],
    spam: true,
  }
  const rich = { ...game, cash: 20_000 }
  const inbox = sent([invoice], 'spam')
  const id = inbox.mail[0]?.id ?? 0
  const model: Model = {
    ...initialModel(),
    route: AppRoute.Company(),
    panel: 'inbox',
    board: { ...initialModel().board, game: rich, inbox: reading(inbox, id) },
  }
  const paid = update(
    model,
    Message.InboxChanged({ message: InboxMessage.Acted({ id, action: 'trap:invoice' }) }),
  ).model
  expect(paid.board.game.cash).toBe(rich.cash - 4_812)
  expect(answerOf(paid.board.inbox.mail[0])).toContain('It was a trap')
})

test('a rewrite proposal needs a reason and never names the language the App Servers run', () => {
  const base = preseedGame()
  const onGo = (debt: number): Game => ({
    ...base,
    apdex: 1,
    backlog: [],
    engineers: ['e1', 'e2', 'e3'].map((id) => ({
      ...NEW_ENGINEER,
      id,
      team: 'product',
      language: 'go' as const,
      hiredAt: 0,
    })),
    nodes: base.nodes.map((node) => (node.type === 'server' ? { ...node, runtime: 'go' } : node)),
    services: base.services.map((service) => ({ ...service, debt, migration: { _tag: 'Idle' } })),
  })
  const proposals = (game: Game) =>
    Array.from({ length: 2_000 }, (_, bucket) => eventMail(game, bucket)).filter((fact) =>
      fact?.key.startsWith('team:rewrite:'),
    )

  const indebted = proposals(onGo(0.5))
  expect(indebted.length).toBeGreaterThan(0)
  expect(indebted.flatMap((fact) => fact?.actions.map((action) => action.id))).not.toContain(
    'rewrite:Go',
  )
  expect(proposals(onGo(0))).toEqual([])

  const send = (inbox: Inbox, from: number, to: number): Inbox => {
    let next = inbox
    for (let bucket = from; bucket < to; bucket += 1) {
      const fact = eventMail(onGo(0.5), bucket, next.mail)
      if (fact?.key.startsWith('team:rewrite:')) next = mailed(next, fact, bucket, false)
    }
    return next
  }
  const waiting = send(EMPTY_INBOX, 0, 2_000)
  expect(waiting.mail.length).toBeGreaterThan(0)
  expect(waiting.mail.map((mail) => mail.entries.length)).toEqual(waiting.mail.map(() => 1))
  const answered: Inbox = {
    ...waiting,
    mail: waiting.mail.map((mail) => ({
      ...mail,
      phase: { _tag: 'Answered', answer: 'Declined.', answerId: '' },
    })),
  }
  const asked = send(answered, 2_000, 4_000)
  expect(asked.mail.some((mail) => mail.entries.length === 2)).toBe(true)
})
