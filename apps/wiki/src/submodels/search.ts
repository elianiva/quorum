import { Effect, Option, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { pushUrl } from 'foldkit/navigation'
import { defineView } from 'foldkit/submodel'
import { defineMessageUnion } from 'foldkit/message'
import { Search as SearchIcon, X } from 'lucide'
import { icon } from '@quorum/ui/primitives/icon'
import { langOf } from '../i18n/lang.ts'
import { Locale, withLocale } from '../i18n/locale.ts'
import { indexUrl, loadIndex, search, type Hit, type Index } from '../search.ts'
import { css, cx } from '@quorum/styled-system/css'

/* The search box in the header: the query, whether its results are open, and the index it loads
   on first use. Each language has its own index, built from its own titles and text. The index is
   not a schema value, so it lives beside the model rather than in it. */

const indexes: Partial<Record<Locale, Index>> = {}

export const Model = Schema.Struct({
  /** The language of the page, which picks the index and the words around the results. */
  locale: Locale,
  query: Schema.String,
  open: Schema.Boolean,
  /** A phone opens search as a full-width panel; a desktop keeps the field in the header. */
  panel: Schema.Boolean,
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
  panel: false,
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
  execute: Effect.promise(async () => {
    // The phone panel renders in the same update, so wait for its frame before focusing.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    document.querySelector<HTMLInputElement>('#search')?.focus()
    return Message.Settled()
  }),
})

/** Return keyboard focus to the header button after the phone panel closes. */
const FocusSearchTrigger = Command.define('FocusSearchTrigger', {
  messages: [Message.Settled],
  execute: Effect.promise(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
    document.getElementById('search-trigger')?.focus()
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
    Chosen: ({ href }) => ({
      model: { ...model, open: false, panel: false },
      commands: [GoTo({ href })],
    }),
    Closed: () =>
      model.open || model.panel
        ? {
            model: { ...model, open: false, panel: false },
            // The phone's field disappears with the panel, so its focus goes back to the button.
            commands: model.panel ? [FocusSearchTrigger()] : [],
          }
        : { model },
    Focused: () => {
      const loading = model.status === 'idle' || model.status === 'failed'
      return {
        model: {
          ...model,
          panel: true,
          status: loading ? 'loading' : model.status,
          open: model.query.trim() !== '',
        },
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
  const field = css({
    display: model.panel ? 'flex' : 'none',
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
  return h.div(
    [
      h.Class(
        css({
          // On a phone the field becomes a sheet under the header, so the header stays compact.
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
        }),
      ),
    ],
    [
      h.button(
        [
          h.Id('search-trigger'),
          h.Type('button'),
          h.AriaLabel(t.search.label),
          h.AriaControls('search'),
          h.AriaExpanded(model.panel),
          h.DataAttribute('search-trigger', ''),
          h.DataAttribute('needs-hydration', 'search-trigger'),
          h.OnClick(Message.Focused()),
          h.Class(
            cx(
              iconButton,
              css({ display: model.panel ? 'none' : 'grid', sm: { display: 'none' } }),
            ),
          ),
        ],
        [
          icon(
            h,
            SearchIcon,
            css({
              width: '4',
              height: '4',
            }),
          ),
        ],
      ),
      h.div(
        [h.Class(css({ display: 'flex', width: '100%', alignItems: 'center', gap: '2' }))],
        [
          h.label(
            [h.Class(field)],
            [
              icon(
                h,
                SearchIcon,
                css({
                  width: '3.5',
                  height: '3.5',
                  flexShrink: '0',
                }),
              ),
              h.input([
                h.Id('search'),
                h.Type('search'),
                h.DataAttribute('needs-hydration', 'search-input'),
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
                    fontSize: 'type.16',
                    color: 'foreground',
                    sm: {
                      fontSize: 'type.13',
                    },
                    outlineStyle: 'none',
                    '&::placeholder': {
                      color: 'mutedForeground',
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
                      borderRadius: 'xs',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'border',
                      paddingInline: '1.5',
                      fontFamily: 'mono',
                      fontSize: 'type.11',
                      lineHeight: 'fixed',
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
          model.panel
            ? h.button(
                [
                  h.Type('button'),
                  h.AriaLabel(t.search.close),
                  h.OnClick(Message.Closed()),
                  h.Class(cx(iconButton, css({ display: 'grid', sm: { display: 'none' } }))),
                ],
                [
                  icon(
                    h,
                    X,
                    css({
                      width: '4',
                      height: '4',
                    }),
                  ),
                ],
              )
            : h.empty,
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
                cx(
                  model.panel
                    ? css({
                        position: 'static',
                        maxHeight: 'none',
                        overflow: 'visible',
                        borderWidth: '0',
                        backgroundColor: 'transparent',
                        padding: '0',
                        boxShadow: 'none',
                      })
                    : css({
                        position: 'fixed',
                        top: '52px',
                        right: '3',
                        left: '3',
                        zIndex: '50',
                        maxHeight: '70dvh',
                        overflowY: 'auto',
                        borderRadius: 'lg',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'border',
                        backgroundColor: 'card',
                        padding: '1',
                        boxShadow: 'lg',
                      }),
                  css({
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
                  }),
                ),
              ),
            ],
            hits.length === 0
              ? [
                  h.p(
                    [
                      h.Class(
                        css({
                          paddingInline: '3',
                          paddingBlock: '2.5',
                          fontSize: 'type.13',
                          color: 'mutedForeground',
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
                        cx(
                          css({
                            display: 'block',
                            borderRadius: 'md',
                            paddingInline: '3',
                            paddingBlock: '2',
                            _hover: {
                              backgroundColor: 'muted',
                            },
                            _focusVisible: {
                              backgroundColor: 'muted',
                              outlineStyle: 'none',
                            },
                          }),
                          position === model.active &&
                            css({
                              backgroundColor: 'muted',
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
                              gap: '3',
                            }),
                          ),
                        ],
                        [
                          h.span(
                            [
                              h.Class(
                                css({
                                  fontSize: 'type.14',
                                  fontWeight: 'medium',
                                  color: 'foreground',
                                }),
                              ),
                            ],
                            [hit.title],
                          ),
                          h.span(
                            [
                              h.Class(
                                css({
                                  fontSize: 'type.12',
                                  color: 'mutedForeground',
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
                              marginTop: '0.5',
                              lineClamp: '1',
                              fontSize: 'type.12',
                              color: 'mutedForeground',
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
