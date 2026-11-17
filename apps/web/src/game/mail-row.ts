import { css } from '@quorum/styled-system/css'
import type { Mail, MailAction as MailActionSchema } from './model.ts'
import { KIND_LABEL, needsAction, senderOf, type SenderKind } from './mail.ts'

type MailAction = typeof MailActionSchema.Type

export const kindOf = (mail: Mail): SenderKind => senderOf(mail.sender).kind

export const kindLabelOf = (mail: Mail): string => KIND_LABEL[kindOf(mail)]

export type Priority = 'clock' | 'decision' | 'none'

export const priorityOf = (mail: Mail): Priority =>
  mail.phase._tag !== 'Active' || mail.spam || mail.trashed
    ? 'none'
    : senderOf(mail.sender).kind === 'security'
      ? 'clock'
      : needsAction(mail)
        ? 'decision'
        : 'none'

const BAR: Record<Priority, string | null> = {
  clock: css({ backgroundColor: 'danger' }),
  decision: css({ backgroundColor: 'warn' }),
  none: null,
}

export const barOf = (mail: Mail): string | null => BAR[priorityOf(mail)]

export const PRIORITY_LABEL: Record<Priority, string> = {
  clock: 'Urgent: a clock is running',
  decision: 'Needs a decision',
  none: '',
}

export const DESTINATIONS: Record<string, string> = {
  show: 'Selects it on the Board',
  resize: 'Opens the Node Inspector, to resize it',
  quota: 'Opens the Node Inspector, on its limit',
  reserved: 'Opens the Node Inspector, on its pricing',
  first: 'Team: the patch goes to the top of the backlog',
  rush: 'Team: the patch is rushed',
  team: 'Opens Team',
  raise: 'Raises the round',
  decline: 'Declines',
  hire: 'Adds the hire to the Team roster',
  later: 'Answers later',
  approve: 'Team: the item moves again',
  defer: 'Answers later: they will ask again tomorrow',
  patch: 'Team: the patch goes to the top of the backlog',
  queue: 'Team: the patch waits its turn',
  timeoff: 'Team: they take three calendar days off',
  payrise: 'Team: their pay rises to the Era’s rate',
  resign: 'Team: they leave the Company',
  rewrite: 'Opens the Tradeoff card for the migration',
  backlog: 'Queues the Feature at the end of the Team backlog',
  churn: 'Opens the Churn breakdown',
  postmortem: 'Files the postmortem',
  'postmortem-take': 'Files the postmortem and queues the action item',
  ack: 'Marks it read and dismisses the card',
  vendor: 'Takes a fifth off that item’s Insight cost',
  mute: 'Mutes the sender for one calendar hour',
}

export const TRAP_SITES: Record<string, string> = {
  phish: 'awol-cloud.support/session/verify',
  patcher: 'cve-fyi.top/patch/patcher.sh',
  invoice: 'azzure-invoices.top/pay/AZ-88213',
  domain: 'domain-guard.wtf/renew/quorum.team',
}

export const destinationOf = (action: MailAction): string => {
  const [kind = '', target = ''] = action.id.split(':')
  if (kind === 'trap') {
    const site = TRAP_SITES[target]
    return site ? `Leads off-site to ${site}` : 'Leads off-site'
  }
  return DESTINATIONS[kind] ?? `Answers: ${action.label}`
}
