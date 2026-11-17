import { SANDBOX_IDS } from '@quorum/simulation/sandbox-summary'
import { MENU_PAGES } from './game/menu-pages.ts'

const SANDBOXES: ReadonlySet<string> = new Set([...SANDBOX_IDS, 'free'])
const MENUS: ReadonlySet<string> = new Set(MENU_PAGES)

export const isAppPath = (pathname: string): boolean => {
  const [, first = '', second, ...rest] = pathname.replace(/\/$/, '').split('/')
  if (rest.length > 0) return false
  if (second === undefined) return first === 'company' || MENUS.has(first)
  if (second === '') return false
  switch (first) {
    case 'sandbox':
      return SANDBOXES.has(second)
    case 'challenges':
    case 'room':
      return true
    default:
      return false
  }
}
