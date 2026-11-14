import type { Html, HtmlBuilder } from 'foldkit/html'
import { Star } from 'lucide'
import { FIGURE } from '@quorum/ui/game/bits'
import { compact } from '@quorum/ui/game/format'
import { githubMark } from '@quorum/ui/primitives/github'
import { icon } from '@quorum/ui/primitives/icon'
import { localeOf } from '../i18n/builder.ts'
import { langOf } from '../i18n/lang.ts'
import type { Message } from '../main.ts'
import { REPOSITORY } from '../site.ts'
import type * as Project from '../submodels/project.ts'
import { css, cx } from '@quorum/styled-system/css'

/* The repository behind the game and the wiki, as a card: where the code is, and what other
   people have made of it. */

type H = HtmlBuilder<Message>

const REPO_NAME = 'elianiva/quorum'
const LICENSE_URL = `${REPOSITORY}/blob/main/LICENSE`

const cell = (value: string, label: string, h: H): Html =>
  h.div(
    [
      h.Key(label),
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1',
          backgroundColor: 'background',
          paddingInline: '4',
          paddingBlock: '3.5',
        }),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: '20px',
                lineHeight: '1',
                fontWeight: '500',
                fontVariantNumeric: 'tabular-nums',
              }),
            ),
          ),
        ],
        [value],
      ),
      h.span(
        [
          h.Class(
            css({
              fontSize: '12px',
              color: 'mutedForeground',
            }),
          ),
        ],
        [label],
      ),
    ],
  )

export const projectCard = (project: Project.Model, h: H): Html => {
  const t = langOf(localeOf(h)).t.project
  const stats = project.stats
  const cells = stats
    ? [
        { label: t.stars, value: compact(stats.stars) },
        { label: t.forks, value: compact(stats.forks) },
        { label: t.contributors, value: compact(stats.contributors) },
        { label: t.issues, value: compact(stats.issues) },
      ]
    : []
  return h.div(
    [
      h.Class(
        css({
          overflow: 'hidden',
          borderRadius: 'lg',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'border',
          backgroundColor: 'background',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              rowGap: '4',
              columnGap: '6',
              padding: '5',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  minWidth: '0',
                  alignItems: 'flex-start',
                  gap: '3',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      display: 'grid',
                      width: '10',
                      height: '10',
                      flexShrink: '0',
                      placeItems: 'center',
                      borderRadius: 'md',
                      backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
                    }),
                  ),
                ],
                [
                  githubMark(
                    h,
                    css({
                      width: '5',
                      height: '5',
                    }),
                  ),
                ],
              ),
              h.div(
                [
                  h.Class(
                    css({
                      minWidth: '0',
                    }),
                  ),
                ],
                [
                  h.a(
                    [
                      h.Href(REPOSITORY),
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: '14px',
                            fontWeight: '500',
                            _hover: {
                              textDecorationLine: 'underline',
                            },
                            textUnderlineOffset: '4px',
                          }),
                        ),
                      ),
                    ],
                    [REPO_NAME],
                  ),
                  h.p(
                    [
                      h.Class(
                        css({
                          marginTop: '1',
                          maxWidth: '96',
                          fontSize: '13px',
                          lineHeight: '1.375',
                          color: 'mutedForeground',
                        }),
                      ),
                    ],
                    [t.blurb],
                  ),
                ],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '3',
                }),
              ),
            ],
            [
              h.a(
                [
                  h.Href(REPOSITORY),
                  h.Class(
                    css({
                      display: 'inline-flex',
                      height: '9',
                      alignItems: 'center',
                      gap: '2',
                      borderRadius: 'md',
                      backgroundColor: 'foreground',
                      paddingInline: '3',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: 'background',
                      _hover: {
                        opacity: 0.9,
                      },
                    }),
                  ),
                ],
                [
                  icon(
                    h,
                    Star,
                    css({
                      width: '3.5',
                      height: '3.5',
                    }),
                  ),
                  t.star,
                ],
              ),
              h.a(
                [
                  h.Href('/about/contributing'),
                  h.Class(
                    css({
                      fontSize: '13px',
                      color: 'mutedForeground',
                      textDecorationLine: 'underline',
                      textUnderlineOffset: '4px',
                      _hover: {
                        color: 'foreground',
                      },
                    }),
                  ),
                ],
                [t.contribute],
              ),
            ],
          ),
        ],
      ),
      stats
        ? h.div(
            [
              h.Class(
                css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '1px',
                  borderTopWidth: '1px',
                  borderTopStyle: 'solid',
                  borderColor: 'border',
                  backgroundColor: 'border',
                  sm: {
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  },
                }),
              ),
            ],
            cells.map((entry) => cell(entry.value, entry.label, h)),
          )
        : h.empty,
      h.p(
        [
          h.Class(
            css({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: '2',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'border',
              paddingInline: '4',
              paddingBlock: '2.5',
              fontSize: '12px',
              color: 'mutedForeground',
            }),
          ),
        ],
        [
          h.a(
            [
              h.Href(LICENSE_URL),
              h.Class(
                css({
                  textDecorationLine: 'underline',
                  textUnderlineOffset: '2px',
                  _hover: {
                    color: 'foreground',
                  },
                }),
              ),
            ],
            [stats?.license ?? 'GPL-3.0'],
          ),
          h.span([h.AriaHidden(true)], ['·']),
          h.span([], [t.source(stats?.language ?? 'TypeScript')]),
        ],
      ),
    ],
  )
}
