import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { ArrowRight } from 'lucide'
import { css, cx } from '@quorum/styled-system/css'
import { FIGURE } from '@quorum/ui/game/bits'
import { langOf } from '../i18n/lang.ts'
import { icon } from './icon.ts'
import { PATHS, placeOf, stepsOf } from './paths.ts'
import type { Page } from './page.ts'
import { quadrantColor } from './quadrant.ts'

const segments = <Msg>(
  steps: ReadonlyArray<Page<Msg>>,
  current: string | null,
  visited: ReadonlyArray<string>,
  h: H<Msg>,
): View.Content<Msg> =>
  h.ol
    .attr('aria-hidden', 'true')
    .class(css({ display: 'flex', gap: '1' }))
    .children(
      ...steps.map((step) =>
        h.li
          .key(step.path)
          .class(css({ flex: '1 1 0%' }))
          .children(
            h.span
              .class(
                cx(
                  css({
                    display: 'block',
                    height: '1.5',
                    borderRadius: 'full',
                    transitionProperty:
                      'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                    transitionDuration: 'fast',
                    transitionTimingFunction: 'default',
                  }),
                  step.path === current
                    ? css({})
                    : visited.includes(step.path)
                      ? css({
                          backgroundColor:
                            'color-mix(in oklab, var(--foreground) 45%, transparent)',
                        })
                      : css({
                          backgroundColor:
                            'color-mix(in oklab, var(--foreground) 10%, transparent)',
                        }),
                ),
              )
              .style(step.path === current ? { background: quadrantColor(step.section) } : {})
              .children(),
          ),
      ),
    )

export const PathBar = <Msg>(
  h: H<Msg>,
  page: Page<Msg>,
  visited: ReadonlyArray<string>,
): View.Content<Msg> => {
  const l = langOf(page.locale)
  const place = placeOf<Msg>(page.locale, page.path)
  if (place === null) return h.span.children()
  const steps = stepsOf<Msg>(page.locale, place.path)
  const title = l.t.paths[place.path.id].title
  return h.nav
    .attr('aria-label', l.t.pathNav.guidedPath(title))
    .class(css({ marginTop: '6' }))
    .children(
      h.div
        .class(
          css({
            marginBottom: '2',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '3',
          }),
        )
        .children(
          h.span
            .class(css({ fontSize: 'type.12', color: 'mutedForeground' }))
            .children(l.t.pathNav.path(title)),
          h.span
            .class(cx(FIGURE, css({ fontSize: 'type.12', color: 'mutedForeground' })))
            .children(l.t.pathNav.place(place.index + 1, steps.length)),
        ),
      segments(steps, page.path, visited, h),
    )
}

const nextCard = <Msg>(label: string, target: Page<Msg>, h: H<Msg>): View.Content<Msg> =>
  h.div.class(css({ marginTop: '14', display: 'flex', justifyContent: 'flex-end' })).children(
    h.a
      .attr('href', target.path)
      .class(
        cx(
          css({
            display: 'flex',
            width: '100%',
            maxWidth: '96',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '1',
            borderRadius: 'lg',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'border',
            paddingInline: '4',
            paddingBlock: '3',
            textAlign: 'right',
            transitionProperty:
              'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
            transitionDuration: 'fast',
            transitionTimingFunction: 'default',
            _hover: { borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)' },
          }),
          'group',
        ),
      )
      .children(
        h.span.class(css({ fontSize: 'type.12', color: 'mutedForeground' })).children(label),
        h.span
          .class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '1.5',
              fontSize: 'type.15',
              fontWeight: 'medium',
            }),
          )
          .children(
            target.title,
            icon(
              h,
              ArrowRight,
              css({
                width: '4',
                height: '4',
                transitionProperty: 'transform, translate, scale, rotate',
                transitionDuration: 'fast',
                transitionTimingFunction: 'default',
                '.group:hover &': { translate: '0.125rem' },
              }),
            ),
          ),
      ),
  )

export const PathNext = <Msg>(h: H<Msg>, page: Page<Msg>): View.Content<Msg> => {
  const l = langOf(page.locale)
  const place = placeOf<Msg>(page.locale, page.path)
  if (place === null) return h.span.children()
  const steps = stepsOf<Msg>(page.locale, place.path)
  const next = steps[place.index + 1]
  if (next !== undefined) return nextCard(l.t.pathNav.next, next, h)
  const following = PATHS[PATHS.indexOf(place.path) + 1]
  const first = following === undefined ? undefined : stepsOf<Msg>(page.locale, following)[0]
  return following !== undefined && first !== undefined
    ? nextCard(l.t.pathNav.nextPath(l.t.paths[following.id].title), first, h)
    : h.span.children()
}
