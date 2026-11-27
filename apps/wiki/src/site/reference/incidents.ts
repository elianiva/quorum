import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import {
  COMPONENT_IDS,
  INCIDENT_IDS,
  type ComponentId,
  type IncidentDef,
  type IncidentId,
} from '@quorum/simulation/catalog'
import { GUIDED_SUMMARY, SANDBOX_IDS, type SandboxId } from '@quorum/simulation/sandbox-summary'
import { BY_INCIDENT } from '@quorum/simulation/term-links'
import { css, cx } from '@quorum/styled-system/css'
import { duration } from '@quorum/ui/game/format'
import { proseStyle } from '../../prose-style.ts'
import { linksFrom } from '../content.ts'
import type { Page } from '../page.ts'
import { prose } from '../prose.ts'
import { FIGURE } from './eras-visuals.ts'
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
  section,
  table,
  termsSection,
  type Lang,
} from './shared.ts'
import { componentList } from './systems-links.ts'

export const incidentPath = (id: IncidentDef['id']): string => `/incidents/${id}`

/**
 * `page` fills in the defaults a generated page shares, but its fields are
 * typed for one message type. The pages here carry their own.
 */
const pageOf = <Msg>(
  l: Lang,
  fields: Partial<Page<Msg>> & Pick<Page<Msg>, 'kind' | 'path' | 'title' | 'summary'>,
): Page<Msg> => page(l, fields as never) as Page<Msg>

const PRODUCTION: Partial<Record<IncidentDef['id'], string>> = {
  config: '/patterns/one-control-plane-73-hours',
  'disk-full': '/patterns/one-command-removed-the-index',
  regex: '/patterns/canary-the-edge-rules',
}

const SEVERITY_CLASS: Record<1 | 2 | 3, string> = {
  1: css({ backgroundColor: 'danger', color: 'background' }),
  2: css({ backgroundColor: 'warn', color: 'background' }),
  3: css({
    backgroundColor: 'color-mix(in oklab, var(--foreground) 10%, transparent)',
    color: 'foreground',
  }),
}

const severityChip = <Msg>(severity: 1 | 2 | 3, h: H<Msg>): View.Content<Msg> =>
  h.span
    .class(
      cx(
        FIGURE,
        css({
          display: 'inline-flex',
          borderRadius: 'md',
          paddingInline: '1.5',
          paddingBlock: '0.5',
          fontSize: 'type.11',
          fontWeight: 'semibold',
        }),
        SEVERITY_CLASS[severity],
      ),
    )
    .children(`SEV${severity}`)

const componentLinks = new Map(
  COMPONENT_IDS.map((id) => [id, linksFrom(`/components/${id}`)] as const),
)

const componentsHitBy = (incident: IncidentId): ReadonlyArray<ComponentId> =>
  COMPONENT_IDS.filter((id) => componentLinks.get(id)?.paths.has(`/incidents/${incident}`))

const sandboxesFiring = (incident: IncidentId): ReadonlyArray<SandboxId> =>
  SANDBOX_IDS.filter((id) =>
    GUIDED_SUMMARY[id].objectives.some((objective) => objective.incident?.kind === incident),
  )

const entity = <Msg>(l: Lang, def: IncidentDef): Page<Msg> => {
  const t = l.t.reference.incidents
  const path = incidentPath(def.id)
  const text = authored(l.locale, path)
  const hits = componentsHitBy(def.id)
  const practice = sandboxesFiring(def.id)
  const productionPath = PRODUCTION[def.id]
  const production = productionPath ? t.production[def.id as keyof typeof t.production] : null
  return pageOf<Msg>(l, {
    kind: 'incident',
    path,
    title: def.name,
    summary: def.cause,
    parent: '/incidents',
    order: INCIDENT_IDS.indexOf(def.id),
    era: def.era,
    aliases: [def.id, ...t.entityAliases],
    source: text.source,
    fallback: text.fallback,
    headings: [
      ...text.headings,
      ...headingsFor([
        l.title('whatHappens'),
        production ? l.title('seenInProduction') : null,
        l.title('howToPrevent'),
        hits.length ? l.title('componentsItHits') : null,
        practice.length ? l.title('practiceIt') : null,
        BY_INCIDENT[def.id]?.length ? l.title('engineeringTerms') : null,
      ]),
    ],
    text: `${def.cause} ${def.prevention} ${text.text} ${production?.label ?? ''}`,
    aside: (h) =>
      factsBox(
        l,
        def.name,
        severityChip(def.severity, h),
        null,
        [
          { name: t.firstEra, value: link(eraPath(def.era), eraName(l, def.era), h) },
          { name: t.startsAt, value: `SEV${def.severity}` },
          {
            name: t.escalatesTo,
            value: def.escalatesTo === def.severity ? '—' : `SEV${def.escalatesTo}`,
          },
          { name: t.lasts, value: duration(def.duration) },
        ],
        h,
      ),
    body: (h) =>
      h.div.class(proseStyle).children(
        section(l.title('whatHappens'), [paragraph(def.cause, h)], h),
        ...(text.prose
          ? [prose(h, l.locale, text.prose.document, text.prose.anchors ?? undefined)]
          : []),
        ...(production && productionPath
          ? [
              section(
                l.title('seenInProduction'),
                [
                  h.p.children(
                    production.sentence,
                    l.t.reference.sentenceGap,
                    link(productionPath, production.label, h),
                    t.shapeAndLimit,
                  ),
                ],
                h,
              ),
            ]
          : []),
        section(
          l.title('howToPrevent'),
          [
            paragraph(def.prevention, h),
            ...(def.actions.length
              ? [
                  h.p.children(t.postmortem),
                  h.ol.children(
                    ...def.actions.map((id) => h.li.key(id).children(researchLink(l, id, h))),
                  ),
                ]
              : []),
          ],
          h,
        ),
        hits.length
          ? section(l.title('componentsItHits'), [componentList(l, hits, h)], h)
          : h.span.children(),
        practice.length
          ? section(
              l.title('practiceIt'),
              [
                h.p.children(
                  linkList(
                    l,
                    practice.map((id) => link(`/sandboxes/${id}`, l.cat.GUIDED[id].name, h)),
                    h,
                  ),
                ),
              ],
              h,
            )
          : h.span.children(),
        termsSection(l, BY_INCIDENT[def.id], h),
      ),
    related: ['/incidents', '/mechanics/incidents'],
  })
}

export const incidentPages = <Msg>(l: Lang): ReadonlyArray<Page<Msg>> => {
  const t = l.t.reference.incidents
  const incidents = l.cat.INCIDENTS
  const entities = INCIDENT_IDS.map((id) => entity<Msg>(l, incidents[id]))
  const hub = pageOf<Msg>(l, {
    kind: 'incident',
    path: '/incidents',
    title: t.title,
    summary: t.summary,
    order: 5,
    aliases: t.aliases,
    headings: headingsFor([l.title('allIncidents')]),
    text: entities.map((entry) => entry.title).join(' '),
    body: (h) =>
      h.div.class(proseStyle).children(
        paragraph(t.intro, h),
        section(
          l.title('allIncidents'),
          [
            table(
              t.columns,
              [...INCIDENT_IDS]
                .sort((a, b) => incidents[a].era - incidents[b].era)
                .map((id) => {
                  const def = incidents[id]
                  return {
                    key: id,
                    cells: [
                      link(incidentPath(id), def.name, h),
                      h.span
                        .class(
                          css({
                            whiteSpace: 'nowrap',
                          }),
                        )
                        .children(eraName(l, def.era)),
                      severityChip(def.severity, h),
                      def.actions[0] ? researchLink(l, def.actions[0], h) : '—',
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
  return [hub, ...entities]
}
