import { css, cx } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  BookCopy,
  Check,
  Clipboard,
  Copy,
  CopyPlus,
  Plus,
  SquareDashed,
  Stamp,
  Trash2,
  Upload,
  X,
} from 'lucide'
import { COMPONENTS, EXITS } from '@quorum/simulation/catalog'
import { exitOffers } from '@quorum/simulation/exit'
import { keepSlots, playbookSlots } from '@quorum/simulation/founder'
import { refundOf } from '@quorum/simulation/lookups'
import { legacyMultiplier } from '@quorum/simulation/founding'
import { valuationOf } from '@quorum/simulation/valuation'
import { clock, compact, money } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { confirmSellOf, ledgerOf, type Model, stampedPlaybook } from '@/game/model.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { button } from '@quorum/ui/primitives/button'
import { textarea } from '@quorum/ui/primitives/textarea'
import { EYEBROW, FIGURE, FIGURE_STYLE, FLOAT, NESTED, SCROLL, WELL } from '@quorum/ui/game/bits'
import { SurveyMessage } from '@/game/survey.ts'
import { isSending, isSent, isSkipped } from '@/game/survey-machine.ts'
import { shell } from './panels.ts'

const stat = (name: string, value: string, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Key(name),
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1',
          paddingInline: '4',
          paddingBlock: '3',
        }),
      ),
    ],
    [
      h.span([h.Class(EYEBROW)], [name]),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.18',
              }),
            ),
          ),
        ],
        [value],
      ),
    ],
  )

const stats = (columns: string, children: ReadonlyArray<Html>, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class(
        cx(
          css({
            display: 'grid',
            width: '100%',
            '& > :not(:last-child)': {
              borderRightWidth: '1px',
              borderRightStyle: 'solid',
              borderColor: 'hairline',
            },
          }),
          WELL,
          columns,
        ),
      ),
    ],
    children,
  )

const footer = (children: ReadonlyArray<Html>, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class(
        css({
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '2',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderColor: 'hairline',
          backgroundColor: 'nested',
          paddingInline: '5',
          paddingBlock: '3',
        }),
      ),
    ],
    children,
  )

export const exitPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const ledger = ledgerOf(model)
  const value = valuationOf(game, ledger)
  const offers = exitOffers(game, ledger)
  const equity = Math.round(game.equity * 100)
  return shell(
    t.legacy.exit,
    [],
    [
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '4',
                paddingInline: '5',
                paddingTop: '1',
                paddingBottom: '5',
              }),
              SCROLL,
            ),
          ),
        ],
        [
          stats(
            css({
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              _narrow: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
            }),
            [
              stat(t.legacy.valuation, money(value.valuation), h),
              stat(t.legacy.ruleOf40, value.ruleOf40.toFixed(0), h),
              stat(t.legacy.equity, `${equity}%`, h),
              stat(t.legacy.legacy, legacyMultiplier(game.founding).toFixed(2), h),
            ],
            h,
          ),
          h.div(
            [
              h.Class(
                cx(
                  NESTED,
                  css({
                    display: 'flex',
                    flexDirection: 'column',
                    '& > :not(:last-child)': {
                      borderBottomWidth: '1px',
                      borderBottomStyle: 'solid',
                      borderColor: 'hairline',
                    },
                  }),
                ),
              ),
            ],
            offers.map((offer) => {
              const defined = EXITS[offer.id]
              const confirming = model.exitConfirm === offer.id
              const streak = offer.multiplier - defined.multiplier
              const notes = [
                Number.isFinite(defined.cap) ? t.legacy.exitCap(money(defined.cap)) : '',
                streak > 0 ? t.legacy.exitStreak(streak.toFixed(1)) : '',
                defined.continues ? t.legacy.exitContinues : t.legacy.exitEnds,
              ].filter((entry) => entry !== '')
              return h.div(
                [
                  h.Key(offer.id),
                  h.Class(
                    css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2',
                      paddingInline: '4',
                      paddingBlock: '3',
                    }),
                  ),
                ],
                [
                  h.div(
                    [
                      h.Class(
                        css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3',
                        }),
                      ),
                    ],
                    [
                      h.div(
                        [
                          h.Class(
                            css({
                              display: 'flex',
                              minWidth: '0',
                              flex: '1 1 0%',
                              flexDirection: 'column',
                              gap: '0.5',
                            }),
                          ),
                        ],
                        [
                          h.span(
                            [
                              h.Class(
                                css({
                                  fontSize: 'type.14',
                                  fontWeight: 'semibold',
                                }),
                              ),
                            ],
                            [t.catalog.exits[offer.id].name],
                          ),
                          h.span(
                            [
                              h.Class(
                                cx(
                                  FIGURE,
                                  css({
                                    fontSize: 'type.11-5',
                                    color: 'mutedForeground',
                                  }),
                                ),
                              ),
                            ],
                            [
                              t.legacy.exitMath(
                                equity,
                                money(offer.valuation),
                                offer.multiplier.toFixed(1),
                                money(offer.payout),
                              ),
                            ],
                          ),
                          h.span(
                            [
                              h.Class(
                                css({
                                  fontSize: 'type.11',
                                  color: 'mutedForeground',
                                }),
                              ),
                            ],
                            [notes.join(' · ')],
                          ),
                        ],
                      ),
                      confirming
                        ? h.div(
                            [
                              h.Class(
                                css({
                                  display: 'flex',
                                  flexShrink: '0',
                                  gap: '2',
                                }),
                              ),
                            ],
                            [
                              button(
                                {
                                  onClick: Message.ExitCancelled(),
                                  variant: 'ghost',
                                  size: 'lg',
                                },
                                t.legacy.cancel,
                                h,
                              ),
                              button(
                                { onClick: Message.ExitTaken({ exit: offer.id }), size: 'lg' },
                                t.legacy.takeLegacy(offer.legacy),
                                h,
                              ),
                            ],
                          )
                        : button(
                            { onClick: Message.ExitAsked({ exit: offer.id }), size: 'lg' },
                            [t.legacy.takeLegacy(offer.legacy)],
                            h,
                          ),
                    ],
                  ),
                  confirming
                    ? h.span(
                        [
                          h.Class(
                            css({
                              fontSize: 'type.11-5',
                              color: 'warn',
                            }),
                          ),
                        ],
                        [t.legacy.exitConfirmNote(offer.legacy)],
                      )
                    : h.empty,
                ],
              )
            }),
          ),
        ],
      ),
    ],
    css({ maxWidth: '620px' }),
    h,
  )
}

const snapshotSvg = (
  snapshot: Model['founder']['history'][number]['snapshot'],
  h: HtmlBuilder<Message>,
  className: string,
): Html => {
  const xs = snapshot.nodes.map((node) => node.x)
  const ys = snapshot.nodes.map((node) => node.y)
  const left = Math.min(0, ...xs) - 40
  const top = Math.min(0, ...ys) - 40
  const width = Math.max(400, ...xs) - left + 280
  const height = Math.max(300, ...ys) - top + 200
  return h.svg(
    [
      h.AriaHidden(true),
      h.Xmlns('http://www.w3.org/2000/svg'),
      h.ViewBox(`${left} ${top} ${width} ${height}`),
      h.Class(className),
      h.Fill('none'),
    ],
    [
      ...snapshot.links.map(([from, to], index) => {
        const a = snapshot.nodes[from]
        const b = snapshot.nodes[to]
        return a && b
          ? h.path(
              [
                h.Key(`l${index}`),
                h.D(`M${a.x + 108} ${a.y + 40} L${b.x + 108} ${b.y + 40}`),
                h.StrokeWidth('6'),
                h.Class(
                  css({
                    stroke: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
                  }),
                ),
              ],
              [],
            )
          : h.empty
      }),
      ...snapshot.nodes.map((node, index) =>
        h.rect(
          [
            h.Key(`n${index}`),
            h.X(String(node.x)),
            h.Y(String(node.y)),
            h.Width('216'),
            h.Height('80'),
            h.Rx('16'),
            h.Fill(`var(--group-${COMPONENTS[node.type].group})`),
            h.Attribute('opacity', '0.75'),
          ],
          [],
        ),
      ),
    ],
  )
}

const surveySection = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const survey = model.survey
  if (isSkipped(survey.phase)) return h.empty
  if (isSent(survey.phase))
    return h.div(
      [
        h.Class(
          cx(
            NESTED,
            css({
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: '2',
              paddingInline: '4',
              paddingBlock: '3',
              fontSize: 'type.12-5',
            }),
          ),
        ),
      ],
      [
        icon(
          h,
          Check,
          css({
            width: '4',
            height: '4',
            color: 'ok',
          }),
        ),
        h.span([], [t.survey.sent]),
      ],
    )
  const sending = isSending(survey.phase)
  const empty = survey.issues.trim() === '' && survey.likes.trim() === ''
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          gap: '3',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderColor: 'hairline',
          paddingTop: '4',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5',
            }),
          ),
        ],
        [
          h.span([h.Class(EYEBROW)], [t.survey.title]),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'type.11-5',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [t.survey.note],
          ),
        ],
      ),
      textarea(
        {
          id: 'survey-issues',
          label: t.survey.issues,
          value: survey.issues,
          onInput: (value) =>
            Message.SurveyChanged({ message: SurveyMessage.IssuesChanged({ value }) }),
          rows: 2,
          isDisabled: sending,
        },
        h,
      ),
      textarea(
        {
          id: 'survey-likes',
          label: t.survey.likes,
          value: survey.likes,
          onInput: (value) =>
            Message.SurveyChanged({ message: SurveyMessage.LikesChanged({ value }) }),
          rows: 2,
          isDisabled: sending,
        },
        h,
      ),
      survey.phase._tag === 'Failed'
        ? h.span(
            [
              h.Class(
                css({
                  fontSize: 'type.11-5',
                  color: 'warn',
                }),
              ),
            ],
            [t.survey.failed(survey.phase.note)],
          )
        : h.empty,
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '2',
            }),
          ),
        ],
        [
          button(
            { onClick: Message.SurveySkipped(), variant: 'ghost', size: 'sm' },
            t.survey.skip,
            h,
          ),
          button(
            {
              onClick: Message.SurveySubmitted(),
              size: 'sm',
              isDisabled: sending || empty,
            },
            sending ? t.survey.sending : t.survey.send,
            h,
          ),
        ],
      ),
    ],
  )
}

export const exitScreen = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const exited = model.companyPhase
  if (exited._tag !== 'Exited') return h.empty
  const row = exited.row
  const slots = keepSlots(model.founder)
  const kept = model.founder.keep
  const venture = t.catalog.ventures[row.founding.venture].name
  const mutators = row.founding.mutators.map((id) => t.catalog.mutators[id].name)
  return h.main(
    [
      h.Key('exit'),
      h.Class(
        css({
          display: 'grid',
          height: '100%',
          placeItems: 'center',
          overflow: 'auto',
          backgroundColor: 'canvas',
          padding: '6',
          _compact: { padding: '0' },
        }),
      ),
    ],
    [
      h.div(
        [
          h.Role('dialog'),
          h.AriaLabel(t.catalog.exits[row.exit].name),
          h.Class(
            cx(
              FLOAT,
              'enter-modal',
              css({
                display: 'flex',
                maxHeight: '100%',
                width: '100%',
                maxWidth: '680px',
                flexDirection: 'column',
                overflow: 'hidden',
                _compact: {
                  height: '100%',
                  maxHeight: 'none',
                  maxWidth: 'none',
                  borderRadius: '0',
                  boxShadow: 'none',
                },
              }),
            ),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '4',
                  paddingInline: '6',
                  paddingTop: '4',
                  paddingBottom: '2',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'type.17',
                      fontWeight: 'semibold',
                      letterSpacing: 'tight',
                    }),
                  ),
                ],
                [t.catalog.exits[row.exit].name],
              ),
              h.span([h.Class(EYEBROW)], [t.catalog.eras[row.stage]?.name ?? '']),
            ],
          ),
          h.div(
            [
              h.Class(
                cx(
                  css({
                    display: 'flex',
                    minHeight: '0',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4',
                    paddingInline: '6',
                    paddingTop: '1',
                    paddingBottom: '5',
                  }),
                  SCROLL,
                ),
              ),
            ],
            [
              snapshotSvg(
                row.snapshot,
                h,
                css({
                  height: '180px',
                  flexShrink: '0',
                  width: '100%',
                  maxWidth: '520px',
                  borderRadius: 'xl',
                  backgroundColor: 'well',
                  boxShadow: 'well',
                  padding: '2',
                }),
              ),
              h.span(
                [
                  h.Class(
                    css(FIGURE_STYLE, {
                      fontSize: 'type.30',
                      fontWeight: 'semibold',
                      letterSpacing: 'heading',
                    }),
                  ),
                ],
                [t.legacy.legacy2(row.legacy)],
              ),
              stats(
                css({
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  _narrow: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
                }),
                [
                  stat(t.legacy.payout2, money(row.payout), h),
                  stat(t.legacy.peakUsers, compact(row.peak), h),
                  stat(t.legacy.era, t.catalog.eras[row.stage]?.name ?? '', h),
                  stat(t.legacy.played, clock(row.time), h),
                ],
                h,
              ),
              h.div(
                [
                  h.Class(
                    cx(
                      NESTED,
                      css({
                        display: 'flex',
                        width: '100%',
                        flexDirection: 'column',
                      }),
                    ),
                  ),
                ],
                [
                  h.div(
                    [
                      h.Class(
                        css({
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: '3',
                          paddingInline: '4',
                          paddingBlock: '2.5',
                          fontSize: 'type.12-5',
                        }),
                      ),
                    ],
                    [
                      h.span([h.Class(css({ color: 'mutedForeground' }))], [t.legacy.founding]),
                      h.span([h.Class(FIGURE)], [venture]),
                    ],
                  ),
                  mutators.length > 0
                    ? h.div(
                        [
                          h.Class(
                            css({
                              display: 'flex',
                              alignItems: 'baseline',
                              justifyContent: 'space-between',
                              gap: '3',
                              paddingInline: '4',
                              paddingBlock: '2.5',
                              fontSize: 'type.12-5',
                            }),
                          ),
                        ],
                        [
                          h.span([h.Class(css({ color: 'mutedForeground' }))], [t.legacy.mutators]),
                          h.span([h.Class(FIGURE)], [mutators.join(' · ')]),
                        ],
                      )
                    : h.empty,
                  h.div(
                    [
                      h.Class(
                        css({
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: '3',
                          paddingInline: '4',
                          paddingBlock: '2.5',
                          fontSize: 'type.12-5',
                        }),
                      ),
                    ],
                    [
                      h.span([h.Class(css({ color: 'mutedForeground' }))], [t.legacy.legacy]),
                      h.span([h.Class(FIGURE)], [legacyMultiplier(row.founding).toFixed(2)]),
                    ],
                  ),
                ],
              ),
              slots > 0
                ? h.div(
                    [
                      h.Class(
                        css({
                          display: 'flex',
                          width: '100%',
                          flexDirection: 'column',
                          gap: '2',
                        }),
                      ),
                    ],
                    [
                      h.span([h.Class(EYEBROW)], [t.legacy.keepResearch(kept.length, slots)]),
                      h.div(
                        [
                          h.Class(
                            css({
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '1.5',
                            }),
                          ),
                        ],
                        exited.researched.map((id) =>
                          button(
                            {
                              onClick: Message.KeepToggled({ id }),
                              size: 'xs',
                              variant: kept.includes(id) ? 'default' : 'outline',
                              attributes: [h.Key(id)],
                            },
                            t.catalog.research[id].name,
                            h,
                          ),
                        ),
                      ),
                    ],
                  )
                : h.empty,
              surveySection(model, h),
            ],
          ),
          footer(
            [
              button(
                { onClick: Message.MenuChosen({ menu: 'legacy' }), variant: 'outline', size: 'lg' },
                t.legacy.legacyShop,
                h,
              ),
              button({ onClick: Message.TitleOpened(), size: 'lg' }, t.legacy.nextCompany, h),
            ],
            h,
          ),
        ],
      ),
    ],
  )
}

export const selectionBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return model.board.selection.length === 0
    ? h.empty
    : h.div(
        [
          h.Key('selection'),
          h.Class(
            cx(
              css({
                pointerEvents: 'auto',
                display: 'flex',
                height: '52px',
                alignItems: 'center',
                gap: '2',
                borderRadius: '2xl',
                layerStyle: 'surface',
                paddingBlock: '1.5',
                paddingRight: '1.5',
                paddingLeft: '3.5',
                fontSize: 'type.12-5',
                boxShadow: 'card',
              }),
              'enter-pop',
            ),
          ),
        ],
        [
          h.span([h.Class(FIGURE)], [t.legacy.selected(model.board.selection.length)]),
          ...(
            [
              [Message.NodesCopied(), Copy, t.legacy.copyCtrlC],
              [Message.NodesDuplicated(), CopyPlus, t.legacy.duplicateCtrlD],
              [Message.NodesBoxed(), SquareDashed, t.legacy.boxTheNodes],
              [Message.SellAsked(), Trash2, t.legacy.sellDel],
              [Message.PlaybookSaved(), BookCopy, t.legacy.saveAsPlaybook],
              [Message.SelectionCleared(), X, t.legacy.clearSelectionEsc],
            ] as const
          ).map(([onClick, glyph, label]) =>
            button(
              {
                onClick,
                size: 'icon-sm',
                variant: 'ghost',
                attributes: [h.AriaLabel(label), h.Title(label)],
              },
              icon(
                h,
                glyph,
                css({
                  width: '4',
                  height: '4',
                }),
              ),
              h,
            ),
          ),
        ],
      )
}

export const sellBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const ids = confirmSellOf(model.board)
  if (!ids) return h.empty
  const refund = model.board.game.nodes
    .filter((node) => ids.includes(node.id))
    .reduce((total, node) => total + refundOf(model.board.game, node), 0)
  return h.div(
    [
      h.Key('sell'),
      h.Class(
        cx(
          css({
            pointerEvents: 'auto',
            display: 'flex',
            height: '52px',
            alignItems: 'center',
            gap: '2',
            borderRadius: '2xl',
            layerStyle: 'surface',
            paddingBlock: '1.5',
            paddingRight: '1.5',
            paddingLeft: '3.5',
            fontSize: 'type.12-5',
            boxShadow: 'card',
          }),
          'enter-pop',
        ),
      ),
    ],
    [
      h.span(
        [],
        [
          t.legacy.sell(
            ids.length === 1 ? t.legacy.n1Node : t.legacy.nodes(ids.length),
            refund > 0 ? t.legacy.forText(money(refund)) : '',
          ),
        ],
      ),
      button(
        { onClick: Message.SellConfirmed(), size: 'sm', variant: 'destructive' },
        [
          icon(
            h,
            Trash2,
            css({
              width: '3.5',
              height: '3.5',
            }),
          ),
          t.legacy.sell2,
        ],
        h,
      ),
      button(
        { onClick: Message.SellDismissed(), size: 'sm', variant: 'ghost' },
        t.legacy.cancel,
        h,
      ),
    ],
  )
}

export const stampBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const playbook = stampedPlaybook(model)
  return playbook
    ? h.div(
        [
          h.Key('stamp'),
          h.Class(
            cx(
              css({
                display: 'flex',
                height: '52px',
                alignItems: 'center',
                gap: '2',
                borderRadius: '2xl',
                layerStyle: 'surface',
                paddingInline: '3.5',
                fontSize: 'type.12-5',
                boxShadow: 'card',
              }),
              'enter-pop',
            ),
          ),
        ],
        [
          icon(
            h,
            Stamp,
            css({
              width: '3.5',
              height: '3.5',
              color: 'primaryStrong',
            }),
          ),
          t.legacy.clickToPlaceEsc(playbook.name),
        ],
      )
    : h.empty
}

export const playbooksPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const founder = model.founder
  return shell(
    t.legacy.playbooks,
    [
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.12',
                color: 'mutedForeground',
              }),
            ),
          ),
        ],
        [`${founder.playbooks.length}/${playbookSlots(founder)}`],
      ),
      button(
        { onClick: Message.PlaybookImportAsked(), variant: 'outline', size: 'sm' },
        [
          icon(
            h,
            Upload,
            css({
              width: '3.5',
              height: '3.5',
            }),
          ),
          t.legacy.importText,
        ],
        h,
      ),
    ],
    [
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '2',
                paddingInline: '5',
                paddingTop: '1',
                paddingBottom: '5',
              }),
              SCROLL,
            ),
          ),
        ],
        founder.playbooks.length === 0
          ? [
              h.span(
                [
                  h.Key('empty'),
                  h.Class(
                    css({
                      fontSize: 'type.12-5',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [t.legacy.shiftClickOrShiftDragNodes],
              ),
            ]
          : founder.playbooks.map((playbook, index) =>
              h.div(
                [
                  h.Key(`p${index}`),
                  h.Class(
                    cx(
                      NESTED,
                      css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2',
                        paddingInline: '3',
                        paddingBlock: '2',
                      }),
                    ),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          minWidth: '0',
                          flex: '1 1 0%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 'type.13',
                          fontWeight: 'medium',
                        }),
                      ),
                    ],
                    [playbook.name],
                  ),
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'type.11-5',
                            color: 'mutedForeground',
                          }),
                        ),
                      ),
                    ],
                    [t.legacy.nodes(playbook.nodes.length)],
                  ),
                  button(
                    { onClick: Message.PlaybookChosen({ index }), size: 'sm' },
                    [
                      icon(
                        h,
                        Plus,
                        css({
                          width: '3.5',
                          height: '3.5',
                        }),
                      ),
                      t.legacy.place,
                    ],
                    h,
                  ),
                  button(
                    {
                      onClick: Message.PlaybookExported({ index }),
                      variant: 'ghost',
                      size: 'icon-sm',
                      attributes: [h.AriaLabel(t.legacy.copy), h.Title(t.legacy.copyAsText)],
                    },
                    icon(
                      h,
                      Clipboard,
                      css({
                        width: '3.5',
                        height: '3.5',
                      }),
                    ),
                    h,
                  ),
                  button(
                    {
                      onClick: Message.PlaybookDeleted({ index }),
                      variant: 'ghost',
                      size: 'icon-sm',
                      attributes: [h.AriaLabel(t.legacy.deleteText), h.Title(t.legacy.deleteText)],
                    },
                    icon(
                      h,
                      Trash2,
                      css({
                        width: '3.5',
                        height: '3.5',
                      }),
                    ),
                    h,
                  ),
                ],
              ),
            ),
      ),
    ],
    css({ maxWidth: '560px' }),
    h,
  )
}
