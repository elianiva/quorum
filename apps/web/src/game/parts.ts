import type { IconNode } from 'lucide'
import { COMPONENTS, type BuildGroup, type ComponentId } from '@quorum/simulation/catalog'
import { isUnlocked, priceOf } from '@quorum/simulation/lookups'
import type { Game } from '@quorum/simulation/state'
import { money } from '@quorum/ui/game/format'
import { COMPONENT_ICONS } from '@quorum/ui/game/component-icons'
import { localized, type Messages } from '../i18n/messages.ts'

export type Part = Readonly<{
  type: ComponentId
  name: string
  blurb: string
  group: BuildGroup
  icon: IconNode
  price: string | null
  short: boolean
  locked: string | null
}>

export const partOf = (t: Messages, game: Game, type: ComponentId): Part => {
  const def = localized(COMPONENTS[type], t.catalog.components[type])
  const price = priceOf(game, type)
  return {
    type,
    name: def.name,
    blurb: def.blurb,
    group: def.group,
    icon: COMPONENT_ICONS[type],
    price: game.sandbox ? null : money(price),
    short: !game.sandbox && game.cash < price,
    locked: isUnlocked(game, type) ? null : t.catalog.research[def.unlock ?? 'stripe'].name,
  }
}
