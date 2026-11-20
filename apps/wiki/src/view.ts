import type { Document, HtmlBuilder } from 'foldkit/html'
import { article, notFound } from './components/article.ts'
import { header } from './components/header.ts'
import { homeView } from './components/home.ts'
import { sidebar } from './components/sidebar.ts'
import { toc } from './components/toc.ts'
import { builderFor } from './i18n/builder.ts'
import { langOf } from './i18n/lang.ts'
import { LOCALE_TAGS, withLocale } from './i18n/locale.ts'
import { Message, type Model } from './main.ts'
import * as Catalog from './submodels/catalog.ts'
import { pageIn } from './pages.ts'
import { WIKI_ORIGIN } from './site.ts'
import { css, cx } from '@quorum/styled-system/css'

const FRAME = css({
  marginInline: 'auto',
  maxWidth: '80rem',
  paddingInline: '4',
  sm: { paddingInline: '6' },
})

const GRID = css({
  display: 'grid',
  columnGap: '8',
  lg: { gridTemplateColumns: '16rem minmax(0,1fr)' },
  xl: { gridTemplateColumns: '16rem minmax(0,1fr) 16rem' },
})

export const view = (model: Model, plain: HtmlBuilder<Message>): Document => {
  const h = builderFor(model.locale, plain)
  const t = langOf(model.locale).t.site
  const page = pageIn(model.locale, model.path)
  const isHome = model.path === '/'
  const wide = page?.wide === true
  const railPage = isHome || wide ? null : page
  const hasRail = railPage !== null && (railPage.aside !== null || railPage.headings.length >= 2)
  const hydration = 'visible'
  if (model.path === Catalog.CATALOG_PATH && model.locale === 'en')
    return {
      title: 'Catalog · Quorum Wiki',
      lang: LOCALE_TAGS[model.locale].lang,
      body: h.div(
        [h.Class(css({ minHeight: '100dvh' })), h.DataAttribute('hydration', 'now')],
        [
          header(model, h),
          h.submodel({
            slotId: 'catalog',
            model: model.catalog,
            view: Catalog.view,
            toParentMessage: (message) => Message.CatalogChanged({ message }),
            viewInputs: {},
          }),
        ],
      ),
    }
  return {
    title: page ? (isHome ? t.homeTitle : t.title(page.seoTitle ?? page.title)) : t.notFoundTitle,
    lang: LOCALE_TAGS[model.locale].lang,
    ...(page ? { canonical: `${WIKI_ORIGIN}${withLocale(model.locale, page.path)}` } : {}),
    body: h.div(
      [
        h.Class(
          css({
            minHeight: '100dvh',
          }),
        ),
        h.DataAttribute('hydration', hydration),
      ],
      [
        header(model, h),
        h.div(
          [h.Class(cx(FRAME, GRID))],
          [
            (!isHome && !wide) || model.menu ? sidebar(model, h) : h.empty,
            page
              ? isHome
                ? homeView(page, model, h)
                : article(page, model, h)
              : notFound(model, h),
            hasRail && railPage
              ? h.div(
                  [
                    h.Class(
                      cx(
                        css({
                          flexDirection: 'column',
                          gap: '10',
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
                                paddingTop: '8',
                              },
                            })
                          : css({
                              display: 'none',
                              xl: {
                                display: 'flex',
                                gridColumnStart: '3',
                                gridRowStart: '1',
                                paddingTop: '8',
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
                                lg: { maxWidth: '80' },
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
