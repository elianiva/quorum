import { Command, Component, Head, Router, UiSchema } from '@effect/ui'
import { Html, HtmlHead } from '@effect/ui/html'
import { Effect, Schema } from 'effect'
import { css, cx } from '@quorum/styled-system/css'
import { langOf } from '../i18n/lang.ts'
import {
  LOCALES,
  LOCALE_TAGS,
  localeOfPath,
  stripLocale,
  withLocale,
  type Locale,
} from '../i18n/locale.ts'
import { WIKI_ORIGIN } from '../site.ts'
import { Article, NotFound } from './Article.ts'
import { GetProse } from './GetProse.ts'
import { Header } from './Header.ts'
import { HomePage } from './HomePage.ts'
import { isFallback, needsProse } from './content.ts'
import { pageAt } from './pages.ts'
import { ogFile } from '../og-card.ts'
import { pathOf, SiteRoute } from './routes.ts'
import { Sidebar, ALL_ERAS } from './Sidebar.ts'
import { Toc } from './Toc.ts'

const ERA_KEY = 'quorum.wiki.era'

export const SiteMessage = UiSchema.TaggedEnum({
  ChangedRoute: { route: SiteRoute },
  ToggledMenu: {},
  ToggledNavGroup: { path: Schema.String },
  ToggledEraMenu: {},
  ClosedEraMenu: {},
  ChosenEra: { era: Schema.Finite },
  LoadedEra: { era: Schema.Finite },
  SavedEra: {},
  LoadedProgress: { visited: Schema.Array(Schema.String) },
})
export type SiteMessage = typeof SiteMessage.Type

const PROGRESS_KEY = 'quorum.wiki.visited'

const readProgress = (): ReadonlyArray<string> => {
  try {
    const stored: unknown = JSON.parse(globalThis.localStorage?.getItem(PROGRESS_KEY) ?? '[]')
    return Array.isArray(stored) ? stored.filter((entry) => typeof entry === 'string') : []
  } catch {
    return []
  }
}

const LoadProgressCommand = Command.make(
  'LoadProgress',
  { args: { path: Schema.String } },
  ({ path }) =>
    Effect.sync(() => {
      const visited = [...new Set([...readProgress(), path])]
      globalThis.localStorage?.setItem(PROGRESS_KEY, JSON.stringify(visited))
      return SiteMessage.LoadedProgress({ visited })
    }),
)

const LoadEra = Command.make('LoadEra', {}, () =>
  Effect.sync(() => {
    const stored = Number(globalThis.localStorage?.getItem(ERA_KEY) ?? ALL_ERAS)
    return SiteMessage.LoadedEra({ era: Number.isInteger(stored) ? stored : ALL_ERAS })
  }),
)

const SaveEra = Command.make('SaveEra', { args: { era: Schema.Finite } }, ({ era }) =>
  Effect.sync(() => {
    globalThis.localStorage?.setItem(ERA_KEY, String(era))
    return SiteMessage.SavedEra()
  }),
)

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
})

const RAIL = css({
  minWidth: '0',
  flexDirection: 'column',
  gap: '10',
  xl: { gridColumnStart: '2', gridRow: '1 / span 2' },
})

const author = { '@type': 'Person', name: 'elianiva', url: 'https://elianiva.com' }

const homeStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${WIKI_ORIGIN}/#website`,
      name: 'Quorum Wiki',
      url: `${WIKI_ORIGIN}/`,
      inLanguage: 'en',
      publisher: author,
      about: { '@type': 'VideoGame', name: 'Quorum', url: 'https://playquorum.dev/' },
    },
  ],
}

const homeHead = () => {
  const t = langOf('en').t.site
  return [
    Head.title(t.homeTitle),
    HtmlHead.lang('en'),
    HtmlHead.meta({ name: 'description', content: t.description }),
    HtmlHead.meta({
      name: 'robots',
      content: 'index,follow,max-image-preview:large,max-snippet:-1',
    }),
    HtmlHead.link({ rel: 'canonical', href: `${WIKI_ORIGIN}/` }),
    HtmlHead.meta({ property: 'og:type', content: 'website' }),
    HtmlHead.meta({ property: 'og:site_name', content: t.name }),
    HtmlHead.meta({ property: 'og:locale', content: LOCALE_TAGS.en.og }),
    HtmlHead.meta({ property: 'og:url', content: `${WIKI_ORIGIN}/` }),
    HtmlHead.meta({ property: 'og:title', content: t.homeTitle }),
    HtmlHead.meta({ property: 'og:description', content: t.description }),
    HtmlHead.meta({ property: 'og:image', content: `${WIKI_ORIGIN}/og.png` }),
    HtmlHead.meta({ property: 'og:image:type', content: 'image/png' }),
    HtmlHead.meta({ property: 'og:image:width', content: '1200' }),
    HtmlHead.meta({ property: 'og:image:height', content: '630' }),
    HtmlHead.meta({ property: 'og:image:alt', content: t.ogImageAlt }),
    HtmlHead.meta({ name: 'twitter:card', content: 'summary_large_image' }),
    HtmlHead.meta({ name: 'twitter:title', content: t.homeTitle }),
    HtmlHead.meta({ name: 'twitter:description', content: t.description }),
    HtmlHead.meta({ name: 'twitter:image', content: `${WIKI_ORIGIN}/og.png` }),
    HtmlHead.meta({ name: 'twitter:image:alt', content: t.ogImageAlt }),
    HtmlHead.jsonLd(homeStructuredData, { key: 'website' }),
  ]
}

const pageHead = (path: string, locale: Locale) => {
  const page = pageAt(path)
  const t = langOf(locale).t.site
  const title = page === null ? t.notFoundTitle : (page.seoTitle ?? t.title(page.title))
  const description = page?.summary ?? t.description
  const canonical = `${WIKI_ORIGIN}${path}`
  const image = page === null ? `${WIKI_ORIGIN}/og.png` : `${WIKI_ORIGIN}/${ogFile(page.path)}`
  const imageAlt = page === null ? t.ogImageAlt : `${page.title} · ${t.name}`
  return [
    Head.title(title),
    HtmlHead.lang(LOCALE_TAGS[locale].lang),
    HtmlHead.meta({ name: 'description', content: description }),
    HtmlHead.meta({
      name: 'robots',
      content:
        page === null ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1',
    }),
    HtmlHead.link({ rel: 'canonical', href: canonical }),
    ...(page === null
      ? []
      : LOCALES.filter((other) => !isFallback(other, page.path)).flatMap((other) => [
          HtmlHead.link({
            rel: 'alternate',
            hreflang: LOCALE_TAGS[other].lang,
            href: `${WIKI_ORIGIN}${withLocale(other, page.path)}`,
          }),
          ...(other === 'en'
            ? [
                HtmlHead.link({
                  rel: 'alternate',
                  type: 'text/markdown',
                  href: `${WIKI_ORIGIN}${page.path === '/' ? '/index.md' : `${page.path}.md`}`,
                }),
              ]
            : []),
        ])),
    HtmlHead.meta({ property: 'og:type', content: 'article' }),
    HtmlHead.meta({ property: 'og:site_name', content: t.name }),
    HtmlHead.meta({ property: 'og:locale', content: LOCALE_TAGS[locale].og }),
    HtmlHead.meta({ property: 'og:url', content: canonical }),
    HtmlHead.meta({ property: 'og:title', content: title }),
    HtmlHead.meta({ property: 'og:description', content: description }),
    HtmlHead.meta({ property: 'og:image', content: image }),
    HtmlHead.meta({ property: 'og:image:type', content: 'image/png' }),
    HtmlHead.meta({ property: 'og:image:width', content: '1200' }),
    HtmlHead.meta({ property: 'og:image:height', content: '630' }),
    HtmlHead.meta({ property: 'og:image:alt', content: imageAlt }),
    HtmlHead.meta({ name: 'twitter:card', content: 'summary_large_image' }),
    HtmlHead.meta({ name: 'twitter:title', content: title }),
    HtmlHead.meta({ name: 'twitter:description', content: description }),
    HtmlHead.meta({ name: 'twitter:image', content: image }),
    HtmlHead.meta({ name: 'twitter:image:alt', content: imageAlt }),
  ]
}

const AppModel = Schema.Struct({
  route: SiteRoute,
  menu: Schema.Boolean,
  navToggled: Schema.Array(Schema.String),
  era: Schema.Finite,
  eraOpen: Schema.Boolean,
  visited: Schema.Array(Schema.String),
})

const SiteAppNoDeps = Html.component({
  name: 'SiteApp',
  props: Schema.Struct({ route: SiteRoute }),
  model: AppModel,
  message: SiteMessage,
  queries: {
    prose: {
      query: GetProse,
      args: ({ model }) => {
        const path = stripLocale(pathOf(model.route))
        const locale = localeOfPath(pathOf(model.route))
        return needsProse(locale, path) ? { locale, path } : undefined
      },
    },
  },
}).make({
  init: ($) =>
    $.set({
      route: $.props.route,
      menu: false,
      navToggled: [],
      era: ALL_ERAS,
      eraOpen: false,
      visited: [],
    }).run(
      LoadProgressCommand.make({ path: stripLocale(pathOf($.props.route)) }),
      LoadEra.make({}),
    ),

  update: {
    ChangedRoute: ($, { route }) =>
      $.evolve({
        route,
        menu: false,
        navToggled:
          stripLocale(pathOf(route)) === stripLocale(pathOf($.model.route))
            ? $.model.navToggled
            : [],
      }),
    ToggledMenu: ($) => $.evolve({ menu: !$.model.menu, eraOpen: false }),
    ToggledNavGroup: ($, { path }) =>
      $.evolve({
        navToggled: $.model.navToggled.includes(path)
          ? $.model.navToggled.filter((entry) => entry !== path)
          : [...$.model.navToggled, path],
      }),
    ChosenEra: ($, { era }) => $.evolve({ era, eraOpen: false }).run(SaveEra.make({ era })),
    ToggledEraMenu: ($) => $.evolve({ eraOpen: !$.model.eraOpen }),
    ClosedEraMenu: ($) => $.evolve({ eraOpen: false }),
    LoadedEra: ($, { era }) => $.evolve({ era }),
    SavedEra: ($) => $.model,
    LoadedProgress: ($, { visited }) => $.evolve({ visited }),
  },

  subscriptions: ({ model }) => [
    Router.subscription(SiteRoute, model.route, (route) => SiteMessage.ChangedRoute({ route })),
  ],

  head: ({ model }) => {
    const path = pathOf(model.route)
    return model.route._tag === 'Home' ? homeHead() : pageHead(path, localeOfPath(path))
  },

  view: (h, model) => {
    const path = pathOf(model.route)
    const locale = localeOfPath(path)
    const inner = stripLocale(path)
    const isHome = model.route._tag === 'Home'
    const page = isHome ? null : pageAt<SiteMessage>(path)
    const wide = page?.wide === true
    const railPage = isHome || wide ? null : page
    const ready = inner === '/' || !needsProse(locale, inner) || h.queries.prose._tag === 'Success'
    const hasRail =
      ready && railPage !== null && (railPage.aside !== null || railPage.headings.length >= 2)
    const rail =
      hasRail && railPage !== null
        ? h.div
            .class(
              cx(
                RAIL,
                railPage.aside !== null
                  ? css({ display: 'flex' })
                  : css({ display: 'none', xl: { display: 'flex' } }),
              ),
            )
            .children(
              railPage.aside === null ? h.span.children() : railPage.aside(h),
              Toc(h, railPage),
            )
        : null
    return h.div.class(css({ minHeight: '100dvh' })).children(
      Header(h, {
        key: 'header',
        props: { path: inner, locale, menu: model.menu },
        onEmit: { ToggledMenu: () => SiteMessage.ToggledMenu() },
      }),
      h.div.class(cx(FRAME, GRID)).children(
        (!isHome && !wide) || model.menu
          ? Sidebar(h, {
              page: page ?? pageAt<SiteMessage>(path),
              current: inner,
              menu: model.menu,
              toggled: model.navToggled,
              era: model.era,
              eraOpen: model.eraOpen,
              onToggle: (toggledPath) => SiteMessage.ToggledNavGroup({ path: toggledPath }),
              onEra: (era) => SiteMessage.ChosenEra({ era }),
              onToggleEraMenu: () => SiteMessage.ToggledEraMenu(),
              onCloseEraMenu: () => SiteMessage.ClosedEraMenu(),
            })
          : h.span.children(),
        isHome
          ? HomePage(h, { key: 'home' })
          : page === null
            ? NotFound(h, inner, locale)
            : Article(h, page, rail, model.visited),
      ),
    )
  },
})

export const SiteApp = SiteAppNoDeps.pipe(Component.provide(GetProse.layer))
