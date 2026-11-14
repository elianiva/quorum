import * as Markdown from '@foldkit/markdown'
import type { HtmlBuilder } from 'foldkit/html'
import { ArrowRight, Info, Lightbulb, TriangleAlert } from 'lucide'
import { researchList } from '@quorum/simulation/catalog'
import { optionControls } from '../reference/options.ts'
import { groupBadge } from '@quorum/ui/game/bits'
import { COMPONENT_ICONS } from '@quorum/ui/game/icons'
import { researchMark } from '@quorum/ui/game/research-marks'
import { icon } from '@quorum/ui/primitives/icon'
import { langOf } from '../i18n/lang.ts'
import { islandAttributes } from '../islands.ts'
import { Message, type Model } from '../main.ts'
import { mixBar } from './mix.ts'
import { leverView } from './lever.ts'
import * as Quiz from '../submodels/quiz.ts'
import { practiceView } from './practice-card.ts'
import { sandboxView } from './sandbox-card.ts'
import { designView } from './design-card.ts'
import { css, cx } from '@quorum/styled-system/css'

/* The live views behind each Markdown directive. src/islands.ts declares their attributes. */

const NOTE = {
  tip: { glyph: Lightbulb, tone: css({ color: 'var(--ok)' }) },
  warn: { glyph: TriangleAlert, tone: css({ color: 'var(--warn)' }) },
  real: { glyph: Info, tone: css({ color: 'var(--group-edge)' }) },
} as const

export const islandViews = (model: Model, h: HtmlBuilder<Message>): Markdown.Islands => {
  const l = langOf(model.locale)
  const t = l.t.islands
  const controlsOf = optionControls(l)
  return Markdown.islandsFor(islandAttributes, {
    Note: ({ tone }, content) => {
      const note = NOTE[tone ?? 'tip']
      return h.aside(
        [
          h.Class(
            cx(
              css({
                marginBlock: '1.5rem',
                borderRadius: 'lg',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--border)',
                paddingInline: '1rem',
                paddingBlock: '0.75rem',
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
                  marginBottom: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '13px',
                  fontWeight: '500',
                }),
              ),
            ],
            [
              icon(
                h,
                note.glyph,
                cx(
                  css({
                    width: '0.875rem',
                    height: '0.875rem',
                  }),
                  note.tone,
                ),
              ),
              t.note[tone ?? 'tip'],
            ],
          ),
          h.div(
            [
              h.Class(
                cx(
                  css({
                    fontSize: '14px',
                    '& > * + *': {
                      marginTop: '0.5rem',
                    },
                  }),
                  'prose',
                ),
              ),
            ],
            content,
          ),
        ],
      )
    },
    Quiz: (quiz, _content, index) =>
      h.submodel({
        slotId: `quiz-${index}`,
        model: model.quiz,
        view: Quiz.view,
        toParentMessage: (message) => Message.QuizChanged({ message }),
        viewInputs: { ...quiz, key: `${model.path}#${index}`, locale: model.locale },
      }),
    Sandbox: ({ id }, _content, index) => sandboxView(model, id, index, h),
    Design: ({ id }) => designView(id, h),
    Options: ({ id }) => {
      const controls = controlsOf[id] ?? []
      if (controls.length === 0) return h.empty
      return h.div(
        [
          h.Class(
            cx(
              css({
                marginBlock: '1.5rem',
                overflowX: 'auto',
                borderRadius: 'lg',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--border)',
              }),
              'not-prose',
            ),
          ),
        ],
        [
          h.table(
            [
              h.Class(
                css({
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                  lineHeight: '1.375',
                }),
              ),
            ],
            [
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    [t.options.control, t.options.settings, t.options.when].map((header) =>
                      h.th(
                        [
                          h.Key(header),
                          h.Class(
                            css({
                              borderBottomWidth: '1px',
                              borderBottomStyle: 'solid',
                              borderColor: 'var(--border)',
                              backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)',
                              paddingInline: '0.75rem',
                              paddingBlock: '0.5rem',
                              textAlign: 'left',
                              fontSize: '12px',
                              fontWeight: '500',
                              whiteSpace: 'nowrap',
                              color: 'var(--muted-foreground)',
                            }),
                          ),
                        ],
                        [header],
                      ),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [
                  h.Class(
                    css({
                      '& > * + *': {
                        borderTopWidth: '1px',
                        borderTopStyle: 'solid',
                        borderColor: 'var(--border)',
                      },
                    }),
                  ),
                ],
                controls.map((control) =>
                  h.tr(
                    [h.Key(control.name)],
                    [
                      h.td(
                        [
                          h.Class(
                            css({
                              paddingInline: '0.75rem',
                              paddingBlock: '0.5rem',
                              verticalAlign: 'top',
                              fontWeight: '500',
                            }),
                          ),
                        ],
                        [control.name],
                      ),
                      h.td(
                        [
                          h.Class(
                            css({
                              paddingInline: '0.75rem',
                              paddingBlock: '0.5rem',
                              verticalAlign: 'top',
                              color: 'var(--muted-foreground)',
                            }),
                          ),
                        ],
                        [control.settings],
                      ),
                      h.td(
                        [
                          h.Class(
                            css({
                              paddingInline: '0.75rem',
                              paddingBlock: '0.5rem',
                              verticalAlign: 'top',
                              color: 'var(--muted-foreground)',
                            }),
                          ),
                        ],
                        [control.shown],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      )
    },
    Component: ({ id }) => {
      const def = l.cat.COMPONENTS[id]
      return h.a(
        [
          h.Href(`/components/${id}`),
          h.Class(
            cx(
              cx(
                css({
                  marginBlock: '1.5rem',
                  display: 'flex',
                  maxWidth: '28rem',
                  alignItems: 'center',
                  gap: '0.875rem',
                  borderRadius: 'lg',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--border)',
                  paddingInline: '1rem',
                  paddingBlock: '0.75rem',
                  transitionProperty:
                    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                  transitionDuration: '150ms',
                  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  _hover: {
                    backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
                  },
                }),
                'not-prose',
                'group',
              ),
            ),
          ),
        ],
        [
          groupBadge(def.group, COMPONENT_ICONS[id], css({ width: '2.5rem', height: '2.5rem' }), h),
          h.span(
            [
              h.Class(
                css({
                  minWidth: '0',
                  flex: '1 1 0%',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.5rem',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          fontSize: '15px',
                          fontWeight: '600',
                          letterSpacing: '-0.025em',
                        }),
                      ),
                    ],
                    [def.name],
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
                    [def.product],
                  ),
                ],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      marginTop: '0.125rem',
                      display: 'block',
                      fontSize: '13px',
                      lineHeight: '1.375',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                ],
                [def.blurb],
              ),
            ],
          ),
          icon(
            h,
            ArrowRight,
            css({
              width: '1rem',
              height: '1rem',
              flexShrink: '0',
              color: 'var(--muted-foreground)',
              transitionProperty: 'transform, translate, scale, rotate',
              transitionDuration: '150ms',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
              '.group:hover &': {
                translate: '0.125rem',
              },
            }),
          ),
        ],
      )
    },
    Mix: ({ era }) => {
      const def = l.cat.ERAS[Number(era)]
      return def
        ? h.figure(
            [
              h.Class(
                cx(
                  css({
                    marginBlock: '1.25rem',
                  }),
                  'not-prose',
                ),
              ),
            ],
            [
              mixBar(def.mix, h),
              h.figcaption(
                [
                  h.Class(
                    css({
                      fontSize: '12px',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                ],
                [t.mix(def.name)],
              ),
            ],
          )
        : h.empty
    },
    Practice: ({ id }) => practiceView(id, h),
    Lever: ({ kind }) => leverView(kind, h),
    Track: ({ track }) =>
      h.ol(
        [
          h.Class(
            cx(
              css({
                marginBlock: '1.25rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }),
              'not-prose',
            ),
          ),
        ],
        researchList
          .filter((entry) => entry.track === track)
          .map((entry) =>
            h.li(
              [h.Key(entry.id)],
              [
                h.a(
                  [
                    h.Href(`/research/${entry.id}`),
                    h.Class(
                      css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        borderRadius: 'md',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'var(--border)',
                        paddingBlock: '0.25rem',
                        paddingRight: '0.75rem',
                        paddingLeft: '0.25rem',
                        fontSize: '13px',
                        _hover: {
                          backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
                        },
                      }),
                    ),
                  ],
                  [researchMark(entry, 'sm', false, h), l.cat.RESEARCH[entry.id].name],
                ),
              ],
            ),
          ),
      ),
  })
}
