import {
  ACHIEVEMENT_IDS,
  ERAS,
  EXIT_IDS,
  FAMILY_IDS,
  FEATURE_IDS,
  IAC_TOOLS,
  IAC_TOOL_INFO,
  MUTATOR_IDS,
  PERK_IDS,
  POLICY_IDS,
  REGIONS,
  SIZES,
  TASK_IDS,
  VENTURE_IDS,
  rttOf,
} from '@quorum/simulation/catalog'
import { GUIDED_SUMMARY, SANDBOX_IDS, type GuidedSummary } from '@quorum/simulation/sandbox-summary'
import { css } from '@quorum/styled-system/css'
import { compact, money } from '@quorum/ui/game/format'
import { proseStyle } from '../../prose-style.ts'
import type { Page } from '../page.ts'
import { prose } from '../prose.ts'
import {
  authored,
  eraName,
  eraPath,
  headingsFor,
  link,
  linkList,
  page,
  paragraph,
  percent,
  researchLink,
  section,
  table,
  titleOf,
  type Lang,
} from './shared.ts'
import { componentList, componentsPlacing, incidentPath, sandboxPath } from './systems-links.ts'

/** `page` keeps the shared defaults but its body is typed for `never`; these bodies send no message. */
const definePage = <Msg>(l: Lang, fields: Parameters<typeof page>[1]): Page<Msg> =>
  page(l, fields) as Page<Msg>

const team = <Msg>(l: Lang): Page<Msg> => {
  const t = l.t.reference.team
  const { POLICIES, FEATURES, TASKS } = l.cat
  return definePage<Msg>(l, {
    kind: 'system',
    path: '/team',
    title: t.title,
    summary: t.summary,
    order: 7,
    aliases: t.aliases,
    headings: headingsFor([l.title('policies'), l.title('features'), l.title('tasks')]),
    text: [
      ...FEATURE_IDS.map((id) => `${FEATURES[id].name} ${FEATURES[id].effect}`),
      ...TASK_IDS.map((id) => TASKS[id].name),
    ].join(' '),
    body: (h) =>
      h.div.class(proseStyle).children(
        paragraph(t.intro, h),
        section(
          l.title('policies'),
          [
            table(
              t.policyColumns,
              POLICY_IDS.map((id) => {
                const def = POLICIES[id]
                return {
                  key: id,
                  cells: [
                    def.label,
                    `×${def.velocity}`,
                    percent(def.debt),
                    `×${def.badDeploy}`,
                    String(def.deploysPerDay),
                  ],
                }
              }),
              h,
              [1, 2, 3, 4],
            ),
          ],
          h,
        ),
        section(
          l.title('features'),
          [
            table(
              t.featureColumns,
              FEATURE_IDS.map((id) => {
                const def = FEATURES[id]
                return {
                  key: id,
                  cells: [
                    def.research
                      ? h.span.children(def.name, h.br, researchLink(l, def.research, h))
                      : def.name,
                    link(eraPath(def.era), eraName(l, def.era), h),
                    String(def.dh),
                    def.effect,
                    def.hidden ?? '—',
                  ],
                }
              }),
              h,
              [2],
            ),
          ],
          h,
        ),
        section(
          l.title('tasks'),
          [
            table(
              t.taskColumns,
              TASK_IDS.filter((id) => !TASKS[id].internal).map((id) => {
                const def = TASKS[id]
                return {
                  key: id,
                  cells: [
                    def.name,
                    String(def.dh),
                    def.effect,
                    def.research ? researchLink(l, def.research, h) : '—',
                  ],
                }
              }),
              h,
              [1],
            ),
          ],
          h,
        ),
      ),
  })
}

const infrastructure = <Msg>(l: Lang): Page<Msg> => {
  const t = l.t.reference.infrastructure
  const { FAMILIES, REGION_INFO } = l.cat
  return definePage<Msg>(l, {
    kind: 'system',
    path: '/infrastructure',
    title: t.title,
    summary: t.summary,
    order: 8,
    aliases: t.aliases,
    headings: headingsFor([
      l.title('instanceFamilies'),
      l.title('sizes'),
      l.title('regions'),
      l.title('roundTrips'),
      l.title('iacTools'),
    ]),
    text: [
      ...FAMILY_IDS.map((id) => FAMILIES[id].blurb),
      ...REGIONS.map((id) => REGION_INFO[id].name),
    ].join(' '),
    body: (h) =>
      h.div.class(proseStyle).children(
        section(
          l.title('instanceFamilies'),
          [
            table(
              t.familyColumns,
              FAMILY_IDS.map((id) => {
                const def = FAMILIES[id]
                return {
                  key: id,
                  cells: [def.name, `${def.ramPerVcpu} GB`, `×${def.price}`, def.blurb],
                }
              }),
              h,
              [1, 2],
            ),
          ],
          h,
        ),
        section(
          l.title('sizes'),
          [
            paragraph(t.sizesIntro, h),
            table(
              t.sizeColumns,
              SIZES.map((size) => ({
                key: size.name,
                cells: [size.name, String(size.vcpu), `${size.gbps} Gbps`],
              })),
              h,
              [1, 2],
            ),
          ],
          h,
        ),
        section(
          l.title('regions'),
          [
            table(
              t.regionColumns,
              REGIONS.map((id) => {
                const def = REGION_INFO[id]
                return {
                  key: id,
                  cells: [def.name, percent(def.share), `+${def.offset / 60} h`],
                }
              }),
              h,
              [1, 2],
            ),
          ],
          h,
        ),
        section(
          l.title('roundTrips'),
          [
            paragraph(t.roundTripsIntro, h),
            table(
              [t.from, ...REGIONS.map((id) => REGION_INFO[id].short)],
              REGIONS.map((from) => ({
                key: from,
                cells: [REGION_INFO[from].name, ...REGIONS.map((to) => `${rttOf(from, to)} ms`)],
              })),
              h,
              REGIONS.map((_, index) => index + 1),
            ),
          ],
          h,
        ),
        section(
          l.title('iacTools'),
          [
            table(
              t.iacColumns,
              IAC_TOOLS.map((id) => {
                const def = IAC_TOOL_INFO[id]
                return {
                  key: id,
                  cells: [
                    def.name,
                    def.language,
                    def.refreshOnPlan
                      ? t.onEveryPlan
                      : t.whenYouRun(String(def.refresh), Boolean(def.repair)),
                  ],
                }
              }),
              h,
            ),
          ],
          h,
        ),
      ),
  })
}

const prestige = <Msg>(l: Lang): Page<Msg> => {
  const t = l.t.reference.prestige
  const { EXITS, PERKS, VENTURES, MUTATORS, ACHIEVEMENTS } = l.cat
  return definePage<Msg>(l, {
    kind: 'system',
    path: '/prestige',
    title: t.title,
    summary: t.summary,
    order: 9,
    aliases: t.aliases,
    headings: headingsFor([
      l.title('exits'),
      l.title('perks'),
      l.title('ventures'),
      l.title('mutators'),
      l.title('achievements'),
    ]),
    text: [
      ...PERK_IDS.map((id) => `${PERKS[id].name} ${PERKS[id].effect}`),
      ...VENTURE_IDS.map((id) => `${VENTURES[id].name} ${VENTURES[id].summary}`),
      ...MUTATOR_IDS.map((id) => `${MUTATORS[id].name} ${MUTATORS[id].rule}`),
      ...ACHIEVEMENT_IDS.map((id) => `${ACHIEVEMENTS[id].name} ${ACHIEVEMENTS[id].condition}`),
    ].join(' '),
    body: (h) =>
      h.div.class(proseStyle).children(
        paragraph(t.intro, h),
        section(
          l.title('exits'),
          [
            table(
              t.exitColumns,
              EXIT_IDS.map((id) => {
                const def = EXITS[id]
                return {
                  key: id,
                  cells: [
                    def.name,
                    link(eraPath(def.stage), l.cat.ERAS[def.stage]?.name ?? '', h),
                    Number.isFinite(def.cap) ? money(def.cap) : t.uncapped,
                    `×${def.multiplier}`,
                    def.continues ? l.t.reference.yes : l.t.reference.no,
                  ],
                }
              }),
              h,
              [2, 3],
            ),
          ],
          h,
        ),
        section(
          l.title('perks'),
          [
            table(
              t.perkColumns,
              PERK_IDS.map((id) => {
                const def = PERKS[id]
                return {
                  key: id,
                  cells: [
                    def.name,
                    def.effect,
                    String(def.costs.length),
                    def.costs.map(compact).join(' · '),
                  ],
                }
              }),
              h,
              [2, 3],
            ),
          ],
          h,
        ),
        section(
          l.title('ventures'),
          [
            h.p.children(
              t.venturesBefore,
              link('/ventures', l.t.reference.ventures.title, h),
              t.venturesAfter,
            ),
            table(
              t.ventureColumns,
              VENTURE_IDS.map((id) => {
                const def = VENTURES[id]
                return {
                  key: id,
                  cells: [link(`/ventures#${id}`, def.name, h), def.summary, `×${def.legacy}`],
                }
              }),
              h,
              [2],
            ),
          ],
          h,
        ),
        section(
          l.title('mutators'),
          [
            table(
              t.mutatorColumns,
              MUTATOR_IDS.map((id) => {
                const def = MUTATORS[id]
                return { key: id, cells: [def.name, def.rule, `+${percent(def.legacy)}`] }
              }),
              h,
              [2],
            ),
          ],
          h,
        ),
        section(
          l.title('achievements'),
          [
            table(
              t.achievementColumns,
              ACHIEVEMENT_IDS.map((id) => {
                const def = ACHIEVEMENTS[id]
                return { key: id, cells: [def.name, def.condition] }
              }),
              h,
            ),
          ],
          h,
        ),
      ),
  })
}

const sandbox = <Msg>(l: Lang, def: GuidedSummary): Page<Msg> => {
  const t = l.t.reference.sandboxes
  const path = sandboxPath(def.id)
  const found = authored(l.locale, path)
  const taughtOn = componentsPlacing(def.id)
  const incidents = [
    ...new Set(def.objectives.flatMap((objective) => objective.incident?.kind ?? [])),
  ]
  return definePage<Msg>(l, {
    kind: 'system',
    path,
    title: def.name,
    summary: def.objectives[0]?.goal ?? def.name,
    parent: '/sandboxes',
    order: SANDBOX_IDS.indexOf(def.id),
    era: def.stage,
    aliases: [...t.entityAliases, def.id],
    source: found.source,
    fallback: found.fallback,
    headings: [
      ...found.headings,
      ...headingsFor([
        l.title('objectives'),
        incidents.length ? l.title('incidentsItFires') : null,
        taughtOn.length ? l.title('whereTaught') : null,
      ]),
    ],
    text: `${def.objectives.map((objective) => objective.goal).join(' ')} ${found.text}`,
    body: (h) =>
      h.div.class(proseStyle).children(
        h.p.children(
          t.guidedBefore,
          link(eraPath(def.stage), eraName(l, def.stage), h),
          t.guidedAfter,
        ),
        ...(found.prose === null
          ? []
          : [prose(h, l.locale, found.prose.document, found.prose.anchors ?? undefined)]),
        section(
          l.title('objectives'),
          [
            h.ol.children(
              ...def.objectives.map((objective, index) =>
                h.li
                  .key(String(index))
                  .children(
                    objective.goal,
                    objective.users
                      ? h.span
                          .class(css({ color: 'mutedForeground' }))
                          .children(t.users(compact(objective.users)))
                      : h.span.children(),
                  ),
              ),
            ),
          ],
          h,
        ),
        incidents.length
          ? section(
              l.title('incidentsItFires'),
              [
                h.p.children(
                  linkList(
                    l,
                    incidents.map((id) => link(incidentPath(id), l.cat.INCIDENTS[id].name, h)),
                    h,
                  ),
                ),
              ],
              h,
            )
          : h.span.children(),
        taughtOn.length
          ? section(l.title('whereTaught'), [componentList(l, taughtOn, h)], h)
          : h.span.children(),
      ),
    related: ['/sandboxes'],
  })
}

export const systemPages = <Msg>(l: Lang): ReadonlyArray<Page<Msg>> => {
  const t = l.t.reference.sandboxes
  const sandboxes = SANDBOX_IDS.map((id) => sandbox<Msg>(l, l.cat.GUIDED[id]))
  const eraTitles = ERAS.map((era, index) => titleOf(era.name, l.cat.ERAS[index]?.name ?? era.name))
  const sandboxHub = definePage<Msg>(l, {
    kind: 'system',
    path: '/sandboxes',
    title: t.title,
    summary: t.summary,
    order: 11,
    aliases: t.aliases,
    headings: headingsFor(
      eraTitles.map((title, index) =>
        sandboxes.some((entry) => entry.era === index) ? title : null,
      ),
    ),
    text: sandboxes.map((entry) => entry.title).join(' '),
    body: (h) =>
      h.div.class(proseStyle).children(
        paragraph(t.intro, h),
        ...eraTitles.map((title, index) => {
          const items = SANDBOX_IDS.filter((id) => GUIDED_SUMMARY[id].stage === index)
          return items.length
            ? section(
                title,
                [
                  h.ul.children(
                    ...items.map((id) =>
                      h.li.key(id).children(link(sandboxPath(id), l.cat.GUIDED[id].name, h)),
                    ),
                  ),
                ],
                h,
              )
            : h.span.children()
        }),
      ),
  })
  return [team<Msg>(l), infrastructure<Msg>(l), prestige<Msg>(l), sandboxHub, ...sandboxes]
}
