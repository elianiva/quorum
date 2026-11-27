import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import {
  COMPONENTS,
  COMPONENT_IDS,
  COPY_PRICE_GROWTH,
  CVE_DEFS,
  DOCK_GROUPS,
  DOCK_OF,
  REQUEST_KINDS,
  RESEARCH,
  SELL_REFUND,
  SIZES,
  researchList,
  type ComponentDef,
  type ComponentId,
  type ResearchId,
} from '@quorum/simulation/catalog'
import { BY_COMPONENT } from '@quorum/simulation/term-links'
import { css } from '@quorum/styled-system/css'
import { money, ms } from '@quorum/ui/game/format'
import { proseStyle } from '../../prose-style.ts'
import type { Page } from '../page.ts'
import { prose } from '../prose.ts'
import { componentBadge } from '../badge.ts'
import { linksFrom } from '../content.ts'
import { nodeCard } from './components-node-card.ts'
import { pageOf } from './components-page.ts'
import {
  authored,
  cardGrid,
  eraName,
  eraPath,
  factsBox,
  headingsFor,
  hubCard,
  link,
  linkList,
  paragraph,
  researchLink,
  section,
  termsSection,
  titleOf,
  type Fact,
  type Lang,
} from './shared.ts'

export const componentPath = (id: ComponentId): string => `/components/${id}`

export const componentEra = (def: ComponentDef): number =>
  def.unlock ? RESEARCH[def.unlock].era : 0

const dockTitles = (l: Lang) =>
  DOCK_GROUPS.map((group, index) =>
    titleOf(group.label, l.cat.DOCK_GROUPS[index]?.label ?? group.label),
  )

const kinds = (l: Lang, list: ReadonlyArray<keyof Lang['cat']['KINDS']>): string =>
  list.length === REQUEST_KINDS.length
    ? l.t.reference.components.everyKind
    : list.length
      ? list.map((kind) => l.cat.KINDS[kind].label).join(', ')
      : '—'

const facts = <Msg>(l: Lang, def: ComponentDef, h: H<Msg>): ReadonlyArray<Fact<Msg>> => {
  const t = l.t.reference.components
  return [
    { name: t.code, value: def.code },
    { name: t.realProduct, value: def.product },
    {
      name: t.group,
      value: l.cat.DOCK_GROUPS.find((group) => group.key === DOCK_OF[def.id])?.label ?? def.group,
    },
    {
      name: t.unlockedBy,
      value: def.unlock ? researchLink(l, def.unlock, h) : t.starterKit,
    },
    {
      name: t.era,
      value: link(eraPath(componentEra(def)), eraName(l, componentEra(def)), h),
    },
    ...(def.fixed
      ? [{ name: t.placed, value: t.alwaysOnBoard }]
      : [
          { name: t.place, value: t.firstCopy(money(def.cost)) },
          { name: t.burn, value: def.sized ? t.byInstanceType : `${money(def.burn)}/s` },
        ]),
    {
      name: t.sizes,
      value: def.sized
        ? t.sizeRange(SIZES[0].name, SIZES[SIZES.length - 1]?.name ?? '')
        : String(def.steps),
    },
    { name: t.overhead, value: def.latency ? ms(def.latency) : '—' },
    { name: t.takes, value: kinds(l, def.accepts) },
    { name: t.sends, value: kinds(l, def.sends) },
    ...(def.coldStart ? [{ name: t.coldStart, value: l.t.reference.yes }] : []),
  ]
}

const rules = <Msg>(l: Lang, def: ComponentDef, h: H<Msg>): ReadonlyArray<View.Content<Msg>> => {
  const t = l.t.reference.components
  return def.fixed
    ? [paragraph(t.fixed(def.name), h)]
    : [
        h.ul.children(
          h.li.children(t.copyGrowth(Math.round((COPY_PRICE_GROWTH - 1) * 100))),
          h.li.children(t.sellRefund(Math.round(SELL_REFUND * 100))),
          h.li.children(
            def.sized ? t.sizedRule : def.steps > 1 ? t.stepsRule(def.steps) : t.oneSize,
          ),
          ...(def.coldStart ? [h.li.children(t.coldRule)] : []),
          ...(def.tap ? [h.li.children(t.tapRule)] : []),
          ...(def.control ? [h.li.children(t.controlRule)] : []),
        ),
      ]
}

const componentLinks = new Map(
  COMPONENT_IDS.map((id) => [id, linksFrom(`/components/${id}`)] as const),
)

const worksWith = (component: ComponentId): ReadonlyArray<ComponentId> =>
  COMPONENT_IDS.filter(
    (id) =>
      id !== component &&
      (componentLinks.get(component)?.paths.has(`/components/${id}`) ||
        componentLinks.get(id)?.paths.has(`/components/${component}`)),
  )

const researchNext = (component: ComponentId): ReadonlyArray<ResearchId> => {
  const unlock = COMPONENTS[component].unlock
  return unlock
    ? researchList.filter((entry) => entry.requires.includes(unlock)).map((entry) => entry.id)
    : []
}

export const componentList = <Msg>(
  l: Lang,
  ids: ReadonlyArray<ComponentId>,
  h: H<Msg>,
): View.Content<Msg> =>
  h.p.children(
    linkList(
      l,
      ids.map((id) => link(componentPath(id), l.cat.COMPONENTS[id].name, h)),
      h,
    ),
  )

const entity = <Msg>(l: Lang, def: ComponentDef): Page<Msg> => {
  const t = l.t.reference.components
  const path = componentPath(def.id)
  const text = authored(l.locale, path)
  const cves = CVE_DEFS.filter((cve) => cve.affects.includes(def.id))
  const terms = BY_COMPONENT[def.id]
  const partners = worksWith(def.id)
  const next = researchNext(def.id)
  const unlockName = def.unlock ? l.cat.RESEARCH[def.unlock].name : def.name
  return pageOf<Msg>(l, {
    kind: 'component',
    path,
    title: def.name,
    summary: def.blurb,
    parent: '/components',
    order: COMPONENT_IDS.indexOf(def.id),
    era: componentEra(def),
    aliases: [def.code, def.product, ...def.product.split(/[,/]/).map((name) => name.trim())],
    source: text.source,
    fallback: text.fallback,
    headings: [
      ...text.headings,
      ...headingsFor([
        l.title('rules'),
        partners.length ? l.title('worksWith') : null,
        next.length ? l.title('researchNext') : null,
        cves.length ? l.title('security') : null,
        terms?.length ? l.title('engineeringTerms') : null,
      ]),
    ],
    text: `${def.product} ${def.blurb} ${text.text}`,
    aside: (h) =>
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '4',
            sm: {
              display: 'grid',
              gridTemplateColumns: '20rem minmax(0,1fr)',
              alignItems: 'start',
            },
            xl: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
            },
          }),
        )
        .children(
          h.div
            .class(
              css({
                overflow: 'hidden',
                borderRadius: 'lg',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'border',
                backgroundColor: 'canvas',
              }),
            )
            .children(nodeCard(l, def.id, h)),
          factsBox(
            l,
            def.name,
            componentBadge(def.id, css({ width: '8', height: '8' }), h),
            def.group,
            facts(l, def, h),
            h,
          ),
        ),
    body: (h) =>
      h.div.class(proseStyle).children(
        ...(text.prose
          ? [prose(h, l.locale, text.prose.document, text.prose.anchors ?? undefined)]
          : []),
        section(l.title('rules'), rules(l, def, h), h),
        ...(partners.length
          ? [section(l.title('worksWith'), [componentList(l, partners, h)], h)]
          : []),
        ...(next.length
          ? [
              section(
                l.title('researchNext'),
                [
                  paragraph(t.researchNextIntro(unlockName), h),
                  h.p.children(
                    linkList(
                      l,
                      next.map((id) => researchLink(l, id, h)),
                      h,
                    ),
                  ),
                ],
                h,
              ),
            ]
          : []),
        ...(cves.length
          ? [
              section(
                l.title('security'),
                [
                  paragraph(t.securityIntro, h),
                  h.ul.children(
                    ...cves.map((cve) =>
                      h.li.key(cve.id).children(t.cve(cve.id, cve.score.toFixed(1))),
                    ),
                  ),
                ],
                h,
              ),
            ]
          : []),
        termsSection(l, terms, h),
      ),
    related: [...(def.unlock ? [`/research/${def.unlock}`] : []), '/components'],
  })
}

export const componentPages = <Msg>(l: Lang): ReadonlyArray<Page<Msg>> => {
  const t = l.t.reference.components
  const entities = COMPONENT_IDS.map((id) => entity<Msg>(l, l.cat.COMPONENTS[id]))
  const titles = dockTitles(l)
  const hub = pageOf<Msg>(l, {
    kind: 'component',
    path: '/components',
    title: t.title,
    summary: t.summary,
    order: 1,
    aliases: t.aliases,
    headings: headingsFor(titles),
    text: entities.map((entry) => entry.title).join(' '),
    body: (h) =>
      h.div.class(proseStyle).children(
        paragraph(t.intro, h),
        ...DOCK_GROUPS.map((group, index) =>
          section(
            titles[index] ?? titleOf(group.label, group.label),
            [
              cardGrid(
                COMPONENT_IDS.filter((id) => DOCK_OF[id] === group.key).map((id) => {
                  const def = l.cat.COMPONENTS[id]
                  const entry = entities.find((candidate) => candidate.path === componentPath(id))!
                  /* `hubCard` reads a page's data fields only, so it takes the page without its message type. */
                  return hubCard(
                    entry as unknown as Page,
                    componentBadge(id, css({ width: '9', height: '9', flexShrink: '0' }), h),
                    `${def.code} · ${eraName(l, componentEra(def))}`,
                    h,
                  )
                }),
                h,
              ),
            ],
            h,
          ),
        ),
      ),
  })
  return [hub, ...entities]
}
