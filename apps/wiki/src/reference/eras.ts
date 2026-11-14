import type { Html } from 'foldkit/html'
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
} from '@quorum/simulation/catalog'
import { EYEBROW, FIGURE } from '@quorum/ui/game/bits'
import { compact, money } from '@quorum/ui/game/format'
import type { Page } from '../page.ts'
import { mixBar } from '../components/mix.ts'
import { componentEra, componentPath } from './components.ts'
import { incidentPath } from './incidents.ts'
import {
  authored,
  eraPath,
  factsBox,
  headingsFor,
  link,
  linkList,
  page,
  paragraph,
  percent,
  researchLink,
  section,
  type H,
  type Lang,
} from './shared.ts'
import { css, cx, cx as cn } from '@quorum/styled-system/css'

/* One page per Era, and a hub that runs them left to right as a timeline. */

const entity = (l: Lang, def: EraDef, index: number): Page => {
  const t = l.t.reference.eras
  const eras = l.cat.ERAS
  const path = eraPath(index)
  const text = authored(l, path)
  const next = eras[index + 1]
  const components = COMPONENT_IDS.filter((id) => componentEra(COMPONENTS[id]) === index)
  const research = researchList.filter((entry) => entry.era === index)
  const incidents = INCIDENT_IDS.filter((id) => INCIDENTS[id].era === index)
  const features = FEATURE_IDS.filter((id) => FEATURES[id].era === index)
  const exits = EXIT_IDS.filter((id) => EXITS[id].stage === index)
  return page(l, {
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
    aside: (_model, h) =>
      factsBox(
        l,
        def.name,
        h.span(
          [
            h.Class(
              cn(
                FIGURE,
                css({
                  display: 'grid',
                  width: '1.5rem',
                  height: '1.5rem',
                  placeItems: 'center',
                  borderRadius: 'md',
                  backgroundColor: 'var(--foreground)',
                  fontSize: '11px',
                  color: 'var(--background)',
                }),
              ),
            ),
          ],
          [String(index)],
        ),
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
    body: (model, h) =>
      h.div(
        [h.Class('prose')],
        [
          ...(text.view ? [text.view(model, h)] : []),
          section(
            l.title('traffic'),
            [
              paragraph(def.arrivals, h),
              paragraph(t.defaultShares, h),
              mixBar(def.mix, h),
              h.p(
                [],
                [
                  t.profileBefore,
                  link('/ventures', l.t.reference.ventures.title, h),
                  t.profileAfter,
                ],
              ),
            ],
            h,
          ),
          next
            ? section(
                l.title('raisingNext'),
                [
                  h.p(
                    [],
                    [
                      t.raise(
                        compact(def.raiseAt),
                        next.name,
                        money(def.grant),
                        percent(def.dilution),
                      ),
                      link(eraPath(index + 1), next.name, h),
                      t.raiseAfter,
                    ],
                  ),
                ],
                h,
              )
            : h.empty,
          section(
            l.title('whatArrives'),
            [
              h.dl(
                [
                  h.Class(
                    css({
                      display: 'grid',
                      columnGap: '1.5rem',
                      rowGap: '0.75rem',
                      sm: {
                        gridTemplateColumns: '10rem 1fr',
                      },
                    }),
                  ),
                ],
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
                ].flatMap(([label, items]) =>
                  (items as ReadonlyArray<Html>).length
                    ? [
                        h.dt(
                          [
                            h.Key(`${label}-t`),
                            h.Class(
                              cn(
                                EYEBROW,
                                css({
                                  paddingTop: '0.25rem',
                                }),
                              ),
                            ),
                          ],
                          [label as string],
                        ),
                        h.dd(
                          [
                            h.Key(`${label}-d`),
                            h.Class(
                              css({
                                margin: '0',
                              }),
                            ),
                          ],
                          [linkList(items as ReadonlyArray<Html>, h)],
                        ),
                      ]
                    : [],
                ),
              ),
            ],
            h,
          ),
        ],
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

/** The Eras top to bottom, on one line: each with its question, its numbers, and its traffic. */
const timeline = (l: Lang, h: H): Html => {
  const t = l.t.reference.eras
  const eras = l.cat.ERAS
  return h.ol(
    [
      h.Class(
        cx(
          css({
            position: 'relative',
            marginBlock: '2rem',
            borderLeftWidth: '1px',
            borderLeftStyle: 'solid',
            borderColor: 'var(--border)',
          }),
          'not-prose',
        ),
      ),
    ],
    eras.map((def, index) => {
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
      return h.li(
        [
          h.Key(def.name),
          h.Class(
            css({
              position: 'relative',
              paddingBottom: '2.5rem',
              paddingLeft: '2rem',
              '&:last-child': {
                paddingBottom: '0',
              },
            }),
          ),
        ],
        [
          h.span(
            [
              h.AriaHidden(true),
              h.Class(
                cn(
                  FIGURE,
                  css({
                    position: 'absolute',
                    top: '0',
                    left: '-0.75rem',
                    display: 'grid',
                    width: '1.5rem',
                    height: '1.5rem',
                    placeItems: 'center',
                    borderRadius: '9999px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--background)',
                    fontSize: '11px',
                    color: 'var(--muted-foreground)',
                  }),
                ),
              ),
            ],
            [String(index + 1)],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  columnGap: '0.75rem',
                  rowGap: '0.25rem',
                }),
              ),
            ],
            [
              h.a(
                [
                  h.Href(eraPath(index)),
                  h.Class(
                    css({
                      fontSize: '16px',
                      fontWeight: '600',
                      letterSpacing: '-0.025em',
                      _hover: {
                        textDecorationLine: 'underline',
                      },
                    }),
                  ),
                ],
                [def.name],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: '15px',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                ],
                [def.question],
              ),
            ],
          ),
          h.dl(
            [
              h.Class(
                css({
                  marginTop: '0.5rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  columnGap: '1.5rem',
                  rowGap: '0.25rem',
                  fontSize: '13px',
                }),
              ),
            ],
            figures.map(([name, value]) =>
              h.div(
                [
                  h.Key(name),
                  h.Class(
                    css({
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.375rem',
                    }),
                  ),
                ],
                [
                  h.dt(
                    [
                      h.Class(
                        css({
                          color: 'var(--muted-foreground)',
                        }),
                      ),
                    ],
                    [name],
                  ),
                  h.dd(
                    [
                      h.Class(
                        cn(
                          FIGURE,
                          css({
                            fontSize: '12px',
                          }),
                        ),
                      ),
                    ],
                    [value],
                  ),
                ],
              ),
            ),
          ),
          h.div(
            [
              h.Class(
                css({
                  marginTop: '0.75rem',
                  maxWidth: '28rem',
                }),
              ),
            ],
            [mixBar(def.mix, h, false)],
          ),
          h.p(
            [
              h.Class(
                css({
                  marginTop: '0.5rem',
                  fontSize: '13px',
                  color: 'var(--muted-foreground)',
                }),
              ),
            ],
            [arrivals(l, index)],
          ),
        ],
      )
    }),
  )
}

export const eraPages = (l: Lang): ReadonlyArray<Page> => {
  const t = l.t.reference.eras
  const entities = l.cat.ERAS.map((def, index) => entity(l, def, index))
  const hub = page(l, {
    path: '/eras',
    title: t.title,
    summary: t.summary,
    order: 2,
    aliases: t.aliases,
    headings: headingsFor([l.title('theClimb')]),
    text: l.cat.ERAS.map((def) => `${def.name} ${def.question}`).join(' '),
    body: (_model, h) =>
      h.div(
        [h.Class('prose')],
        [paragraph(t.intro, h), section(l.title('theClimb'), [timeline(l, h)], h)],
      ),
  })
  return [hub, ...entities]
}
