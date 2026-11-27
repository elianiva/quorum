import { Head, Router, UiSchema } from '@effect/ui'
import type { View } from '@effect/ui'
import { Html, HtmlHead } from '@effect/ui/html'
import type { H } from '@effect/ui/html/Html'
import { css } from '@quorum/styled-system/css'
import { Schema } from 'effect'
import { langOf } from '../i18n/lang.ts'
import { LOCALE_TAGS, localeOfPath, stripLocale } from '../i18n/locale.ts'
import { WIKI_ORIGIN } from '../site.ts'
import { Header } from './Header.ts'
import { HomePage } from './HomePage.ts'
import { pathOf, SiteRoute } from './routes.ts'

export const SiteMessage = UiSchema.TaggedEnum({
  ChangedRoute: { route: SiteRoute },
})
export type SiteMessage = typeof SiteMessage.Type

const FRAME = css({
  marginInline: 'auto',
  maxWidth: '80rem',
  paddingInline: '4',
  sm: { paddingInline: '6' },
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

const notFoundHead = (path: string) => {
  const t = langOf('en').t.site
  return [
    Head.title(t.notFoundTitle),
    HtmlHead.lang('en'),
    HtmlHead.meta({ name: 'description', content: t.description }),
    HtmlHead.meta({ name: 'robots', content: 'noindex,follow' }),
    HtmlHead.meta({ property: 'og:title', content: t.notFoundTitle }),
    HtmlHead.meta({ property: 'og:description', content: t.description }),
    HtmlHead.link({ rel: 'canonical', href: `${WIKI_ORIGIN}${path}` }),
  ]
}

const notFound = (h: H<SiteMessage>, path: string): View.Content<SiteMessage> => {
  const t = langOf('en').t.article.notFound
  return h.main
    .class(css({ marginInline: 'auto', maxWidth: '48rem', paddingInline: '4', paddingBlock: '16' }))
    .children(
      h.h1.class(css({ textStyle: 'display' })).children(t.heading),
      h.p
        .class(
          css({
            marginTop: '4',
            fontSize: 'type.16',
            lineHeight: 'relaxed',
            color: 'mutedForeground',
          }),
        )
        .children(t.body(path)),
      h.a
        .attr('href', '/')
        .class(
          css({
            marginTop: '6',
            display: 'inline-flex',
            height: '10',
            alignItems: 'center',
            borderRadius: 'md',
            backgroundColor: 'foreground',
            paddingInline: '4',
            fontSize: 'type.14',
            fontWeight: 'medium',
            color: 'background',
          }),
        )
        .children(t.home),
    )
}

const AppModel = Schema.Struct({ route: SiteRoute })

export const SiteApp = Html.component({
  name: 'SiteApp',
  props: Schema.Struct({ route: SiteRoute }),
  model: AppModel,
  message: SiteMessage,
}).make({
  init: ($) => ({ route: $.props.route }),

  update: ($, message) =>
    SiteMessage.match(message, {
      ChangedRoute: ({ route }) => $.evolve({ route }),
    }),

  subscriptions: ({ model }) => [
    Router.subscription(SiteRoute, model.route, (route) => SiteMessage.ChangedRoute({ route })),
  ],

  head: ({ model }) => {
    const path = pathOf(model.route)
    if (model.route._tag === 'Home') return homeHead()
    return notFoundHead(path)
  },

  view: (h, { route }) => {
    const path = pathOf(route)
    const locale = localeOfPath(path)
    const inner = stripLocale(path)
    return h.div
      .class(css({ minHeight: '100dvh' }))
      .children(
        Header(h, { key: 'header', props: { path: inner, locale } }),
        h.div
          .class(FRAME)
          .children(route._tag === 'Home' ? HomePage(h, { key: 'home' }) : notFound(h, path)),
      )
  },
})
