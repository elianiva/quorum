import { css } from '@quorum/styled-system/css'
import type { Mail } from './model.ts'
import { needsAction, senderOf, type SenderKind } from './mail.ts'

export const kindOf = (mail: Mail): SenderKind => senderOf(mail.sender).kind

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

export const TRAP_SITES: Record<string, string> = {
  phish: 'awol-cloud.support/session/verify',
  patcher: 'cve-fyi.top/patch/patcher.sh',
  invoice: 'azzure-invoices.top/pay/AZ-88213',
  domain: 'domain-guard.wtf/renew/quorum.team',
}
