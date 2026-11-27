import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { Maximize2, Minimize2, type IconNode } from 'lucide'
import {
  COMPONENT_IDS,
  INSIGHT_POOLS,
  researchList,
  type ComponentId,
  type ResearchDef,
} from '@quorum/simulation/catalog'
import { BY_RESEARCH } from '@quorum/simulation/term-links'
import { css, cx } from '@quorum/styled-system/css'
import { EYEBROW, FIGURE, SCROLL } from '@quorum/ui/game/bits'
import { compact } from '@quorum/ui/game/format'
import { POOL_ICONS, poolColor, recipeOf } from '@quorum/ui/game/pool-visuals'
import { NODE_SIZE, researchLayout } from '@quorum/ui/game/research-layouts'
import { TRACK_ICONS } from '@quorum/ui/game/research-marks'
import { proseStyle } from '../../prose-style.ts'
import { icon } from '../icon.ts'
import type { Page } from '../page.ts'
import { prose } from '../prose.ts'
import { insightChip, researchMark } from './research-visuals.ts'
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
  type Lang,
} from './shared.ts'

const componentPath = (id: ComponentId): string => `/components/${id}`

/**
 * `page` fills in the defaults a generated page shares, but its fields are
 * typed for one message type. The pages here carry their own.
 */
const pageOf = <Msg>(
  l: Lang,
  fields: Partial<Page<Msg>> & Pick<Page<Msg>, 'kind' | 'path' | 'title' | 'summary'>,
): Page<Msg> => page(l, fields as never) as Page<Msg>

const trackLabel = (l: Lang, track: ResearchDef['track']): string =>
  l.cat.RESEARCH_TRACKS.find((entry) => entry.key === track)?.label ?? track

const poolLabel = (l: Lang, pool: (typeof INSIGHT_POOLS)[number]): string =>
  l.t.reference.research.insightName(l.cat.POOLS[pool].label)

const chip = <Msg>(
  l: Lang,
  pool: (typeof INSIGHT_POOLS)[number],
  figure: string,
  h: H<Msg>,
): View.Content<Msg> => insightChip(pool, figure, poolLabel(l, pool), h)

const recipe = <Msg>(l: Lang, entry: ResearchDef, h: H<Msg>): View.Content<Msg> =>
  h.span
    .class(
      css({
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '2',
      }),
    )
    .children(...recipeOf(entry.id).map(([pool, cost]) => chip(l, pool, compact(cost), h)))

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

const entity = <Msg>(l: Lang, entry: ResearchDef): Page<Msg> => {
  const t = l.t.reference.research
  const path = researchPath(entry.id)
  const found = authored(l.locale, path)
  const followUps = researchList.filter((candidate) => candidate.requires.includes(entry.id))
  const unlocks = unlocksOf(l, entry)
  const prevents = Object.values(l.cat.INCIDENTS).filter((incident) =>
    incident.actions.includes(entry.id),
  )
  return pageOf(l, {
    kind: 'research',
    path,
    title: entry.name,
    summary: entry.blurb,
    parent: '/research',
    order: researchList.findIndex((candidate) => candidate.id === entry.id),
    era: entry.era,
    aliases: [entry.id, trackLabel(l, entry.track)],
    source: found.source,
    fallback: found.fallback,
    headings: [
      ...found.headings,
      ...headingsFor([
        unlocks.length ? l.title('whatItUnlocks') : null,
        l.title('prerequisites'),
        prevents.length ? l.title('incidentsItPrevents') : null,
        BY_RESEARCH[entry.id]?.length ? l.title('engineeringTerms') : null,
      ]),
    ],
    text: `${entry.blurb} ${found.text}`,
    aside: (h) =>
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
              l,
              entry.requires.map((id) => researchLink(l, id, h)),
              h,
            ),
          },
        ],
        h,
      ),
    body: (h) => {
      const blocks: ReadonlyArray<View.Content<Msg>> = [
        ...(found.prose === null
          ? []
          : [prose(h, l.locale, found.prose.document, found.prose.anchors ?? undefined)]),
        unlocks.length
          ? section(
              l.title('whatItUnlocks'),
              [
                h.p.children(
                  linkList(
                    l,
                    unlocks.map((item) => link(item.path, item.text, h)),
                    h,
                  ),
                ),
              ],
              h,
            )
          : h.span.children(),
        section(
          l.title('prerequisites'),
          [
            h.p.children(
              entry.requires.length
                ? [
                    t.prerequisitesIntro,
                    linkList(
                      l,
                      entry.requires.map((id) => researchLink(l, id, h)),
                      h,
                    ),
                    l.t.reference.sentenceEnd,
                  ]
                : [t.root(trackLabel(l, entry.track))],
            ),
            ...(followUps.length
              ? [
                  h.p.children(
                    t.leadsTo,
                    linkList(
                      l,
                      followUps.map((next) => researchLink(l, next.id, h)),
                      h,
                    ),
                    l.t.reference.sentenceEnd,
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
                h.ul.children(
                  ...prevents.map((incident) =>
                    h.li
                      .key(incident.id)
                      .children(link(`/incidents/${incident.id}`, incident.name, h)),
                  ),
                ),
              ],
              h,
            )
          : h.span.children(),
        termsSection(l, BY_RESEARCH[entry.id], h),
      ]
      return h.div.class(proseStyle).children(...blocks)
    },
    related: ['/research'],
  })
}

const tree = <Msg>(l: Lang, h: H<Msg>, full = false): View.Content<Msg> => {
  const layout = researchLayout()
  const research = l.cat.RESEARCH
  return h.div
    .attr('aria-label', l.t.reference.research.treeLabel)
    .class(
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
    )
    .children(
      h.div
        .class(
          css({
            position: 'relative',
            flexShrink: '0',
          }),
        )
        .style({ width: `${layout.width}px`, height: `${layout.height}px` })
        .children(
          ...layout.bands.map((band) =>
            h.div
              .key(`era-${band.era}`)
              .class(
                css({
                  position: 'absolute',
                  borderTopWidth: '1px',
                  borderTopStyle: 'solid',
                  borderColor: 'hairline',
                }),
              )
              .style({
                left: `${band.x}px`,
                top: `${band.y}px`,
                width: `${band.w}px`,
                height: `${band.h}px`,
              })
              .children(
                h.a
                  .attr('href', eraPath(band.era))
                  .class(
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
                  )
                  .children(eraName(l, band.era)),
              ),
          ),
          ...layout.tracks.map((track) =>
            h.div
              .key(`root-${track.track}`)
              .class(
                css({
                  position: 'absolute',
                  display: 'flex',
                  width: '180px',
                  translate: '-50% -50%',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2',
                }),
              )
              .style({ left: `${track.x}px`, top: `${track.y}px` })
              .children(
                h.span
                  .class(
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
                  )
                  .children(
                    icon(
                      h,
                      TRACK_ICONS[track.track],
                      css({
                        width: '6',
                        height: '6',
                      }),
                    ),
                  ),
                h.span
                  .class(
                    css({
                      fontSize: 'type.14',
                      fontWeight: 'semibold',
                    }),
                  )
                  .children(trackLabel(l, track.track)),
              ),
          ),
          h.svg
            .attr('aria-hidden', 'true')
            .class(
              css({
                pointerEvents: 'none',
                position: 'absolute',
                inset: '0',
                overflow: 'visible',
              }),
            )
            .attr('width', String(layout.width))
            .attr('height', String(layout.height))
            .attr('fill', 'none')
            .children(
              ...layout.wires.map((wire) =>
                h.path
                  .key(wire.key)
                  .attr('d', wire.d)
                  .attr('stroke-width', wire.root ? '2' : '1.5')
                  .attr('stroke-linecap', 'round')
                  .attr('stroke-linejoin', 'round')
                  .class(
                    wire.root
                      ? css({
                          stroke: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
                        })
                      : css({
                          stroke: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
                        }),
                  )
                  .children(),
              ),
            ),
          ...[...layout.placed.values()].map(({ entry, x, y }) =>
            h.a
              .key(entry.id)
              .attr('href', researchPath(entry.id))
              .style({
                left: `${x}px`,
                top: `${y}px`,
                width: `${NODE_SIZE.w}px`,
                height: `${NODE_SIZE.h}px`,
              })
              .class(
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
                    transitionDuration: 'fast',
                    transitionTimingFunction: 'default',
                    _hover: {
                      filter: 'brightness(0.985)',
                    },
                  }),
                  'press',
                ),
              )
              .children(
                researchMark(entry, 'sm', false, h),
                h.span
                  .class(
                    css({
                      display: 'flex',
                      minWidth: '0',
                      flex: '1 1 0%',
                      flexDirection: 'column',
                      gap: '1',
                    }),
                  )
                  .children(
                    h.span
                      .class(
                        css({
                          lineClamp: '2',
                          fontSize: 'type.12',
                          lineHeight: 'tight',
                          fontWeight: 'semibold',
                        }),
                      )
                      .children(research[entry.id].name),
                    h.span
                      .class(
                        css({
                          display: 'flex',
                          width: 'fit-content',
                          alignItems: 'center',
                          gap: '2',
                          fontSize: 'type.11',
                        }),
                      )
                      .children(
                        ...recipeOf(entry.id).map(([pool, cost]) =>
                          chip(l, pool, compact(cost), h),
                        ),
                      ),
                  ),
              ),
          ),
        ),
    )
}

const byTrack = <Msg>(l: Lang, h: H<Msg>): View.Content<Msg> =>
  h.div
    .class(
      cx(
        css({
          marginBlock: '6',
          display: 'grid',
          gap: '0.25',
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
    )
    .children(
      ...l.cat.RESEARCH_TRACKS.map((track) => {
        const items = researchList.filter((entry) => entry.track === track.key)
        const eras = [...new Set(items.map((entry) => entry.era))].sort((a, b) => a - b)
        return h.section
          .key(track.key)
          .class(
            css({
              backgroundColor: 'background',
              padding: '4',
            }),
          )
          .children(
            h.h3
              .class(
                css({
                  marginTop: '0 !important',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  fontSize: 'type.15',
                  fontWeight: 'semibold',
                }),
              )
              .children(
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
                h.span
                  .class(
                    cx(
                      FIGURE,
                      css({
                        marginLeft: 'auto',
                        fontSize: 'type.12',
                        fontWeight: 'normal',
                        color: 'mutedForeground',
                      }),
                    ),
                  )
                  .children(String(items.length)),
              ),
            h.dl
              .class(
                css({
                  marginTop: '3',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3',
                }),
              )
              .children(
                ...eras.flatMap((era) => [
                  h.dt
                    .key(`${era}-t`)
                    .class(
                      css({
                        fontSize: 'type.12',
                        fontWeight: 'medium',
                        letterSpacing: 'wide',
                        color: 'mutedForeground',
                        textTransform: 'uppercase',
                      }),
                    )
                    .children(
                      h.a
                        .attr('href', eraPath(era))
                        .class(
                          css({
                            _hover: {
                              color: 'foreground',
                            },
                          }),
                        )
                        .children(eraName(l, era)),
                    ),
                  h.dd
                    .key(`${era}-d`)
                    .class(
                      css({
                        marginTop: '1',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1',
                      }),
                    )
                    .children(
                      ...items
                        .filter((entry) => entry.era === era)
                        .map((entry) =>
                          h.a
                            .key(entry.id)
                            .attr('href', researchPath(entry.id))
                            .class(
                              css({
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2',
                                fontSize: 'type.14',
                                lineHeight: 'snug',
                                _hover: {
                                  textDecorationLine: 'underline',
                                },
                              }),
                            )
                            .children(
                              researchMark(entry, 'sm', false, h),
                              l.cat.RESEARCH[entry.id].name,
                            ),
                        ),
                    ),
                ]),
              ),
          )
      }),
    )

const treeButton = <Msg>(
  href: string,
  label: string,
  mark: IconNode,
  h: H<Msg>,
): View.Content<Msg> =>
  h.a
    .attr('href', href)
    .class(
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
        fontSize: 'type.13',
        fontWeight: 'medium',
        color: 'foreground',
        textDecorationLine: 'none',
        _hover: {
          backgroundColor: 'muted',
        },
      }),
    )
    .children(
      icon(
        h,
        mark,
        css({
          width: '4',
          height: '4',
        }),
      ),
      label,
    )

const usedPools = INSIGHT_POOLS.filter((pool) =>
  researchList.some((entry) => recipeOf(entry.id).some(([spent]) => spent === pool)),
)

const costLegend = <Msg>(l: Lang, h: H<Msg>): View.Content<Msg> => {
  const t = l.t.reference.research
  return h.div
    .class(
      cx(
        css({
          marginBlock: '5',
        }),
        'not-prose',
      ),
    )
    .children(
      h.ul
        .class(
          css({
            display: 'grid',
            gap: '0.25',
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
        )
        .children(
          ...usedPools.map((pool) =>
            h.li
              .key(pool)
              .class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                  backgroundColor: 'background',
                  paddingInline: '3.5',
                  paddingBlock: '2.5',
                }),
              )
              .children(
                h.span
                  .attr('aria-hidden', 'true')
                  .class(
                    css({
                      display: 'grid',
                      width: '8',
                      height: '8',
                      flexShrink: '0',
                      placeItems: 'center',
                      borderRadius: 'md',
                      backgroundColor: 'muted',
                    }),
                  )
                  .style({ color: poolColor(pool) })
                  .children(
                    icon(
                      h,
                      POOL_ICONS[pool],
                      css({
                        width: '4',
                        height: '4',
                      }),
                    ),
                  ),
                h.span
                  .class(
                    css({
                      minWidth: '0',
                    }),
                  )
                  .children(
                    h.span
                      .class(
                        css({
                          display: 'block',
                          fontSize: 'type.14',
                          fontWeight: 'medium',
                        }),
                      )
                      .children(poolLabel(l, pool)),
                    h.span
                      .class(
                        css({
                          display: 'block',
                          fontSize: 'type.12',
                          lineHeight: 'snug',
                          color: 'mutedForeground',
                        }),
                      )
                      .children(
                        pool === 'failure' ? t.failureEarned : t.sampled(l.cat.POOLS[pool].label),
                      ),
                  ),
              ),
          ),
          ...Array.from({ length: (3 - (usedPools.length % 3)) % 3 }, (_, index) =>
            h.li
              .key(`fill-3-${index}`)
              .class(
                css({
                  display: 'none',
                  backgroundColor: 'background',
                  lg: {
                    display: 'block',
                  },
                }),
              )
              .children(),
          ),
          ...Array.from({ length: (2 - (usedPools.length % 2)) % 2 }, (_, index) =>
            h.li
              .key(`fill-2-${index}`)
              .class(
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
              )
              .children(),
          ),
        ),
    )
}

export const researchPages = <Msg>(l: Lang): ReadonlyArray<Page<Msg>> => {
  const t = l.t.reference.research
  const entities: ReadonlyArray<Page<Msg>> = researchList.map((entry) =>
    entity<Msg>(l, l.cat.RESEARCH[entry.id] as ResearchDef),
  )
  const fullTree = pageOf<Msg>(l, {
    kind: 'research',
    path: '/research/tree',
    title: t.fullTitle,
    summary: t.fullSummary,
    parent: '/research',
    order: -1,
    wide: true,
    aliases: t.fullAliases,
    body: (h) =>
      h.div.children(
        h.div
          .class(
            css({
              marginBottom: '4',
              display: 'flex',
              justifyContent: 'flex-end',
            }),
          )
          .children(treeButton('/research', t.backToPage, Minimize2, h)),
        tree(l, h, true),
      ),
  })
  const hub = pageOf<Msg>(l, {
    kind: 'research',
    path: '/research',
    title: t.title,
    summary: t.summary,
    order: 3,
    aliases: t.aliases,
    headings: headingsFor([l.title('readingACost'), l.title('theTree'), l.title('byTrack')]),
    text: entities.map((entry) => entry.title).join(' '),
    body: (h) =>
      h.div.class(proseStyle).children(
        paragraph(t.intro, h),
        section(
          l.title('readingACost'),
          [
            h.p.children(
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
            ),
            costLegend(l, h),
            h.p.children(t.earn, link('/explanation/observability', t.earnLink, h), t.earnAfter),
          ],
          h,
        ),
        section(
          l.title('theTree'),
          [
            h.div
              .class(
                cx(
                  css({
                    marginBottom: '3',
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }),
                  'not-prose',
                ),
              )
              .children(treeButton('/research/tree', t.openInFull, Maximize2, h)),
            tree(l, h),
          ],
          h,
        ),
        section(l.title('byTrack'), [byTrack(l, h)], h),
      ),
  })
  return [hub, fullTree, ...entities]
}
