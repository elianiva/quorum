import { Rows3 } from 'lucide'
import { compact } from '../game/format.ts'
import { type ComponentView } from './shared.ts'

export const log: ComponentView = {
  icon: Rows3,
  layout: { rows: 4, inRow: 0, outRow: 3, footer: true },
  rows: ({ node, inbound, capacity, out }) => {
    return [
      inbound,
      {
        glyph: 'depth',
        name: 'Lag',
        value: node.depth < 1 ? '0' : compact(Math.round(node.depth)),
        tone: node.depth > 0 ? 'warn' : 'plain',
      },
      capacity,
      out,
    ]
  },
}
