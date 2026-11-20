import { Scaling } from 'lucide'
import { autoscalerViewOf } from '@quorum/simulation/scaling'
import { pct, type ComponentView } from './shared.ts'

const signalName = (signal: 'cpu' | 'load' | 'rps' | 'queue'): string =>
  signal === 'cpu' ? 'CPU' : signal === 'load' ? 'Load' : signal === 'rps' ? 'Requests' : 'Queue'

const nextOf = (view: ReturnType<typeof autoscalerViewOf>): string => {
  if (view.members.length === 0) return 'Link a Node'
  if (view.phase === 'paused') return 'paused'
  if (view.phase === 'booting') return `ready ${Math.ceil(view.readyIn)} s`
  const delta = view.wanted - view.copies
  if (view.phase === 'up')
    return `+${delta} ${view.cooldown > 0 ? `in ${Math.ceil(view.cooldown)} s` : 'now'}`
  if (view.phase === 'down')
    return `−1 ${view.cooldown > 0 ? `in ${Math.ceil(view.cooldown)} s` : 'now'}`
  if (view.members.some((member) => member.atLimit === 'max')) return 'at max'
  return view.members.every((member) => member.atLimit === 'min') ? 'at min' : 'holding'
}

export const autoscaler: ComponentView = {
  icon: Scaling,
  layout: { rows: 5, inRow: 0, outRow: null, footer: false },
  rows: ({ game, node, ledger }) => {
    const view = autoscalerViewOf(game, ledger, node)
    const reading =
      view.members.length === 0 ? 0 : Math.max(...view.members.map((member) => member.reading))
    const target = view.members[0]?.target ?? node.target
    const signal = view.members[0]?.signal ?? node.signal
    return [
      {
        glyph: 'copies',
        name: 'Copies',
        value:
          view.members.length === 0
            ? '—'
            : view.booting > 0
              ? `${view.copies} → ${view.copies + view.booting}`
              : `${view.copies}`,
        tone:
          view.members.length === 0 || view.phase === 'paused'
            ? 'muted'
            : view.booting > 0
              ? 'warn'
              : 'plain',
      },
      {
        glyph: 'load',
        name: 'Now',
        value: view.members.length === 0 ? '—' : `${signalName(signal)} ${pct(reading)}`,
        tone: reading >= 1.2 ? 'danger' : reading >= target ? 'warn' : 'plain',
        bar: Math.min(reading, 1),
      },
      { glyph: 'policy', name: 'Target', value: view.members.length === 0 ? '—' : pct(target) },
      {
        glyph: 'policy',
        name: 'Range',
        value:
          view.members.length === 0
            ? '—'
            : `${node.minCopies}–${node.maxCopies > 0 ? node.maxCopies : '∞'} each`,
        tone: node.maxCopies === 0 ? 'warn' : 'plain',
      },
      {
        glyph: 'policy',
        name: 'Next',
        value: nextOf(view),
        tone: view.phase === 'booting' || view.phase === 'up' ? 'warn' : 'plain',
      },
    ]
  },
}
