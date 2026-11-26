import { css } from '@quorum/styled-system/css'
import { copy, type Messages } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
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

export const nodeList = (model: Model, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const nodes = regionView(game, model.board.region).nodes
  return h.section(
    [
      h.Key('node-list'),
      h.DataAttribute('node-list', ''),
      h.Class(NODE_LIST),
      h.AriaLabel(t.nodeList.nodes),
    ],
    [
      h.h2([h.Class(TITLE)], [t.nodeList.nodes]),
      h.ul(
        [],
        nodes.map((node) =>
          h.li(
            [h.Key(node.id)],
            [
              h.button(
                [h.Type('button'), h.OnClick(Message.NodeTapped({ nodeId: node.id }))],
                [
                  h.span([], [t.catalog.components[node.type].name]),
                  h.span([], [' · ']),
                  h.span(
                    [],
                    [
                      COMPONENTS[node.type].sized
                        ? t.nodeList.sizes[SIZES[node.size]?.name ?? 'custom']
                        : t.nodeList.sizeStep(node.size),
                    ],
                  ),
                  h.span([], [' · ']),
                  h.span([], [loadOf(t, ledger, node.id)]),
                  h.span([], [' · ']),
                  h.span([], [t.nodeList.s(rate(ledger.nodes[node.id]?.inbound ?? 0))]),
                ],
              ),
            ],
          ),
        ),
      ),
    ],
  )
}
