import { ListOrdered } from 'lucide'
import { compact, queueWait } from '../game/format.ts'
import { type ComponentView } from './shared.ts'

const LATE_WAIT_SECONDS = 40
const SLOW_WAIT_SECONDS = 10
const DEEP_BACKLOG = 100

export const queue: ComponentView = {
  icon: ListOrdered,
  layout: { rows: 4, inRow: 0, outRow: 3, footer: true },
  rows: ({ node, own, inbound, capacity, out }) => {
    return [
      inbound,
      {
        glyph: 'depth',
        name: 'Depth',
        value: node.depth < 1 ? '0' : `${compact(Math.round(node.depth))} · ${queueWait(own.age)}`,
        tone:
          (own.age ?? 0) >= LATE_WAIT_SECONDS
            ? 'danger'
            : (own.age ?? 0) >= SLOW_WAIT_SECONDS || node.depth >= DEEP_BACKLOG
              ? 'warn'
              : 'plain',
      },
      capacity,
      out,
    ]
  },
}
