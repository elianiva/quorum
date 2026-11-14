import type { Html } from 'foldkit/html'
import { Maximize2, Minimize2, type IconNode } from 'lucide'
import {
  COMPONENT_IDS,
  INSIGHT_POOLS,
  researchList,
  type ResearchDef,
} from '@quorum/simulation/catalog'
import { BY_RESEARCH } from '@quorum/simulation/term-links'
import { EYEBROW, FIGURE, SCROLL, insightChip } from '@quorum/ui/game/bits'
import { compact } from '@quorum/ui/game/format'
import { POOL_ICONS, poolColor, recipeOf } from '@quorum/ui/game/pools'
import { NODE_SIZE, researchLayout } from '@quorum/ui/game/research-layouts'
import { TRACK_ICONS, researchMark } from '@quorum/ui/game/research-marks'
import { icon } from '@quorum/ui/primitives/icon'
import type { Page } from '../page.ts'
import {
  authored,
  eraName,
  eraPath,
  factsBox,
  headingsFor,
  link,
  linkList,
  page,
  paragraph,
  researchLink,
  researchPath,
  section,
  termsSection,
  type H,
  type Lang,
} from './shared.ts'
import { componentPath } from './components.ts'
import { css, cx } from '@quorum/styled-system/css'

/* One page per Research item, and the Research tree as the hub. Layout and marks are the game's. */

const trackLabel = (l: Lang, track: ResearchDef['track']): string =>
  l.cat.RESEARCH_TRACKS.find((entry) => entry.key === track)?.label ?? track

/** An Insight pool's name in the page's language, such as "Checkout Insight". */
const poolLabel = (l: Lang, pool: (typeof INSIGHT_POOLS)[number]): string =>
  l.t.reference.research.insightName(l.cat.POOLS[pool].label)

const chip = (l: Lang, pool: (typeof INSIGHT_POOLS)[number], figure: string, h: H): Html =>
  insightChip(pool, figure, h, false, 'plain', poolLabel(l, pool))

const recipe = (l: Lang, entry: ResearchDef, h: H): Html =>
  h.span(
    [
      h.Class(
        css({
          display: 'inline-flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '2',
        }),
      ),
    ],
    recipeOf(entry.id).map(([pool, cost]) => chip(l, pool, compact(cost), h)),
  )

const unlocksOf = (
  l: Lang,
  entry: ResearchDef,
): ReadonlyArray<Readonly<{ path: string; text: string }>> => [
  ...COMPONENT_IDS.filter((id) => l.cat.COMPONENTS[id].unlock === entry.id).map((id) => ({
    path: componentPath(id),
    text: l.cat.COMPONENTS[id].name,
  })),
  ...Object.values(l.cat.RUNTIMES)
    .filter((runtime) => runtime.research === entry.id)
    .map((runtime) => ({ path: `/runtimes/${runtime.id}`, text: runtime.name })),
  ...Object.values(l.cat.TASKS)
    .filter((task) => task.research === entry.id)
    .map((task) => ({ path: '/team#tasks', text: l.t.reference.research.task(task.name) })),
  ...Object.values(l.cat.FEATURES)
    .filter((feature) => feature.research === entry.id)
    .map((feature) => ({
      path: '/team#features',
      text: l.t.reference.research.feature(feature.name),
    })),
]

const entity = (l: Lang, entry: ResearchDef): Page => {
  const t = l.t.reference.research
  const path = researchPath(entry.id)
  const text = authored(l, path)
  const followUps = researchList.filter((candidate) => candidate.requires.includes(entry.id))
  const unlocks = unlocksOf(l, entry)
  const prevents = Object.values(l.cat.INCIDENTS).filter((incident) =>
    incident.actions.includes(entry.id),
  )
  return page(l, {
    path,
    title: entry.name,
    summary: entry.blurb,
    parent: '/research',
    order: researchList.findIndex((candidate) => candidate.id === entry.id),
    era: entry.era,
    aliases: [entry.id, trackLabel(l, entry.track)],
    source: text.source,
    fallback: text.fallback,
    headings: [
      ...text.headings,
      ...headingsFor([
        unlocks.length ? l.title('whatItUnlocks') : null,
        l.title('prerequisites'),
        prevents.length ? l.title('incidentsItPrevents') : null,
        BY_RESEARCH[entry.id]?.length ? l.title('engineeringTerms') : null,
      ]),
    ],
    text: `${entry.blurb} ${text.text}`,
    aside: (_model, h) =>
      factsBox(
        l,
        entry.name,
        researchMark(entry, 'sm', false, h),
        null,
        [
          { name: t.track, value: trackLabel(l, entry.track) },
          { name: t.era, value: link(eraPath(entry.era), eraName(l, entry.era), h) },
          { name: t.cost, value: recipe(l, entry, h) },
          {
            name: t.requires,
            value: linkList(
              entry.requires.map((id) => researchLink(l, id, h)),
              h,
            ),
          },
        ],
        h,
      ),
    body: (model, h) =>
      h.div(
        [h.Class('prose')],
        [
          ...(text.view ? [text.view(model, h)] : []),
          unlocks.length
            ? section(
                l.title('whatItUnlocks'),
                [
                  h.p(
                    [],
                    [
                      linkList(
                        unlocks.map((item) => link(item.path, item.text, h)),
                        h,
                      ),
                    ],
                  ),
                ],
                h,
              )
            : h.empty,
          section(
            l.title('prerequisites'),
            [
              h.p(
                [],
                entry.requires.length
                  ? [
                      t.prerequisitesIntro,
                      linkList(
                        entry.requires.map((id) => researchLink(l, id, h)),
                        h,
                      ),
                      l.t.reference.sentenceEnd,
                    ]
                  : [t.root(trackLabel(l, entry.track))],
              ),
              ...(followUps.length
                ? [
                    h.p(
                      [],
                      [
                        t.leadsTo,
                        linkList(
                          followUps.map((next) => researchLink(l, next.id, h)),
                          h,
                        ),
                        l.t.reference.sentenceEnd,
                      ],
                    ),
                  ]
                : []),
            ],
            h,
          ),
          prevents.length
            ? section(
                l.title('incidentsItPrevents'),
                [
                  h.ul(
                    [],
                    prevents.map((incident) =>
                      h.li(
                        [h.Key(incident.id)],
                        [link(`/incidents/${incident.id}`, incident.name, h)],
                      ),
                    ),
                  ),
                ],
                h,
              )
            : h.empty,
          termsSection(l, BY_RESEARCH[entry.id], h),
        ],
      ),
    related: ['/research'],
  })
}

/** The game's Research tree, read-only: each item links to its page. */
const tree = (l: Lang, h: H, full = false): Html => {
  const layout = researchLayout()
  const research = l.cat.RESEARCH
  return h.div(
    [
      // column-reverse opens the box scrolled to the bottom, where the Garage Era and the roots are.
      h.Class(
        cx(
          SCROLL,
          cx(
            css({
              display: 'flex',
              flexDirection: 'column-reverse',
              overflow: 'auto',
              borderRadius: 'lg',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'border',
              backgroundColor: 'canvas',
            }),
            'not-prose',
          ),
          full
            ? css({
                height: 'calc(100dvh - 210px)',
              })
            : css({
                maxHeight: '72vh',
              }),
        ),
      ),
      h.AriaLabel(l.t.reference.research.treeLabel),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              position: 'relative',
              flexShrink: '0',
            }),
          ),
          h.Style({ width: `${layout.width}px`, height: `${layout.height}px` }),
        ],
        [
          ...layout.bands.map((band) =>
            h.div(
              [
                h.Key(`era-${band.era}`),
                h.Class(
                  css({
                    position: 'absolute',
                    borderTopWidth: '1px',
                    borderTopStyle: 'solid',
                    borderColor: 'hairline',
                  }),
                ),
                h.Style({
                  left: `${band.x}px`,
                  top: `${band.y}px`,
                  width: `${band.w}px`,
                  height: `${band.h}px`,
                }),
              ],
              [
                h.a(
                  [
                    h.Href(eraPath(band.era)),
                    h.Class(
                      cx(
                        EYEBROW,
                        css({
                          position: 'absolute',
                          top: '3',
                          left: '5',
                          _hover: {
                            color: 'foreground',
                          },
                        }),
                      ),
                    ),
                  ],
                  [eraName(l, band.era)],
                ),
              ],
            ),
          ),
          ...layout.tracks.map((track) =>
            h.div(
              [
                h.Key(`root-${track.track}`),
                h.Class(
                  css({
                    position: 'absolute',
                    display: 'flex',
                    width: '180px',
                    translate: '-50% -50%',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2',
                  }),
                ),
                h.Style({ left: `${track.x}px`, top: `${track.y}px` }),
              ],
              [
                h.span(
                  [
                    h.Class(
                      css({
                        display: 'grid',
                        width: '14',
                        height: '14',
                        placeItems: 'center',
                        borderRadius: 'xl',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'border',
                        backgroundColor: 'background',
                      }),
                    ),
                  ],
                  [
                    icon(
                      h,
                      TRACK_ICONS[track.track],
                      css({
                        width: '6',
                        height: '6',
                      }),
                    ),
                  ],
                ),
                h.span(
                  [
                    h.Class(
                      css({
                        fontSize: '14px',
                        fontWeight: '600',
                      }),
                    ),
                  ],
                  [trackLabel(l, track.track)],
                ),
              ],
            ),
          ),
          h.svg(
            [
              h.AriaHidden(true),
              h.Class(
                css({
                  pointerEvents: 'none',
                  position: 'absolute',
                  inset: '0',
                  overflow: 'visible',
                }),
              ),
              h.Width(String(layout.width)),
              h.Height(String(layout.height)),
              h.Fill('none'),
            ],
            layout.wires.map((wire) =>
              h.path(
                [
                  h.Key(wire.key),
                  h.D(wire.d),
                  h.StrokeWidth(wire.root ? '2' : '1.5'),
                  h.StrokeLinecap('round'),
                  h.StrokeLinejoin('round'),
                  h.Class(
                    wire.root
                      ? css({
                          stroke: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
                        })
                      : css({
                          stroke: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
                        }),
                  ),
                ],
                [],
              ),
            ),
          ),
          ...[...layout.placed.values()].map(({ entry, x, y }) =>
            h.a(
              [
                h.Key(entry.id),
                h.Href(researchPath(entry.id)),
                h.Style({
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${NODE_SIZE.w}px`,
                  height: `${NODE_SIZE.h}px`,
                }),
                h.Class(
                  cx(
                    css({
                      position: 'absolute',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2.5',
                      overflow: 'hidden',
                      borderRadius: 'xl',
                      layerStyle: 'raised',
                      paddingInline: '2.5',
                      paddingBlock: '1',
                      boxShadow: 'raised',
                      transitionProperty: 'filter',
                      transitionDuration: '150ms',
                      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                      _hover: {
                        filter: 'brightness(0.985)',
                      },
                    }),
                    'press',
                  ),
                ),
              ],
              [
                researchMark(entry, 'sm', false, h),
                h.span(
                  [
                    h.Class(
                      css({
                        display: 'flex',
                        minWidth: '0',
                        flex: '1 1 0%',
                        flexDirection: 'column',
                        gap: '1',
                      }),
                    ),
                  ],
                  [
                    h.span(
                      [
                        h.Class(
                          css({
                            lineClamp: '2',
                            fontSize: '12px',
                            lineHeight: '1.25',
                            fontWeight: '600',
                          }),
                        ),
                      ],
                      [research[entry.id].name],
                    ),
                    h.span(
                      [
                        h.Class(
                          css({
                            display: 'flex',
                            width: 'fit-content',
                            alignItems: 'center',
                            gap: '2',
                            fontSize: '11px',
                          }),
                        ),
                      ],
                      recipeOf(entry.id).map(([pool, cost]) => chip(l, pool, compact(cost), h)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ],
  )
}

/** Every track side by side, its items grouped under the Era they open in. */
const byTrack = (l: Lang, h: H): Html =>
  h.div(
    [
      h.Class(
        cx(
          css({
            marginBlock: '6',
            display: 'grid',
            gap: '1px',
            overflow: 'hidden',
            borderRadius: 'lg',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'border',
            backgroundColor: 'border',
            md: {
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              '& > :last-child:nth-child(odd)': {
                gridColumn: 'span 2 / span 2',
              },
            },
          }),
          'not-prose',
        ),
      ),
    ],
    l.cat.RESEARCH_TRACKS.map((track) => {
      const items = researchList.filter((entry) => entry.track === track.key)
      const eras = [...new Set(items.map((entry) => entry.era))].sort((a, b) => a - b)
      return h.section(
        [
          h.Key(track.key),
          h.Class(
            css({
              backgroundColor: 'background',
              padding: '4',
            }),
          ),
        ],
        [
          h.h3(
            [
              h.Class(
                css({
                  marginTop: '0 !important',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  fontSize: '15px',
                  fontWeight: '600',
                }),
              ),
            ],
            [
              icon(
                h,
                TRACK_ICONS[track.key],
                css({
                  width: '4',
                  height: '4',
                  color: 'mutedForeground',
                }),
              ),
              track.label,
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        marginLeft: 'auto',
                        fontSize: '12px',
                        fontWeight: '400',
                        color: 'mutedForeground',
                      }),
                    ),
                  ),
                ],
                [String(items.length)],
              ),
            ],
          ),
          h.dl(
            [
              h.Class(
                css({
                  marginTop: '3',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3',
                }),
              ),
            ],
            eras.flatMap((era) => [
              h.dt(
                [
                  h.Key(`${era}-t`),
                  h.Class(
                    css({
                      fontSize: '12px',
                      fontWeight: '500',
                      letterSpacing: '0.025em',
                      color: 'mutedForeground',
                      textTransform: 'uppercase',
                    }),
                  ),
                ],
                [
                  h.a(
                    [
                      h.Href(eraPath(era)),
                      h.Class(
                        css({
                          _hover: {
                            color: 'foreground',
                          },
                        }),
                      ),
                    ],
                    [eraName(l, era)],
                  ),
                ],
              ),
              h.dd(
                [
                  h.Key(`${era}-d`),
                  h.Class(
                    css({
                      marginTop: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1',
                    }),
                  ),
                ],
                items
                  .filter((entry) => entry.era === era)
                  .map((entry) =>
                    h.a(
                      [
                        h.Key(entry.id),
                        h.Href(researchPath(entry.id)),
                        h.Class(
                          css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2',
                            fontSize: '14px',
                            lineHeight: '1.375',
                            _hover: {
                              textDecorationLine: 'underline',
                            },
                          }),
                        ),
                      ],
                      [researchMark(entry, 'sm', false, h), l.cat.RESEARCH[entry.id].name],
                    ),
                  ),
              ),
            ]),
          ),
        ],
      )
    }),
  )

const treeButton = (href: string, label: string, mark: IconNode, h: H): Html =>
  h.a(
    [
      h.Href(href),
      h.Class(
        css({
          display: 'inline-flex',
          height: '8',
          alignItems: 'center',
          gap: '2',
          borderRadius: 'md',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'border',
          backgroundColor: 'background',
          paddingInline: '3',
          fontSize: '13px',
          fontWeight: '500',
          color: 'foreground',
          textDecorationLine: 'none',
          _hover: {
            backgroundColor: 'muted',
          },
        }),
      ),
    ],
    [
      icon(
        h,
        mark,
        css({
          width: '4',
          height: '4',
        }),
      ),
      label,
    ],
  )

/** Every Insight pool some item costs, in catalog order. */
const usedPools = INSIGHT_POOLS.filter((pool) =>
  researchList.some((entry) => recipeOf(entry.id).some(([spent]) => spent === pool)),
)

/** How to read the cost on an item: what its icon names and what its number counts. */
const costLegend = (l: Lang, h: H): Html => {
  const t = l.t.reference.research
  return h.div(
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
      h.ul(
        [
          h.Class(
            css({
              display: 'grid',
              gap: '1px',
              overflow: 'hidden',
              borderRadius: 'lg',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'border',
              backgroundColor: 'border',
              sm: {
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              },
            }),
          ),
        ],
        [
          ...usedPools.map((pool) =>
            h.li(
              [
                h.Key(pool),
                h.Class(
                  css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3',
                    backgroundColor: 'background',
                    paddingInline: '3.5',
                    paddingBlock: '2.5',
                  }),
                ),
              ],
              [
                h.span(
                  [
                    h.AriaHidden(true),
                    h.Class(
                      css({
                        display: 'grid',
                        width: '8',
                        height: '8',
                        flexShrink: '0',
                        placeItems: 'center',
                        borderRadius: 'md',
                        backgroundColor: 'muted',
                      }),
                    ),
                    h.Style({ color: poolColor(pool) }),
                  ],
                  [
                    icon(
                      h,
                      POOL_ICONS[pool],
                      css({
                        width: '4',
                        height: '4',
                      }),
                    ),
                  ],
                ),
                h.span(
                  [
                    h.Class(
                      css({
                        minWidth: '0',
                      }),
                    ),
                  ],
                  [
                    h.span(
                      [
                        h.Class(
                          css({
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                          }),
                        ),
                      ],
                      [poolLabel(l, pool)],
                    ),
                    h.span(
                      [
                        h.Class(
                          css({
                            display: 'block',
                            fontSize: '12px',
                            lineHeight: '1.375',
                            color: 'mutedForeground',
                          }),
                        ),
                      ],
                      [pool === 'failure' ? t.failureEarned : t.sampled(l.cat.POOLS[pool].label)],
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Blank cells finish the last row at two and three columns, so the hairlines do not show through.
          ...Array.from({ length: (3 - (usedPools.length % 3)) % 3 }, (_, index) =>
            h.li(
              [
                h.Key(`fill-3-${index}`),
                h.Class(
                  css({
                    display: 'none',
                    backgroundColor: 'background',
                    lg: {
                      display: 'block',
                    },
                  }),
                ),
              ],
              [],
            ),
          ),
          ...Array.from({ length: (2 - (usedPools.length % 2)) % 2 }, (_, index) =>
            h.li(
              [
                h.Key(`fill-2-${index}`),
                h.Class(
                  css({
                    display: 'none',
                    backgroundColor: 'background',
                    sm: {
                      display: 'block',
                    },
                    lg: {
                      display: 'none',
                    },
                  }),
                ),
              ],
              [],
            ),
          ),
        ],
      ),
    ],
  )
}

export const researchPages = (l: Lang): ReadonlyArray<Page> => {
  const t = l.t.reference.research
  const entities = researchList.map((entry) => entity(l, l.cat.RESEARCH[entry.id] as ResearchDef))
  /** The tree on a page of its own, as wide as the screen, like the game's Research panel. */
  const fullTree = page(l, {
    path: '/research/tree',
    title: t.fullTitle,
    summary: t.fullSummary,
    parent: '/research',
    order: -1,
    wide: true,
    aliases: t.fullAliases,
    body: (_model, h) =>
      h.div(
        [],
        [
          h.div(
            [
              h.Class(
                css({
                  marginBottom: '4',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }),
              ),
            ],
            [treeButton('/research', t.backToPage, Minimize2, h)],
          ),
          tree(l, h, true),
        ],
      ),
  })
  const hub = page(l, {
    path: '/research',
    title: t.title,
    summary: t.summary,
    order: 3,
    aliases: t.aliases,
    headings: headingsFor([l.title('readingACost'), l.title('theTree'), l.title('byTrack')]),
    text: entities.map((entry) => entry.title).join(' '),
    body: (_model, h) =>
      h.div(
        [h.Class('prose')],
        [
          paragraph(t.intro, h),
          section(
            l.title('readingACost'),
            [
              h.p(
                [],
                [
                  t.cost1,
                  link('/components/analytics', t.cost1Link, h),
                  t.cost2,
                  chip(l, 'write', '5k', h),
                  t.cost3,
                  poolLabel(l, 'write'),
                  t.cost4,
                  chip(l, 'failure', '2k', h),
                  t.cost5,
                  poolLabel(l, 'failure'),
                  t.cost6,
                ],
              ),
              costLegend(l, h),
              h.p([], [t.earn, link('/explanation/observability', t.earnLink, h), t.earnAfter]),
            ],
            h,
          ),
          section(
            l.title('theTree'),
            [
              h.div(
                [
                  h.Class(
                    cx(
                      css({
                        marginBottom: '3',
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }),
                      'not-prose',
                    ),
                  ),
                ],
                [treeButton('/research/tree', t.openInFull, Maximize2, h)],
              ),
              tree(l, h),
            ],
            h,
          ),
          section(l.title('byTrack'), [byTrack(l, h)], h),
        ],
      ),
  })
  return [hub, fullTree, ...entities]
}
