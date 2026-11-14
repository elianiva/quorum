import { Effect, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { defineView } from 'foldkit/submodel'
import { defineMessageUnion } from 'foldkit/message'
import { FIGURE } from '@quorum/ui/game/bits'
import { langOf } from '../i18n/lang.ts'
import type { Locale } from '../i18n/locale.ts'
import { css, cx } from '@quorum/styled-system/css'

/* The spoiler filter: the last Era the reader reached. Pages about later Eras fold. Kept in the browser. */

/** Every Era: content from any Era shows. */
export const ALL_ERAS = -1

export const Model = Schema.Struct({ era: Schema.Finite })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  Chosen: { era: Schema.Finite },
  Loaded: { era: Schema.Finite },
  Saved: {},
})
export type Message = typeof Message.Type

const KEY = 'quorum.wiki.era'

export const init: Model = { era: ALL_ERAS }

export const Load = Command.define('LoadEra', {
  messages: [Message.Loaded],
  execute: Effect.sync(() => {
    const stored = Number(globalThis.localStorage?.getItem(KEY) ?? ALL_ERAS)
    return Message.Loaded({ era: Number.isInteger(stored) ? stored : ALL_ERAS })
  }),
})

const Save = Command.define('SaveEra', {
  args: { era: Schema.Finite },
  messages: [Message.Saved],
  execute: ({ era }) =>
    Effect.sync(() => {
      globalThis.localStorage?.setItem(KEY, String(era))
      return Message.Saved()
    }),
})

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    Chosen: ({ era }) => ({ model: { era }, commands: [Save({ era })] }),
    Loaded: ({ era }) => ({ model: { era } }),
    Saved: () => ({ model }),
  })

/** A page about `era` folds for this reader. */
export const hides = (model: Model, era: number | null): boolean =>
  era !== null && model.era !== ALL_ERAS && era > model.era

/** The control at the foot of the sidebar: "All", then one step per Era, filled up to the Era reached. */
export const view = defineView<Model, Message, Readonly<{ locale: Locale }>>(
  (model, { locale }, h) => {
    const l = langOf(locale)
    const t = l.t.spoilers
    const ERAS = l.cat.ERAS
    const all = model.era === ALL_ERAS
    const reached = all ? t.allShow : t.hidingAfter(ERAS[model.era]?.name ?? '')
    const step = css({
      height: '1.75rem',
      minWidth: '0',
      flex: '1 1 0%',
      cursor: 'pointer',
      borderRadius: 'md',
      fontSize: '12px',
      transitionProperty:
        'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
      transitionDuration: '150ms',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    })
    // The first step says a word, not a number: it takes the room it needs, in every language.
    const allStep = css({
      height: '1.75rem',
      flexShrink: '0',
      cursor: 'pointer',
      borderRadius: 'md',
      paddingInline: '0.5rem',
      fontSize: '12px',
      whiteSpace: 'nowrap',
      transitionProperty:
        'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
      transitionDuration: '150ms',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    })
    return h.div(
      [
        h.Class(
          css({
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderColor: 'var(--border)',
            paddingTop: '0.75rem',
          }),
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
                gap: '0.5rem',
              }),
            ),
          ],
          [
            h.span(
              [
                h.Class(
                  css({
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'var(--foreground)',
                  }),
                ),
              ],
              [t.title],
            ),
            h.span(
              [
                h.Class(
                  css({
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '12px',
                    color: 'var(--muted-foreground)',
                  }),
                ),
              ],
              [reached],
            ),
          ],
        ),
        h.div(
          [
            h.Role('group'),
            h.AriaLabel(t.groupLabel),
            h.Class(
              css({
                marginTop: '0.5rem',
                display: 'flex',
                gap: '0.25rem',
              }),
            ),
          ],
          [
            h.button(
              [
                h.Type('button'),
                h.AriaPressed(all ? 'true' : 'false'),
                h.Title(t.showEvery),
                h.OnClick(Message.Chosen({ era: ALL_ERAS })),
                h.Class(
                  cx(
                    allStep,
                    all
                      ? css({
                          backgroundColor: 'var(--foreground)',
                          fontWeight: '500',
                          color: 'var(--background)',
                        })
                      : css({
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'var(--border)',
                          color: 'var(--muted-foreground)',
                          _hover: {
                            backgroundColor: 'var(--muted)',
                            color: 'var(--foreground)',
                          },
                        }),
                  ),
                ),
              ],
              [t.all],
            ),
            ...ERAS.map((era, index) =>
              h.button(
                [
                  h.Key(era.name),
                  h.Type('button'),
                  h.AriaPressed(model.era === index ? 'true' : 'false'),
                  h.AriaLabel(t.hideAfter(era.name)),
                  h.Title(t.upTo(era.name)),
                  h.OnClick(Message.Chosen({ era: index })),
                  h.Class(
                    cx(
                      step,
                      FIGURE,
                      all || index <= model.era
                        ? model.era === index
                          ? css({
                              backgroundColor: 'var(--foreground)',
                              color: 'var(--background)',
                            })
                          : css({
                              backgroundColor: 'var(--muted)',
                              color: 'var(--foreground)',
                              _hover: {
                                backgroundColor:
                                  'color-mix(in oklab, var(--muted) 70%, transparent)',
                              },
                            })
                        : css({
                            borderWidth: '1px',
                            borderStyle: 'dashed',
                            borderColor: 'var(--border)',
                            color: 'var(--muted-foreground)',
                            _hover: {
                              backgroundColor: 'var(--muted)',
                            },
                          }),
                    ),
                  ),
                ],
                [String(index)],
              ),
            ),
          ],
        ),
      ],
    )
  },
)
