import { Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { SIZES } from '@quorum/simulation/catalog'
import { CARD_W, heightOf } from '@quorum/ui/board/size'
import { compact, money, ms } from '@quorum/ui/game/format'
import { css, cx } from '@quorum/styled-system/css'
import { Effect, Schema, Stream } from 'effect'
import { langOf, type Lang } from '../i18n/lang.ts'
import type { Locale } from '../i18n/locale.ts'
import { DESIGNS } from '../patterns/designs/index.ts'
import { DESIGN_IDS, type DesignId } from '../patterns/designs/ids.ts'
import type { Setting } from '../patterns/design.ts'
import { solveFlow } from '@quorum/simulation/solve'
import { link } from './reference/shared.ts'

const DrawDesign = Mount.makeStream(
  'DrawDesign',
  { args: { id: Schema.Literals(DESIGN_IDS) } },
  (node: HTMLElement, { id }) =>
    Stream.callback<never>(() =>
      Effect.acquireRelease(
        Effect.promise(async () => {
          const { solverReadyForBoard } = await import('../solver.ts')
          await solverReadyForBoard()
          const { drawDesign } = await import('../components/design-board.ts')
          node.replaceChildren()
          return drawDesign(id, node)
        }),
        (detach) => Effect.sync(detach),
      ).pipe(Effect.andThen(Effect.never)),
    ),
)

const valueOf = (l: Lang, setting: Setting): string => {
  const { field, value } = setting
  if (field === 'size' && typeof value === 'number') return SIZES[value]?.name ?? String(value)
  if (value === true) return l.t.islands.design.on
  if (value === false) return l.t.islands.design.off
  if (field === 'timeout' && typeof value === 'number') return `${value} s`
  return String(value)
}

const FIT_MARGIN = 16
const INSET = 16
const PHONE_SCALE = 0.42
const TOP_SCALE = 1.1

const frameFor = (
  id: string,
): Readonly<{ aspectRatio: string; maxHeight: string; minHeight: string }> => {
  const design = DESIGNS[id]
  if (!design) return { aspectRatio: '2 / 1', maxHeight: 'none', minHeight: '0' }
  const left = Math.min(...design.game.nodes.map((node) => node.x))
  const right = Math.max(...design.game.nodes.map((node) => node.x + CARD_W))
  const top = Math.min(...design.game.nodes.map((node) => node.y))
  const bottom = Math.max(...design.game.nodes.map((node) => node.y + heightOf(node.type)))
  const width = right - left + 2 * FIT_MARGIN
  const height = bottom - top + 2 * FIT_MARGIN
  return {
    aspectRatio: `${width} / ${height + 2 * INSET}`,
    maxHeight: `${Math.round(height * TOP_SCALE + 2 * INSET)}px`,
    minHeight: `${Math.round(height * PHONE_SCALE + 2 * INSET)}px`,
  }
}

/** A Design drawn on the board, with the settings that make it work. */
export const Design = <Msg>(h: H<Msg>, id: DesignId, locale: Locale): View.Content<Msg> => {
  const design = DESIGNS[id]
  if (design === undefined) return h.span.children()
  const l = langOf(locale)
  const t = l.t.islands.design
  const { COMPONENTS, INCIDENTS, RESEARCH } = l.cat
  const ledger = solveFlow(design.game)
  const rows = [
    ...design.nodes.flatMap((node) =>
      node.settings.map((setting) => ({
        key: `${node.id}-${setting.field}`,
        where: link(`/components/${node.type}`, COMPONENTS[node.type].name, h),
        setting,
      })),
    ),
    ...design.links.flatMap((entry) =>
      entry.settings.map((setting) => ({
        key: `${entry.from}-${entry.to}-${setting.field}`,
        where: h.span.children(
          t.link(
            COMPONENTS[design.nodes.find((node) => node.id === entry.from)?.type ?? 'users'].name,
            COMPONENTS[design.nodes.find((node) => node.id === entry.to)?.type ?? 'users'].name,
          ),
        ),
        setting,
      })),
    ),
  ]
  const needs = [
    ...new Set(
      design.nodes.flatMap((node) => {
        const unlock = COMPONENTS[node.type].unlock
        return unlock ? [unlock] : []
      }),
    ),
    ...design.researched,
  ]
  const cell = css({ paddingInline: '3', paddingBlock: '2', verticalAlign: 'top' })
  return h.figure
    .key(`design-${id}`)
    .attr('data-lazy-island', '')
    .class(cx(css({ marginBlock: '6' }), 'not-prose'))
    .children(
      h.div
        .attr('role', 'img')
        .attr(
          'aria-label',
          t.aria(design.nodes.map((node) => COMPONENTS[node.type].name).join(', ')),
        )
        .class(
          css({
            position: 'relative',
            width: '100%',
            cursor: 'grab',
            overflow: 'hidden',
            borderRadius: 'lg',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'border',
          }),
        )
        .style(frameFor(id))
        .onMount(DrawDesign({ id }))
        .children(),
      h.p
        .class(css({ marginTop: '1.5', fontSize: 'type.12', color: 'mutedForeground' }))
        .children(t.hint),
      h.figcaption
        .class(css({ marginTop: '2', fontSize: 'type.12', color: 'mutedForeground' }))
        .children(
          t.caption(
            compact(design.users),
            design.incident ? INCIDENTS[design.incident.kind].name : null,
            ledger.apdex.toFixed(2),
            ms(ledger.p99),
            (ledger.errorShare * 100).toFixed(1),
            money(ledger.burn),
            ledger.egress >= 0.005 ? money(ledger.egress) : null,
            design.note ?? null,
          ),
        ),
      ...(rows.length > 0
        ? [
            h.div
              .class(
                css({
                  marginTop: '4',
                  overflowX: 'auto',
                  borderRadius: 'lg',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'border',
                }),
              )
              .children(
                h.table
                  .class(
                    css({
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 'type.14',
                      lineHeight: 'snug',
                    }),
                  )
                  .children(
                    h.thead.children(
                      h.tr.children(
                        ...[t.where, t.setting, t.value, t.why].map((name) =>
                          h.th
                            .key(name)
                            .class(
                              css({
                                borderBottomWidth: '1px',
                                borderBottomStyle: 'solid',
                                borderColor: 'border',
                                backgroundColor:
                                  'color-mix(in oklab, var(--muted) 50%, transparent)',
                                paddingInline: '3',
                                paddingBlock: '2',
                                textAlign: 'left',
                                fontSize: 'type.12',
                                fontWeight: 'medium',
                                color: 'mutedForeground',
                              }),
                            )
                            .children(name),
                        ),
                      ),
                    ),
                    h.tbody
                      .class(
                        css({
                          '& > * + *': {
                            borderTopWidth: '1px',
                            borderTopStyle: 'solid',
                            borderColor: 'border',
                          },
                        }),
                      )
                      .children(
                        ...rows.map((row) =>
                          h.tr
                            .key(row.key)
                            .children(
                              h.td
                                .class(cx(cell, css({ whiteSpace: 'nowrap' })))
                                .children(row.where),
                              h.td.class(cell).children(row.setting.label),
                              h.td
                                .class(cx(cell, css({ whiteSpace: 'nowrap', fontFamily: 'mono' })))
                                .children(valueOf(l, row.setting)),
                              h.td
                                .class(cx(cell, css({ color: 'mutedForeground' })))
                                .children(row.setting.why),
                            ),
                        ),
                      ),
                  ),
              ),
          ]
        : []),
      ...(needs.length > 0
        ? [
            h.p
              .class(css({ marginTop: '2', fontSize: 'type.12', color: 'mutedForeground' }))
              .children(
                t.needs,
                ...needs.flatMap((research, index) => [
                  ...(index > 0 ? [l.t.reference.listSeparator] : []),
                  link(`/research/${research}`, RESEARCH[research].name, h),
                ]),
                l.t.reference.sentenceEnd,
              ),
          ]
        : []),
    )
}
