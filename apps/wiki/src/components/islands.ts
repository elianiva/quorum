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
  tip: { glyph: Lightbulb, tone: css({ color: 'ok' }) },
  warn: { glyph: TriangleAlert, tone: css({ color: 'warn' }) },
  real: { glyph: Info, tone: css({ color: 'groupEdge' }) },
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
                marginBlock: '6',
                borderRadius: 'lg',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'border',
                paddingInline: '4',
                paddingBlock: '3',
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
                  marginBottom: '1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                  fontSize: 'type.13',
                  fontWeight: 'medium',
                }),
              ),
            ],
            [
              icon(
                h,
                note.glyph,
                cx(
                  css({
                    width: '3.5',
                    height: '3.5',
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
                    fontSize: 'type.14',
                    '& > * + *': {
                      marginTop: '2',
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
                marginBlock: '6',
                overflowX: 'auto',
                borderRadius: 'lg',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'border',
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
                  fontSize: 'type.14',
                  lineHeight: 'snug',
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
                              borderColor: 'border',
                              backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)',
                              paddingInline: '3',
                              paddingBlock: '2',
                              textAlign: 'left',
                              fontSize: 'type.12',
                              fontWeight: 'medium',
                              whiteSpace: 'nowrap',
                              color: 'mutedForeground',
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
                        borderColor: 'border',
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
                              paddingInline: '3',
                              paddingBlock: '2',
                              verticalAlign: 'top',
                              fontWeight: 'medium',
                            }),
                          ),
                        ],
                        [control.name],
                      ),
                      h.td(
                        [
                          h.Class(
                            css({
                              paddingInline: '3',
                              paddingBlock: '2',
                              verticalAlign: 'top',
                              color: 'mutedForeground',
                            }),
                          ),
                        ],
                        [control.settings],
                      ),
                      h.td(
                        [
                          h.Class(
                            css({
                              paddingInline: '3',
                              paddingBlock: '2',
                              verticalAlign: 'top',
                              color: 'mutedForeground',
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
                  marginBlock: '6',
                  display: 'flex',
                  maxWidth: '28rem',
                  alignItems: 'center',
                  gap: '3.5',
                  borderRadius: 'lg',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'border',
                  paddingInline: '4',
                  paddingBlock: '3',
                  transitionProperty:
                    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                  transitionDuration: 'fast',
                  transitionTimingFunction: 'default',
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
          groupBadge(def.group, COMPONENT_ICONS[id], css({ width: '10', height: '10' }), h),
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
                      gap: '2',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          fontSize: 'type.15',
                          fontWeight: 'semibold',
                          letterSpacing: 'tight',
                        }),
                      ),
                    ],
                    [def.name],
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
                    [def.product],
                  ),
                ],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      marginTop: '0.5',
                      display: 'block',
                      fontSize: 'type.13',
                      lineHeight: 'snug',
                      color: 'mutedForeground',
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
              width: '4',
              height: '4',
              flexShrink: '0',
              color: 'mutedForeground',
              transitionProperty: 'transform, translate, scale, rotate',
              transitionDuration: 'fast',
              transitionTimingFunction: 'default',
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
                    marginBlock: '5',
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
                      fontSize: 'type.12',
                      color: 'mutedForeground',
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
                marginBlock: '5',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '2',
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
                        gap: '2',
                        borderRadius: 'md',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'border',
                        paddingBlock: '1',
                        paddingRight: '3',
                        paddingLeft: '1',
                        fontSize: 'type.13',
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
