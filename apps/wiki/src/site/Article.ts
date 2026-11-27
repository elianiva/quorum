import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { ArrowUpRight, ChevronRight, Coffee, Pencil } from 'lucide'
import { css, cx } from '@quorum/styled-system/css'
import { FIGURE } from '@quorum/ui/game/bits'
import { langOf } from '../i18n/lang.ts'
import { withLocale } from '../i18n/locale.ts'
import { KOFI, editUrl } from '../site.ts'
import { icon } from './icon.ts'
import { pageIn } from './pages.ts'
import { PathBar, PathNext } from './PathNav.ts'
import type { Page } from './page.ts'
import { prose } from './prose.ts'
import { quadrantBadge } from './quadrant.ts'
import { proseAt } from './content.ts'
import { eraPath } from './reference/shared.ts'

const breadcrumbs = <Msg>(page: Page<Msg>, h: H<Msg>): View.Content<Msg> => {
  const t = langOf(page.locale).t
  const parent = page.parent ? pageIn<Msg>(page.locale, page.parent) : null
  return h.div
    .class(
      css({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1.5',
        fontSize: 'type.13',
        color: 'mutedForeground',
      }),
    )
    .children(
      quadrantBadge(page.section, css({ width: '4', height: '4' }), h),
      h.span.children(t.quadrants[page.section].label),
      ...(parent
        ? [
            icon(h, ChevronRight, css({ width: '3.5', height: '3.5', opacity: 0.6 })),
            h.a
              .attr('href', parent.path)
              .class(css({ _hover: { color: 'foreground' } }))
              .children(parent.title),
          ]
        : []),
    )
}

const footer = <Msg>(page: Page<Msg>, h: H<Msg>): View.Content<Msg> => {
  const l = langOf(page.locale)
  const t = l.t.article
  const related = page.related.flatMap((path) => {
    const target = pageIn<Msg>(page.locale, path)
    return target ? [target] : []
  })
  return h.footer.class(css({ marginTop: '16' })).children(
    related.length
      ? h.div.class(css({ marginBottom: '10' })).children(
          h.div
            .class(css({ marginBottom: '3', fontSize: 'type.13', fontWeight: 'semibold' }))
            .children(t.seeAlso),
          h.ul
            .class(
              css({
                '& > * + *': {
                  borderTopWidth: '1px',
                  borderTopStyle: 'solid',
                  borderColor: 'border',
                },
                borderTopWidth: '1px',
                borderTopStyle: 'solid',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderColor: 'border',
              }),
            )
            .children(
              ...related.map((target) =>
                h.li.key(target.path).children(
                  h.a
                    .attr('href', target.path)
                    .class(
                      cx(
                        css({
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '4',
                          paddingBlock: '2.5',
                        }),
                        'group',
                      ),
                    )
                    .children(
                      h.span
                        .class(
                          css({
                            flexShrink: '0',
                            fontSize: 'type.14',
                            fontWeight: 'medium',
                            '.group:hover &': { textDecorationLine: 'underline' },
                          }),
                        )
                        .children(target.title),
                      h.span
                        .class(
                          css({
                            minWidth: '0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 'type.13',
                            color: 'mutedForeground',
                          }),
                        )
                        .children(target.summary),
                    ),
                ),
              ),
            ),
        )
      : h.span.children(),
    h.div
      .class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: '5',
          rowGap: '3',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderColor: 'border',
          paddingTop: '5',
          fontSize: 'type.12',
          color: 'mutedForeground',
        }),
      )
      .children(
        page.source
          ? h.a
              .attr('href', editUrl(page.source))
              .class(
                css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1.5',
                  _hover: { color: 'foreground' },
                }),
              )
              .children(icon(h, Pencil, css({ width: '3.5', height: '3.5' })), t.editOnGitHub)
          : h.span.children(),
        page.gdd
          ? h.a
              .attr('href', page.gdd)
              .class(
                css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1',
                  _hover: { color: 'foreground' },
                }),
              )
              .children(t.designNotes, icon(h, ArrowUpRight, css({ width: '3.5', height: '3.5' })))
          : h.span.children(),
        h.a
          .attr('href', KOFI)
          .class(
            css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '1.5',
              _hover: { color: 'foreground' },
            }),
          )
          .children(icon(h, Coffee, css({ width: '3.5', height: '3.5' })), t.support),
        h.span.class(css({ marginLeft: 'auto' })).children(
          t.disclaimerLead,
          h.a
            .attr('href', '/about/disclaimer')
            .class(
              css({
                textDecorationLine: 'underline',
                textUnderlineOffset: '2px',
                _hover: { color: 'foreground' },
              }),
            )
            .children(t.disclaimerLink),
          t.disclaimerMid,
          h.a
            .attr('href', '/about/changelog')
            .class(
              css({
                textDecorationLine: 'underline',
                textUnderlineOffset: '2px',
                _hover: { color: 'foreground' },
              }),
            )
            .children(t.changelogLink),
          l.t.reference.sentenceEnd,
        ),
      ),
  )
}

const notice = <Msg>(page: Page<Msg>, h: H<Msg>): View.Content<Msg> =>
  page.fallback
    ? h.p
        .attr('role', 'note')
        .class(
          css({
            marginBottom: '6',
            borderRadius: 'md',
            borderWidth: '1px',
            borderStyle: 'dashed',
            borderColor: 'border',
            paddingInline: '4',
            paddingBlock: '2.5',
            fontSize: 'type.13',
            color: 'mutedForeground',
          }),
        )
        .children(langOf(page.locale).t.article.untranslated)
    : h.span.children()

/**
 * One article page. A generated page supplies its own body; an authored page
 * renders the Markdown its content entry points at.
 */
export const Article = <Msg>(
  h: H<Msg>,
  page: Page<Msg>,
  rail: View.Content<Msg> | null,
  visited: ReadonlyArray<string>,
): View.Content<Msg> => {
  const l = langOf(page.locale)
  const found = page.body === null ? proseAt(page.locale, page.path, true) : null
  const body =
    page.body !== null
      ? page.body(h)
      : found === null
        ? h.span.children()
        : prose(h, page.locale, found.document, found.anchors ?? undefined)
  return h.main
    .attr('data-kind', page.section)
    .class(
      cx(
        css({ minWidth: '0', paddingBlock: '8' }),
        page.wide && css({ gridColumn: '1 / -1' }),
        rail !== null &&
          css({
            xl: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 16rem', columnGap: '8' },
          }),
      ),
    )
    .children(
      h.header
        .class(
          css({
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderColor: 'border',
            paddingBottom: '8',
            xl: { gridColumnStart: '1', gridRowStart: '1' },
          }),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '4',
              }),
            )
            .children(
              breadcrumbs(page, h),
              page.era !== null
                ? h.a
                    .attr('href', eraPath(page.era))
                    .class(
                      cx(
                        FIGURE,
                        css({
                          fontSize: 'type.12',
                          color: 'mutedForeground',
                          _hover: { color: 'foreground' },
                        }),
                      ),
                    )
                    .children(l.t.article.era(page.era, l.cat.ERAS[page.era]?.name ?? ''))
                : h.span.children(),
            ),
          h.h1
            .class(css({ marginTop: '4', textStyle: 'pageTitle', textWrap: 'balance' }))
            .children(page.title),
          h.p
            .class(
              css({
                marginTop: '2',
                fontSize: 'type.16',
                lineHeight: 'relaxed',
                textWrap: 'pretty',
                color: 'mutedForeground',
              }),
            )
            .children(page.summary),
          PathBar(h, page, visited),
        ),
      rail ?? h.span.children(),
      h.div
        .class(css({ paddingTop: '8', xl: { gridColumnStart: '1', gridRowStart: '2' } }))
        .children(
          notice(page, h),
          page.fallback ? h.div.attr('lang', 'en').children(body) : body,
          PathNext(h, page),
          footer(page, h),
        ),
    )
}

export const NotFound = <Msg>(
  h: H<Msg>,
  path: string,
  locale: Page<Msg>['locale'],
): View.Content<Msg> => {
  const t = langOf(locale).t.article.notFound
  return h.main
    .class(css({ marginInline: 'auto', maxWidth: '48rem', paddingInline: '4', paddingBlock: '16' }))
    .children(
      h.div
        .class(cx(FIGURE, css({ fontSize: 'type.13', color: 'mutedForeground' })))
        .children('404'),
      h.h1.class(css({ marginTop: '2', textStyle: 'pageTitle' })).children(t.heading),
      h.p
        .class(css({ marginTop: '2', fontSize: 'type.15', color: 'mutedForeground' }))
        .children(t.body(withLocale(locale, path))),
      h.a
        .attr('href', '/')
        .class(
          css({
            marginTop: '6',
            display: 'inline-block',
            fontSize: 'type.14',
            fontWeight: 'medium',
            textDecorationLine: 'underline',
            textUnderlineOffset: '4px',
          }),
        )
        .children(t.home),
    )
}
