import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { Lock } from 'lucide'
import { FIGURE, groupBadge } from '@quorum/ui/game/bits'
import { icon } from '@quorum/ui/primitives/icon'
import type { Message } from '@/game/message.ts'
import type { Part } from '@/game/parts.ts'

/* ==========================================================================
   A part as a list row shows it. The dock and the command palette draw the
   same cells, so the menu a player knows and the palette they search cannot
   drift apart.
   ========================================================================== */

/** A part's price, or the Research that still locks it. */
const detail = (part: Part, h: HtmlBuilder<Message>): Html => {
  if (part.locked !== null)
    return h.span(
      [
        h.Title(part.locked),
        h.Class(
          css({
            display: 'flex',
            flexShrink: '0',
            alignItems: 'center',
            gap: '1',
            fontSize: 'type.11',
            color: 'mutedForeground',
          }),
        ),
      ],
      [
        icon(
          h,
          Lock,
          css({
            width: '3.5',
            height: '3.5',
          }),
        ),
        h.span(
          [
            h.Class(
              css({
                _compact: {
                  display: 'none',
                },
              }),
            ),
          ],
          [part.locked],
        ),
      ],
    )
  if (part.price === null) return h.empty
  return h.span(
    [
      h.Class(
        cx(
          FIGURE,
          css({
            flexShrink: '0',
            fontSize: 'type.12-5',
          }),
          part.short
            ? css({
                color: 'danger',
              })
            : '',
        ),
      ),
    ],
    [part.price],
  )
}

/** The shaped badge, the name over its blurb, and the price or the lock. */
export const partCells = (part: Part, h: HtmlBuilder<Message>): ReadonlyArray<Html> => [
  groupBadge(
    part.group,
    part.icon,
    css({ width: '8', height: '8', flexShrink: '0' }),
    h,
    part.locked !== null,
  ),
  h.span(
    [
      h.Class(
        css({
          display: 'flex',
          minWidth: '0',
          flex: '1 1 0%',
          flexDirection: 'column',
          gap: '0.5',
        }),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'type.13',
              lineHeight: 'none',
              fontWeight: 'medium',
            }),
          ),
        ],
        [part.name],
      ),
      h.span(
        [
          h.Class(
            css({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'type.11-5',
              lineHeight: 'tight',
              color: 'mutedForeground',
            }),
          ),
        ],
        [part.blurb],
      ),
    ],
  ),
  detail(part, h),
]
