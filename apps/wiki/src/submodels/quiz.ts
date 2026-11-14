import { Schema } from 'effect'
import type { Update } from 'foldkit'
import { defineView } from 'foldkit/submodel'
import { defineMessageUnion } from 'foldkit/message'
import { Check, RotateCcw, X } from 'lucide'
import { icon } from '@quorum/ui/primitives/icon'
import { langOf } from '../i18n/lang.ts'
import type { Locale } from '../i18n/locale.ts'
import { css, cx } from '@quorum/styled-system/css'

/* The quizzes on a page: the option the reader chose for each, by `<page path>#<occurrence>`,
   counting from 1. A check, not a score: answers last until the page reloads. */

export const Model = Schema.Struct({ answers: Schema.Record(Schema.String, Schema.Finite) })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  Answered: { key: Schema.String, choice: Schema.Finite },
  Reset: { key: Schema.String },
})
export type Message = typeof Message.Type

export const init: Model = { answers: {} }

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    Answered: ({ key, choice }) => ({ model: { answers: { ...model.answers, [key]: choice } } }),
    Reset: ({ key }) => {
      const { [key]: _dropped, ...answers } = model.answers
      return { model: { answers } }
    },
  })

export type Question = Readonly<{
  key: string
  question: string
  options: string
  answer: string
  explain: string
  /** The page's language, for the words around the question. */
  locale: Locale
}>

export const view = defineView<Model, Message, Question>((model, quiz, h) => {
  const t = langOf(quiz.locale).t.quiz
  const options = quiz.options.split('|').map((option) => option.trim())
  const right = Number(quiz.answer)
  const chosen = model.answers[quiz.key] ?? null
  const correct = chosen === right
  const id = `quiz-${quiz.key.replace(/[^a-z0-9]+/gi, '-')}`
  return h.section(
    [
      h.Class(
        cx(
          css({
            marginBlock: '2rem',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderColor: 'var(--border)',
            paddingBlock: '1.25rem',
          }),
          'not-prose',
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [t.title],
      ),
      h.p(
        [
          h.Id(id),
          h.Class(
            css({
              marginTop: '0.25rem',
              fontSize: '16px',
              lineHeight: '1.375',
              fontWeight: '500',
              textWrap: 'balance',
            }),
          ),
        ],
        [quiz.question],
      ),
      h.div(
        [
          h.Role('group'),
          h.AriaLabelledBy(id),
          h.Class(
            css({
              marginTop: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
            }),
          ),
        ],
        options.map((option, at) => {
          const choice = at + 1
          const picked = choice === chosen
          const state =
            chosen === null ? 'open' : choice === right ? 'right' : picked ? 'wrong' : 'other'
          return h.button(
            [
              h.Key(option),
              h.Type('button'),
              h.Disabled(chosen !== null),
              h.AriaPressed(picked ? 'true' : 'false'),
              h.OnClick(Message.Answered({ key: quiz.key, choice })),
              h.Class(
                cx(
                  css({
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    gap: '0.75rem',
                    borderRadius: 'md',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    paddingInline: '0.75rem',
                    paddingBlock: '0.5rem',
                    textAlign: 'left',
                    fontSize: '14px',
                    transitionProperty:
                      'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                    transitionDuration: '150ms',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  }),
                  state === 'open' &&
                    css({
                      borderColor: 'var(--border)',
                      _hover: {
                        borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
                        backgroundColor: 'var(--muted)',
                      },
                    }),
                  state === 'right' &&
                    css({
                      borderColor: 'color-mix(in oklab, var(--ok) 50%, transparent)',
                      backgroundColor: 'color-mix(in oklab, var(--ok) 8%, transparent)',
                      fontWeight: '500',
                    }),
                  state === 'wrong' &&
                    css({
                      borderColor: 'color-mix(in oklab, var(--danger) 50%, transparent)',
                      backgroundColor: 'color-mix(in oklab, var(--danger) 8%, transparent)',
                    }),
                  state === 'other' &&
                    css({
                      borderColor: 'var(--border)',
                      color: 'var(--muted-foreground)',
                    }),
                ),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    cx(
                      css({
                        display: 'grid',
                        width: '1.25rem',
                        height: '1.25rem',
                        flexShrink: '0',
                        placeItems: 'center',
                        borderRadius: '9999px',
                        fontFamily: 'mono',
                        fontSize: '11px',
                      }),
                      state === 'right'
                        ? css({
                            backgroundColor: 'var(--ok)',
                            color: 'white',
                          })
                        : state === 'wrong'
                          ? css({
                              backgroundColor: 'var(--danger)',
                              color: 'white',
                            })
                          : css({
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: 'var(--border)',
                            }),
                    ),
                  ),
                ],
                [
                  state === 'right'
                    ? icon(
                        h,
                        Check,
                        css({
                          width: '0.75rem',
                          height: '0.75rem',
                        }),
                      )
                    : state === 'wrong'
                      ? icon(
                          h,
                          X,
                          css({
                            width: '0.75rem',
                            height: '0.75rem',
                          }),
                        )
                      : String.fromCharCode(64 + choice),
                ],
              ),
              option,
            ],
          )
        }),
      ),
      chosen === null
        ? h.empty
        : h.div(
            [
              h.AriaLive('polite'),
              h.Class(
                css({
                  marginTop: '0.75rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                }),
              ),
            ],
            [
              h.p(
                [
                  h.Class(
                    css({
                      flex: '1 1 0%',
                      fontSize: '14px',
                      lineHeight: '1.625',
                    }),
                  ),
                ],
                [
                  h.strong(
                    [
                      h.Class(
                        correct
                          ? css({
                              color: 'var(--ok)',
                            })
                          : css({
                              color: 'var(--danger)',
                            }),
                      ),
                    ],
                    [correct ? t.right : t.wrong],
                  ),
                  quiz.explain,
                ],
              ),
              correct
                ? h.empty
                : h.button(
                    [
                      h.Type('button'),
                      h.OnClick(Message.Reset({ key: quiz.key })),
                      h.Class(
                        css({
                          display: 'inline-flex',
                          height: '2rem',
                          flexShrink: '0',
                          alignItems: 'center',
                          gap: '0.375rem',
                          borderRadius: 'md',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'var(--border)',
                          paddingInline: '0.625rem',
                          fontSize: '12px',
                          fontWeight: '500',
                          _hover: {
                            backgroundColor: 'var(--muted)',
                          },
                        }),
                      ),
                    ],
                    [
                      icon(
                        h,
                        RotateCcw,
                        css({
                          width: '0.875rem',
                          height: '0.875rem',
                        }),
                      ),
                      t.retry,
                    ],
                  ),
            ],
          ),
    ],
  )
})
