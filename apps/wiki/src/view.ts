import type { Document, HtmlBuilder } from 'foldkit/html'
import { article, notFound } from './components/article.ts'
import { header } from './components/header.ts'
import { homeView } from './components/home.ts'
import { sidebar } from './components/sidebar.ts'
import { toc } from './components/toc.ts'
import { builderFor } from './i18n/builder.ts'
import { langOf } from './i18n/lang.ts'
import { LOCALE_TAGS, withLocale } from './i18n/locale.ts'
import type { Message, Model } from './main.ts'
import { pageIn } from './pages.ts'
import { WIKI_ORIGIN } from './site.ts'
import { css, cx as cn } from '@quorum/styled-system/css'

/* The page frame: the header, the navigation rail, the page, and the facts rail. Each rail takes
   one step of the width scale, and the page fills what the frame has left. */

/** The frame the header, the section bar, and the page share. */
export const FRAME = css({
  marginInline: 'auto',
  maxWidth: '80rem',
  paddingInline: '1rem',
  sm: { paddingInline: '1.5rem' },
})

const GRID = css({
  display: 'grid',
  columnGap: '2rem',
  lg: { gridTemplateColumns: '16rem minmax(0,1fr)' },
  xl: { gridTemplateColumns: '16rem minmax(0,1fr) 16rem' },
})

export const view = (model: Model, plain: HtmlBuilder<Message>): Document => {
  // Every link a translated page draws points into its own language (src/i18n/builder.ts).
  const h = builderFor(model.locale, plain)
  const t = langOf(model.locale).t.site
  const page = pageIn(model.locale, model.path)
  const isHome = model.path === '/'
  const wide = page?.wide === true
  const railPage = isHome || wide ? null : page
  const hasRail = railPage !== null && (railPage.aside !== null || railPage.headings.length >= 2)
  return {
    title: page ? (isHome ? t.name : t.title(page.title)) : t.notFoundTitle,
    lang: LOCALE_TAGS[model.locale].lang,
    ...(page ? { canonical: `${WIKI_ORIGIN}${withLocale(model.locale, page.path)}` } : {}),
    body: h.div(
      [
        h.Class(
          css({
            minHeight: '100dvh',
          }),
        ),
      ],
      [
        header(model, h),
        h.div(
          [h.Class(cn(FRAME, GRID))],
          [
            (!isHome && !wide) || model.menu ? sidebar(model, h) : h.empty,
            page
              ? isHome
                ? homeView(page, model, h)
                : article(page, model, h)
              : notFound(model, h),
            // Facts and the contents list share one rail. A page with neither gets no cell.
            hasRail && railPage
              ? h.div(
                  [
                    h.Class(
                      cn(
                        css({
                          flexDirection: 'column',
                          gap: '2.5rem',
                        }),
                        railPage.aside
                          ? css({
                              display: 'flex',
                              lg: {
                                gridColumnStart: '2',
                                gridRowStart: '2',
                              },
                              xl: {
                                gridColumnStart: '3',
                                gridRowStart: '1',
                                paddingTop: '2rem',
                              },
                            })
                          : css({
                              display: 'none',
                              xl: {
                                display: 'flex',
                                gridColumnStart: '3',
                                gridRowStart: '1',
                                paddingTop: '2rem',
                              },
                            }),
                      ),
                    ),
                  ],
                  [
                    railPage.aside
                      ? h.div(
                          [
                            h.Class(
                              css({
                                lg: { maxWidth: '20rem' },
                              }),
                            ),
                          ],
                          [railPage.aside(model, h)],
                        )
                      : h.empty,
                    toc(railPage, h),
                  ],
                )
              : h.empty,
          ],
        ),
      ],
    ),
  }
}
