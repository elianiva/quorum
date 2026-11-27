import { Command, Component, Mount, UiSchema } from '@effect/ui'
import type { View } from '@effect/ui'
import { Html } from '@effect/ui/html'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect, Schema, Stream } from 'effect'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  Gamepad2,
  Globe,
  GraduationCap,
  Info,
  Lightbulb,
  Menu,
  Moon,
  NotebookPen,
  Search as SearchIcon,
  Sun,
  Wrench,
  X,
} from 'lucide'
import { langOf } from '../i18n/lang.ts'
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS, Locale, withLocale } from '../i18n/locale.ts'
import { navOf, pageIn, SECTION_ORDER } from './pages.ts'
import { indexUrl, loadIndex, search, type Hit, type Index } from '../search.ts'
import { GAME_ORIGIN, REPOSITORY } from '../site.ts'
import { githubMark } from './github.ts'
import { icon } from './icon.ts'

const indexes: Partial<Record<Locale, Index>> = {}

const mark = <Msg>(h: H<Msg>): View.Content<Msg> =>
  h.svg
    .attr('aria-hidden', 'true')
    .attr('viewBox', '0 0 64 64')
    .class(css({ width: '7', height: '7', flexShrink: '0' }))
    .children(
      h.rect
        .attr('width', '64')
        .attr('height', '64')
        .attr('rx', '14')
        .attr('fill', '#141517')
        .children(),
      h.g
        .attr('transform', 'translate(18.5 9.5) scale(0.24)')
        .children(
          h.path
            .attr('d', 'M89 11V150M50 11a39 39 0 1 0 0.01 0')
            .attr('fill', 'none')
            .attr('stroke', '#eaebec')
            .attr('stroke-width', '22')
            .children(),
          h.circle
            .attr('cx', '89')
            .attr('cy', '180')
            .attr('r', '14')
            .attr('fill', '#58cef8')
            .children(),
        ),
    )

const languageSummary = css({
  display: 'flex',
  height: '8',
  width: '8',
  flexShrink: '0',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1.5',
  cursor: 'pointer',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  color: 'mutedForeground',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionDuration: 'fast',
  transitionTimingFunction: 'default',
  _hover: {
    borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
    color: 'foreground',
  },
  sm: { width: 'auto', paddingInline: '2.5' },
})

const languageMenu = css({
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: '0',
  zIndex: '50',
  minWidth: '12rem',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  backgroundColor: 'popover',
  boxShadow: 'float',
  padding: '1',
})

const languageBackdrop = css({
  position: 'fixed',
  inset: '0',
  zIndex: '40',
  cursor: 'default',
})

const languageItem = css({
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
  borderRadius: 'md',
  paddingInline: '2',
  paddingBlock: '2',
  color: 'foreground',
  fontSize: 'type.13',
  _hover: { backgroundColor: 'muted' },
})

const languageCode = css({
  fontFamily: 'mono',
  fontSize: 'type.11',
  color: 'mutedForeground',
})

const tool = css({
  width: '8',
  height: '8',
  flexShrink: '0',
  placeItems: 'center',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  color: 'mutedForeground',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionDuration: 'fast',
  transitionTimingFunction: 'default',
  _hover: {
    borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
    color: 'foreground',
  },
})

const searchField = css({
  display: 'flex',
  height: '8',
  minWidth: '0',
  flex: '1 1 0%',
  alignItems: 'center',
  gap: '2',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  backgroundColor: 'background',
  paddingInline: '2.5',
  color: 'mutedForeground',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionDuration: 'fast',
  transitionTimingFunction: 'default',
  '&:focus-within': {
    borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
  },
  sm: { display: 'flex' },
})

const searchInput = css({
  height: '100%',
  minWidth: '0',
  flex: '1 1 0%',
  backgroundColor: 'transparent',
  fontSize: 'type.16',
  color: 'foreground',
  outlineStyle: 'none',
  sm: { fontSize: 'type.13' },
  '&::placeholder': { color: 'mutedForeground' },
})

export const HeaderEvents = UiSchema.TaggedEnum({
  ToggledMenu: {},
})

export const HeaderMessage = UiSchema.TaggedEnum({
  ClickedMenu: {},
  LanguageMenuToggled: {},
  LanguageMenuClosed: {},
  QueryChanged: { query: Schema.String },
  SearchFocused: {},
  SearchPanelOpened: {},
  SearchClosed: {},
  SearchMoved: { delta: Schema.Finite, count: Schema.Finite },
  IndexLoaded: {},
  IndexFailed: {},
})
export type HeaderMessage = typeof HeaderMessage.Type

const LoadIndex = Command.make('LoadIndex', { args: { locale: Locale } }, ({ locale }) =>
  Effect.promise(async () => {
    if (indexes[locale] !== undefined) return HeaderMessage.IndexLoaded()
    try {
      const response = await fetch(indexUrl(locale))
      if (!response.ok) throw new Error(`Search index: HTTP ${response.status}`)
      indexes[locale] = loadIndex(await response.text(), locale)
      return HeaderMessage.IndexLoaded()
    } catch {
      return HeaderMessage.IndexFailed()
    }
  }),
)

const SearchFocus = Mount.make(
  'SearchFocus',
  { args: { panel: Schema.Boolean } },
  (node: HTMLElement, _args, changes) =>
    Stream.runForEach(changes, ({ panel }) =>
      Effect.sync(() => {
        if (panel) node.querySelector<HTMLInputElement>('#search')?.focus()
      }),
    ).pipe(Effect.as(Component.noop)),
)

const HeaderModel = Schema.Struct({
  languageMenu: Schema.Boolean,
  query: Schema.String,
  open: Schema.Boolean,
  panel: Schema.Boolean,
  active: Schema.Finite,
  status: Schema.Literals(['idle', 'loading', 'ready', 'failed'] as const),
})

type HeaderModel = typeof HeaderModel.Type

const languageSwitcher = (
  h: H<HeaderMessage>,
  model: HeaderModel,
  path: string,
  locale: Locale,
): View.Content<HeaderMessage> => {
  const t = langOf(locale).t.header
  return h.nav
    .attr('aria-label', t.language)
    .class(css({ position: 'relative', flexShrink: '0' }))
    .children(
      h.button
        .attr('type', 'button')
        .attr('title', t.language)
        .attr('aria-label', t.language)
        .attr('aria-haspopup', 'menu')
        .attr('aria-expanded', model.languageMenu ? 'true' : 'false')
        .attr('aria-controls', 'language-menu')
        .attr('data-needs-hydration', 'language')
        .on('click', HeaderMessage.LanguageMenuToggled())
        .class(languageSummary)
        .children(
          icon(
            h,
            Globe,
            css({
              display: 'none',
              width: '4',
              height: '4',
              flexShrink: '0',
              sm: { display: 'block' },
            }),
          ),
          h.span
            .class(
              css({
                fontSize: 'type.11',
                fontWeight: 'semibold',
                textTransform: 'uppercase',
                sm: { display: 'none' },
              }),
            )
            .children(LOCALE_TAGS[locale].lang),
          h.span
            .class(
              css({
                display: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'type.12',
                fontWeight: 'medium',
                sm: { display: 'inline' },
              }),
            )
            .children(LOCALE_NAMES[locale]),
          icon(
            h,
            ChevronDown,
            css({
              display: 'none',
              width: '3.5',
              height: '3.5',
              flexShrink: '0',
              sm: { display: 'block' },
            }),
          ),
        ),
      model.languageMenu &&
        h.div
          .attr('aria-hidden', 'true')
          .on('click', HeaderMessage.LanguageMenuClosed())
          .class(languageBackdrop)
          .children(),
      model.languageMenu &&
        h.div
          .attr('id', 'language-menu')
          .attr('role', 'menu')
          .attr('aria-label', t.language)
          .class(languageMenu)
          .children(
            ...LOCALES.map((candidate) => {
              const tag = LOCALE_TAGS[candidate].lang
              return candidate === locale
                ? h.span
                    .key(candidate)
                    .attr('role', 'menuitem')
                    .attr('aria-current', 'page')
                    .attr('aria-label', LOCALE_NAMES[candidate])
                    .class(languageItem)
                    .children(
                      h.span.children(LOCALE_NAMES[candidate]),
                      icon(
                        h,
                        Check,
                        css({
                          width: '3.5',
                          height: '3.5',
                          flexShrink: '0',
                          color: 'mutedForeground',
                        }),
                      ),
                    )
                : h.a
                    .key(candidate)
                    .attr('href', withLocale(candidate, path))
                    .attr('hreflang', tag)
                    .attr('lang', tag)
                    .attr('title', t.switchTo(LOCALE_NAMES[candidate]))
                    .attr('role', 'menuitem')
                    .attr('aria-label', LOCALE_NAMES[candidate])
                    .class(languageItem)
                    .children(
                      h.span.children(LOCALE_NAMES[candidate]),
                      h.span.class(languageCode).children(tag),
                    )
            }),
          ),
    )
}

const iconButton = css({
  width: '8',
  height: '8',
  flexShrink: '0',
  placeItems: 'center',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  color: 'mutedForeground',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionDuration: 'fast',
  transitionTimingFunction: 'default',
  _hover: {
    borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
    color: 'foreground',
  },
})

const searchView = (
  h: H<HeaderMessage>,
  model: HeaderModel,
  locale: Locale,
): View.Content<HeaderMessage> => {
  const t = langOf(locale).t.search
  const index = indexes[locale] ?? null
  const hits = model.open && index !== null ? search(index, model.query, locale) : []
  const active = hits[model.active]
  const hrefOf = (hit: Hit): string =>
    withLocale(locale, hit.heading ? `${hit.path}#${hit.heading}` : hit.path)
  const empty =
    model.status === 'loading' ? t.searching : model.status === 'failed' ? t.unavailable : t.none
  const outer = css({
    position: model.panel ? 'fixed' : 'relative',
    top: model.panel ? '14' : 'auto',
    right: model.panel ? '0' : 'auto',
    bottom: model.panel ? '0' : 'auto',
    left: model.panel ? '0' : 'auto',
    zIndex: model.panel ? '50' : 'auto',
    display: model.panel ? 'flex' : 'block',
    flexDirection: 'column',
    gap: '1',
    minWidth: '0',
    flex: '1 1 0%',
    overflowY: model.panel ? 'auto' : 'visible',
    backgroundColor: model.panel ? 'background' : 'transparent',
    paddingInline: model.panel ? '4' : '0',
    paddingBlock: model.panel ? '3' : '0',
    sm: {
      position: 'relative',
      top: 'auto',
      right: 'auto',
      bottom: 'auto',
      left: 'auto',
      zIndex: 'auto',
      display: 'block',
      overflow: 'visible',
      backgroundColor: 'transparent',
      paddingInline: '0',
      paddingBlock: '0',
      maxWidth: '96',
    },
  })
  const results = css({
    position: model.panel ? 'static' : 'fixed',
    top: model.panel ? undefined : '52px',
    right: model.panel ? undefined : '3',
    left: model.panel ? undefined : '3',
    zIndex: model.panel ? undefined : '50',
    maxHeight: model.panel ? 'none' : '70dvh',
    overflowY: model.panel ? 'visible' : 'auto',
    borderRadius: 'lg',
    borderWidth: model.panel ? '0' : '1px',
    borderStyle: 'solid',
    borderColor: 'border',
    backgroundColor: model.panel ? 'transparent' : 'card',
    padding: model.panel ? '0' : '1',
    boxShadow: model.panel ? 'none' : 'lg',
    sm: {
      position: 'absolute',
      top: '10',
      right: '0',
      left: '0',
      maxHeight: 'none',
      overflow: 'hidden',
      borderRadius: 'lg',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'border',
      backgroundColor: 'card',
      padding: '1',
      boxShadow: 'lg',
    },
  })
  return h.div.class(outer).children(
    h.button
      .attr('id', 'search-trigger')
      .attr('type', 'button')
      .attr('aria-label', t.label)
      .attr('aria-controls', 'search')
      .attr('aria-expanded', model.panel ? 'true' : 'false')
      .attr('data-search-trigger', '')
      .attr('data-needs-hydration', 'search-trigger')
      .on('click', HeaderMessage.SearchPanelOpened())
      .class(
        cx(iconButton, css({ display: model.panel ? 'none' : 'grid', sm: { display: 'none' } })),
      )
      .children(icon(h, SearchIcon, css({ width: '4', height: '4' }))),
    h.div
      .class(css({ display: 'flex', width: '100%', alignItems: 'center', gap: '2' }))
      .onMount(SearchFocus({ panel: model.panel }))
      .children(
        h.label
          .class(
            cx(
              searchField,
              css({ display: model.panel ? 'flex' : 'none', sm: { display: 'flex' } }),
            ),
          )
          .children(
            icon(h, SearchIcon, css({ width: '3.5', height: '3.5', flexShrink: '0' })),
            h.input
              .attr('id', 'search')
              .attr('type', 'search')
              .attr('data-needs-hydration', 'search-input')
              .value(model.query)
              .attr('placeholder', t.placeholder)
              .attr('aria-label', t.label)
              .attr('autocomplete', 'off')
              .attr('spellcheck', 'false')
              .attr('role', 'combobox')
              .attr('aria-expanded', model.open ? 'true' : 'false')
              .attr('aria-controls', 'search-results')
              .attr('aria-activedescendant', active ? `hit-${model.active}` : '')
              .class(searchInput)
              .on('focus', HeaderMessage.SearchFocused())
              .on('input', ({ value }) => HeaderMessage.QueryChanged({ query: value }))
              .on(
                'keydown',
                ({ key }) => {
                  if (key === 'Escape') return HeaderMessage.SearchClosed()
                  if (!model.open || hits.length === 0) return undefined
                  if (key === 'ArrowDown')
                    return HeaderMessage.SearchMoved({ delta: 1, count: hits.length })
                  if (key === 'ArrowUp')
                    return HeaderMessage.SearchMoved({ delta: -1, count: hits.length })
                  return undefined
                },
                { preventDefault: true },
              ),
            h.kbd
              .attr('aria-hidden', 'true')
              .class(
                css({
                  display: 'none',
                  borderRadius: 'xs',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'border',
                  paddingInline: '1.5',
                  fontFamily: 'mono',
                  fontSize: 'type.11',
                  lineHeight: 'fixed',
                  sm: { display: 'block' },
                }),
              )
              .children('/'),
          ),
        model.panel &&
          h.button
            .attr('type', 'button')
            .attr('aria-label', t.close)
            .on('click', HeaderMessage.SearchClosed())
            .class(cx(iconButton, css({ display: 'grid', sm: { display: 'none' } })))
            .children(icon(h, X, css({ width: '4', height: '4' }))),
      ),
    model.open &&
      h.div
        .attr('id', 'search-results')
        .attr('role', 'listbox')
        .attr('aria-label', t.results)
        .attr('aria-busy', model.status === 'loading' ? 'true' : 'false')
        .class(results)
        .children(
          ...(hits.length === 0
            ? [
                h.p
                  .key('empty')
                  .class(
                    css({
                      paddingInline: '3',
                      paddingBlock: '2.5',
                      fontSize: 'type.13',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(empty),
              ]
            : hits.map((hit, position) =>
                h.a
                  .key(hit.path)
                  .attr('id', `hit-${position}`)
                  .attr('role', 'option')
                  .attr('aria-selected', position === model.active ? 'true' : 'false')
                  .attr('href', hrefOf(hit))
                  .class(
                    cx(
                      css({
                        display: 'block',
                        borderRadius: 'md',
                        paddingInline: '3',
                        paddingBlock: '2',
                        _hover: { backgroundColor: 'muted' },
                        _focusVisible: { backgroundColor: 'muted', outlineStyle: 'none' },
                      }),
                      position === model.active && css({ backgroundColor: 'muted' }),
                    ),
                  )
                  .children(
                    h.div
                      .class(
                        css({
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: '3',
                        }),
                      )
                      .children(
                        h.span
                          .class(
                            css({
                              fontSize: 'type.14',
                              fontWeight: 'medium',
                              color: 'foreground',
                            }),
                          )
                          .children(hit.title),
                        h.span
                          .class(css({ fontSize: 'type.12', color: 'mutedForeground' }))
                          .children(langOf(locale).t.quadrants[hit.section].label),
                      ),
                    h.p
                      .class(
                        css({
                          marginTop: '0.5',
                          lineClamp: '1',
                          fontSize: 'type.12',
                          color: 'mutedForeground',
                        }),
                      )
                      .children(hit.summary),
                  ),
              )),
        ),
  )
}

const sections = (
  h: H<HeaderMessage>,
  path: string,
  locale: Locale,
): View.Content<HeaderMessage> => {
  const l = langOf(locale)
  const current = path === '/' ? null : (pageIn<never>(locale, path)?.section ?? null)
  return h.nav.attr('aria-label', l.t.header.sections).children(
    h.div
      .class(
        css({
          marginInline: 'auto',
          display: 'flex',
          height: '11',
          maxWidth: '80rem',
          alignItems: 'stretch',
          gap: '6',
          overflowX: 'auto',
          paddingInline: '4',
          paddingRight: '24',
          sm: { paddingInline: '6' },
          scrollbarWidth: 'none',
          '@media (max-width: 1023px)': {
            maskImage:
              'linear-gradient(to right,transparent 0.5rem,#000 1rem,#000 calc(100% - 3rem),transparent)',
          },
        }),
      )
      .children(
        ...SECTION_ORDER.flatMap((section) => {
          const first = navOf<never>(locale, section)[0]
          if (!first) return []
          const target = withLocale(locale, first.path)
          return [
            h.a
              .key(section)
              .attr('href', target)
              .attr('aria-current', section === current ? 'true' : undefined)
              .class(
                cx(
                  css({
                    display: 'flex',
                    flexShrink: '0',
                    alignItems: 'center',
                    gap: '2',
                    borderBottomWidth: '2px',
                    borderBottomStyle: 'solid',
                    scrollMarginInlineStart: '4',
                    fontSize: 'type.14',
                    transitionProperty:
                      'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                    transitionDuration: 'fast',
                    transitionTimingFunction: 'default',
                  }),
                  section === current
                    ? css({ borderColor: 'foreground', fontWeight: 'medium', color: 'foreground' })
                    : css({
                        borderColor: 'transparent',
                        color: 'mutedForeground',
                        _hover: { color: 'foreground' },
                      }),
                ),
              )
              .children(
                icon(h, sectionIcon(section), css({ width: '4', height: '4' })),
                l.t.quadrants[section].label,
              ),
          ]
        }),
      ),
  )
}

const SECTION_ICONS = {
  play: Gamepad2,
  tutorials: GraduationCap,
  guides: Wrench,
  explanation: Lightbulb,
  patterns: NotebookPen,
  reference: BookOpen,
  design: FileText,
  about: Info,
} as const

const sectionIcon = (section: (typeof SECTION_ORDER)[number]) => SECTION_ICONS[section]

export const Header = Html.component({
  name: 'Header',
  props: Schema.Struct({ path: Schema.String, locale: Locale, menu: Schema.Boolean }),
  model: HeaderModel,
  message: HeaderMessage,
  events: HeaderEvents,
}).make({
  init: () => ({
    languageMenu: false,
    query: '',
    open: false,
    panel: false,
    active: 0,
    status: 'idle' as const,
  }),

  update: {
    ClickedMenu: ($) => $.evolve({ languageMenu: false }).emit(HeaderEvents.ToggledMenu()),
    LanguageMenuToggled: ($) => $.evolve({ languageMenu: !$.model.languageMenu }),
    LanguageMenuClosed: ($) => $.evolve({ languageMenu: false }),
    QueryChanged: ($, { query }) => {
      const loading = query.trim() !== '' && $.model.status === 'idle'
      const next = $.evolve({
        query,
        open: query.trim() !== '',
        active: 0,
        status: loading ? ('loading' as const) : $.model.status,
      })
      return loading ? next.run(LoadIndex.make({ locale: $.props.locale })) : next
    },
    SearchFocused: ($) => {
      if ($.model.status === 'ready') return $.model
      return $.evolve({ status: 'loading' as const }).run(
        LoadIndex.make({ locale: $.props.locale }),
      )
    },
    SearchPanelOpened: ($) => {
      const loading = $.model.status === 'idle' || $.model.status === 'failed'
      const next = $.evolve({
        panel: true,
        status: loading ? ('loading' as const) : $.model.status,
        open: $.model.query.trim() !== '',
      })
      return loading ? next.run(LoadIndex.make({ locale: $.props.locale })) : next
    },
    SearchClosed: ($) => $.evolve({ open: false, panel: false }),
    SearchMoved: ($, { delta, count }) =>
      $.evolve({
        active: count === 0 ? 0 : ($.model.active + delta + count) % count,
      }),
    IndexLoaded: ($) => $.evolve({ status: 'ready' as const }),
    IndexFailed: ($) => $.evolve({ status: 'failed' as const }),
  },

  view: (h, model) => {
    const { path, locale, menu } = h.props
    const t = langOf(locale).t.header
    return h.header
      .class(
        css({
          position: 'sticky',
          top: '0',
          zIndex: '40',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: 'border',
          backgroundColor: 'background',
        }),
      )
      .children(
        h.div
          .class(
            css({
              marginInline: 'auto',
              display: 'flex',
              height: '14',
              maxWidth: '80rem',
              alignItems: 'center',
              gap: '3',
              paddingInline: '4',
              sm: { paddingInline: '6' },
            }),
          )
          .children(
            h.button
              .attr('type', 'button')
              .attr('aria-label', menu ? t.closeMenu : t.openMenu)
              .attr('aria-expanded', menu ? 'true' : 'false')
              .attr('data-needs-hydration', 'menu')
              .on('click', HeaderMessage.ClickedMenu())
              .class(
                css({
                  marginLeft: '-0.25rem',
                  display: 'grid',
                  width: '9',
                  height: '9',
                  placeItems: 'center',
                  borderRadius: 'md',
                  color: 'mutedForeground',
                  _hover: { color: 'foreground' },
                  lg: { display: 'none' },
                }),
              )
              .children(icon(h, menu ? X : Menu, css({ width: '18px', height: '18px' }))),
            h.a
              .attr('href', withLocale(locale, '/'))
              .attr('aria-label', langOf(locale).t.site.name)
              .class(
                css({
                  display: 'flex',
                  flexShrink: '0',
                  alignItems: 'center',
                  gap: '2',
                  paddingRight: '1',
                  sm: { paddingRight: '3' },
                }),
              )
              .children(
                mark(h),
                h.span
                  .class(
                    css({
                      display: 'none',
                      fontSize: 'type.15',
                      fontWeight: 'semibold',
                      letterSpacing: 'tight',
                      '@media (min-width: 430px)': { display: 'inline' },
                    }),
                  )
                  .children('Quorum'),
                h.span
                  .class(
                    css({
                      display: 'none',
                      fontSize: 'type.15',
                      color: 'mutedForeground',
                      sm: { display: 'inline' },
                    }),
                  )
                  .children(t.wordmarkWiki),
              ),
            searchView(h, model, locale),
            h.div
              .class(css({ display: 'none', flex: '1 1 0%', sm: { display: 'block' } }))
              .children(),
            languageSwitcher(h, model, path, locale),
            h.button
              .attr('type', 'button')
              .attr('data-theme-toggle', '')
              .attr('aria-label', t.theme)
              .attr('title', t.theme)
              .class(cx(tool, css({ display: 'grid' })))
              .children(
                icon(h, Sun, css({ width: '4', height: '4', _dark: { display: 'none' } })),
                icon(
                  h,
                  Moon,
                  css({ display: 'none', width: '4', height: '4', _dark: { display: 'block' } }),
                ),
              ),
            h.a
              .attr('href', REPOSITORY)
              .attr('title', t.github)
              .attr('aria-label', t.github)
              .class(cx(tool, css({ display: 'none', sm: { display: 'grid' } })))
              .children(githubMark(h, css({ width: '17px', height: '17px' }))),
            h.a
              .attr('href', GAME_ORIGIN)
              .class(
                css({
                  display: 'flex',
                  height: '8',
                  flexShrink: '0',
                  alignItems: 'center',
                  gap: '1',
                  borderRadius: 'md',
                  backgroundColor: 'foreground',
                  paddingInline: '3',
                  fontSize: 'type.13',
                  fontWeight: 'medium',
                  color: 'background',
                  _hover: { opacity: 0.9 },
                }),
              )
              .children(t.play, icon(h, ArrowUpRight, css({ width: '3.5', height: '3.5' }))),
          ),
        sections(h, path, locale),
      )
  },
})
