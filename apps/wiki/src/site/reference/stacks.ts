import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import {
  AXES,
  FRAMEWORK_IDS,
  LANGUAGES,
  LANGUAGE_IDS,
  RUNTIME_IDS,
  type Axes,
  type FrameworkDef,
  type RuntimeDef,
} from '@quorum/simulation/catalog'
import { css } from '@quorum/styled-system/css'
import { ms } from '@quorum/ui/game/format'
import { proseStyle } from '../../prose-style.ts'
import type { Page } from '../page.ts'
import { prose } from '../prose.ts'
import { stackLogo } from './stacks-logo.ts'
import {
  authored,
  factsBox,
  headingsFor,
  link,
  page,
  paragraph,
  researchLink,
  section,
  table,
  termsSection,
  type Fact,
  type Lang,
} from './shared.ts'

export const runtimePath = (id: RuntimeDef['id']): string => `/runtimes/${id}`
const frameworkPath = (id: FrameworkDef['id']): string => `/frameworks/${id}`

/**
 * `page` fills in the defaults a generated page shares, but its fields are
 * typed for one message type. The pages here carry their own.
 */
const pageOf = <Msg>(
  l: Lang,
  fields: Partial<Page<Msg>> & Pick<Page<Msg>, 'kind' | 'path' | 'title' | 'summary'>,
): Page<Msg> => page(l, fields as never) as Page<Msg>

const axes = <Msg>(l: Lang, values: Axes, h: H<Msg>): View.Content<Msg> => {
  const t = l.t.reference.stacks
  return table(
    t.axisColumns,
    AXES.map((axis) => ({
      key: axis,
      cells: [
        t.axes[axis],
        h.span
          .attr('aria-label', t.pips(values[axis]))
          .class(
            css({
              display: 'inline-flex',
              gap: '1',
            }),
          )
          .children(
            ...[1, 2, 3, 4, 5].map((step) =>
              h.span
                .key(String(step))
                .class(
                  step <= values[axis]
                    ? css({
                        width: '2',
                        height: '2',
                        borderRadius: 'full',
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 70%, transparent)',
                      })
                    : css({
                        width: '2',
                        height: '2',
                        borderRadius: 'full',
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 12%, transparent)',
                      }),
                )
                .children(),
            ),
          ),
      ],
    })),
    h,
    [1],
  )
}

const languageFacts = <Msg>(
  l: Lang,
  language: RuntimeDef['language'],
): ReadonlyArray<Fact<Msg>> => {
  const t = l.t.reference.stacks
  const def = LANGUAGES[language]
  return [
    { name: t.velocity, value: `×${def.velocity}` },
    { name: t.salary, value: `×${def.salary}` },
    { name: t.build, value: t.minutes(def.buildMinutes) },
  ]
}

const runtimePage = <Msg>(l: Lang, def: RuntimeDef): Page<Msg> => {
  const t = l.t.reference.stacks
  const path = runtimePath(def.id)
  const found = authored(l.locale, path)
  const frameworks = FRAMEWORK_IDS.filter((id) => l.cat.FRAMEWORKS[id].language === def.language)
  return pageOf(l, {
    kind: 'runtime',
    path,
    title: def.name,
    summary: def.blurb,
    parent: '/runtimes',
    order: RUNTIME_IDS.indexOf(def.id),
    era: null,
    aliases: [LANGUAGES[def.language].name, t.models[def.model]],
    source: found.source,
    fallback: found.fallback,
    headings: [
      ...found.headings,
      ...headingsFor([
        l.title('tradeoffs'),
        l.title('frameworks'),
        def.glossary.length ? l.title('engineeringTerms') : null,
      ]),
    ],
    text: `${def.blurb} ${found.text}`,
    aside: (h) =>
      factsBox(
        l,
        def.name,
        stackLogo(
          def.language,
          css({
            width: '6',
            height: '6',
          }),
          h,
        ),
        null,
        [
          { name: t.language, value: LANGUAGES[def.language].name },
          { name: t.concurrency, value: t.models[def.model] },
          { name: t.speed, value: `×${def.speed}` },
          { name: t.memory, value: `${def.memoryMb} MB` },
          { name: t.startup, value: t.seconds(def.startupSeconds) },
          { name: t.warmup, value: def.warmup ? t.seconds(def.warmup) : '—' },
          { name: t.gcPause, value: def.gc ? ms(def.gc.pauseMs) : t.none },
          {
            name: t.unlockedBy,
            value: def.research ? researchLink(l, def.research, h) : t.starterKit,
          },
          ...languageFacts<Msg>(l, def.language),
        ],
        h,
      ),
    body: (h) => {
      const blocks: ReadonlyArray<View.Content<Msg>> = [
        ...(found.prose === null
          ? []
          : [prose(h, l.locale, found.prose.document, found.prose.anchors ?? undefined)]),
        section(l.title('tradeoffs'), [axes(l, def.axes, h)], h),
        section(
          l.title('frameworks'),
          [
            h.ul.children(
              ...frameworks.map((id) =>
                h.li.key(id).children(link(frameworkPath(id), l.cat.FRAMEWORKS[id].name, h)),
              ),
            ),
          ],
          h,
        ),
        termsSection(l, def.glossary, h),
      ]
      return h.div.class(proseStyle).children(...blocks)
    },
    related: ['/runtimes', ...frameworks.map(frameworkPath)],
  })
}

const frameworkPage = <Msg>(l: Lang, def: FrameworkDef): Page<Msg> => {
  const t = l.t.reference.stacks
  const path = frameworkPath(def.id)
  const found = authored(l.locale, path)
  const runtimes = RUNTIME_IDS.filter(
    (id) => def.language === null || l.cat.RUNTIMES[id].language === def.language,
  )
  return pageOf(l, {
    kind: 'framework',
    path,
    title: def.name,
    summary: def.blurb,
    parent: '/runtimes',
    order: 100 + FRAMEWORK_IDS.indexOf(def.id),
    aliases: def.language ? [LANGUAGES[def.language].name, t.entityAlias] : [t.entityAlias],
    source: found.source,
    fallback: found.fallback,
    headings: [
      ...found.headings,
      ...headingsFor([
        l.title('tradeoffs'),
        l.title('runsOn'),
        def.glossary.length ? l.title('engineeringTerms') : null,
      ]),
    ],
    text: `${def.blurb} ${found.text}`,
    aside: (h) =>
      factsBox(
        l,
        def.name,
        def.id === 'none'
          ? null
          : stackLogo(
              def.id,
              css({
                width: '6',
                height: '6',
              }),
              h,
            ),
        null,
        [
          {
            name: t.language,
            value: def.language ? LANGUAGES[def.language].name : l.t.reference.any,
          },
          { name: t.overhead, value: t.cpuMs(def.overhead) },
          { name: t.velocity, value: `×${def.velocity}` },
          { name: t.memory, value: `+${def.memoryMb} MB` },
          { name: t.startup, value: `+${def.startupSeconds} s` },
          { name: t.orm, value: def.orm ? t.ormYes : l.t.reference.no },
        ],
        h,
      ),
    body: (h) => {
      const blocks: ReadonlyArray<View.Content<Msg>> = [
        ...(found.prose === null
          ? []
          : [prose(h, l.locale, found.prose.document, found.prose.anchors ?? undefined)]),
        section(l.title('tradeoffs'), [axes(l, def.axes, h)], h),
        section(
          l.title('runsOn'),
          [
            h.ul.children(
              ...runtimes.map((id) =>
                h.li.key(id).children(link(runtimePath(id), l.cat.RUNTIMES[id].name, h)),
              ),
            ),
          ],
          h,
        ),
        termsSection(l, def.glossary, h),
      ]
      return h.div.class(proseStyle).children(...blocks)
    },
    related: ['/runtimes'],
  })
}

export const stackPages = <Msg>(l: Lang): ReadonlyArray<Page<Msg>> => {
  const t = l.t.reference.stacks
  const RUNTIMES = l.cat.RUNTIMES
  const FRAMEWORKS = l.cat.FRAMEWORKS
  const hub = pageOf<Msg>(l, {
    kind: 'runtime',
    path: '/runtimes',
    title: t.title,
    summary: t.summary,
    order: 4,
    aliases: t.aliases,
    headings: headingsFor([l.title('languages'), l.title('runtimes'), l.title('frameworks')]),
    text: [
      ...RUNTIME_IDS.map((id) => RUNTIMES[id].name),
      ...FRAMEWORK_IDS.map((id) => FRAMEWORKS[id].name),
    ].join(' '),
    body: (h) =>
      h.div.class(proseStyle).children(
        paragraph(t.intro, h),
        section(
          l.title('languages'),
          [
            table(
              t.languageColumns,
              LANGUAGE_IDS.map((id) => {
                const def = LANGUAGES[id]
                return {
                  key: id,
                  cells: [
                    h.span
                      .class(
                        css({
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2',
                        }),
                      )
                      .children(
                        stackLogo(
                          id,
                          css({
                            width: '4',
                            height: '4',
                          }),
                          h,
                        ),
                        def.name,
                      ),
                    `×${def.velocity}`,
                    `×${def.salary}`,
                    `×${def.hireTime}`,
                    t.minutes(def.buildMinutes),
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
          l.title('runtimes'),
          [
            table(
              t.runtimeColumns,
              RUNTIME_IDS.map((id) => {
                const def = RUNTIMES[id]
                return {
                  key: id,
                  cells: [
                    link(runtimePath(id), def.name, h),
                    t.models[def.model],
                    `×${def.speed}`,
                    `${def.memoryMb} MB`,
                    def.gc ? ms(def.gc.pauseMs) : '—',
                  ],
                }
              }),
              h,
              [2, 3, 4],
            ),
          ],
          h,
        ),
        section(
          l.title('frameworks'),
          [
            table(
              t.frameworkColumns,
              FRAMEWORK_IDS.map((id) => {
                const def = FRAMEWORKS[id]
                return {
                  key: id,
                  cells: [
                    link(frameworkPath(id), def.name, h),
                    def.language ? LANGUAGES[def.language].name : l.t.reference.any,
                    `${def.overhead} ms`,
                    `×${def.velocity}`,
                    def.orm ? l.t.reference.yes : l.t.reference.no,
                  ],
                }
              }),
              h,
              [2, 3],
            ),
          ],
          h,
        ),
      ),
  })
  return [
    hub,
    ...RUNTIME_IDS.map((id) => runtimePage<Msg>(l, RUNTIMES[id])),
    ...FRAMEWORK_IDS.map((id) => frameworkPage<Msg>(l, FRAMEWORKS[id])),
  ]
}
