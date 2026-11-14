import type { Html, HtmlBuilder } from 'foldkit/html'

import { ArrowRight } from 'lucide'
import type { SandboxId } from '@quorum/simulation/sandbox'

import { icon } from '@quorum/ui/primitives/icon'
import { localeOf } from '../i18n/builder.ts'
import { langOf } from '../i18n/lang.ts'
import type { Message, Model } from '../main.ts'
import { css, cx } from '@quorum/styled-system/css'

/* A guided Sandbox placed in a page. */

export const sandboxView = (
  _model: Model,
  id: SandboxId,
  _index: number,
  h: HtmlBuilder<Message>,
): Html => {
  const l = langOf(localeOf(h))
  const def = l.cat.GUIDED[id]
  return h.a(
    [
      h.Href(`/sandboxes/${id}`),
      h.Class(
        cx(
          css({
            marginBlock: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            borderRadius: 'lg',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            paddingInline: '1rem',
            paddingBlock: '0.75rem',
            _hover: {
              backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
            },
          }),
          'not-prose',
          'group',
        ),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              minWidth: '0',
              flex: '1 1 0%',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontSize: '12px',
                  color: 'var(--muted-foreground)',
                }),
              ),
            ],
            [l.t.islands.sandbox],
          ),
          h.span(
            [
              h.Class(
                css({
                  marginTop: '0.25rem',
                  display: 'block',
                  fontSize: '16px',
                  fontWeight: '600',
                  letterSpacing: '-0.025em',
                }),
              ),
            ],
            [def.name],
          ),
          h.span(
            [
              h.Class(
                css({
                  display: 'block',
                  fontSize: '13px',
                  color: 'var(--muted-foreground)',
                }),
              ),
            ],
            [def.objectives[0]?.goal ?? ''],
          ),
        ],
      ),
      icon(
        h,
        ArrowRight,
        css({
          width: '1rem',
          height: '1rem',
          color: 'var(--muted-foreground)',
        }),
      ),
    ],
  )
}
