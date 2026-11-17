import type { SeatActivity } from '@quorum/simulation/room'
import { copyIn } from '../i18n/messages.ts'
import type { Locale } from '../i18n/index.ts'
import type { Model, Panel } from './model.ts'

const PANEL_ACTIVITY: Partial<Record<Panel, SeatActivity>> = {
  room: 'room',
  research: 'research',
  team: 'team',
  playbooks: 'playbooks',
  help: 'help',
  dev: 'dev',
  menu: 'menu',
  settings: 'settings',
  inbox: 'inbox',
  dashboard: 'dashboard',
  churn: 'churn',
  mirror: 'mirror',
  cost: 'cost',
  exit: 'exit',
  challenge: 'challenge',
}

export const activityChange = (before: Model, after: Model): SeatActivity | null | undefined => {
  if (after.panel !== before.panel) return PANEL_ACTIVITY[after.panel] ?? null
  if (after.panel !== 'none') return undefined
  if (after.board.selected === before.board.selected) return undefined
  return after.board.selected === null ? null : 'inspector'
}

export const activityIn = (locale: Locale, activity: SeatActivity): string => {
  const t = copyIn(locale).presence
  return t.opening(t[activity])
}
