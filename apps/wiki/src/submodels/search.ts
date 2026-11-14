import { Effect, Option, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { pushUrl } from 'foldkit/navigation'
import { defineView } from 'foldkit/submodel'
import { defineMessageUnion } from 'foldkit/message'
import { Search as SearchIcon } from 'lucide'
import { icon } from '@quorum/ui/primitives/icon'
import { langOf } from '../i18n/lang.ts'
import { Locale, withLocale } from '../i18n/locale.ts'
import { indexUrl, loadIndex, search, type Hit, type Index } from '../search.ts'
import { css, cx as cn } from '@quorum/styled-system/css'

/* The search box in the header: the query, whether its results are open, and the index it loads
   on first use. Each language has its own index, built from its own titles and text. The index is
   not a schema value, so it lives beside the model rather than in it. */

const indexes: Partial<Record<Locale, Index>> = {}

export const Model = Schema.Struct({
  /** The language of the page, which picks the index and the words around the results. */
  locale: Locale,
  query: Schema.String,
  open: Schema.Boolean,
  /** The result the arrow keys have reached; Enter opens it. */
  active: Schema.Finite,
  /** The index arrives once per page load, on the reader's first search. */
  status: Schema.Literals(['idle', 'loading', 'ready', 'failed'] as const),
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  QueryChanged: { query: Schema.String },
  Closed: {},
  Focused: {},
  Moved: { delta: Schema.Finite, count: Schema.Finite },
  Chosen: { href: Schema.String },
  IndexLoaded: {},
  IndexFailed: {},
  Settled: {},
})
export type Message = typeof Message.Type

export const init = (locale: Locale): Model => ({
  locale,
  query: '',
  open: false,
  active: 0,
  status: 'idle',
})

const GoTo = Command.define('GoTo', {
  args: { href: Schema.String },
  messages: [Message.Settled],
  execute: ({ href }) => pushUrl(href).pipe(Effect.as(Message.Settled())),
})

const FocusSearch = Command.define('FocusSearch', {
  messages: [Message.Settled],
  execute: Effect.sync(() => {
    document.querySelector<HTMLInputElement>('#search')?.focus()
    return Message.Settled()
  }),
})

/** One fetch of the whole index, kept for the rest of the session. A failure leaves search
    unavailable rather than breaking the page. */
const LoadIndex = Command.define('LoadIndex', {
  args: { locale: Locale },
  messages: [Message.IndexLoaded, Message.IndexFailed],
  execute: ({ locale }) =>
    Effect.promise(async () => {
      if (indexes[locale] !== undefined) return Message.IndexLoaded()
      try {
        const response = await fetch(indexUrl(locale))
        if (!response.ok) throw new Error(`Search index: HTTP ${response.status}`)
        indexes[locale] = loadIndex(await response.text(), locale)
        return Message.IndexLoaded()
      } catch {
        return Message.IndexFailed()
      }
    }),
})

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    QueryChanged: ({ query }) => {
      const loading = query.trim() !== '' && model.status === 'idle'
      return {
        model: {
          ...model,
          query,
          open: query.trim() !== '',
          active: 0,
          status: loading ? 'loading' : model.status,
        },
        commands: loading ? [LoadIndex({ locale: model.locale })] : [],
      }
    },
    Moved: ({ delta, count }) => ({
      model: { ...model, active: count === 0 ? 0 : (model.active + delta + count) % count },
    }),
    Chosen: ({ href }) => ({ model: { ...model, open: false }, commands: [GoTo({ href })] }),
    Closed: () => ({ model: { ...model, open: false } }),
    Focused: () => {
      const loading = model.status === 'idle' || model.status === 'failed'
      return {
        model: loading ? { ...model, status: 'loading' } : model,
        commands: loading ? [FocusSearch(), LoadIndex({ locale: model.locale })] : [FocusSearch()],
      }
    },
    IndexLoaded: () => ({ model: { ...model, status: 'ready' } }),
    IndexFailed: () => ({ model: { ...model, status: 'failed' } }),
    Settled: () => ({ model }),
  })

export const view = defineView<Model, Message>((model, h) => {
  const t = langOf(model.locale).t
  const index = indexes[model.locale] ?? null
  const hits = model.open && index !== null ? search(index, model.query, model.locale) : []
  const hrefOf = (hit: Hit): string =>
    withLocale(model.locale, hit.heading ? `${hit.path}#${hit.heading}` : hit.path)
  const active = hits[model.active]
  const emptiness =
    model.status === 'loading'
      ? t.search.searching
      : model.status === 'failed'
        ? t.search.unavailable
        : t.search.none
  return h.div(
    [
      h.Class(
        css({
          position: 'relative',
          minWidth: '0',
          flex: '1 1 0%',
          sm: {
            maxWidth: '24rem',
          },
        }),
      ),
    ],
    [
      h.label(
        [
          h.Class(
            css({
              display: 'flex',
              height: '2rem',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: 'md',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--border)',
              backgroundColor: 'var(--background)',
              paddingInline: '0.625rem',
              color: 'var(--muted-foreground)',
              transitionProperty:
                'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
              transitionDuration: '150ms',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
              '&:focus-within': {
                borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
              },
            }),
          ),
        ],
        [
          icon(
            h,
            SearchIcon,
            css({
              width: '0.875rem',
              height: '0.875rem',
              flexShrink: '0',
            }),
          ),
          h.input([
            h.Id('search'),
            h.Type('search'),
            h.Value(model.query),
            h.Placeholder(t.search.placeholder),
            h.AriaLabel(t.search.label),
            h.Autocomplete('off'),
            h.Spellcheck(false),
            h.Class(
              css({
                height: '100%',
                minWidth: '0',
                flex: '1 1 0%',
                backgroundColor: 'transparent',
                fontSize: '16px',
                color: 'var(--foreground)',
                sm: {
                  fontSize: '13px',
                },
                outlineStyle: 'none',
                '&::placeholder': {
                  color: 'var(--muted-foreground)',
                },
              }),
            ),
            h.OnInput((query) => Message.QueryChanged({ query })),
            h.Role('combobox'),
            h.AriaExpanded(model.open),
            h.AriaControls('search-results'),
            h.AriaActiveDescendant(active ? `hit-${model.active}` : ''),
            h.OnKeyDownPreventDefault((key) => {
              if (key === 'Escape') return Option.some(Message.Closed())
              if (!model.open || hits.length === 0) return Option.none()
              if (key === 'ArrowDown')
                return Option.some(Message.Moved({ delta: 1, count: hits.length }))
              if (key === 'ArrowUp')
                return Option.some(Message.Moved({ delta: -1, count: hits.length }))
              if (key === 'Enter' && active)
                return Option.some(Message.Chosen({ href: hrefOf(active) }))
              return Option.none()
            }),
          ]),
          h.kbd(
            [
              h.Class(
                css({
                  display: 'none',
                  borderRadius: '0.25rem',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--border)',
                  paddingInline: '0.375rem',
                  fontFamily: 'mono',
                  fontSize: '11px',
                  lineHeight: '1rem',
                  sm: {
                    display: 'block',
                  },
                }),
              ),
            ],
            ['/'],
          ),
        ],
      ),
      model.open
        ? h.div(
            [
              h.Id('search-results'),
              h.Role('listbox'),
              h.AriaLabel(t.search.results),
              h.AriaBusy(model.status === 'loading'),
              h.Class(
                css({
                  position: 'fixed',
                  top: '52px',
                  right: '0.75rem',
                  left: '0.75rem',
                  zIndex: '50',
                  maxHeight: '70dvh',
                  overflowY: 'auto',
                  borderRadius: 'lg',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--card)',
                  padding: '0.25rem',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                  sm: {
                    position: 'absolute',
                    top: '2.5rem',
                    right: '0',
                    left: '0',
                    maxHeight: 'none',
                    overflow: 'hidden',
                  },
                }),
              ),
            ],
            hits.length === 0
              ? [
                  h.p(
                    [
                      h.Class(
                        css({
                          paddingInline: '0.75rem',
                          paddingBlock: '0.625rem',
                          fontSize: '13px',
                          color: 'var(--muted-foreground)',
                        }),
                      ),
                    ],
                    [emptiness],
                  ),
                ]
              : hits.map((hit, position) => {
                  return h.a(
                    [
                      h.Key(hit.path),
                      h.Id(`hit-${position}`),
                      h.Role('option'),
                      h.AriaSelected(position === model.active),
                      h.Href(hrefOf(hit)),
                      h.Class(
                        cn(
                          css({
                            display: 'block',
                            borderRadius: 'md',
                            paddingInline: '0.75rem',
                            paddingBlock: '0.5rem',
                            _hover: {
                              backgroundColor: 'var(--muted)',
                            },
                            _focusVisible: {
                              backgroundColor: 'var(--muted)',
                              outlineStyle: 'none',
                            },
                          }),
                          position === model.active &&
                            css({
                              backgroundColor: 'var(--muted)',
                            }),
                        ),
                      ),
                    ],
                    [
                      h.div(
                        [
                          h.Class(
                            css({
                              display: 'flex',
                              alignItems: 'baseline',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                            }),
                          ),
                        ],
                        [
                          h.span(
                            [
                              h.Class(
                                css({
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: 'var(--foreground)',
                                }),
                              ),
                            ],
                            [hit.title],
                          ),
                          h.span(
                            [
                              h.Class(
                                css({
                                  fontSize: '12px',
                                  color: 'var(--muted-foreground)',
                                }),
                              ),
                            ],
                            [t.quadrants[hit.section].label],
                          ),
                        ],
                      ),
                      h.p(
                        [
                          h.Class(
                            css({
                              marginTop: '0.125rem',
                              lineClamp: '1',
                              fontSize: '12px',
                              color: 'var(--muted-foreground)',
                            }),
                          ),
                        ],
                        [hit.summary],
                      ),
                    ],
                  )
                }),
          )
        : h.empty,
    ],
  )
})
