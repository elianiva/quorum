import { css } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { Lock } from 'lucide'
import { FIGURE, groupBadge } from '@quorum/ui/game/bits'
import { icon } from '@quorum/ui/primitives/icon'
import type { Message } from '@/game/message.ts'
import type { Part } from '@/game/parts.ts'
import { cn } from '@/lib/utils'

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
            gap: '0.25rem',
            fontSize: 'calc(11px*var(--type-scale))',
            color: 'var(--muted-foreground)',
          }),
        ),
      ],
      [
        icon(
          h,
          Lock,
          css({
            width: '0.875rem',
            height: '0.875rem',
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
        cn(
          FIGURE,
          css({
            flexShrink: '0',
            fontSize: 'calc(12.5px*var(--type-scale))',
          }),
          part.short
            ? css({
                color: 'var(--danger)',
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
    css({ width: '2rem', height: '2rem', flexShrink: '0' }),
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
          gap: '0.125rem',
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
              fontSize: 'calc(13px*var(--type-scale))',
              lineHeight: '1',
              fontWeight: '500',
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
              fontSize: 'calc(11.5px*var(--type-scale))',
              lineHeight: '1.25',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [part.blurb],
      ),
    ],
  ),
  detail(part, h),
]
