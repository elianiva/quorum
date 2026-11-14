import type { Html, HtmlBuilder } from 'foldkit/html'
import { ArrowRight, Check } from 'lucide'
import { FIGURE } from '@quorum/ui/game/bits'
import { icon } from '@quorum/ui/primitives/icon'
import { langOf, type Lang } from '../i18n/lang.ts'
import type { Message, Model } from '../main.ts'
import type { Page } from '../page.ts'
import { PATHS, placeOf, resumeOf, stepsOf, type Path } from '../paths.ts'
import { quadrantColor } from './quadrant.ts'
import { css, cx } from '@quorum/styled-system/css'

/* The guided paths in the page: where a reader is in one, and the step after it. */

type H = HtmlBuilder<Message>

/** One segment per step: read steps fill, the current one takes its kind's colour. */
const segments = (
  l: Lang,
  steps: ReadonlyArray<Page>,
  current: string | null,
  model: Model,
  h: H,
): Html =>
  h.ol(
    [
      h.Class(
        css({
          display: 'flex',
          gap: '0.25rem',
        }),
      ),
    ],
    steps.map((step, index) =>
      h.li(
        [
          h.Key(step.path),
          h.Class(
            css({
              flex: '1 1 0%',
            }),
          ),
        ],
        [
          h.a(
            [
              h.Href(step.path),
              h.Title(l.t.pathNav.stepTitle(index + 1, step.title)),
              h.AriaLabel(l.t.pathNav.stepLabel(index + 1, step.title)),
              ...(step.path === current ? [h.AriaCurrent('step')] : []),
              h.Class(
                cx(
                  css({
                    display: 'block',
                    height: '0.375rem',
                    borderRadius: '9999px',
                    transitionProperty:
                      'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                    transitionDuration: '150ms',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  }),
                  step.path === current
                    ? ''
                    : model.progress.visited.includes(step.path)
                      ? css({
                          backgroundColor:
                            'color-mix(in oklab, var(--foreground) 45%, transparent)',
                          _hover: {
                            backgroundColor:
                              'color-mix(in oklab, var(--foreground) 60%, transparent)',
                          },
                        })
                      : css({
                          backgroundColor:
                            'color-mix(in oklab, var(--foreground) 10%, transparent)',
                          _hover: {
                            backgroundColor:
                              'color-mix(in oklab, var(--foreground) 25%, transparent)',
                          },
                        }),
                ),
              ),
              ...(step.path === current
                ? [h.Style({ background: quadrantColor(step.section) })]
                : []),
            ],
            [],
          ),
        ],
      ),
    ),
  )

/** Under a page's title: the path it belongs to and the reader's place in it. */
export const pathBar = (page: Page, model: Model, h: H): Html => {
  const l = langOf(page.locale)
  const place = placeOf(page.locale, page.path)
  if (!place) return h.empty
  const steps = stepsOf(page.locale, place.path)
  const title = l.t.paths[place.path.id].title
  return h.nav(
    [
      h.AriaLabel(l.t.pathNav.guidedPath(title)),
      h.Class(
        css({
          marginTop: '1.5rem',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              marginBottom: '0.5rem',
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
                  fontSize: '12px',
                  color: 'var(--muted-foreground)',
                }),
              ),
            ],
            [l.t.pathNav.path(title)],
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: '12px',
                    color: 'var(--muted-foreground)',
                  }),
                ),
              ),
            ],
            [l.t.pathNav.place(place.index + 1, steps.length)],
          ),
        ],
      ),
      segments(l, steps, page.path, model, h),
    ],
  )
}

/** The next page, as docs sites end a page: a bordered link on the right. */
const nextCard = (label: string, target: Page, h: H): Html =>
  h.div(
    [
      h.Class(
        css({
          marginTop: '3.5rem',
          display: 'flex',
          justifyContent: 'flex-end',
        }),
      ),
    ],
    [
      h.a(
        [
          h.Href(target.path),
          h.Class(
            cx(
              css({
                display: 'flex',
                width: '100%',
                maxWidth: '24rem',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '0.25rem',
                borderRadius: 'lg',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--border)',
                paddingInline: '1rem',
                paddingBlock: '0.75rem',
                textAlign: 'right',
                transitionProperty:
                  'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                transitionDuration: '150ms',
                transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                _hover: {
                  borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
                },
              }),
              'group',
            ),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontSize: '12px',
                  color: 'var(--muted-foreground)',
                }),
              ),
            ],
            [label],
          ),
          h.span(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '15px',
                  fontWeight: '500',
                }),
              ),
            ],
            [
              target.title,
              icon(
                h,
                ArrowRight,
                css({
                  width: '1rem',
                  height: '1rem',
                  transitionProperty: 'transform, translate, scale, rotate',
                  transitionDuration: '150ms',
                  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  '.group:hover &': {
                    translate: '0.125rem',
                  },
                }),
              ),
            ],
          ),
        ],
      ),
    ],
  )

/** At a page's end: the next step of its path, or the next path when this one is done. */
export const pathNext = (page: Page, h: H): Html => {
  const l = langOf(page.locale)
  const place = placeOf(page.locale, page.path)
  if (!place) return h.empty
  const steps = stepsOf(page.locale, place.path)
  const next = steps[place.index + 1]
  if (next) return nextCard(l.t.pathNav.next, next, h)
  const following = PATHS[PATHS.indexOf(place.path) + 1]
  const first = following ? stepsOf(page.locale, following)[0] : undefined
  return following && first
    ? nextCard(l.t.pathNav.nextPath(l.t.paths[following.id].title), first, h)
    : h.empty
}

/** A path on the home page: its progress, the step to take next, and where it goes. */
export const pathCard = (path: Path, model: Model, h: H): Html => {
  const l = langOf(model.locale)
  const copy = l.t.paths[path.id]
  const steps = stepsOf(model.locale, path)
  const read = steps.filter((step) => model.progress.visited.includes(step.path)).length
  const resume = resumeOf(model.locale, path, model.progress.visited)
  const target = resume ?? steps[0]
  const label = read === 0 ? l.t.pathNav.start : resume ? l.t.pathNav.continue : l.t.pathNav.again
  return h.article(
    [
      h.Key(path.id),
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          backgroundColor: 'var(--background)',
          padding: '1.25rem',
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
              gap: '0.75rem',
            }),
          ),
        ],
        [
          h.h3(
            [
              h.Class(
                css({
                  fontSize: '16px',
                  fontWeight: '600',
                  letterSpacing: '-0.025em',
                }),
              ),
            ],
            [copy.title],
          ),
          read === steps.length && steps.length > 0
            ? h.span(
                [
                  h.Class(
                    css({
                      display: 'grid',
                      width: '1.25rem',
                      height: '1.25rem',
                      flexShrink: '0',
                      placeItems: 'center',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--ok)',
                      color: 'white',
                    }),
                  ),
                ],
                [
                  icon(
                    h,
                    Check,
                    css({
                      width: '0.75rem',
                      height: '0.75rem',
                    }),
                  ),
                ],
              )
            : h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        flexShrink: '0',
                        fontSize: '12px',
                        color: 'var(--muted-foreground)',
                      }),
                    ),
                  ),
                ],
                [`${read}/${steps.length}`],
              ),
        ],
      ),
      h.p(
        [
          h.Class(
            css({
              fontSize: '14px',
              lineHeight: '1.375',
              textWrap: 'pretty',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [copy.summary],
      ),
      segments(l, steps, null, model, h),
      target
        ? h.a(
            [
              h.Href(target.path),
              h.Class(
                cx(
                  css({
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    borderRadius: 'md',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--border)',
                    paddingInline: '0.75rem',
                    paddingBlock: '0.5rem',
                    fontSize: '14px',
                    transitionProperty:
                      'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                    transitionDuration: '150ms',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    _hover: {
                      borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
                      backgroundColor: 'var(--well)',
                    },
                  }),
                  'group',
                ),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      minWidth: '0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          fontWeight: '500',
                        }),
                      ),
                    ],
                    [label],
                  ),
                  ...(label === l.t.pathNav.again
                    ? []
                    : [
                        h.span(
                          [
                            h.Class(
                              css({
                                color: 'var(--muted-foreground)',
                              }),
                            ),
                          ],
                          [` · ${target.title}`],
                        ),
                      ]),
                ],
              ),
              icon(
                h,
                ArrowRight,
                css({
                  width: '1rem',
                  height: '1rem',
                  flexShrink: '0',
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
        : h.empty,
    ],
  )
}
