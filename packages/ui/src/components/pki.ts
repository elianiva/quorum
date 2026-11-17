import { Certificate } from 'lucide'
import { money } from '../game/format.ts'
import { burnOf, certDaysLeft, certDaysOf } from '@quorum/simulation/lookups'
import { type ComponentView } from './shared.ts'

export const pki: ComponentView = {
  icon: Certificate,
  layout: { rows: 3, inRow: null, outRow: null, footer: false },
  rows: ({ game, node }) => {
    const left = certDaysLeft(game)
    return [
      {
        glyph: 'policy',
        name: 'Life',
        value: `${Math.round(certDaysOf(game))} d`,
      },
      {
        glyph: 'cost',
        name: 'Expires',
        value:
          left === null
            ? 'not issued'
            : left <= 0
              ? 'expired'
              : `in ${Math.max(0, Math.round(left))} d`,
        tone: left === null ? 'warn' : left <= 1 ? 'danger' : left < 14 ? 'warn' : 'ok',
      },
      { glyph: 'cost', name: 'Cost', value: `${money(burnOf(game, node))}/s` },
    ]
  },
}
