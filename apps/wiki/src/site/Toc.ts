import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css } from '@quorum/styled-system/css'
import { langOf } from '../i18n/lang.ts'
import type { Page } from './page.ts'

export const Toc = <Msg>(h: H<Msg>, page: Page<Msg>): View.Content<Msg> => {
  if (page.headings.length < 2) return h.span.children()
  const t = langOf(page.locale).t.toc
  return h.nav
    .attr('aria-label', t.onThisPage)
    .class(
      css({
        position: 'sticky',
        top: 'var(--header-height)',
        display: 'none',
        alignSelf: 'flex-start',
        xl: { display: 'block' },
      }),
    )
    .children(
      h.div
        .class(css({ marginBottom: '2', fontSize: 'type.12', fontWeight: 'semibold' }))
        .children(t.onThisPage),
      h.ul
        .class(css({ borderLeftWidth: '1px', borderLeftStyle: 'solid', borderColor: 'border' }))
        .children(
          ...page.headings.map((heading) =>
            h.li.key(heading.id).children(
              h.a
                .attr('href', `#${heading.id}`)
                .class(
                  css({
                    marginLeft: '-1px',
                    display: 'block',
                    borderLeftWidth: '1px',
                    borderLeftStyle: 'solid',
                    borderColor: 'transparent',
                    paddingBlock: '1',
                    paddingLeft: heading.level === 3 ? '6' : '3',
                    fontSize: 'type.13',
                    color: 'mutedForeground',
                    _hover: {
                      borderColor: 'color-mix(in oklab, var(--foreground) 40%, transparent)',
                      color: 'foreground',
                    },
                  }),
                )
                .children(heading.text),
            ),
          ),
        ),
    )
}
