import { Component, type View } from '@effect/ui'
import { Html } from '@effect/ui/html'
import type { H } from '@effect/ui/html/Html'
import {
  COMPONENTS,
  COMPONENT_IDS,
  ERAS,
  GLOSSARY,
  INCIDENT_IDS,
  researchList,
} from '@quorum/simulation/catalog'
import { SANDBOX_IDS } from '@quorum/simulation/sandbox-summary'
import { css, cx } from '@quorum/styled-system/css'
import { FIGURE } from '@quorum/ui/game/bits'
import { compact } from '@quorum/ui/game/format'
import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Gamepad2,
  GraduationCap,
  Info,
  Lightbulb,
  NotebookPen,
  Star,
  Wrench,
} from 'lucide'
import { Schema } from 'effect'
import { langOf } from '../i18n/lang.ts'
import type { Section } from '../frontmatter.ts'
import type { Page } from './page.ts'
import { navOf, pageIn } from './pages.ts'
import { PATHS, stepsOf, type Path } from './paths.ts'
import { KOFI, REPOSITORY } from '../site.ts'
import { componentBadge, groupBadge } from './badge.ts'
import { githubMark } from './github.ts'
import { GetProject, type ProjectStats } from './project.ts'
import { icon } from './icon.ts'

type H0 = H<never>
type P = Page<never>

const CANVAS = {
  backgroundImage: 'radial-gradient(var(--canvas-grid) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
} as const

const FIRST_TUTORIAL = '/tutorials/first-company'

const TROUBLE: ReadonlyArray<string> = [
  '/guides/find-the-bottleneck',
  '/guides/read-p99',
  '/guides/scale-the-database',
  '/guides/fix-slow-queries',
  '/guides/survive-a-traffic-spike',
  '/guides/stop-a-retry-storm',
]

const FLOW = ['users', 'lb', 'server', 'cache', 'database'] as const

const LINK = css({
  color: 'foreground',
  textDecorationLine: 'underline',
  textUnderlineOffset: '4px',
})

const SECTION = css({ marginTop: '12' })

const chip = css({ display: 'contents' })

const grid = (
  columns: string,
  items: ReadonlyArray<View.Content<never>>,
  h: H0,
): View.Content<never> =>
  h.div
    .class(
      cx(
        css({
          display: 'grid',
          gap: '0.25',
          overflow: 'hidden',
          borderRadius: 'lg',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'border',
          backgroundColor: 'border',
        }),
        columns,
      ),
    )
    .children(...items)

const block = (
  title: string,
  lead: string,
  content: View.Content<never>,
  h: H0,
): View.Content<never> =>
  h.section
    .class(SECTION)
    .children(
      h.h2.class(css({ textStyle: 'sectionTitle' })).children(title),
      h.p
        .class(css({ marginTop: '1', fontSize: 'type.14', color: 'mutedForeground' }))
        .children(lead),
      h.div.class(css({ marginTop: '4' })).children(content),
    )

const troubleLink = (target: P, h: H0): View.Content<never> =>
  h.a
    .key(target.path)
    .attr('href', target.path)
    .class(
      cx(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1',
          backgroundColor: 'background',
          padding: '5',
          transitionProperty:
            'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
          transitionDuration: 'fast',
          transitionTimingFunction: 'default',
          _hover: { backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)' },
        }),
        'group',
      ),
    )
    .children(
      h.span
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2',
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
              flexShrink: '0',
              color: 'mutedForeground',
              transitionProperty: 'transform, translate, scale, rotate',
              transitionDuration: 'fast',
              transitionTimingFunction: 'default',
              '.group:hover &': { translate: '0.125rem' },
            }),
          ),
        ),
      h.span
        .class(
          css({
            lineClamp: '2',
            fontSize: 'type.13',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(target.summary),
    )

const flow = (h: H0): View.Content<never> =>
  h.ol
    .attr('aria-hidden', 'true')
    .class(
      css({
        display: 'none',
        alignItems: 'flex-start',
        gap: '2',
        borderRadius: 'lg',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'border',
        backgroundColor: 'color-mix(in oklab, var(--background) 80%, transparent)',
        padding: '5',
        lg: { display: 'flex' },
      }),
    )
    .children(
      ...FLOW.flatMap((id, index) => [
        ...(index > 0
          ? [
              h.li
                .key(`to-${id}`)
                .class(
                  css({ marginTop: '18px', height: '1px', width: '6', backgroundColor: 'border' }),
                )
                .children(),
            ]
          : []),
        h.li
          .key(id)
          .class(
            css({
              display: 'flex',
              width: '14',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2',
            }),
          )
          .children(
            componentBadge(id, css({ width: '10', height: '10' }), h),
            h.span
              .class(cx(FIGURE, css({ fontSize: 'type.11', color: 'mutedForeground' })))
              .children(COMPONENTS[id].code),
          ),
      ]),
    )

const counts = (h: H0): View.Content<never> => {
  const t = langOf('en').t.home.counts
  const entries: ReadonlyArray<readonly [string, number, string]> = [
    ['/components', COMPONENT_IDS.length, t.components],
    ['/research', researchList.length, t.research],
    ['/eras', ERAS.length, t.eras],
    ['/incidents', INCIDENT_IDS.length, t.incidents],
    ['/sandboxes', SANDBOX_IDS.length, t.sandboxes],
    ['/glossary', GLOSSARY.length, t.terms],
  ]
  return h.ul
    .class(
      css({
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '0.25',
        overflow: 'hidden',
        borderRadius: 'lg',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'border',
        backgroundColor: 'border',
        sm: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
        lg: { gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' },
      }),
    )
    .children(
      ...entries.map(([path, value, label]) =>
        h.li
          .key(path)
          .class(chip)
          .children(
            h.a
              .attr('href', path)
              .class(
                cx(
                  css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1',
                    backgroundColor: 'background',
                    padding: '5',
                    transitionProperty:
                      'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                    transitionDuration: 'fast',
                    transitionTimingFunction: 'default',
                    _hover: {
                      backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
                    },
                  }),
                  'group',
                ),
              )
              .children(
                h.span
                  .class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.32',
                        lineHeight: 'none',
                        fontWeight: 'medium',
                      }),
                    ),
                  )
                  .children(String(value)),
                h.span
                  .class(
                    css({
                      fontSize: 'type.13',
                      color: 'mutedForeground',
                      '.group:hover &': { color: 'foreground' },
                    }),
                  )
                  .children(label),
              ),
          ),
      ),
    )
}

const SECTION_ICONS = {
  play: Gamepad2,
  tutorials: GraduationCap,
  guides: Wrench,
  explanation: Lightbulb,
  patterns: NotebookPen,
  reference: BookOpen,
  design: FileText,
  about: Info,
} as const

const SECTION_GROUPS = {
  play: 'edge',
  tutorials: 'edge',
  guides: 'compute',
  explanation: 'data',
  patterns: 'compute',
  reference: 'ops',
  design: 'ops',
  about: 'ops',
} as const

const kind = (section: Section, h: H0): View.Content<never> => {
  const l = langOf('en')
  return h.section
    .key(section)
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background',
        padding: '5',
      }),
    )
    .children(
      h.div
        .class(css({ display: 'flex', alignItems: 'center', gap: '2' }))
        .children(
          groupBadge(
            SECTION_GROUPS[section],
            SECTION_ICONS[section],
            css({ width: '5', height: '5' }),
            h,
            section === 'about',
          ),
          h.h3
            .class(css({ fontSize: 'type.15', fontWeight: 'semibold' }))
            .children(l.t.quadrants[section].label),
        ),
      h.p
        .class(css({ marginTop: '1', fontSize: 'type.13', color: 'mutedForeground' }))
        .children(l.t.quadrants[section].purpose),
      h.ul.class(css({ marginTop: '3', display: 'flex', flexDirection: 'column' })).children(
        ...navOf<never>('en', section)
          .slice(0, 6)
          .map((target) =>
            h.li.key(target.path).children(
              h.a
                .attr('href', target.path)
                .class(
                  css({
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingBlock: '1',
                    fontSize: 'type.14',
                    _hover: { textDecorationLine: 'underline' },
                  }),
                )
                .children(target.title),
            ),
          ),
      ),
    )
}

const segments = (steps: ReadonlyArray<Page>, h: H0): View.Content<never> =>
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
                css({
                  display: 'block',
                  height: '1.5',
                  borderRadius: 'full',
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 10%, transparent)',
                }),
              )
              .children(),
          ),
      ),
    )

const pathCard = (path: Path, h: H0): View.Content<never> => {
  const l = langOf('en')
  const copy = l.t.paths[path.id]
  const steps = stepsOf<never>('en', path)
  const target = steps[0]
  if (target === undefined) return h.span.children()
  const read = 0
  return h.article
    .key(path.id)
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        backgroundColor: 'background',
        padding: '5',
      }),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '3',
          }),
        )
        .children(
          h.h3
            .class(
              css({
                fontSize: 'type.16',
                fontWeight: 'semibold',
                letterSpacing: 'tight',
              }),
            )
            .children(copy.title),
          read === steps.length && steps.length > 0
            ? h.span
                .class(
                  css({
                    display: 'grid',
                    width: '5',
                    height: '5',
                    flexShrink: '0',
                    placeItems: 'center',
                    borderRadius: 'full',
                    backgroundColor: 'ok',
                    color: 'background',
                  }),
                )
                .children(icon(h, Check, css({ width: '3', height: '3' })))
            : h.span
                .class(
                  cx(
                    FIGURE,
                    css({ flexShrink: '0', fontSize: 'type.12', color: 'mutedForeground' }),
                  ),
                )
                .children(`${read}/${steps.length}`),
        ),
      h.p
        .class(
          css({
            fontSize: 'type.14',
            lineHeight: 'snug',
            textWrap: 'pretty',
            color: 'mutedForeground',
          }),
        )
        .children(copy.summary),
      segments(steps, h),
      h.a
        .attr('href', target.path)
        .class(
          cx(
            css({
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '3',
              borderRadius: 'md',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'border',
              paddingInline: '3',
              paddingBlock: '2',
              fontSize: 'type.14',
              transitionProperty:
                'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
              transitionDuration: 'fast',
              transitionTimingFunction: 'default',
              _hover: {
                borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
                backgroundColor: 'well',
              },
            }),
            'group',
          ),
        )
        .children(
          h.span
            .class(
              css({
                minWidth: '0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }),
            )
            .children(
              h.span.class(css({ fontWeight: 'medium' })).children(l.t.pathNav.start),
              h.span.class(css({ color: 'mutedForeground' })).children(` · ${target.title}`),
            ),
          icon(
            h,
            ArrowRight,
            css({
              width: '4',
              height: '4',
              flexShrink: '0',
              transitionProperty: 'transform, translate, scale, rotate',
              transitionDuration: 'fast',
              transitionTimingFunction: 'default',
              '.group:hover &': { translate: '0.125rem' },
            }),
          ),
        ),
    )
}

const statCell = (value: string, label: string, h: H0): View.Content<never> =>
  h.div
    .key(label)
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1',
        backgroundColor: 'background',
        paddingInline: '4',
        paddingBlock: '3.5',
      }),
    )
    .children(
      h.span
        .class(
          cx(
            FIGURE,
            css({
              fontSize: 'type.20',
              lineHeight: 'none',
              fontWeight: 'medium',
              fontVariantNumeric: 'tabular-nums',
            }),
          ),
        )
        .children(value),
      h.span.class(css({ fontSize: 'type.12', color: 'mutedForeground' })).children(label),
    )

const projectCard = (stats: ProjectStats | null, h: H0): View.Content<never> => {
  const t = langOf('en').t.project
  const cells =
    stats === null
      ? []
      : [
          [compact(stats.stars), t.stars],
          [compact(stats.forks), t.forks],
          [compact(stats.contributors), t.contributors],
          [compact(stats.issues), t.issues],
        ]
  return h.div
    .attr('data-lazy-island', '')
    .class(
      css({
        overflow: 'hidden',
        borderRadius: 'lg',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'border',
        backgroundColor: 'background',
      }),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            rowGap: '4',
            columnGap: '6',
            padding: '5',
          }),
        )
        .children(
          h.div
            .class(css({ display: 'flex', minWidth: '0', alignItems: 'flex-start', gap: '3' }))
            .children(
              h.span
                .class(
                  css({
                    display: 'grid',
                    width: '10',
                    height: '10',
                    flexShrink: '0',
                    placeItems: 'center',
                    borderRadius: 'md',
                    backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
                  }),
                )
                .children(githubMark(h, css({ width: '5', height: '5' }))),
              h.div.class(css({ minWidth: '0' })).children(
                h.a
                  .attr('href', REPOSITORY)
                  .class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.14',
                        fontWeight: 'medium',
                        _hover: { textDecorationLine: 'underline' },
                        textUnderlineOffset: '4px',
                      }),
                    ),
                  )
                  .children('elianiva/quorum'),
                h.p
                  .class(
                    css({
                      marginTop: '1',
                      maxWidth: '96',
                      fontSize: 'type.13',
                      lineHeight: 'snug',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(t.blurb),
              ),
            ),
          h.div
            .class(css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3' }))
            .children(
              h.a
                .attr('href', REPOSITORY)
                .class(
                  css({
                    display: 'inline-flex',
                    height: '9',
                    alignItems: 'center',
                    gap: '2',
                    borderRadius: 'md',
                    backgroundColor: 'foreground',
                    paddingInline: '3',
                    fontSize: 'type.13',
                    fontWeight: 'medium',
                    color: 'background',
                    _hover: { opacity: 0.9 },
                  }),
                )
                .children(icon(h, Star, css({ width: '3.5', height: '3.5' })), t.star),
              h.a
                .attr('href', '/about/contributing')
                .class(
                  css({
                    fontSize: 'type.13',
                    color: 'mutedForeground',
                    textDecorationLine: 'underline',
                    textUnderlineOffset: '4px',
                    _hover: { color: 'foreground' },
                  }),
                )
                .children(t.contribute),
            ),
        ),
      stats !== null &&
        h.div
          .class(
            css({
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '0.25',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'border',
              backgroundColor: 'border',
              sm: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
            }),
          )
          .children(...cells.map(([value, label]) => statCell(value!, label!, h))),
      h.p
        .class(
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
            fontSize: 'type.12',
            color: 'mutedForeground',
          }),
        )
        .children(
          h.a
            .attr('href', `${REPOSITORY}/blob/main/LICENSE`)
            .class(
              css({
                textDecorationLine: 'underline',
                textUnderlineOffset: '2px',
                _hover: { color: 'foreground' },
              }),
            )
            .children(stats?.license ?? 'GPL-3.0'),
          h.span.attr('aria-hidden', 'true').children('·'),
          h.span.children(t.source(stats?.language ?? 'TypeScript')),
        ),
    )
}

const HomePageNoDeps = Html.component({
  name: 'HomePage',
  model: Schema.Struct({}),
  message: Schema.Never,
  queries: { project: { query: GetProject, args: () => ({}) } },
}).make({
  init: () => ({}),
  update: ($) => $.model,
  view: (h) => {
    const l = langOf('en')
    const t = l.t.home
    const page = pageIn<never>('en', '/')
    if (page === null) return h.main.children()
    const trouble = TROUBLE.flatMap((path) => {
      const target = pageIn<never>('en', path)
      return target ? [target] : []
    })
    const result = h.queries.project
    const project = result._tag === 'Success' ? result.value : null
    return h.main.class(css({ minWidth: '0', paddingBottom: '16' })).children(
      h.header
        .class(
          css({
            marginTop: '8',
            display: 'grid',
            alignItems: 'center',
            gap: '10',
            overflow: 'hidden',
            borderRadius: 'xl',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'border',
            backgroundColor: 'canvas',
            paddingInline: '6',
            paddingBlock: '12',
            sm: { paddingInline: '10' },
            lg: { gridTemplateColumns: 'minmax(0,1fr) auto', paddingBlock: '16' },
          }),
        )
        .style(CANVAS)
        .children(
          h.div.class(css({ minWidth: '0' })).children(
            h.h1.class(css({ textStyle: 'display', textWrap: 'balance' })).children(t.heroTitle),
            h.p
              .class(
                css({
                  marginTop: '4',
                  fontSize: 'type.16',
                  lineHeight: 'relaxed',
                  textWrap: 'pretty',
                  color: 'mutedForeground',
                }),
              )
              .children(page.summary),
            h.div
              .class(
                css({
                  marginTop: '7',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '3',
                }),
              )
              .children(
                pageIn<never>('en', FIRST_TUTORIAL) !== null &&
                  h.a
                    .attr('href', FIRST_TUTORIAL)
                    .class(
                      css({
                        display: 'inline-flex',
                        height: '10',
                        alignItems: 'center',
                        gap: '2',
                        borderRadius: 'md',
                        backgroundColor: 'foreground',
                        paddingInline: '4',
                        fontSize: 'type.14',
                        fontWeight: 'medium',
                        color: 'background',
                        _hover: { opacity: 0.9 },
                      }),
                    )
                    .children(t.start, icon(h, ArrowRight, css({ width: '4', height: '4' }))),
                h.a
                  .attr('href', '/components')
                  .class(
                    css({
                      display: 'inline-flex',
                      height: '10',
                      alignItems: 'center',
                      gap: '2',
                      borderRadius: 'md',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'border',
                      backgroundColor: 'background',
                      paddingInline: '4',
                      fontSize: 'type.14',
                      fontWeight: 'medium',
                      _hover: {
                        borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
                      },
                    }),
                  )
                  .children(icon(h, BookOpen, css({ width: '4', height: '4' })), t.browse),
                h.a
                  .attr('href', REPOSITORY)
                  .class(
                    css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '1.5',
                      fontSize: 'type.13',
                      color: 'mutedForeground',
                      textDecorationLine: 'underline',
                      textUnderlineOffset: '4px',
                      _hover: { color: 'foreground' },
                    }),
                  )
                  .children(githubMark(h, css({ width: '3.5', height: '3.5' })), t.openSource),
              ),
          ),
          flow(h),
        ),
      h.div.class(css({ marginTop: '8' })).children(counts(h)),
      block(
        t.trouble.title,
        t.trouble.lead,
        grid(
          css({
            sm: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
            lg: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
          }),
          trouble.map((target) => troubleLink(target, h)),
          h,
        ),
        h,
      ),
      block(
        t.guided.title,
        t.guided.lead,
        grid(
          css({
            md: {
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              '& > :last-child:nth-child(odd)': { gridColumn: 'span 2 / span 2' },
            },
          }),
          PATHS.filter((path) => stepsOf<never>('en', path).length > 0).map((path) =>
            pathCard(path, h),
          ),
          h,
        ),
        h,
      ),
      block(
        t.kinds.title,
        t.kinds.lead,
        grid(
          css({
            sm: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
            xl: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
          }),
          (['play', 'tutorials', 'guides', 'explanation', 'patterns', 'reference'] as const).map(
            (section) => kind(section, h),
          ),
          h,
        ),
        h,
      ),
      block(t.open.title, t.open.lead, projectCard(project, h), h),
      h.p
        .class(
          css({
            marginTop: '8',
            maxWidth: '48rem',
            fontSize: 'type.13',
            lineHeight: 'relaxed',
            color: 'mutedForeground',
          }),
        )
        .children(
          t.footer.before,
          h.a.attr('href', '/design').class(LINK).children(t.footer.design),
          t.footer.afterDesign,
          h.a.attr('href', '/about/changelog').class(LINK).children(t.footer.changelog),
          t.footer.afterChangelog,
          h.a.attr('href', '/about/disclaimer').class(LINK).children(t.footer.disclaimer),
          t.footer.afterDisclaimer,
          h.a.attr('href', KOFI).class(LINK).children(t.footer.kofi),
          t.footer.end,
        ),
    )
  },
})

export const HomePage = HomePageNoDeps.pipe(Component.provide(GetProject.layer))
