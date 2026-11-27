import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { CVE_TERMS, GLOSSARY_CATEGORIES, type GlossaryEntry } from '@quorum/simulation/catalog'
import { css, cx } from '@quorum/styled-system/css'
import { proseStyle } from '../../prose-style.ts'
import type { Page } from '../page.ts'
import { prose } from '../prose.ts'
import { EYEBROW } from './eras-visuals.ts'
import {
  authored,
  headingsFor,
  link,
  linkList,
  page,
  paragraph,
  section,
  termName,
  termPath,
  titleOf,
  type Lang,
} from './shared.ts'

export { termPath }

/**
 * `page` fills in the defaults a generated page shares, but its fields are
 * typed for one message type. The pages here carry their own.
 */
const pageOf = <Msg>(
  l: Lang,
  fields: Partial<Page<Msg>> & Pick<Page<Msg>, 'kind' | 'path' | 'title' | 'summary'>,
): Page<Msg> => page(l, fields as never) as Page<Msg>

const CATEGORY_NAMES: Readonly<Record<(typeof GLOSSARY_CATEGORIES)[number], string>> = {
  performance: 'Performance',
  reliability: 'Reliability',
  observability: 'Observability',
  data: 'Data',
  runtimes: 'Runtimes',
  network: 'Network',
  security: 'Security',
  delivery: 'Delivery',
  team: 'Team',
  business: 'Business',
}

const entity = <Msg>(l: Lang, entry: GlossaryEntry, order: number): Page<Msg> => {
  const path = termPath(entry.id)
  const found = authored(l.locale, path)
  const category = l.t.reference.categories[entry.category]
  return pageOf<Msg>(l, {
    kind: 'glossary',
    path,
    title: entry.term,
    summary: entry.definition,
    parent: '/glossary',
    order,
    aliases: [...new Set([entry.id, category, CATEGORY_NAMES[entry.category]])],
    source: found.source,
    fallback: found.fallback,
    headings: [
      ...headingsFor([l.title('inQuorum'), entry.design?.length ? l.title('design') : null]),
      ...found.headings,
      ...headingsFor([
        entry.related.length ? l.title('readNext') : null,
        entry.links.length ? l.title('learnMore') : null,
      ]),
    ],
    text: `${entry.definition} ${entry.inGame} ${found.text}`,
    body: (h) =>
      h.div.class(proseStyle).children(
        h.p.children(
          h.span
            .class(
              cx(
                EYEBROW,
                css({
                  marginRight: '2',
                }),
              ),
            )
            .children(category),
        ),
        section(l.title('inQuorum'), [paragraph(entry.inGame, h)], h),
        entry.design?.length
          ? section(
              l.title('design'),
              [
                h.p.children(
                  linkList(
                    l,
                    entry.design.map((target) => link(target.url, target.label, h)),
                    h,
                  ),
                ),
              ],
              h,
            )
          : h.span.children(),
        ...(found.prose
          ? [prose(h, l.locale, found.prose.document, found.prose.anchors ?? undefined)]
          : []),
        entry.related.length
          ? section(
              l.title('readNext'),
              [
                h.p.children(
                  linkList(
                    l,
                    entry.related.map((id) => link(termPath(id), termName(l, id), h)),
                    h,
                  ),
                ),
              ],
              h,
            )
          : h.span.children(),
        entry.links.length
          ? section(
              l.title('learnMore'),
              [
                h.ul.children(
                  ...entry.links.map((source) =>
                    h.li
                      .key(source.url)
                      .children(
                        h.a
                          .attr('href', source.url)
                          .attr('rel', 'noopener')
                          .attr('target', '_blank')
                          .children(source.label),
                      ),
                  ),
                ),
              ],
              h,
            )
          : h.span.children(),
      ),
    related: ['/glossary'],
  })
}

const termList = <Msg>(entries: ReadonlyArray<GlossaryEntry>, h: H<Msg>): View.Content<Msg> =>
  h.ul
    .class(
      cx(
        css({
          display: 'grid',
          columnGap: '6',
          rowGap: '1.5',
          sm: {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          },
        }),
        'not-prose',
      ),
    )
    .children(
      ...entries.map((entry) =>
        h.li
          .key(entry.id)
          .class(
            css({
              fontSize: 'type.14',
            }),
          )
          .children(link(termPath(entry.id), entry.term, h)),
      ),
    )

export const glossaryPages = <Msg>(l: Lang): ReadonlyArray<Page<Msg>> => {
  const t = l.t.reference.glossary
  const terms: ReadonlyArray<GlossaryEntry> = [...l.cat.GLOSSARY, ...CVE_TERMS]
  const sorted = [...terms].sort((a, b) => a.term.localeCompare(b.term, l.locale))
  const entities = terms.map((entry, index) => entity<Msg>(l, entry, index))
  const categories = GLOSSARY_CATEGORIES.map((category) =>
    titleOf(CATEGORY_NAMES[category], l.t.reference.categories[category]),
  )
  const hub = pageOf<Msg>(l, {
    kind: 'glossary',
    path: '/glossary',
    title: t.title,
    summary: t.summary,
    order: 6,
    aliases: t.aliases,
    headings: headingsFor(categories),
    text: terms.map((entry) => entry.term).join(' '),
    body: (h) =>
      h.div.class(proseStyle).children(
        paragraph(t.intro, h),
        ...GLOSSARY_CATEGORIES.map((category, index) =>
          section(
            categories[index] ?? titleOf(category, category),
            [
              termList(
                sorted.filter((entry) => entry.category === category),
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
