import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import {
  COMPONENTS,
  COMPONENT_IDS,
  EXITS,
  EXIT_IDS,
  FEATURES,
  FEATURE_IDS,
  INCIDENT_IDS,
  INCIDENTS,
  researchList,
  type EraDef,
  type IncidentId,
} from '@quorum/simulation/catalog'
import { css, cx } from '@quorum/styled-system/css'
import { compact, money } from '@quorum/ui/game/format'
import { proseStyle } from '../../prose-style.ts'
import type { Page } from '../page.ts'
import { prose } from '../prose.ts'
import { componentEra, componentPath } from './components.ts'
import { pageOf } from './components-page.ts'
import { EYEBROW, FIGURE, mixBar } from './eras-visuals.ts'
import {
  authored,
  eraPath,
  factsBox,
  headingsFor,
  link,
  linkList,
  paragraph,
  percent,
  researchLink,
  section,
  type Lang,
} from './shared.ts'

const incidentPath = (id: IncidentId): string => `/incidents/${id}`

const entity = <Msg>(l: Lang, def: EraDef, index: number): Page<Msg> => {
  const t = l.t.reference.eras
  const eras = l.cat.ERAS
  const path = eraPath(index)
  const text = authored(l.locale, path)
  const next = eras[index + 1]
  const components = COMPONENT_IDS.filter((id) => componentEra(COMPONENTS[id]) === index)
  const research = researchList.filter((entry) => entry.era === index)
  const incidents = INCIDENT_IDS.filter((id) => INCIDENTS[id].era === index)
  const features = FEATURE_IDS.filter((id) => FEATURES[id].era === index)
  const exits = EXIT_IDS.filter((id) => EXITS[id].stage === index)
  return pageOf<Msg>(l, {
    kind: 'era',
    path,
    title: def.name,
    summary: def.question,
    parent: '/eras',
    order: index,
    era: index,
    aliases: [t.aliasEra(index), ...t.entityAliases],
    source: text.source,
    fallback: text.fallback,
    headings: [
      ...text.headings,
      ...headingsFor([
        l.title('traffic'),
        next ? l.title('raisingNext') : null,
        l.title('whatArrives'),
      ]),
    ],
    text: `${def.question} ${def.arrivals} ${text.text}`,
    aside: (h) =>
      factsBox(
        l,
        def.name,
        h.span
          .class(
            cx(
              FIGURE,
              css({
                display: 'grid',
                width: '6',
                height: '6',
                placeItems: 'center',
                borderRadius: 'md',
                backgroundColor: 'foreground',
                fontSize: 'type.11',
                color: 'background',
              }),
            ),
          )
          .children(String(index)),
        null,
        [
          { name: t.market, value: t.users(compact(def.market)) },
          { name: t.apdexTarget, value: def.apdexTarget.toFixed(2) },
          { name: t.weeklySlo, value: percent(def.slo) },
          { name: t.worstStart, value: `SEV${def.maxSeverity}` },
          { name: t.costIndex, value: `×${def.costIndex}` },
          { name: t.salaryIndex, value: `×${def.salaryIndex}` },
          ...(next
            ? [
                { name: t.raiseAt, value: t.users(compact(def.raiseAt)) },
                { name: t.roundPays, value: money(def.grant) },
                { name: t.dilution, value: percent(def.dilution) },
              ]
            : []),
        ],
        h,
      ),
    body: (h) =>
      h.div.class(proseStyle).children(
        ...(text.prose
          ? [prose(h, l.locale, text.prose.document, text.prose.anchors ?? undefined)]
          : []),
        section(
          l.title('traffic'),
          [
            paragraph(def.arrivals, h),
            paragraph(t.defaultShares, h),
            mixBar(l, def.mix, h),
            h.p.children(
              t.profileBefore,
              link('/ventures', l.t.reference.ventures.title, h),
              t.profileAfter,
            ),
          ],
          h,
        ),
        ...(next
          ? [
              section(
                l.title('raisingNext'),
                [
                  h.p.children(
                    t.raise(
                      compact(def.raiseAt),
                      next.name,
                      money(def.grant),
                      percent(def.dilution),
                    ),
                    link(eraPath(index + 1), next.name, h),
                    t.raiseAfter,
                  ),
                ],
                h,
              ),
            ]
          : []),
        section(
          l.title('whatArrives'),
          [
            h.dl
              .class(
                css({
                  display: 'grid',
                  columnGap: '6',
                  rowGap: '3',
                  sm: {
                    gridTemplateColumns: '10rem 1fr',
                  },
                }),
              )
              .children(
                ...(
                  [
                    [
                      t.arrives.components,
                      components.map((id) => link(componentPath(id), l.cat.COMPONENTS[id].name, h)),
                    ],
                    [t.arrives.research, research.map((entry) => researchLink(l, entry.id, h))],
                    [
                      t.arrives.incidents,
                      incidents.map((id) => link(incidentPath(id), l.cat.INCIDENTS[id].name, h)),
                    ],
                    [
                      t.arrives.features,
                      features.map((id) => link('/team#features', l.cat.FEATURES[id].name, h)),
                    ],
                    [
                      t.arrives.exits,
                      exits.map((id) => link('/prestige#exits', l.cat.EXITS[id].name, h)),
                    ],
                  ] satisfies ReadonlyArray<readonly [string, ReadonlyArray<View.Content<Msg>>]>
                ).flatMap(([label, items]) =>
                  items.length
                    ? [
                        h.dt
                          .key(`${label}-t`)
                          .class(
                            cx(
                              EYEBROW,
                              css({
                                paddingTop: '1',
                              }),
                            ),
                          )
                          .children(label),
                        h.dd
                          .key(`${label}-d`)
                          .class(
                            css({
                              margin: '0',
                            }),
                          )
                          .children(linkList(l, items, h)),
                      ]
                    : [],
                ),
              ),
          ],
          h,
        ),
      ),
    related: ['/eras', ...(next ? [eraPath(index + 1)] : [])],
  })
}

const arrivals = (l: Lang, index: number): string => {
  const t = l.t.reference.eras.count
  const parts = [
    [COMPONENT_IDS.filter((id) => componentEra(COMPONENTS[id]) === index).length, t.components],
    [researchList.filter((entry) => entry.era === index).length, t.research],
    [INCIDENT_IDS.filter((id) => INCIDENTS[id].era === index).length, t.incidents],
  ] as const
  return parts
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(' · ')
}

const timeline = <Msg>(l: Lang, h: H<Msg>): View.Content<Msg> => {
  const t = l.t.reference.eras
  const eras = l.cat.ERAS
  return h.ol
    .class(
      cx(
        css({
          position: 'relative',
          marginBlock: '8',
          borderLeftWidth: '1px',
          borderLeftStyle: 'solid',
          borderColor: 'border',
        }),
        'not-prose',
      ),
    )
    .children(
      ...eras.map((def, index) => {
        const next = eras[index + 1]
        const figures: ReadonlyArray<readonly [string, string]> = [
          [t.market, t.users(compact(def.market))],
          [t.apdexTarget, def.apdexTarget.toFixed(2)],
          ...(next
            ? ([
                [t.raiseAt, t.users(compact(def.raiseAt))],
                [t.roundPays, money(def.grant)],
              ] as const)
            : []),
        ]
        return h.li
          .key(def.name)
          .class(
            css({
              position: 'relative',
              paddingBottom: '10',
              paddingLeft: '8',
              '&:last-child': {
                paddingBottom: '0',
              },
            }),
          )
          .children(
            h.span
              .attr('aria-hidden', 'true')
              .class(
                cx(
                  FIGURE,
                  css({
                    position: 'absolute',
                    top: '0',
                    left: '-0.75rem',
                    display: 'grid',
                    width: '6',
                    height: '6',
                    placeItems: 'center',
                    borderRadius: 'full',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'border',
                    backgroundColor: 'background',
                    fontSize: 'type.11',
                    color: 'mutedForeground',
                  }),
                ),
              )
              .children(String(index + 1)),
            h.div
              .class(
                css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  columnGap: '3',
                  rowGap: '1',
                }),
              )
              .children(
                h.a
                  .attr('href', eraPath(index))
                  .class(
                    css({
                      fontSize: 'type.16',
                      fontWeight: 'semibold',
                      letterSpacing: 'tight',
                      _hover: {
                        textDecorationLine: 'underline',
                      },
                    }),
                  )
                  .children(def.name),
                h.span
                  .class(
                    css({
                      fontSize: 'type.15',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(def.question),
              ),
            h.dl
              .class(
                css({
                  marginTop: '2',
                  display: 'flex',
                  flexWrap: 'wrap',
                  columnGap: '6',
                  rowGap: '1',
                  fontSize: 'type.13',
                }),
              )
              .children(
                ...figures.map(([name, value]) =>
                  h.div
                    .key(name)
                    .class(
                      css({
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '1.5',
                      }),
                    )
                    .children(
                      h.dt
                        .class(
                          css({
                            color: 'mutedForeground',
                          }),
                        )
                        .children(name),
                      h.dd
                        .class(
                          cx(
                            FIGURE,
                            css({
                              fontSize: 'type.12',
                            }),
                          ),
                        )
                        .children(value),
                    ),
                ),
              ),
            h.div
              .class(
                css({
                  marginTop: '3',
                  maxWidth: '28rem',
                }),
              )
              .children(mixBar(l, def.mix, h, false)),
            h.p
              .class(
                css({
                  marginTop: '2',
                  fontSize: 'type.13',
                  color: 'mutedForeground',
                }),
              )
              .children(arrivals(l, index)),
          )
      }),
    )
}

export const eraPages = <Msg>(l: Lang): ReadonlyArray<Page<Msg>> => {
  const t = l.t.reference.eras
  const entities = l.cat.ERAS.map((def, index) => entity<Msg>(l, def, index))
  const hub = pageOf<Msg>(l, {
    kind: 'era',
    path: '/eras',
    title: t.title,
    summary: t.summary,
    order: 2,
    aliases: t.aliases,
    headings: headingsFor([l.title('theClimb')]),
    text: l.cat.ERAS.map((def) => `${def.name} ${def.question}`).join(' '),
    body: (h) =>
      h.div
        .class(proseStyle)
        .children(paragraph(t.intro, h), section(l.title('theClimb'), [timeline(l, h)], h)),
  })
  return [hub, ...entities]
}
