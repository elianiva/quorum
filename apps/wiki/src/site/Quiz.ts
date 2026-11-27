import { UiSchema } from '@effect/ui'
import { Html } from '@effect/ui/html'
import { Check, RotateCcw, X } from 'lucide'
import { css, cx } from '@quorum/styled-system/css'
import { Schema } from 'effect'
import { icon } from './icon.ts'

export const QuizMessage = UiSchema.TaggedEnum({
  Chosen: { choice: Schema.Finite },
  Reset: {},
})

const QuizModel = Schema.Struct({ chosen: Schema.NullOr(Schema.Finite) })

const quizText = {
  en: { title: 'Quiz', retry: 'Try again' },
  es: { title: 'Prueba', retry: 'Intentar de nuevo' },
  ja: { title: 'クイズ', retry: 'もう一度' },
} as const

const QuizNoDeps = Html.component({
  name: 'Quiz',
  props: Schema.Struct({
    question: Schema.String,
    options: Schema.String,
    answer: Schema.String,
    explain: Schema.String,
    locale: Schema.Literals(['en', 'es', 'ja']),
  }),
  model: QuizModel,
  message: QuizMessage,
}).make({
  init: () => ({ chosen: null }),
  update: {
    Chosen: ($, { choice }) => $.evolve({ chosen: choice }),
    Reset: ($) => $.evolve({ chosen: null }),
  },
  view: (h, model) => {
    const t = quizText[h.props.locale]
    const options = h.props.options.split('|').map((option) => option.trim())
    const right = Number(h.props.answer)
    const chosen = model.chosen
    const id = `quiz-${h.props.question.replace(/[^a-z0-9]+/gi, '-')}`
    return h.section
      .class(
        cx(
          css({
            marginBlock: '8',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderColor: 'border',
            paddingBlock: '5',
          }),
          'not-prose',
        ),
      )
      .children(
        h.div
          .class(css({ fontSize: 'type.12', fontWeight: 'medium', color: 'mutedForeground' }))
          .children(t.title),
        h.p
          .attr('id', id)
          .class(
            css({
              marginTop: '1',
              fontSize: 'type.16',
              lineHeight: 'snug',
              fontWeight: 'medium',
              textWrap: 'balance',
            }),
          )
          .children(h.props.question),
        h.div
          .attr('role', 'group')
          .attr('aria-labelledby', id)
          .class(css({ marginTop: '3', display: 'flex', flexDirection: 'column', gap: '1.5' }))
          .children(
            ...options.map((option, at) => {
              const choice = at + 1
              const picked = choice === chosen
              const state =
                chosen === null ? 'open' : choice === right ? 'right' : picked ? 'wrong' : 'other'
              return h.button
                .key(option)
                .attr('type', 'button')
                .attr('disabled', chosen !== null ? 'true' : undefined)
                .attr('aria-pressed', picked ? 'true' : 'false')
                .on('click', QuizMessage.Chosen({ choice }))
                .class(
                  cx(
                    css({
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      gap: '3',
                      borderRadius: 'md',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      paddingInline: '3',
                      paddingBlock: '2',
                      textAlign: 'left',
                      fontSize: 'type.14',
                      transitionProperty:
                        'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                      transitionDuration: 'fast',
                      transitionTimingFunction: 'default',
                    }),
                    state === 'open' &&
                      css({
                        borderColor: 'border',
                        _hover: {
                          borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
                          backgroundColor: 'muted',
                        },
                      }),
                    state === 'right' &&
                      css({
                        borderColor: 'color-mix(in oklab, var(--ok) 50%, transparent)',
                        backgroundColor: 'color-mix(in oklab, var(--ok) 8%, transparent)',
                        fontWeight: 'medium',
                      }),
                    state === 'wrong' &&
                      css({
                        borderColor: 'color-mix(in oklab, var(--danger) 50%, transparent)',
                        backgroundColor: 'color-mix(in oklab, var(--danger) 8%, transparent)',
                      }),
                    state === 'other' && css({ borderColor: 'border', color: 'mutedForeground' }),
                  ),
                )
                .children(
                  h.span
                    .class(
                      cx(
                        css({
                          display: 'grid',
                          width: '5',
                          height: '5',
                          flexShrink: '0',
                          placeItems: 'center',
                          borderRadius: 'full',
                          fontFamily: 'mono',
                          fontSize: 'type.11',
                        }),
                        state === 'right'
                          ? css({ backgroundColor: 'ok', color: 'background' })
                          : state === 'wrong'
                            ? css({ backgroundColor: 'danger', color: 'background' })
                            : css({
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor: 'border',
                              }),
                      ),
                    )
                    .children(
                      state === 'right'
                        ? icon(h, Check, css({ width: '3', height: '3' }))
                        : state === 'wrong'
                          ? icon(h, X, css({ width: '3', height: '3' }))
                          : String.fromCharCode(64 + choice),
                    ),
                  option,
                )
            }),
          ),
        chosen === null
          ? h.span.children()
          : h.div
              .class(
                css({
                  marginTop: '3',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: '3',
                }),
              )
              .children(
                h.p
                  .class(
                    css({
                      flex: '1 1 12rem',
                      fontSize: 'type.13',
                      lineHeight: 'snug',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(h.props.explain),
                h.button
                  .attr('type', 'button')
                  .on('click', QuizMessage.Reset())
                  .class(
                    css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '1.5',
                      borderRadius: 'md',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'border',
                      paddingInline: '2.5',
                      paddingBlock: '1',
                      fontSize: 'type.12',
                      _hover: { backgroundColor: 'muted' },
                    }),
                  )
                  .children(icon(h, RotateCcw, css({ width: '3', height: '3' })), t.retry),
              ),
      )
  },
})

export const Quiz = QuizNoDeps
