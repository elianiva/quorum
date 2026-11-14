import type { Html, HtmlBuilder } from 'foldkit/html'
import { localeOf } from '../i18n/builder.ts'
import { langOf } from '../i18n/lang.ts'
import type { Message } from '../main.ts'
import type { Page } from '../page.ts'
import { css, cx } from '@quorum/styled-system/css'

/* The right rail: the page's headings. */

export const toc = (page: Page, h: HtmlBuilder<Message>): Html => {
  const t = langOf(localeOf(h)).t.toc
  return page.headings.length < 2
    ? h.empty
    : h.nav(
        [
          h.AriaLabel(t.onThisPage),
          h.Class(
            css({
              position: 'sticky',
              top: 'var(--header-height)',
              display: 'none',
              alignSelf: 'flex-start',
              xl: {
                display: 'block',
              },
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  marginBottom: '2',
                  fontSize: 'type.12',
                  fontWeight: 'semibold',
                }),
              ),
            ],
            [t.onThisPage],
          ),
          h.ul(
            [
              h.Class(
                css({
                  borderLeftWidth: '1px',
                  borderLeftStyle: 'solid',
                  borderColor: 'border',
                }),
              ),
            ],
            page.headings.map((heading) =>
              h.li(
                [h.Key(heading.id)],
                [
                  h.a(
                    [
                      h.Href(`#${heading.id}`),
                      h.Class(
                        cx(
                          css({
                            marginLeft: '-1px',
                            display: 'block',
                            borderLeftWidth: '1px',
                            borderLeftStyle: 'solid',
                            borderColor: 'transparent',
                            paddingBlock: '1',
                            fontSize: 'type.13',
                            color: 'mutedForeground',
                            _hover: {
                              borderColor:
                                'color-mix(in oklab, var(--foreground) 40%, transparent)',
                              color: 'foreground',
                            },
                          }),
                          heading.level === 3
                            ? css({
                                paddingLeft: '6',
                              })
                            : css({
                                paddingLeft: '3',
                              }),
                        ),
                      ),
                    ],
                    [heading.text],
                  ),
                ],
              ),
            ),
          ),
        ],
      )
}
