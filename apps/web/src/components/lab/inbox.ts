import { css, cx } from '@quorum/styled-system/css'
import { actionLabelIn, answerIn, closingIn, signOf, writtenIn } from '@/i18n/mail-render.ts'
import { type Messages, copy, localeOf } from '@/i18n/messages.ts'
import { has } from '@quorum/simulation/lookups'
import { InboxMessage } from '@/game/inbox.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  Activity,
  ArchiveRestore,
  ArrowLeft,
  Ban,
  ChevronRight,
  CircleCheck,
  Cloud,
  Compass,
  CreditCard,
  Landmark,
  Layers,
  LifeBuoy,
  Mail as MailIcon,
  ShieldAlert,
  Trash2,
  TrendingUp,
  User,
  X,
  type IconNode,
  Dices,
} from 'lucide'
import { badge as chip } from '@quorum/ui/primitives/badge'
import {
  button,
  buttonBase,
  buttonSizes,
  buttonVariants,
  closeButton,
} from '@quorum/ui/primitives/button'
import { clock } from '@quorum/ui/game/format'
import { SAMPLES, needsAction, senderOf, type Sender, type SenderKind } from '@/game/mail.ts'
import type { BuildGroup } from '@quorum/simulation/catalog'
import { Kbd } from '@quorum/ui/primitives/kbd'
import {
  nativeSelect,
  nativeSelectOptGroup,
  nativeSelectOption,
} from '@quorum/ui/primitives/native-select'
import { folderHolds, folderList, digestOf, labelsIn, DIGEST_ID } from '@/game/inbox.ts'
import { TRAP_SITES, barOf, kindOf, priorityOf } from '@/game/mail-row.ts'
import { advisoryTell } from '@/game/advisories.ts'
import { glossaryUrl } from '@/platform/analytics.ts'
import { Message } from '@/game/message.ts'
import { boardSandbox, type Folder, type Mail, type MailLabel, type Model } from '@/game/model.ts'
import { isPhone } from '@/game/viewport.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { EYEBROW, FIGURE, FLOAT, PANEL, SCROLL, WELL, groupBadge } from '@quorum/ui/game/bits'

/** Where a button really goes, in words of the builder's language (a trap's names an off-site address). */
const destinationIn = (t: Messages, h: object, action: Mail['actions'][number]): string => {
  const [kind = '', target = ''] = action.id.split(':')
  if (kind === 'trap') {
    const site = TRAP_SITES[target]
    return site ? t.inbox.leadsOffSite(site) : t.inbox.leadsOffSiteUnknown
  }
  return (
    (t.inbox.destinations as Readonly<Record<string, string | undefined>>)[kind] ??
    t.inbox.answers(actionLabelIn(t, action))
  )
}

/** The badge each kind of sender wears: a shape from the build groups, a glyph, a colour. */
const BADGE: Record<SenderKind, { group: BuildGroup; glyph: IconNode }> = {
  cloud: { group: 'edge', glyph: Cloud },
  monitoring: { group: 'ops', glyph: Activity },
  vendor: { group: 'ops', glyph: CreditCard },
  investor: { group: 'compute', glyph: TrendingUp },
  finance: { group: 'data', glyph: Landmark },
  customers: { group: 'edge', glyph: LifeBuoy },
  mentor: { group: 'compute', glyph: Compass },
  teammate: { group: 'data', glyph: User },
  security: { group: 'ops', glyph: ShieldAlert },
  spam: { group: 'edge', glyph: Ban },
}

/** The shape and glyph say what kind of party wrote; the colour is the brand it parodies. */
const badge = (sender: Sender, size: string, h: HtmlBuilder<Message>): Html => {
  const { group, glyph } = BADGE[sender.looks]
  return groupBadge(group, glyph, size, h, false, sender.color)
}

const unreadIn = (model: Model, folder: Folder): number =>
  model.board.inbox.mail.filter((mail) => folderHolds(mail, folder) && !mail.read).length

/** Threads waiting on the player: it does not fall when they are read, only when they are answered. */
const openCount = (model: Model): number =>
  model.board.inbox.mail.filter((mail) => folderHolds(mail, 'action')).length

/** A letter's text in the builder's language: written again from what it says, or the English the Model kept. */
const bodyOf = (h: HtmlBuilder<Message>, entry: Mail['entries'][number]): string =>
  (entry.message ? writtenIn(copy(h), entry.message)?.body : undefined) ??
  (entry.closing ? (closingIn(copy(h), entry.closing) ?? undefined) : undefined) ??
  entry.text

/** A Mail's subject in the builder's language. */
const subjectOf = (h: HtmlBuilder<Message>, mail: Mail): string =>
  (mail.message ? writtenIn(copy(h), mail.message)?.subject : undefined) ?? mail.subject

/** One entry of a thread: its time when the Mail repeats, then its paragraphs. */
const entryOf = (
  h: HtmlBuilder<Message>,
  entry: Mail['entries'][number],
  threaded: boolean,
  index: number,
): Html =>
  h.div(
    [
      h.Key(`entry-${index}`),
      h.Class(
        threaded
          ? css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5',
              borderLeftWidth: '2px',
              borderColor: 'hairline',
              paddingLeft: '3',
            })
          : css({
              display: 'flex',
              flexDirection: 'column',
            }),
      ),
    ],
    [
      threaded
        ? h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(10.5px*var(--type-scale))',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [clock(entry.time)],
          )
        : h.empty,
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '3',
              whiteSpace: 'pre-line',
            }),
          ),
        ],
        bodyOf(h, entry)
          .split('\n\n')
          .map((paragraph) => h.p([], [paragraph])),
      ),
    ],
  )

/** The first line of a letter that says something, for the preview. */
const gist = (h: HtmlBuilder<Message>, mail: Mail): string => {
  const last = mail.entries.at(-1)
  return (
    (last ? bodyOf(h, last) : '').split('\n\n').find((paragraph) => paragraph.trim() !== '') ?? ''
  )
}

/**
 * The newest letter that wants the player, as a card above the Inbox button. It stays until the
 * player reads, answers or dismisses it, so new mail cannot slip past. A decision shows its first
 * button here, so a patch is one click away.
 */
export const peek = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const mail = model.board.inbox.mail.find(
    (entry) => entry.id === model.board.inbox.peek && !entry.trashed,
  )
  if (!mail || model.panel === 'inbox') return h.empty
  const sender = senderOf(mail.sender)
  const decision = needsAction(mail)
  const act = decision ? mail.actions.find((action) => !action.id.startsWith('show')) : undefined
  return h.div(
    [
      h.Key(`peek-${mail.id}-${mail.entries.length}`),
      h.Role('status'),
      h.AriaLabel(t.inbox.newMailFrom(sender.name, subjectOf(h, mail))),
      h.Class(
        cx(
          cx(
            css({
              position: 'absolute',
              right: '3',
              bottom: '68px',
              zIndex: '20',
              display: 'flex',
              width: 'min(380px,calc(100%-24px))',
              flexDirection: 'column',
              gap: '2.5',
              padding: '3',
            }),
            'enter-pop',
          ),
          FLOAT,
          css({
            _compact: {
              position: 'relative',
              width: 'auto',
              pointerEvents: 'auto',
            },
          }),
        ),
      ),
    ],
    [
      closeButton(
        {
          label: t.inbox.dismiss,
          onClick: Message.InboxChanged({ message: InboxMessage.PeekDismissed() }),
        },
        h,
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '3',
              paddingRight: '6',
            }),
          ),
        ],
        [
          badge(
            sender,
            css({
              width: '8',
              height: '8',
            }),
            h,
          ),
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
                    cx(
                      EYEBROW,
                      css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5',
                      }),
                    ),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }),
                      ),
                    ],
                    [sender.name],
                  ),
                  h.span([], ['·']),
                  h.span([h.Class(FIGURE)], [clock(mail.time)]),
                ],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      lineClamp: 2,
                      fontSize: 'calc(14.5px*var(--type-scale))',
                      lineHeight: '1.375',
                      fontWeight: '600',
                      letterSpacing: '-0.01em',
                    }),
                  ),
                ],
                [subjectOf(h, mail)],
              ),
            ],
          ),
        ],
      ),
      // The clamp sits on the inner line, so the well's padding cannot show a third line.
      h.div(
        [
          h.Class(
            cx(
              WELL,
              css({
                paddingInline: '3',
                paddingBlock: '2',
                _short: {
                  display: 'none',
                },
              }),
            ),
          ),
        ],
        [
          h.p(
            [
              h.Class(
                css({
                  lineClamp: 2,
                  fontSize: 'calc(12px*var(--type-scale))',
                  lineHeight: '1.375',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [gist(h, mail)],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            }),
          ),
        ],
        [
          decision ? chip({ variant: 'destructive' }, [t.inbox.needsAction], h) : h.empty,
          h.span(
            [
              h.Class(
                css({
                  flex: '1 1 0%',
                }),
              ),
            ],
            [],
          ),
          act
            ? button(
                {
                  onClick: Message.InboxChanged({
                    message: InboxMessage.Acted({ id: mail.id, action: act.id }),
                  }),
                  size: 'sm',
                  attributes: [h.Key(act.id), h.Title(destinationIn(t, h, act))],
                },
                actionLabelIn(t, act),
                h,
              )
            : h.empty,
          button(
            {
              onClick: Message.InboxChanged({ message: InboxMessage.PeekOpened({ id: mail.id }) }),
              variant: act ? 'outline' : 'default',
              size: 'sm',
              attributes: [h.Key('open')],
            },
            [
              t.inbox.open,
              Kbd(
                {
                  className: css({
                    marginLeft: '1',
                    opacity: 0.8,
                  }),
                },
                ['I'],
                h,
              ),
            ],
            h,
          ),
        ],
      ),
    ],
  )
}

/** The unread count the corners and the phone's action bar show. */
export const unreadCount = (model: Model): number =>
  unreadIn(model, 'action') + unreadIn(model, 'fyi')

/** A decision is waiting: the badge turns red and the Inbox rings. */
export const waitingMail = (model: Model): boolean =>
  model.board.inbox.mail.some((mail) => folderHolds(mail, 'action') && !mail.read)

/**
 * The newest Mail that wants the player, as one line in the phone's notice stack. It replaces the
 * desktop's peek card: the phone gets the sender and the subject, and the whole line opens the
 * Inbox on that Mail.
 */
export const mailQueueRow = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const mail = model.board.inbox.mail.find(
    (entry) => entry.id === model.board.inbox.peek && !entry.trashed,
  )
  if (!mail || model.panel === 'inbox') return h.empty
  const sender = senderOf(mail.sender)
  return h.button(
    [
      h.Key(`queue-${mail.id}-${mail.entries.length}`),
      h.Type('button'),
      h.AriaLabel(t.inbox.newMailFrom(sender.name, subjectOf(h, mail))),
      h.OnClick(Message.InboxChanged({ message: InboxMessage.PeekOpened({ id: mail.id }) })),
      h.Class(
        css({
          pointerEvents: 'auto',
          display: 'flex',
          minHeight: '12',
          width: '100%',
          alignItems: 'center',
          gap: '2.5',
          borderRadius: 'xl',
          layerStyle: 'surface',
          paddingInline: '3',
          paddingBlock: '2',
          textAlign: 'left',
          boxShadow: 'card',
        }),
      ),
    ],
    [
      badge(
        sender,
        css({
          width: '7',
          height: '7',
        }),
        h,
      ),
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
                cx(
                  EYEBROW,
                  css({
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }),
                ),
              ),
            ],
            [sender.name],
          ),
          h.span(
            [
              h.Class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'calc(13px*var(--type-scale))',
                  fontWeight: '500',
                }),
              ),
            ],
            [subjectOf(h, mail)],
          ),
        ],
      ),
      needsAction(mail)
        ? h.span(
            [
              h.Class(
                css({
                  width: '2',
                  height: '2',
                  flexShrink: '0',
                  borderRadius: '9999px',
                  backgroundColor: 'danger',
                }),
              ),
            ],
            [],
          )
        : h.empty,
      icon(
        h,
        ChevronRight,
        css({
          width: '4',
          height: '4',
          flexShrink: '0',
          color: 'mutedForeground',
        }),
      ),
    ],
  )
}

export const inboxButton = (model: Model, h: HtmlBuilder<Message>): Html =>
  inboxToggle(model, unreadCount(model), waitingMail(model), h)

const inboxToggle = (
  model: Model,
  unread: number,
  waiting: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  return h.button(
    [
      h.Key('inbox'),
      h.Type('button'),
      h.Title(t.inbox.inboxI),
      h.AriaLabel(unread > 0 ? t.inbox.inboxUnread(unread) : t.inbox.inbox),
      h.OnClick(Message.PanelOpened({ panel: 'inbox' })),
      h.Class(
        cx(
          waiting
            ? cx('mail-ping', css({ color: 'foreground' }))
            : css({ color: 'mutedForeground' }),
          css({
            position: 'absolute',
            right: '3',
            bottom: '3',
            zIndex: '20',
            display: 'grid',
            width: '11',
            height: '11',
            placeItems: 'center',
          }),
          PANEL,
          css({
            _hover: {
              color: 'foreground',
            },
            _compact: {
              display: 'none',
            },
          }),
        ),
      ),
    ],
    [
      icon(
        h,
        MailIcon,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
      unread > 0
        ? h.span(
            [
              h.Key(`unread-${unread}`),
              h.Class(
                cx(
                  FIGURE,
                  cx(
                    css({
                      position: 'absolute',
                      top: '-0.375rem',
                      right: '-0.375rem',
                      display: 'grid',
                      height: '18px',
                      minWidth: '18px',
                      placeItems: 'center',
                      borderRadius: '9999px',
                      paddingInline: '1',
                      fontSize: 'calc(10.5px*var(--type-scale))',
                      fontWeight: '500',
                      boxShadow: 'raised',
                    }),
                    'enter-badge',
                  ),
                  waiting
                    ? css({
                        backgroundColor: 'danger',
                        color: 'white',
                      })
                    : css({
                        layerStyle: 'primaryFill',
                        color: 'onPrimaryFill',
                      }),
                ),
              ),
            ],
            [String(unread)],
          )
        : h.empty,
    ],
  )
}

const row = (
  mail: Mail,
  open: boolean,
  folded: ReadonlyArray<Mail>,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  if (mail.id === DIGEST_ID) return digestRow(mail, folded, open, h)
  const sender = senderOf(mail.sender)
  // The priority bar (18 "Pacing and volume"): danger while a clock runs, warn while a
  // decision waits. Noise wears none, because no clock and no question is running.
  const bar = barOf(mail)
  return h.li(
    [h.Key(String(mail.id))],
    [
      h.button(
        [
          h.Type('button'),
          h.AriaCurrent(open ? 'true' : 'false'),
          h.OnClick(Message.InboxChanged({ message: InboxMessage.Opened({ id: mail.id }) })),
          h.Class(
            cx(
              css({
                position: 'relative',
                display: 'flex',
                width: '100%',
                alignItems: 'flex-start',
                gap: '2.5',
                paddingInline: '3.5',
                paddingBlock: '2',
                textAlign: 'left',
                _compact: {
                  gap: '3',
                  paddingInline: '4',
                  paddingBlock: '3',
                },
              }),
              open
                ? css({
                    backgroundColor: 'well',
                  })
                : css({
                    _hover: {
                      backgroundColor: 'color-mix(in oklab, var(--well) 50%, transparent)',
                    },
                  }),
            ),
          ),
        ],
        [
          bar === null
            ? h.empty
            : h.span(
                [
                  h.Class(
                    cx(
                      css({
                        position: 'absolute',
                        insetBlock: '0',
                        left: '0',
                        width: '3px',
                      }),
                      bar,
                    ),
                  ),
                  h.Role('img'),
                  h.AriaLabel(t.inbox.priorities[priorityOf(mail)]),
                ],
                [],
              ),
          mail.read
            ? h.empty
            : h.span(
                [
                  h.Class(
                    css({
                      position: 'absolute',
                      top: '17px',
                      left: '1.5',
                      width: '1.5',
                      height: '1.5',
                      borderRadius: '9999px',
                      backgroundColor: 'primaryStrong',
                      _compact: {
                        top: '26px',
                        left: '2',
                      },
                    }),
                  ),
                  h.Role('img'),
                  h.AriaLabel(t.inbox.unread),
                ],
                [],
              ),
          badge(
            sender,
            css({
              marginTop: '1px',
              width: '6',
              height: '6',
              _compact: {
                width: '9',
                height: '9',
              },
            }),
            h,
          ),
          h.span(
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
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '2',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        cx(
                          css({
                            flex: '1 1 0%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 'calc(12.5px*var(--type-scale))',
                            _compact: {
                              fontSize: 'calc(13.5px*var(--type-scale))',
                            },
                          }),
                          mail.read
                            ? ''
                            : css({
                                fontWeight: '600',
                              }),
                        ),
                      ),
                    ],
                    [sender.name],
                  ),
                  // The kind label repeats the badge's shape and colour in words
                  // (18 "Colour code").
                  h.span(
                    [
                      h.Class(
                        cx(
                          EYEBROW,
                          css({
                            flexShrink: '0',
                            _compact: {
                              display: 'none',
                            },
                          }),
                        ),
                      ),
                    ],
                    [t.inbox.kinds[kindOf(mail)]],
                  ),
                  mail.entries.length > 1
                    ? h.span(
                        [
                          h.Class(
                            cx(
                              FIGURE,
                              css({
                                fontSize: 'calc(10.5px*var(--type-scale))',
                                color: 'mutedForeground',
                              }),
                            ),
                          ),
                        ],
                        [`×${mail.entries.length}`],
                      )
                    : h.empty,
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'calc(10.5px*var(--type-scale))',
                            color: 'mutedForeground',
                          }),
                        ),
                      ),
                    ],
                    [clock(mail.time)],
                  ),
                ],
              ),
              h.span(
                [
                  h.Class(
                    cx(
                      css({
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 'calc(12px*var(--type-scale))',
                        _compact: {
                          fontSize: 'calc(13.5px*var(--type-scale))',
                        },
                      }),
                      mail.read
                        ? css({
                            color: 'mutedForeground',
                          })
                        : css({
                            color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
                          }),
                    ),
                  ),
                ],
                [subjectOf(h, mail)],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      display: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'calc(11.5px*var(--type-scale))',
                      color: 'mutedForeground',
                      _compact: {
                        display: 'block',
                      },
                    }),
                  ),
                ],
                [gist(h, mail)],
              ),
            ],
          ),
        ],
      ),
    ],
  )
}

/** A thread the Digest folds, as one line that opens it. */
const digestLine = (mail: Mail, h: HtmlBuilder<Message>): Html => {
  const sender = senderOf(mail.sender)
  return h.li(
    [h.Key(`folded-${mail.id}`)],
    [
      h.button(
        [
          h.Type('button'),
          h.OnClick(Message.InboxChanged({ message: InboxMessage.Opened({ id: mail.id }) })),
          h.Class(
            css({
              display: 'flex',
              width: '100%',
              flexDirection: 'column',
              gap: '0.5',
              paddingInline: '3.5',
              paddingBlock: '2',
              textAlign: 'left',
              _hover: {
                backgroundColor: 'color-mix(in oklab, var(--well) 50%, transparent)',
              },
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '2',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      flex: '1 1 0%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'calc(12.5px*var(--type-scale))',
                    }),
                  ),
                ],
                [sender.name],
              ),
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'calc(10.5px*var(--type-scale))',
                        color: 'mutedForeground',
                      }),
                    ),
                  ),
                ],
                [clock(mail.time)],
              ),
            ],
          ),
          h.span(
            [
              h.Class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'calc(12px*var(--type-scale))',
                  color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
                }),
              ),
            ],
            [subjectOf(h, mail)],
          ),
          h.span(
            [
              h.Class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'calc(11.5px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [gist(h, mail)],
          ),
        ],
      ),
    ],
  )
}

/** The Digest's row in the list: how many older threads it folds, and the newest of them. */
const digestRow = (
  mail: Mail,
  folded: ReadonlyArray<Mail>,
  open: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return h.li(
    [h.Key('digest')],
    [
      h.button(
        [
          h.Type('button'),
          h.AriaCurrent(open ? 'true' : 'false'),
          h.OnClick(Message.InboxChanged({ message: InboxMessage.Opened({ id: DIGEST_ID }) })),
          h.Class(
            cx(
              css({
                position: 'relative',
                display: 'flex',
                width: '100%',
                alignItems: 'flex-start',
                gap: '2.5',
                paddingInline: '3.5',
                paddingBlock: '2',
                textAlign: 'left',
                _compact: {
                  gap: '3',
                  paddingInline: '4',
                  paddingBlock: '3',
                },
              }),
              open
                ? css({
                    backgroundColor: 'well',
                  })
                : css({
                    _hover: {
                      backgroundColor: 'color-mix(in oklab, var(--well) 50%, transparent)',
                    },
                  }),
            ),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  marginTop: '1px',
                  display: 'grid',
                  width: '6',
                  height: '6',
                  flexShrink: '0',
                  placeItems: 'center',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [
              icon(
                h,
                Layers,
                css({
                  width: '4',
                  height: '4',
                }),
              ),
            ],
          ),
          h.span(
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
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '2',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        cx(
                          css({
                            flex: '1 1 0%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 'calc(12.5px*var(--type-scale))',
                            _compact: {
                              fontSize: 'calc(13.5px*var(--type-scale))',
                            },
                          }),
                          mail.read
                            ? ''
                            : css({
                                fontWeight: '600',
                              }),
                        ),
                      ),
                    ],
                    [t.inbox.digest],
                  ),
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'calc(10.5px*var(--type-scale))',
                            color: 'mutedForeground',
                          }),
                        ),
                      ),
                    ],
                    [`×${folded.length}`],
                  ),
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'calc(10.5px*var(--type-scale))',
                            color: 'mutedForeground',
                          }),
                        ),
                      ),
                    ],
                    [clock(mail.time)],
                  ),
                ],
              ),
              h.span(
                [
                  h.Class(
                    cx(
                      css({
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 'calc(12px*var(--type-scale))',
                        _compact: {
                          fontSize: 'calc(13.5px*var(--type-scale))',
                        },
                      }),
                      mail.read
                        ? css({
                            color: 'mutedForeground',
                          })
                        : css({
                            color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
                          }),
                    ),
                  ),
                ],
                [subjectOf(h, mail)],
              ),
            ],
          ),
        ],
      ),
    ],
  )
}

/** A label chip: one Sender kind, and how much Mail in this folder it has (18 "The Inbox"). */
const labelChip = (
  label: MailLabel | null,
  text: string,
  count: number | null,
  active: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Key(`label-${label ?? 'all'}`),
      h.Type('button'),
      h.AriaCurrent(active ? 'true' : 'false'),
      h.OnClick(Message.InboxChanged({ message: InboxMessage.LabelChosen({ label }) })),
      h.Class(
        cx(
          cx(
            css({
              display: 'flex',
              height: '6',
              flexShrink: '0',
              alignItems: 'center',
              gap: '1.5',
              borderRadius: '9999px',
              borderWidth: '1px',
              borderStyle: 'solid',
              paddingInline: '2.5',
              fontSize: 'calc(11px*var(--type-scale))',
              whiteSpace: 'nowrap',
            }),
            'press',
          ),
          active
            ? css({
                borderColor: 'hairline',
                layerStyle: 'raised',
                fontWeight: '500',
                color: 'foreground',
                boxShadow: 'raised',
              })
            : css({
                borderColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
                color: 'mutedForeground',
                _hover: {
                  borderColor: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
                  color: 'foreground',
                },
              }),
        ),
      ),
    ],
    [
      text,
      count === null
        ? h.empty
        : h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(10px*var(--type-scale))',
                  }),
                ),
              ),
            ],
            [String(count)],
          ),
    ],
  )

const folderTab = (
  folder: Folder,
  label: string,
  count: number,
  active: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Key(folder),
      h.Type('button'),
      h.AriaCurrent(active ? 'true' : 'false'),
      h.OnClick(Message.InboxChanged({ message: InboxMessage.FolderChosen({ folder }) })),
      h.Class(
        cx(
          cx(
            css({
              display: 'flex',
              height: '6',
              alignItems: 'center',
              gap: '1.5',
              borderRadius: 'lg',
              paddingInline: '2.5',
              fontSize: 'calc(12px*var(--type-scale))',
              _compact: {
                height: '9',
                paddingInline: '3',
              },
            }),
            'press',
          ),
          active
            ? css({
                layerStyle: 'raised',
                fontWeight: '500',
                color: 'foreground',
                boxShadow: 'raised',
              })
            : css({
                color: 'mutedForeground',
                _hover: {
                  color: 'foreground',
                },
              }),
        ),
      ),
    ],
    [
      label,
      count > 0
        ? h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(10.5px*var(--type-scale))',
                  }),
                ),
              ),
            ],
            [String(count)],
          )
        : h.empty,
    ],
  )

const tool = (label: string, glyph: IconNode, message: Message, h: HtmlBuilder<Message>): Html =>
  button(
    {
      onClick: message,
      variant: 'ghost',
      size: 'icon-sm',
      className: css({
        color: 'mutedForeground',
        _compact: {
          width: '11',
          height: '11',
        },
      }),
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
  )

/**
 * The Digest's reader (18 "Pacing and volume"): the threads it folded, each one a line that opens
 * the Mail it stands for. Nothing is answered here; the Digest is a shelf, not a letter.
 */
const digestLetter = (mail: Mail, folded: ReadonlyArray<Mail>, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.article(
    [
      h.Key('digest'),
      h.Class(
        css({
          display: 'flex',
          minHeight: '0',
          flex: '1 1 0%',
          flexDirection: 'column',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                minHeight: '0',
                flex: '1 1 0%',
                flexDirection: 'column',
                gap: '3',
                paddingInline: '5',
                paddingBlock: '4',
              }),
              SCROLL,
            ),
          ),
        ],
        [
          h.span([h.Class(EYEBROW)], [t.inbox.digest]),
          h.h2(
            [
              h.Class(
                css({
                  fontSize: 'calc(16px*var(--type-scale))',
                  lineHeight: '1.375',
                  fontWeight: '600',
                  letterSpacing: '-0.02em',
                  _compact: {
                    fontSize: 'calc(18px*var(--type-scale))',
                  },
                }),
              ),
            ],
            [subjectOf(h, mail)],
          ),
          h.p(
            [
              h.Class(
                css({
                  fontSize: 'calc(12px*var(--type-scale))',
                  lineHeight: '1.625',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [t.inbox.moreThanEightThreadsWereUnread],
          ),
          h.ul(
            [
              h.Key('folded'),
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  '& > :not(:last-child)': {
                    borderBottomWidth: '1px',
                    borderBottomStyle: 'solid',
                    borderColor: 'hairline',
                  },
                  borderTopWidth: '1px',
                  borderTopStyle: 'solid',
                  borderBottomWidth: '1px',
                  borderBottomStyle: 'solid',
                  borderColor: 'hairline',
                }),
              ),
            ],
            folded.map((entry) => digestLine(entry, h)),
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'hairline',
              backgroundColor: 'nested',
              paddingInline: '3',
              paddingBlock: '2',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  flex: '1 1 0%',
                  fontSize: 'calc(11.5px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [t.inbox.olderUpdates(folded.length)],
          ),
        ],
      ),
    ],
  )
}

const letter = (mail: Mail, folded: ReadonlyArray<Mail>, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  if (mail.id === DIGEST_ID) return digestLetter(mail, folded, h)
  const sender = senderOf(mail.sender)
  const threaded = mail.entries.length > 1
  const latest = mail.entries.at(-1)
  const earlier = mail.entries.slice(0, -1)
  // The second tell (18 "How to tell"): a real advisory names an id the Glossary lists, and a
  // fake one names an id it does not, so there is nothing here to open.
  const tell = advisoryTell(
    `${mail.subject}\n${mail.entries.map((entry) => entry.text).join('\n')}`,
  )
  const buttons =
    mail.phase._tag === 'Answered'
      ? [
          h.p(
            [
              h.Class(
                css({
                  flex: '1 1 0%',
                  fontSize: 'calc(12px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [answerIn(t, { id: mail.phase.answerId, text: mail.phase.answer })],
          ),
        ]
      : mail.phase._tag !== 'Resolved'
        ? mail.actions.map((action, index) =>
            button(
              {
                onClick: Message.InboxChanged({
                  message: InboxMessage.Acted({ id: mail.id, action: action.id }),
                }),
                variant: action.id.startsWith('show') ? 'outline' : 'default',
                size: 'sm',
                className: css({
                  _compact: {
                    height: '11',
                    paddingInline: '3',
                  },
                }),
                // The hover names where the button really goes: a trap names an off-site address.
                attributes: [h.Key(action.id), h.Title(destinationIn(t, h, action))],
              },
              [
                actionLabelIn(t, action),
                h.span(
                  [
                    h.Class(
                      css({
                        _compact: {
                          display: 'none',
                        },
                      }),
                    ),
                  ],
                  [
                    Kbd(
                      {
                        className: css({
                          marginLeft: '1',
                          opacity: 0.8,
                        }),
                      },
                      [String(index + 1)],
                      h,
                    ),
                  ],
                ),
              ],
              h,
            ),
          )
        : []
  return h.article(
    // A new entry remounts the letter, which puts its scroll back at the top, on the newest line.
    [
      h.Key(`${mail.id}:${mail.entries.length}`),
      h.Class(
        css({
          display: 'flex',
          minHeight: '0',
          flex: '1 1 0%',
          flexDirection: 'column',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                minHeight: '0',
                flex: '1 1 0%',
                flexDirection: 'column',
                gap: '3',
                paddingInline: '5',
                paddingBlock: '4',
              }),
              SCROLL,
            ),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '2',
                }),
              ),
            ],
            [
              h.span([h.Class(EYEBROW)], [t.inbox.kinds[sender.kind]]),
              tell === null
                ? h.empty
                : h.a(
                    [
                      h.Key(`glossary-${tell.id}`),
                      h.Href(glossaryUrl(tell.term, localeOf(h))),
                      h.Target('_blank'),
                      h.Rel('noreferrer noopener'),
                      h.Title(t.inbox.opensTheGlossaryOnThisAdvisory),
                      h.Class(
                        cx(
                          buttonBase,
                          buttonVariants.ghost,
                          buttonSizes.sm,
                          css({
                            marginLeft: '-0.25rem',
                            height: '6',
                            paddingInline: '1.5',
                            color: 'mutedForeground',
                          }),
                        ),
                      ),
                    ],
                    [
                      icon(
                        h,
                        ShieldAlert,
                        css({
                          width: '3.5',
                          height: '3.5',
                        }),
                      ),
                      tell.id,
                      ' · ',
                      t.inbox.inTheGlossary,
                    ],
                  ),
              mail.phase._tag === 'Resolved'
                ? h.span(
                    [
                      h.Class(
                        css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1',
                          fontSize: 'calc(11.5px*var(--type-scale))',
                          fontWeight: '500',
                          color: 'ok',
                        }),
                      ),
                    ],
                    [
                      icon(
                        h,
                        CircleCheck,
                        css({
                          width: '3.5',
                          height: '3.5',
                        }),
                      ),
                      t.inbox.resolved(clock(mail.phase.at)),
                    ],
                  )
                : h.empty,
            ],
          ),
          h.h2(
            [
              h.Class(
                css({
                  fontSize: 'calc(16px*var(--type-scale))',
                  lineHeight: '1.375',
                  fontWeight: '600',
                  letterSpacing: '-0.02em',
                  _compact: {
                    fontSize: 'calc(18px*var(--type-scale))',
                  },
                }),
              ),
            ],
            [subjectOf(h, mail)],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2.5',
                }),
              ),
            ],
            [
              badge(
                sender,
                css({
                  width: '7',
                  height: '7',
                  _compact: {
                    width: '9',
                    height: '9',
                  },
                }),
                h,
              ),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      minWidth: '0',
                      flexDirection: 'column',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 'calc(12.5px*var(--type-scale))',
                          fontWeight: '500',
                        }),
                      ),
                    ],
                    [sender.name],
                  ),
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 'calc(11px*var(--type-scale))',
                            color: 'mutedForeground',
                          }),
                        ),
                      ),
                    ],
                    [sender.address],
                  ),
                ],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3',
                  fontSize: 'calc(13px*var(--type-scale))',
                  lineHeight: '1.625',
                  _compact: {
                    fontSize: 'calc(15px*var(--type-scale))',
                    lineHeight: '1.625',
                  },
                }),
              ),
            ],
            [
              // The newest line is what the player opened the thread for, so the rest waits behind
              // one row (18 "The Inbox"). A repeat folds the old lines again, and the reader stays
              // at the top, where the new line is.
              earlier.length > 0
                ? h.details(
                    [
                      h.Key('earlier'),
                      h.Class(
                        cx(
                          css({
                            display: 'flex',
                            flexDirection: 'column',
                          }),
                          'fold',
                          'group',
                        ),
                      ),
                    ],
                    [
                      h.summary(
                        [
                          h.Class(
                            css({
                              display: 'flex',
                              cursor: 'pointer',
                              listStyleType: 'none',
                              alignItems: 'center',
                              gap: '1.5',
                              '&::-webkit-details-marker': {
                                display: 'none',
                              },
                            }),
                          ),
                        ],
                        [
                          icon(
                            h,
                            ChevronRight,
                            cx(
                              css({
                                width: '3.5',
                                height: '3.5',
                                flexShrink: '0',
                                color: 'mutedForeground',
                                '.group[open] &': {
                                  rotate: '90deg',
                                },
                              }),
                              'fold-chevron',
                            ),
                          ),
                          h.span([h.Class(EYEBROW)], [t.inbox.earlierMessages(earlier.length)]),
                        ],
                      ),
                      h.div(
                        [
                          h.Class(
                            css({
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3',
                              paddingTop: '2',
                            }),
                          ),
                        ],
                        earlier.map((entry, index) => entryOf(h, entry, threaded, index)),
                      ),
                    ],
                  )
                : h.empty,
              latest ? entryOf(h, latest, threaded, mail.entries.length - 1) : h.empty,
            ],
          ),
          h.p(
            [
              h.Class(
                css({
                  fontSize: 'calc(11.5px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [signOf(t, mail.sender, sender)],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexShrink: '0',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '2',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'hairline',
              backgroundColor: 'nested',
              paddingInline: '3',
              paddingBlock: '2',
              _compact: {
                paddingBottom: '2',
              },
            }),
          ),
        ],
        [
          ...buttons,
          h.span(
            [
              h.Class(
                css({
                  flex: '1 1 0%',
                }),
              ),
            ],
            [],
          ),
          mail.trashed
            ? tool(
                t.inbox.moveToInboxE,
                ArchiveRestore,
                Message.InboxChanged({ message: InboxMessage.Restored({ id: mail.id }) }),
                h,
              )
            : h.span(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      alignItems: 'center',
                    }),
                  ),
                ],
                [
                  tool(
                    mail.spam ? t.inbox.notSpamS : t.inbox.reportSpamS,
                    mail.spam ? MailIcon : Ban,
                    Message.InboxChanged({ message: InboxMessage.MarkedSpam({ id: mail.id }) }),
                    h,
                  ),
                  tool(
                    t.inbox.deleteE,
                    Trash2,
                    Message.InboxChanged({ message: InboxMessage.Trashed({ id: mail.id }) }),
                    h,
                  ),
                ],
              ),
        ],
      ),
    ],
  )
}

const emptyOf = (t: Messages): Record<Folder, string> => ({
  action: t.inbox.nothingNeedsYou,
  fyi: t.inbox.noUpdates,
  spam: t.inbox.spamIsEmpty,
  trash: t.inbox.trashIsEmpty,
})

/** The Sandbox's stress bench: send any kind of Mail, one or many, without waiting for it. */
const generator = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: '2',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderColor: 'hairline',
          backgroundColor: 'nested',
          paddingInline: '3',
          paddingBlock: '2',
          _compact: {
            gap: '1.5',
          },
        }),
      ),
    ],
    [
      nativeSelect(
        {
          id: 'mail-sample',
          label: t.inbox.sample,
          labelClass: css({
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: '0',
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: '0',
          }),
          size: 'sm',
          value: model.board.inbox.sample,
          onChange: (id) => Message.InboxChanged({ message: InboxMessage.SampleChosen({ id }) }),
          wrapperClass: css({ width: '64' }),
          options: [...new Set(SAMPLES.map((sample) => sample.group))].map((group) =>
            nativeSelectOptGroup(
              { label: group },
              SAMPLES.filter((sample) => sample.group === group).map((sample) =>
                nativeSelectOption({ value: sample.id, label: sample.label }, h),
              ),
              h,
            ),
          ),
        },
        h,
      ),
      ...[1, 10, 50].map((count) =>
        button(
          {
            onClick: Message.InboxChanged({ message: InboxMessage.Generated({ count }) }),
            variant: count === 1 ? 'default' : 'outline',
            size: 'sm',
            attributes: [
              h.Key(`send-${count}`),
              ...(count === 1
                ? []
                : [h.AriaLabel(t.inbox.sendRandom(count)), h.Title(t.inbox.sendRandom(count))]),
            ],
          },
          count === 1
            ? t.inbox.send
            : [
                icon(
                  h,
                  Dices,
                  css({
                    width: '3.5',
                    height: '3.5',
                  }),
                ),
                `×${count}`,
              ],
          h,
        ),
      ),
      h.span(
        [
          h.Class(
            css({
              flex: '1 1 0%',
            }),
          ),
        ],
        [],
      ),
      button(
        {
          onClick: Message.InboxChanged({ message: InboxMessage.Resolved() }),
          variant: 'ghost',
          size: 'sm',
        },
        t.inbox.resolveThreads,
        h,
      ),
      button(
        {
          onClick: Message.InboxChanged({ message: InboxMessage.Cleared() }),
          variant: 'ghost',
          size: 'sm',
        },
        t.inbox.clear,
        h,
      ),
    ],
  )
}

/** A mail window docked above the corner button: the Board stays in view and clickable. */
export const inboxPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const newest = folderList(model.board.inbox)
  const folded = digestOf(model.board.inbox)
  const phone = isPhone()
  const focused =
    model.board.inbox.focus === null
      ? undefined
      : newest.find((mail) => mail.id === model.board.inbox.focus)
  // A phone is one screen at a time: the list until a Mail is tapped, then the Mail.
  const open = phone ? focused : (focused ?? newest[0])
  const labels = labelsIn(model.board.inbox)
  return h.section(
    [
      h.Key('inbox-panel'),
      h.DataAttribute('exit', 'gesture'),
      h.AriaLabel(t.inbox.inbox),
      h.Class(
        cx(
          css({
            position: 'absolute',
            right: '3',
            bottom: '68px',
            zIndex: '30',
            display: 'flex',
            height: 'min(520px, calc(100% - 96px))',
            width: 'min(720px, calc(100% - 24px))',
            flexDirection: 'column',
            overflow: 'hidden',
            _compact: {
              left: '0',
              right: '0',
              top: 'auto',
              bottom: '0',
              height: 'min(680px, 78dvh)',
              maxHeight: 'none',
              width: 'auto',
              borderTopLeftRadius: '2xl',
              borderTopRightRadius: '2xl',
              borderBottomLeftRadius: '0',
              borderBottomRightRadius: '0',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderTopColor: 'hairline',
              paddingBottom: 'env(safe-area-inset-bottom)',
            },
          }),
          FLOAT,
          'enter-panel sheet',
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'none',
              flexShrink: '0',
              justifyContent: 'center',
              paddingTop: '2',
              _compact: {
                display: 'flex',
              },
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  height: '1',
                  width: '10',
                  borderRadius: '9999px',
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
                }),
              ),
            ],
            [],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              paddingInline: '3',
              paddingBlock: '2.5',
              _compact: {
                paddingTop: '1',
              },
            }),
          ),
        ],
        [
          phone && open
            ? button(
                {
                  onClick: Message.InboxChanged({ message: InboxMessage.Opened({ id: null }) }),
                  variant: 'ghost',
                  size: 'sm',
                  className: css({
                    marginLeft: '-0.25rem',
                    height: '2.75rem !important',
                    gap: '1.5',
                    paddingInline: '2',
                    color: 'mutedForeground',
                  }),
                  attributes: [h.AriaLabel(t.inbox.inbox)],
                },
                [
                  icon(
                    h,
                    ArrowLeft,
                    css({
                      width: '4',
                      height: '4',
                    }),
                  ),
                  t.inbox.inbox,
                ],
                h,
              )
            : h.empty,
          h.div(
            [
              h.Class(
                cx(
                  css({
                    display: 'flex',
                    maxWidth: '100%',
                    gap: '0.5',
                    overflowX: 'auto',
                    borderRadius: 'xl',
                    backgroundColor: 'well',
                    padding: '0.5',
                    boxShadow: 'well',
                    scrollbarWidth: 'none',
                  }),
                  phone &&
                    open &&
                    css({
                      _compact: {
                        display: 'none',
                      },
                    }),
                ),
              ),
            ],
            [
              folderTab(
                'action',
                t.inbox.needsAction,
                openCount(model),
                model.board.inbox.folder === 'action',
                h,
              ),
              folderTab(
                'fyi',
                t.inbox.fYI,
                unreadIn(model, 'fyi'),
                model.board.inbox.folder === 'fyi',
                h,
              ),
              folderTab(
                'spam',
                t.inbox.spam,
                unreadIn(model, 'spam'),
                model.board.inbox.folder === 'spam',
                h,
              ),
              folderTab('trash', t.inbox.trash, 0, model.board.inbox.folder === 'trash', h),
            ],
          ),
          h.span(
            [
              h.Class(
                css({
                  flex: '1 1 0%',
                }),
              ),
            ],
            [],
          ),
          has(model.board.game, 'spam-filter')
            ? h.button(
                [
                  h.Key('filter'),
                  h.Type('button'),
                  h.AriaPressed(model.board.inbox.filter ? 'true' : 'false'),
                  h.OnClick(Message.InboxChanged({ message: InboxMessage.FilterToggled() })),
                  h.Class(
                    cx(
                      cx(
                        css({
                          display: 'flex',
                          height: '6',
                          alignItems: 'center',
                          borderRadius: 'lg',
                          paddingInline: '2.5',
                          fontSize: 'calc(12px*var(--type-scale))',
                          _compact: {
                            display: 'none',
                          },
                        }),
                        'press',
                      ),
                      model.board.inbox.filter
                        ? css({
                            layerStyle: 'raised',
                            color: 'foreground',
                            boxShadow: 'raised',
                          })
                        : css({
                            color: 'mutedForeground',
                          }),
                    ),
                  ),
                ],
                [model.board.inbox.filter ? t.changes.spamFilterOn : t.changes.spamFilterOff],
              )
            : h.empty,
          h.span(
            [
              h.Class(
                css({
                  _compact: {
                    display: 'none',
                  },
                }),
              ),
            ],
            [Kbd.group({}, [Kbd({}, ['J'], h), Kbd({}, ['K'], h)], h)],
          ),
          h.span(
            [
              h.Class(
                css({
                  _compact: {
                    display: 'none',
                  },
                }),
              ),
            ],
            [Kbd({}, [t.inbox.esc], h)],
          ),
          button(
            {
              onClick: Message.PanelClosed(),
              variant: 'ghost',
              size: 'icon-sm',
              className: css({
                color: 'mutedForeground',
                _compact: {
                  width: '11',
                  height: '11',
                },
              }),
              attributes: [h.AriaLabel(t.inbox.closeEsc)],
            },
            icon(
              h,
              X,
              css({
                width: '3.5',
                height: '3.5',
              }),
            ),
            h,
          ),
        ],
      ),
      boardSandbox(model.board) ? generator(model, h) : h.empty,
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'grid',
                minHeight: '0',
                flex: '1 1 0%',
                gridTemplateColumns: '264px minmax(0,1fr)',
                borderTopWidth: '1px',
                borderTopStyle: 'solid',
                borderColor: 'hairline',
                _compact: {
                  gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
                  gridTemplateRows: 'repeat(1, minmax(0, 1fr))',
                },
              }),
            ),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                cx(
                  css({
                    display: 'flex',
                    minHeight: '0',
                    flexDirection: 'column',
                    borderRightWidth: '1px',
                    borderRightStyle: 'solid',
                    borderColor: 'hairline',
                    _compact: {
                      borderRightWidth: '0px',
                      borderBottomWidth: '1px',
                      borderBottomStyle: 'solid',
                    },
                  }),
                  phone && open ? 'compact:hidden' : '',
                ),
              ),
            ],
            [
              // The labels are the filter chips above the list (18 "The Inbox").
              h.div(
                [
                  h.AriaLabel(t.inbox.labels),
                  // The chips keep their height: a scrolled row would otherwise give its space to
                  // the list and clip them under the first Mail.
                  h.Class(
                    css({
                      display: 'flex',
                      flexShrink: '0',
                      flexWrap: 'nowrap',
                      gap: '1.5',
                      overflowX: 'auto',
                      borderBottomWidth: '1px',
                      borderBottomStyle: 'solid',
                      borderColor: 'hairline',
                      paddingInline: '3',
                      paddingBlock: '2',
                    }),
                  ),
                ],
                [
                  labelChip(null, t.inbox.all, null, model.board.inbox.label === null, h),
                  ...labels.map((entry) =>
                    labelChip(
                      entry.label,
                      t.inbox.kinds[entry.label],
                      entry.count,
                      model.board.inbox.label === entry.label,
                      h,
                    ),
                  ),
                ],
              ),
              h.ul(
                [
                  h.AriaLabel(t.inbox.mail),
                  h.Class(
                    cx(
                      css({
                        display: 'flex',
                        minHeight: '0',
                        flex: '1 1 0%',
                        flexDirection: 'column',
                        '& > :not(:last-child)': {
                          borderBottomWidth: '1px',
                          borderBottomStyle: 'solid',
                          borderColor: 'hairline',
                        },
                      }),
                      SCROLL,
                    ),
                  ),
                ],
                newest.length === 0
                  ? [
                      h.li(
                        [
                          h.Class(
                            css({
                              paddingInline: '4',
                              paddingBlock: '4',
                              fontSize: 'calc(12.5px*var(--type-scale))',
                              color: 'mutedForeground',
                            }),
                          ),
                        ],
                        [
                          model.board.inbox.label === null
                            ? emptyOf(t)[model.board.inbox.folder]
                            : t.inbox.noMailWithThatLabelHere,
                        ],
                      ),
                    ]
                  : newest.map((mail) => row(mail, mail.id === open?.id, folded, h)),
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                cx(
                  css({
                    display: 'flex',
                    minHeight: '0',
                    minWidth: '0',
                    flexDirection: 'column',
                  }),
                  phone && !open ? 'compact:hidden' : '',
                ),
              ),
            ],
            open ? [letter(open, folded, h)] : [],
          ),
        ],
      ),
    ],
  )
}
