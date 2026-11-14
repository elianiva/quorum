import type { Html, HtmlBuilder } from 'foldkit/html'
import { ArrowRight, BookOpen } from 'lucide'
import {
  COMPONENTS,
  COMPONENT_IDS,
  ERAS,
  type ComponentId,
  GLOSSARY,
  INCIDENT_IDS,
  researchList,
} from '@quorum/simulation/catalog'
import { SANDBOX_IDS } from '@quorum/simulation/sandbox'
import { FIGURE } from '@quorum/ui/game/bits'
import { githubMark } from '@quorum/ui/primitives/github'
import { icon } from '@quorum/ui/primitives/icon'
import type { Section } from '../frontmatter.ts'
import { langOf, type Lang } from '../i18n/lang.ts'
import type { Message, Model } from '../main.ts'
import type { Page } from '../page.ts'
import { navOf, pageIn } from '../pages.ts'
import { PATHS, stepsOf } from '../paths.ts'
import { KOFI, REPOSITORY } from '../site.ts'
import { componentBadge } from '../reference/components.ts'
import { pathCard } from './path-nav.ts'
import { projectCard } from './project.ts'
import { quadrantBadge } from './quadrant.ts'
import { css, cx, cx as cn } from '@quorum/styled-system/css'

/* The home page: what the wiki is, the guided paths, then the four kinds of page and the catalog. */

type H = HtmlBuilder<Message>

/** One kind of page: its badge, what it is for, and its first pages. */
const kind = (l: Lang, section: Section, h: H): Html =>
  h.section(
    [
      h.Key(section),
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
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
              alignItems: 'center',
              gap: '0.5rem',
            }),
          ),
        ],
        [
          quadrantBadge(
            section,
            css({
              width: '1.25rem',
              height: '1.25rem',
            }),
            h,
          ),
          h.h3(
            [
              h.Class(
                css({
                  fontSize: '15px',
                  fontWeight: '600',
                }),
              ),
            ],
            [l.t.quadrants[section].label],
          ),
        ],
      ),
      h.p(
        [
          h.Class(
            css({
              marginTop: '0.25rem',
              fontSize: '13px',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [l.t.quadrants[section].purpose],
      ),
      h.ul(
        [
          h.Class(
            css({
              marginTop: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
            }),
          ),
        ],
        navOf(l.locale, section)
          .slice(0, 6)
          .map((target) =>
            h.li(
              [h.Key(target.path)],
              [
                h.a(
                  [
                    h.Href(target.path),
                    h.Class(
                      css({
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingBlock: '0.25rem',
                        fontSize: '14px',
                        _hover: {
                          textDecorationLine: 'underline',
                        },
                      }),
                    ),
                  ],
                  [target.title],
                ),
              ],
            ),
          ),
      ),
    ],
  )

const counts = (l: Lang, h: H): Html => {
  const t = l.t.home.counts
  const entries: ReadonlyArray<Readonly<{ path: string; value: number; label: string }>> = [
    { path: '/components', value: COMPONENT_IDS.length, label: t.components },
    { path: '/research', value: researchList.length, label: t.research },
    { path: '/eras', value: ERAS.length, label: t.eras },
    { path: '/incidents', value: INCIDENT_IDS.length, label: t.incidents },
    { path: '/sandboxes', value: SANDBOX_IDS.length, label: t.sandboxes },
    { path: '/glossary', value: GLOSSARY.length, label: t.terms },
  ]
  return countList(entries, h)
}

/** The catalog as six lookups: a number and where it leads. */
const countList = (
  entries: ReadonlyArray<Readonly<{ path: string; value: number; label: string }>>,
  h: H,
): Html =>
  h.dl(
    [
      h.Class(
        css({
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '1px',
          overflow: 'hidden',
          borderRadius: 'lg',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--border)',
          backgroundColor: 'var(--border)',
          sm: {
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          },
          lg: {
            gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          },
        }),
      ),
    ],
    entries.map((entry) =>
      h.a(
        [
          h.Key(entry.path),
          h.Href(entry.path),
          h.Class(
            cx(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                backgroundColor: 'var(--background)',
                padding: '1.25rem',
                transitionProperty:
                  'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                transitionDuration: '150ms',
                transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                _hover: {
                  backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
                },
              }),
              'group',
            ),
          ),
        ],
        [
          h.dd(
            [
              h.Class(
                cn(
                  FIGURE,
                  css({
                    fontSize: '32px',
                    lineHeight: '1',
                    fontWeight: '500',
                  }),
                ),
              ),
            ],
            [String(entry.value)],
          ),
          h.dt(
            [
              h.Class(
                css({
                  fontSize: '13px',
                  color: 'var(--muted-foreground)',
                  '.group:hover &': {
                    color: 'var(--foreground)',
                  },
                }),
              ),
            ],
            [entry.label],
          ),
        ],
      ),
    ),
  )

const FIRST_TUTORIAL = '/tutorials/first-company'

/** Guides a reader opens with a problem in hand, most common first. */
const TROUBLE: ReadonlyArray<string> = [
  '/guides/find-the-bottleneck',
  '/guides/read-p99',
  '/guides/scale-the-database',
  '/guides/fix-slow-queries',
  '/guides/survive-a-traffic-spike',
  '/guides/stop-a-retry-storm',
]

const grid = (columns: string, items: ReadonlyArray<Html>, h: H): Html =>
  h.div(
    [
      h.Class(
        cn(
          css({
            display: 'grid',
            gap: '1px',
            overflow: 'hidden',
            borderRadius: 'lg',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            backgroundColor: 'var(--border)',
          }),
          columns,
        ),
      ),
    ],
    items,
  )

/** A heading with the sentence that says what the block is for, under it. */
const block = (title: string, lead: string, content: Html, h: H): Html =>
  h.section(
    [
      h.Class(
        css({
          marginTop: '3rem',
        }),
      ),
    ],
    [
      h.h2(
        [
          h.Class(
            css({
              fontSize: '20px',
              fontWeight: '600',
              letterSpacing: '-0.025em',
            }),
          ),
        ],
        [title],
      ),
      h.p(
        [
          h.Class(
            css({
              marginTop: '0.25rem',
              fontSize: '14px',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [lead],
      ),
      h.div(
        [
          h.Class(
            css({
              marginTop: '1rem',
            }),
          ),
        ],
        [content],
      ),
    ],
  )

const troubleLink = (target: Page, h: H): Html =>
  h.a(
    [
      h.Key(target.path),
      h.Href(target.path),
      h.Class(
        cx(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            backgroundColor: 'var(--background)',
            padding: '1.25rem',
            transitionProperty:
              'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
            transitionDuration: '150ms',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            _hover: {
              backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
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
      ),
      h.span(
        [
          h.Class(
            css({
              lineClamp: '2',
              fontSize: '13px',
              lineHeight: '1.375',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [target.summary],
      ),
    ],
  )

/** The board's dotted canvas, as the backdrop of the hero. */
const CANVAS = {
  backgroundImage: 'radial-gradient(var(--canvas-grid) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
}

/** A request's way through a small Design, drawn with the game's own badges. */
const FLOW: ReadonlyArray<ComponentId> = ['users', 'lb', 'server', 'cache', 'database']

const flow = (h: H): Html =>
  h.ol(
    [
      h.AriaHidden(true),
      h.Class(
        css({
          display: 'none',
          alignItems: 'flex-start',
          gap: '0.5rem',
          borderRadius: 'lg',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--border)',
          backgroundColor: 'color-mix(in oklab, var(--background) 80%, transparent)',
          padding: '1.25rem',
          lg: {
            display: 'flex',
          },
        }),
      ),
    ],
    FLOW.flatMap((id, index) => [
      ...(index > 0
        ? [
            h.li(
              [
                h.Key(`to-${id}`),
                h.Class(
                  css({
                    marginTop: '18px',
                    height: '1px',
                    width: '1.5rem',
                    backgroundColor: 'var(--border)',
                  }),
                ),
              ],
              [],
            ),
          ]
        : []),
      h.li(
        [
          h.Key(id),
          h.Class(
            css({
              display: 'flex',
              width: '3.5rem',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
            }),
          ),
        ],
        [
          componentBadge(
            id,
            css({
              width: '2.5rem',
              height: '2.5rem',
            }),
            h,
          ),
          h.span(
            [
              h.Class(
                cn(
                  FIGURE,
                  css({
                    fontSize: '11px',
                    color: 'var(--muted-foreground)',
                  }),
                ),
              ),
            ],
            [COMPONENTS[id].code],
          ),
        ],
      ),
    ]),
  )

export const homeView = (page: Page, model: Model, h: H): Html => {
  const l = langOf(model.locale)
  const t = l.t.home
  const trouble = TROUBLE.flatMap((path) => {
    const target = pageIn(model.locale, path)
    return target ? [target] : []
  })
  return h.div(
    [
      h.Class(
        css({
          minWidth: '0',
          paddingBottom: '4rem',
          lg: {
            gridColumn: 'span 2 / span 2',
          },
          xl: {
            gridColumn: 'span 3 / span 3',
          },
        }),
      ),
    ],
    [
      h.header(
        [
          h.Class(
            css({
              marginTop: '2rem',
              display: 'grid',
              alignItems: 'center',
              gap: '2.5rem',
              overflow: 'hidden',
              borderRadius: 'xl',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--border)',
              backgroundColor: 'var(--canvas)',
              paddingInline: '1.5rem',
              paddingBlock: '3rem',
              sm: {
                paddingInline: '2.5rem',
              },
              lg: {
                gridTemplateColumns: 'minmax(0,1fr) auto',
                paddingBlock: '4rem',
              },
            }),
          ),
          h.Style(CANVAS),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  minWidth: '0',
                }),
              ),
            ],
            [
              h.h1(
                [
                  h.Class(
                    css({
                      fontSize: '44px',
                      lineHeight: '1.05',
                      fontWeight: '600',
                      letterSpacing: '-0.035em',
                      textWrap: 'balance',
                    }),
                  ),
                ],
                [t.heroTitle],
              ),
              h.p(
                [
                  h.Class(
                    css({
                      marginTop: '1rem',
                      fontSize: '16px',
                      lineHeight: '1.625',
                      textWrap: 'pretty',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                ],
                [page.summary],
              ),
              h.div(
                [
                  h.Class(
                    css({
                      marginTop: '1.75rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }),
                  ),
                ],
                [
                  pageIn(model.locale, FIRST_TUTORIAL)
                    ? h.a(
                        [
                          h.Href(FIRST_TUTORIAL),
                          h.Class(
                            css({
                              display: 'inline-flex',
                              height: '2.5rem',
                              alignItems: 'center',
                              gap: '0.5rem',
                              borderRadius: 'md',
                              backgroundColor: 'var(--foreground)',
                              paddingInline: '1rem',
                              fontSize: '14px',
                              fontWeight: '500',
                              color: 'var(--background)',
                              _hover: {
                                opacity: 0.9,
                              },
                            }),
                          ),
                        ],
                        [
                          t.start,
                          icon(
                            h,
                            ArrowRight,
                            css({
                              width: '1rem',
                              height: '1rem',
                            }),
                          ),
                        ],
                      )
                    : h.empty,
                  h.a(
                    [
                      h.Href('/components'),
                      h.Class(
                        css({
                          display: 'inline-flex',
                          height: '2.5rem',
                          alignItems: 'center',
                          gap: '0.5rem',
                          borderRadius: 'md',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'var(--border)',
                          backgroundColor: 'var(--background)',
                          paddingInline: '1rem',
                          fontSize: '14px',
                          fontWeight: '500',
                          _hover: {
                            borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
                          },
                        }),
                      ),
                    ],
                    [
                      icon(
                        h,
                        BookOpen,
                        css({
                          width: '1rem',
                          height: '1rem',
                        }),
                      ),
                      t.browse,
                    ],
                  ),
                  h.a(
                    [
                      h.Href(REPOSITORY),
                      // The third action is a link, not a button, so the row does not wrap.
                      h.Class(
                        css({
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          fontSize: '13px',
                          color: 'var(--muted-foreground)',
                          textDecorationLine: 'underline',
                          textUnderlineOffset: '4px',
                          _hover: {
                            color: 'var(--foreground)',
                          },
                        }),
                      ),
                    ],
                    [
                      githubMark(
                        h,
                        css({
                          width: '0.875rem',
                          height: '0.875rem',
                        }),
                      ),
                      t.openSource,
                    ],
                  ),
                ],
              ),
            ],
          ),
          flow(h),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              marginTop: '2rem',
            }),
          ),
        ],
        [counts(l, h)],
      ),
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
          PATHS.filter((path) => stepsOf(model.locale, path).length > 0).map((path) =>
            pathCard(path, model, h),
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
            (section) => kind(l, section, h),
          ),
          h,
        ),
        h,
      ),
      block(t.open.title, t.open.lead, projectCard(model.project, h), h),
      h.p(
        [
          h.Class(
            css({
              marginTop: '2rem',
              maxWidth: '48rem',
              fontSize: '13px',
              lineHeight: '1.625',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [
          t.footer.before,
          h.a(
            [
              h.Href('/design'),
              h.Class(
                css({
                  color: 'var(--foreground)',
                  textDecorationLine: 'underline',
                  textUnderlineOffset: '4px',
                }),
              ),
            ],
            [t.footer.design],
          ),
          t.footer.afterDesign,
          h.a(
            [
              h.Href('/about/changelog'),
              h.Class(
                css({
                  color: 'var(--foreground)',
                  textDecorationLine: 'underline',
                  textUnderlineOffset: '4px',
                }),
              ),
            ],
            [t.footer.changelog],
          ),
          t.footer.afterChangelog,
          h.a(
            [
              h.Href('/about/disclaimer'),
              h.Class(
                css({
                  color: 'var(--foreground)',
                  textDecorationLine: 'underline',
                  textUnderlineOffset: '4px',
                }),
              ),
            ],
            [t.footer.disclaimer],
          ),
          t.footer.afterDisclaimer,
          h.a(
            [
              h.Href(KOFI),
              h.Class(
                css({
                  color: 'var(--foreground)',
                  textDecorationLine: 'underline',
                  textUnderlineOffset: '4px',
                }),
              ),
            ],
            [t.footer.kofi],
          ),
          t.footer.end,
        ],
      ),
    ],
  )
}
