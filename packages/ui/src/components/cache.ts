import { Zap } from 'lucide'
import { pct, type ComponentView } from './shared.ts'

export const cache: ComponentView = {
  icon: Zap,
  layout: { rows: 4, inRow: 0, outRow: 3, footer: true },
  rows: ({ own, inbound, capacity, out }) => {
    const memory = own.resources.ramGb
    const hit = own.hitRatio ?? 0
    return [
      inbound,
      capacity,
      {
        glyph: 'hits',
        name: 'Hit / RAM',
        value: memory
          ? `${pct(hit)} · ${memory.used.toFixed(1)}/${memory.total.toFixed(0)} GB`
          : pct(hit),
        bar: hit,
        tone: memory && memory.used > memory.total ? 'warn' : 'plain',
      },
      out,
    ]
  },
}
