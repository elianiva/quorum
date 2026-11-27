import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css } from '@quorum/styled-system/css'
import { proseStyle } from '../../prose-style.ts'
import type { Page } from '../page.ts'
import { navOf } from '../pages.ts'
import { quadrantBadge } from '../quadrant.ts'
import {
  cardGrid,
  headingsFor,
  hubCard,
  link,
  page,
  paragraph,
  section,
  titleOf,
  type Lang,
} from './shared.ts'

export type GroupName = keyof Lang['t']['groups']

const PATTERN_GROUPS: ReadonlyArray<GroupName> = [
  'Foundations',
  'Scaling steps',
  'Scaling reads and compute',
  'Scaling data',
  'Messaging and async',
  'Resilience',
  'Deploys and change',
  'Operate and observe',
  'Security and edge',
  'Cost',
  'Ran in production',
  'When it broke',
  'Outside the game',
]

/**
 * `page` fills in the defaults a generated page shares, but its fields are
 * typed for one message type. The pages here carry their own.
 */
const pageOf = <Msg>(
  l: Lang,
  fields: Partial<Page<Msg>> & Pick<Page<Msg>, 'kind' | 'path' | 'title' | 'summary'>,
): Page<Msg> => page(l, fields as never) as Page<Msg>

const stepMark = <Msg>(step: number, h: H<Msg>): View.Content<Msg> =>
  h.span
    .class(
      css({
        display: 'flex',
        width: '9',
        height: '9',
        flexShrink: '0',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'lg',
        backgroundColor: 'muted',
        fontSize: 'type.13',
        fontWeight: 'semibold',
        fontVariantNumeric: 'tabular-nums',
        color: 'mutedForeground',
      }),
    )
    .children(String(step))

export const patternsPages = <Msg>(l: Lang): ReadonlyArray<Page<Msg>> => {
  const t = l.t.reference.patterns
  const groups = PATTERN_GROUPS.map((key) => ({ key, ...l.t.groups[key] }))
  return [
    pageOf<Msg>(l, {
      kind: 'pattern',
      path: '/patterns',
      title: t.title,
      summary: t.summary,
      section: 'patterns',
      order: 0,
      aliases: t.aliases,
      headings: headingsFor(groups.map((group) => titleOf(group.key, group.name))),
      text: groups.map((group) => `${group.name} ${group.blurb}`).join(' '),
      body: (h) => {
        const pages: ReadonlyArray<Page<Msg>> = navOf<Msg>(l.locale, 'patterns')
        return h.div.class(proseStyle).children(
          paragraph(t.intro, h),
          h.p.children(t.newHere, link('/patterns/one-box', t.oneBox, h), t.newHereAfter),
          ...groups.flatMap((group) => {
            const members = pages.filter((entry) => entry.group === group.key)
            return members.length === 0
              ? []
              : [
                  section(
                    titleOf(group.key, group.name),
                    [
                      paragraph(group.blurb, h),
                      cardGrid(
                        members.map((entry) =>
                          hubCard(
                            entry as unknown as Page,
                            group.key === 'Scaling steps'
                              ? stepMark(entry.order - 100, h)
                              : quadrantBadge(
                                  'patterns',
                                  css({
                                    width: '9',
                                    height: '9',
                                    flexShrink: '0',
                                  }),
                                  h,
                                ),
                            '',
                            h,
                          ),
                        ),
                        h,
                      ),
                    ],
                    h,
                  ),
                ]
          }),
        )
      },
    }),
  ]
}
