import * as Effect from 'effect/Effect'
import { Schema } from 'effect'
import { Mount } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { localeOf } from '../i18n/builder.ts'
import { langOf } from '../i18n/lang.ts'
import { COMPONENT_IDS, type ComponentId } from '@quorum/simulation/catalog'
import { heightOf } from '@quorum/ui/board/size'
import { Message } from '../main.ts'
import { solverReadyForBoard } from '../solver.ts'
import { css } from '@quorum/styled-system/css'

const SCALE = 1.1
const PAD = 8
const INSET = 16

const defineCardMounted = () =>
  Mount.define('CardMounted', {
    args: { type: Schema.Literals(COMPONENT_IDS) },
    messages: [Message.Navigated],
    execute: ({ element, type }) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => solverReadyForBoard())
        const { drawNodeCard } = yield* Effect.promise(() => import('./node-board.ts'))
        yield* Effect.acquireRelease(
          Effect.sync(() => drawNodeCard(`card-${type}`, type, element as HTMLElement)),
          (detach) => Effect.sync(detach),
        )
        return Message.Navigated()
      }),
  })

let cardMounted: ReturnType<typeof defineCardMounted> | null = null

export const nodeCard = (type: ComponentId, h: HtmlBuilder<Message>): Html => {
  const l = langOf(localeOf(h))
  return h.div(
    [
      h.Key(`card-${type}`),
      h.Role('img'),
      h.AriaLabel(l.t.islands.nodeCard(l.cat.COMPONENTS[type].name)),
      h.DataAttribute('lazy-island', ''),
      h.Class(
        css({
          pointerEvents: 'none',
          position: 'relative',
          width: '100%',
        }),
      ),
      h.Style({ height: `${Math.round((heightOf(type) + 2 * PAD) * SCALE) + 2 * INSET}px` }),
      h.OnMount((cardMounted ??= defineCardMounted())({ type })),
    ],
    [],
  )
}
