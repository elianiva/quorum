import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import {
  ERAS,
  VENTURE_IDS,
  type RequestKind,
  type VentureDef,
  type VentureId,
} from '@quorum/simulation/catalog'
import { css, cx } from '@quorum/styled-system/css'
import { money } from '@quorum/ui/game/format'
import { proseStyle } from '../../prose-style.ts'
import type { Page } from '../page.ts'
import { mixBar } from './eras-visuals.ts'
import { incidentPath } from './incidents.ts'
import {
  headingsFor,
  link,
  linkList,
  page,
  paragraph,
  percent,
  researchLink,
  section,
  table,
  type Lang,
} from './shared.ts'
import { runtimePath } from './stacks.ts'

/**
 * `page` fills in the defaults a generated page shares, but its fields are
 * typed for one message type. The pages here carry their own.
 */
const pageOf = <Msg>(
  l: Lang,
  fields: Partial<Page<Msg>> & Pick<Page<Msg>, 'kind' | 'path' | 'title' | 'summary'>,
): Page<Msg> => page(l, fields as never) as Page<Msg>

const WIDEST = ERAS[ERAS.length - 1]

const trafficOf = (def: VentureDef): Partial<Record<RequestKind, number>> => {
  const shares = def.shares ?? WIDEST?.mix ?? {}
  return Object.fromEntries(
    (Object.entries(shares) as Array<[RequestKind, number]>).toSorted((a, b) => b[1] - a[1]),
  ) as Partial<Record<RequestKind, number>>
}

const busiest = (l: Lang, def: VentureDef): string =>
  (Object.entries(trafficOf(def)) as Array<[RequestKind, number]>)
    .slice(0, 3)
    .map(([kind, share]) => `${l.cat.KINDS[kind].label} ${percent(share)}`)
    .join(' · ')

const hour = (value: number): string => `${String(value).padStart(2, '0')}:00`

const venturePath = (id: VentureId): string => `/ventures#${id}`

const ventureName = <Msg>(l: Lang, id: VentureId, h: H<Msg>): View.Content<Msg> =>
  link(venturePath(id), l.cat.VENTURES[id].name, h)

const startsWith = <Msg>(l: Lang, def: VentureDef, h: H<Msg>): ReadonlyArray<View.Content<Msg>> => [
  ...(def.start.runtime === null
    ? []
    : [link(runtimePath(def.start.runtime), l.cat.RUNTIMES[def.start.runtime].name, h)]),
  ...def.start.researched.map((research) => researchLink(l, research, h)),
]

const ventureBlock = <Msg>(l: Lang, id: VentureId, h: H<Msg>): View.Content<Msg> => {
  const t = l.t.reference.ventures
  const def = l.cat.VENTURES[id]
  return h.section.key(id).children(
    h.h3
      .attr('id', id)
      .class('group')
      .children(def.name, h.a.attr('href', `#${id}`).class('anchor').children('#')),
    paragraph(def.summary, h),
    mixBar(l, trafficOf(def), h),
    h.dl
      .class(
        cx(
          css({
            marginBlock: '4',
            display: 'grid',
            columnGap: '6',
            rowGap: '2',
            fontSize: 'type.14',
            sm: {
              gridTemplateColumns: '9rem 1fr',
            },
          }),
          'not-prose',
        ),
      )
      .children(
        ...(def.signature === null
          ? []
          : [
              h.dt
                .key('incident-t')
                .class(
                  css({
                    color: 'mutedForeground',
                  }),
                )
                .children(t.signature),
              h.dd
                .key('incident-d')
                .class(
                  css({
                    margin: '0',
                  }),
                )
                .children(
                  link(incidentPath(def.signature), l.cat.INCIDENTS[def.signature].name, h),
                ),
            ]),
        h.dt
          .key('market-t')
          .class(
            css({
              color: 'mutedForeground',
            }),
          )
          .children(t.market),
        h.dd
          .key('market-d')
          .class(
            css({
              margin: '0',
            }),
          )
          .children(`×${def.market}`),
        h.dt
          .key('legacy-t')
          .class(
            css({
              color: 'mutedForeground',
            }),
          )
          .children(t.legacy),
        h.dd
          .key('legacy-d')
          .class(
            css({
              margin: '0',
            }),
          )
          .children(`×${def.legacy}`),
      ),
  )
}

export const venturePages = <Msg>(l: Lang): ReadonlyArray<Page<Msg>> => {
  const t = l.t.reference.ventures
  const VENTURES = l.cat.VENTURES
  return [
    pageOf<Msg>(l, {
      kind: 'venture',
      path: '/ventures',
      title: t.title,
      summary: t.summary,
      order: 10,
      aliases: t.aliases,
      headings: [
        ...headingsFor([
          l.title('traffic'),
          l.title('whenBusy'),
          l.title('startingOut'),
          l.title('everyVenture'),
        ]),
        ...VENTURE_IDS.map((id) => ({ id, text: VENTURES[id].name, level: 3 as const })),
      ],
      text: VENTURE_IDS.map((id) => `${VENTURES[id].name} ${VENTURES[id].summary}`).join(' '),
      body: (h) =>
        h.div.class(proseStyle).children(
          paragraph(t.intro, h),
          section(
            l.title('traffic'),
            [
              paragraph(t.trafficIntro, h),
              table(
                t.trafficColumns,
                VENTURE_IDS.map((id) => ({
                  key: id,
                  cells: [
                    ventureName(l, id, h),
                    mixBar(l, trafficOf(VENTURES[id]), h, false),
                    busiest(l, VENTURES[id]),
                    `×${VENTURES[id].legacy}`,
                  ],
                })),
                h,
                [3],
              ),
            ],
            h,
          ),
          section(
            l.title('whenBusy'),
            [
              paragraph(t.busyIntro, h),
              table(
                t.busyColumns,
                VENTURE_IDS.map((id) => {
                  const def = VENTURES[id]
                  return {
                    key: id,
                    cells: [
                      ventureName(l, id, h),
                      hour(def.peak),
                      `±${Math.round(def.amplitude * 100)}%`,
                      `×${def.weekend}`,
                    ],
                  }
                }),
                h,
                [1, 2, 3],
              ),
            ],
            h,
          ),
          section(
            l.title('startingOut'),
            [
              paragraph(t.startIntro, h),
              table(
                t.startColumns,
                VENTURE_IDS.map((id) => {
                  const def = VENTURES[id]
                  return {
                    key: id,
                    cells: [
                      ventureName(l, id, h),
                      money(def.start.cash),
                      `×${def.market}`,
                      linkList(l, startsWith(l, def, h), h),
                    ],
                  }
                }),
                h,
                [1, 2],
              ),
            ],
            h,
          ),
          section(
            l.title('everyVenture'),
            VENTURE_IDS.map((id) => ventureBlock(l, id, h)),
            h,
          ),
        ),
      related: ['/prestige', '/eras'],
    }),
  ]
}
