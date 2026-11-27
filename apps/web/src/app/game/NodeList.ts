import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css } from '@quorum/styled-system/css'
import { copy, type Messages } from '@/i18n/messages.ts'
import type { Ledger } from '@quorum/simulation/ledger'
import { COMPONENTS, SIZES } from '@quorum/simulation/catalog'
import { regionView } from '@quorum/simulation/regions'
import { rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'

const loadOf = (t: Messages, ledger: Ledger, id: string): string => {
  const own = ledger.nodes[id]
  if (!own) return t.nodeList.noLoad
  if (own.status === 'down') return t.nodeList.down
  return `${Math.round(own.utilization * 100)}%`
}

/* The screen reader's Node list (15 "Accessibility"): hidden until a keyboard player tabs into
   it, then it names every Node on the board in board order and opens one on Enter. */
const NODE_LIST = css({
  position: 'absolute',
  zIndex: '40',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
  '&:focus-within': {
    top: '12px',
    left: '50%',
    translate: '-50% 0',
    width: 'min(420px, calc(100vw - 24px))',
    maxHeight: '60vh',
    height: 'auto',
    margin: '0',
    padding: '8px 10px 10px',
    overflow: 'auto',
    borderRadius: '12px',
    background: 'var(--card)',
    boxShadow: 'inset 0 0 0 1px var(--hairline), 0 18px 32px -12px oklch(0 0 0 / 0.45)',
    whiteSpace: 'normal',
    clip: 'auto',
    clipPath: 'none',
  },
  '& ul': {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    margin: '0',
    padding: '0',
    listStyle: 'none',
  },
  '& button': {
    display: 'block',
    width: '100%',
    padding: '3px 6px',
    borderRadius: '7px',
    color: 'var(--foreground)',
    fontSize: 'var(--type-12)',
    textAlign: 'left',
  },
  '& button:hover': { background: 'var(--well)' },
  '& button:focus-visible': { outline: '2px solid var(--ring)', outlineOffset: '-2px' },
})

const TITLE = css({
  margin: '0 0 4px',
  fontFamily: 'var(--heading)',
  fontSize: 'var(--type-13)',
  fontWeight: 'var(--quorum-font-weights-semibold)',
  whiteSpace: 'nowrap',
})

export const nodeList = (h: H<Message>, model: Model, ledger: Ledger): View.Content<Message> => {
  const t = copy(h)

  const game = model.board.game
  const nodes = regionView(game, model.board.region).nodes
  return h.section
    .key('node-list')
    .attr('data-node-list', '')
    .class(NODE_LIST)
    .attr('aria-label', t.nodeList.nodes)
    .children(
      h.h2.class(TITLE).children(t.nodeList.nodes),
      h.ul.children(
        nodes.map((node) =>
          h.li.key(node.id).children(
            h.button
              .attr('type', 'button')
              .on('click', () => Message.NodeTapped({ nodeId: node.id }))
              .children(
                h.span.children(t.catalog.components[node.type].name),
                h.span.children(' · '),
                h.span.children(
                  COMPONENTS[node.type].sized
                    ? t.nodeList.sizes[SIZES[node.size]?.name ?? 'custom']
                    : t.nodeList.sizeStep(node.size),
                ),
                h.span.children(' · '),
                h.span.children(loadOf(t, ledger, node.id)),
                h.span.children(' · '),
                h.span.children(t.nodeList.s(rate(ledger.nodes[node.id]?.inbound ?? 0))),
              ),
          ),
        ),
      ),
    )
}
