import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import {
  Activity,
  ArchiveRestore,
  ArrowLeft,
  Ban,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Cloud,
  Compass,
  CreditCard,
  Dices,
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
} from 'lucide'
import { has } from '@quorum/simulation/lookups'
import type { BuildGroup } from '@quorum/simulation/catalog'
import { clock } from '@quorum/ui/game/format'
import { actionLabelIn, answerIn, closingIn, signOf, writtenIn } from '@/i18n/mail-render.ts'
import { copy, localeOf, type Messages } from '@/i18n/messages.ts'
import { advisoryTell } from '@/game/advisories.ts'
import {
  DIGEST_ID,
  InboxMessage,
  digestOf,
  folderHolds,
  folderList,
  labelsIn,
} from '@/game/inbox.ts'
import { TRAP_SITES, barOf, kindOf, priorityOf } from '@/game/mail-row.ts'
import { SAMPLES, needsAction, senderOf, type Sender, type SenderKind } from '@/game/mail.ts'
import { Message } from '@/game/message.ts'
import { boardSandbox, type Folder, type Mail, type MailLabel, type Model } from '@/game/model.ts'
import { isPhone } from '@/game/viewport.ts'
import { glossaryUrl } from '@/platform/analytics.ts'
import { EYEBROW, FIGURE, FLOAT, PANEL, SCROLL, WELL } from '@quorum/ui/game/bits'
import { badge as chip } from '../ui/badge.ts'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'
import { groupBadge } from './inspector/shared.ts'

/* The view content and children these helpers pass around. */
type Content = View.Content<Message>
type Child = View.Input<Message>
type Label = View.Content<Message> | string | false | null | undefined

const button = (
  h: H<Message>,
  config: Readonly<{
    onClick?: Message
    type?: 'button' | 'submit' | 'reset'
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
    key?: string
    attributes?: Readonly<Record<string, string | undefined>>
  }>,
  label: Label | ReadonlyArray<Label>,
): Content => {
  const root = config.key === undefined ? h.button : h.button.key(config.key)
  const base = root
    .attr('type', config.type ?? 'button')
    .attr('tabindex', '0')
    .class(buttonClass(config.variant, config.size), config.className)
    .attr('data-slot', 'button')
    .attrs(config.attributes ?? {})
  const clickable = config.onClick === undefined ? base : base.on('click', () => config.onClick)
  const inputs: ReadonlyArray<View.Input<Message>> = Array.isArray(label) ? label : [label]
  return clickable.children(...inputs)
}

const closeButton = (
  h: H<Message>,
  config: Readonly<{ label: string; onClick: Message }>,
): Content =>
  h.button
    .attr('type', 'button')
    .attr('aria-label', config.label)
    .attr('title', config.label)
    .on('click', () => config.onClick)
    .class(
      css({
        position: 'absolute',
        top: '1.5',
        right: '1.5',
        zIndex: 10,
        display: 'grid',
        width: '7',
        height: '7',
        placeItems: 'center',
        borderRadius: 'lg',
        color: 'color-mix(in oklab, var(--muted-foreground) 80%, transparent)',
        _hover: { backgroundColor: 'well', color: 'foreground' },
        _focusVisible: {
          boxShadow: 'focus',
          outlineStyle: 'none',
        },
      }),
    )
    .children(icon(h, X, css({ width: '3.5', height: '3.5' })))

/* The kbd `@quorum/ui/primitives/kbd` drew, hand-written for Effect UI. */
const KBD = css({
  layerStyle: 'raised',
  boxShadow: 'raised',
  color: 'color-mix(in oklab, var(--foreground) 75%, transparent)',
  '[data-slot="tooltip-content"] &': {
    backgroundColor: 'color-mix(in oklab, var(--background) 20%, transparent)',
    backgroundImage: 'none',
    boxShadow: 'none',
    color: 'background',
  },
  _dark: {
    '[data-slot="tooltip-content"] &': {
      backgroundColor: 'color-mix(in oklab, var(--background) 10%, transparent)',
    },
  },
  height: '5',
  width: 'fit-content',
  minWidth: '5',
  gap: '1',
  borderRadius: 'sm',
  paddingInline: '1.5',
  fontFamily: 'mono',
  fontSize: 'type.10-5',
  fontWeight: 'medium',
  '& svg:not([data-svg-icon])': { width: '3', height: '3' },
  pointerEvents: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
})

const KBD_GROUP = css({
  gap: '1',
  display: 'inline-flex',
  alignItems: 'center',
})

const kbd = (h: H<Message>, label: string, className?: string): Content =>
  h.kbd.attr('data-slot', 'kbd').class(cx(KBD, className)).children(label)

const kbdGroup = (h: H<Message>, children: ReadonlyArray<Child>): Content =>
  h.kbd
    .attr('data-slot', 'kbd-group')
    .class(KBD_GROUP)
    .children(...children)

/* The native select `@quorum/ui/primitives/native-select` drew, hand-written
   for Effect UI. */
const NATIVE_SELECT_FIELD_WRAPPER = css({
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
  gap: '1.5',
})

const NATIVE_SELECT_LABEL = css({
  paddingInline: '1.5',
  paddingBlock: '1',
  fontSize: 'type.12',
  lineHeight: 'compact',
  color: 'mutedForeground',
})

const NATIVE_SELECT_WRAPPER = css({
  '&:has(select[aria-disabled="true"])': { opacity: 0.5 },
  '&:has(select[data-disabled])': { opacity: 0.5 },
  position: 'relative',
  width: 'fit-content',
  '&:has(select:disabled)': { opacity: 0.5 },
})

const NATIVE_SELECT = css({
  backgroundColor: 'well',
  boxShadow: 'well',
  borderColor: 'transparent',
  '&::placeholder': { color: 'mutedForeground' },
  '&::selection': { backgroundColor: 'primary', color: 'primaryForeground' },
  _focusVisible: {
    borderColor: 'ring',
    boxShadow: 'focusWell',
  },
  '&[aria-invalid="true"]': {
    borderColor: 'destructive',
    boxShadow:
      'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
  },
  _dark: {
    '&[aria-invalid="true"]': {
      borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
      boxShadow:
        'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
    },
  },
  height: '8',
  width: '100%',
  minWidth: '0',
  appearance: 'none',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  paddingBlock: '1',
  paddingRight: '8',
  paddingLeft: '2.5',
  fontSize: 'type.14',
  lineHeight: 'fine',
  transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'default',
  transitionDuration: 'fast',
  userSelect: 'none',
  '&[data-size="sm"]': {
    height: '7',
    borderRadius: 'md',
    paddingBlock: '0.5',
  },
  '&[aria-disabled="true"], &[data-disabled]': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
  },
  outlineStyle: 'none',
  '&:disabled': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
  },
})

const NATIVE_SELECT_ICON = css({
  color: 'mutedForeground',
  top: '50%',
  right: '2.5',
  width: '4',
  height: '4',
  translate: '0 -50%',
  pointerEvents: 'none',
  position: 'absolute',
  userSelect: 'none',
})

const NATIVE_SELECT_OPTION = css({
  backgroundColor: 'Canvas',
  color: 'CanvasText',
})

const NATIVE_SELECT_OPTGROUP = css({
  backgroundColor: 'Canvas',
  color: 'CanvasText',
})

const nativeSelect = (
  h: H<Message>,
  config: Readonly<{
    id: string
    label: string
    size: 'default' | 'sm'
    value: string
    onChange: (value: string) => Message
    className?: string
    labelClass?: string
    wrapperClass?: string
    options: ReadonlyArray<Child>
  }>,
): Content =>
  h.div.class(cx(NATIVE_SELECT_FIELD_WRAPPER, config.wrapperClass)).children(
    h.label
      .attr('for', config.id)
      .class(cx(NATIVE_SELECT_LABEL, config.labelClass))
      .children(config.label),
    h.div
      .attr('data-slot', 'native-select-wrapper')
      .attr('data-size', config.size)
      .class(NATIVE_SELECT_WRAPPER)
      .children(
        h.select
          .attr('id', config.id)
          .attr('data-slot', 'native-select')
          .attr('data-size', config.size)
          .class(cx(NATIVE_SELECT, config.className))
          .value(config.value)
          .on('change', ({ value }) => config.onChange(value))
          .children(...config.options),
        h.span
          .attr('data-slot', 'native-select-icon')
          .class(NATIVE_SELECT_ICON)
          .attr('aria-hidden', 'true')
          .children(icon(h, ChevronDown, css({ width: '4', height: '4' }))),
      ),
  )

const nativeSelectOption = (
  h: H<Message>,
  config: Readonly<{ value: string; label: string }>,
): Content =>
  h.option
    .attr('value', config.value)
    .attr('data-slot', 'native-select-option')
    .class(NATIVE_SELECT_OPTION)
    .children(config.label)

const nativeSelectOptGroup = (
  h: H<Message>,
  config: Readonly<{ label: string }>,
  children: ReadonlyArray<Child>,
): Content =>
  h.optgroup
    .attr('data-slot', 'native-select-optgroup')
    .class(NATIVE_SELECT_OPTGROUP)
    .attr('label', config.label)
    .children(...children)

const destinationIn = (t: Messages, action: Mail['actions'][number]): string => {
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

const BADGE: Record<SenderKind, Readonly<{ group: BuildGroup; glyph: IconNode }>> = {
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

const badge = (sender: Sender, size: string, h: H<Message>): Content => {
  const { group, glyph } = BADGE[sender.looks]
  return groupBadge(group, glyph, size, h, false, sender.color)
}

const unreadIn = (model: Model, folder: Folder): number =>
  model.board.inbox.mail.filter((mail) => folderHolds(mail, folder) && !mail.read).length

const openCount = (model: Model): number =>
  model.board.inbox.mail.filter((mail) => folderHolds(mail, 'action')).length

const bodyOf = (h: H<Message>, entry: Mail['entries'][number]): string =>
  (entry.message ? writtenIn(copy(h), entry.message)?.body : undefined) ??
  (entry.closing ? (closingIn(copy(h), entry.closing) ?? undefined) : undefined) ??
  entry.text

const subjectOf = (h: H<Message>, mail: Mail): string =>
  (mail.message ? writtenIn(copy(h), mail.message)?.subject : undefined) ?? mail.subject

const entryOf = (
  h: H<Message>,
  entry: Mail['entries'][number],
  threaded: boolean,
  index: number,
): Content =>
  h.div
    .key(`entry-${index}`)
    .class(
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
    )
    .children(
      threaded
        ? h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.10-5',
                  color: 'mutedForeground',
                }),
              ),
            )
            .children(clock(entry.time))
        : undefined,
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '3',
            whiteSpace: 'pre-line',
          }),
        )
        .children(
          ...bodyOf(h, entry)
            .split('\n\n')
            .map((paragraph) => h.p.children(paragraph)),
        ),
    )

const gist = (h: H<Message>, mail: Mail): string => {
  const last = mail.entries.at(-1)
  return (
    (last ? bodyOf(h, last) : '').split('\n\n').find((paragraph) => paragraph.trim() !== '') ?? ''
  )
}

export const peek = (h: H<Message>, model: Model): Child => {
  const t = copy(h)

  const mail = model.board.inbox.mail.find(
    (entry) => entry.id === model.board.inbox.peek && !entry.trashed,
  )
  if (!mail || model.panel === 'inbox') return undefined
  const sender = senderOf(mail.sender)
  const decision = needsAction(mail)
  const act = decision ? mail.actions.find((action) => !action.id.startsWith('show')) : undefined
  return h.div
    .key(`peek-${mail.id}-${mail.entries.length}`)
    .attr('role', 'status')
    .attr('aria-label', t.inbox.newMailFrom(sender.name, subjectOf(h, mail)))
    .class(
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
      FLOAT,
      css({
        _compact: {
          position: 'relative',
          width: 'auto',
          pointerEvents: 'auto',
        },
      }),
    )
    .children(
      closeButton(h, {
        label: t.inbox.dismiss,
        onClick: Message.InboxChanged({ message: InboxMessage.PeekDismissed() }),
      }),
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'flex-start',
            gap: '3',
            paddingRight: '6',
          }),
        )
        .children(
          badge(
            sender,
            css({
              width: '8',
              height: '8',
            }),
            h,
          ),
          h.div
            .class(
              css({
                display: 'flex',
                minWidth: '0',
                flex: '1 1 0%',
                flexDirection: 'column',
                gap: '0.5',
              }),
            )
            .children(
              h.span
                .class(
                  cx(
                    EYEBROW,
                    css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.5',
                    }),
                  ),
                )
                .children(
                  h.span
                    .class(
                      css({
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }),
                    )
                    .children(sender.name),
                  h.span.children('·'),
                  h.span.class(FIGURE).children(clock(mail.time)),
                ),
              h.span
                .class(
                  css({
                    lineClamp: 2,
                    fontSize: 'type.14-5',
                    lineHeight: 'snug',
                    fontWeight: 'semibold',
                    letterSpacing: 'subtle',
                  }),
                )
                .children(subjectOf(h, mail)),
            ),
        ),
      h.div
        .class(
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
        )
        .children(
          h.p
            .class(
              css({
                lineClamp: 2,
                fontSize: 'type.12',
                lineHeight: 'snug',
                color: 'mutedForeground',
              }),
            )
            .children(gist(h, mail)),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
          }),
        )
        .children(
          decision ? chip(h, { variant: 'destructive' }, [t.inbox.needsAction]) : undefined,
          h.span
            .class(
              css({
                flex: '1 1 0%',
              }),
            )
            .children(),
          act
            ? button(
                h,
                {
                  onClick: Message.InboxChanged({
                    message: InboxMessage.Acted({ id: mail.id, action: act.id }),
                  }),
                  size: 'sm',
                  key: act.id,
                  attributes: { title: destinationIn(t, act) },
                },
                actionLabelIn(t, act),
              )
            : undefined,
          button(
            h,
            {
              onClick: Message.InboxChanged({ message: InboxMessage.PeekOpened({ id: mail.id }) }),
              variant: act ? 'outline' : 'default',
              size: 'sm',
              key: 'open',
            },
            [
              t.inbox.open,
              kbd(
                h,
                'I',
                css({
                  marginLeft: '1',
                  opacity: 0.8,
                }),
              ),
            ],
          ),
        ),
    )
}

export const unreadCount = (model: Model): number =>
  unreadIn(model, 'action') + unreadIn(model, 'fyi')

export const waitingMail = (model: Model): boolean =>
  model.board.inbox.mail.some((mail) => folderHolds(mail, 'action') && !mail.read)

export const mailQueueRow = (h: H<Message>, model: Model): Child => {
  const t = copy(h)

  const mail = model.board.inbox.mail.find(
    (entry) => entry.id === model.board.inbox.peek && !entry.trashed,
  )
  if (!mail || model.panel === 'inbox') return undefined
  const sender = senderOf(mail.sender)
  return h.button
    .key(`queue-${mail.id}-${mail.entries.length}`)
    .attr('type', 'button')
    .attr('aria-label', t.inbox.newMailFrom(sender.name, subjectOf(h, mail)))
    .on('click', () => Message.InboxChanged({ message: InboxMessage.PeekOpened({ id: mail.id }) }))
    .class(
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
    )
    .children(
      badge(
        sender,
        css({
          width: '7',
          height: '7',
        }),
        h,
      ),
      h.div
        .class(
          css({
            display: 'flex',
            minWidth: '0',
            flex: '1 1 0%',
            flexDirection: 'column',
            gap: '0.5',
          }),
        )
        .children(
          h.span
            .class(
              cx(
                EYEBROW,
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }),
              ),
            )
            .children(sender.name),
          h.span
            .class(
              css({
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'type.13',
                fontWeight: 'medium',
              }),
            )
            .children(subjectOf(h, mail)),
        ),
      needsAction(mail)
        ? h.span
            .class(
              css({
                width: '2',
                height: '2',
                flexShrink: '0',
                borderRadius: 'full',
                backgroundColor: 'danger',
              }),
            )
            .children()
        : undefined,
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
    )
}

export const inboxButton = (h: H<Message>, model: Model): Content =>
  inboxToggle(h, model, unreadCount(model), waitingMail(model))

const inboxToggle = (h: H<Message>, model: Model, unread: number, waiting: boolean): Content => {
  const t = copy(h)

  return h.button
    .key('inbox')
    .attr('type', 'button')
    .attr('title', t.inbox.inboxI)
    .attr('aria-label', unread > 0 ? t.inbox.inboxUnread(unread) : t.inbox.inbox)
    .on('click', () => Message.PanelOpened({ panel: 'inbox' }))
    .class(
      waiting
        ? css({
            color: 'foreground',
            /* A decision waits in the Inbox: a ring sweeps out of the button until it is read. */
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: '0',
              borderRadius: 'inherit',
              boxShadow: '0 0 0 0 var(--danger)',
              animation: 'mail-ping 1.8s var(--ease-out) infinite',
              pointerEvents: 'none',
            },
          })
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
    )
    .children(
      icon(
        h,
        MailIcon,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
      unread > 0
        ? h.span
            .key(`unread-${unread}`)
            .class(
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
                    borderRadius: 'full',
                    paddingInline: '1',
                    fontSize: 'type.10-5',
                    fontWeight: 'medium',
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
            )
            .children(String(unread))
        : undefined,
    )
}

const row = (mail: Mail, open: boolean, folded: ReadonlyArray<Mail>, h: H<Message>): Content => {
  const t = copy(h)

  if (mail.id === DIGEST_ID) return digestRow(mail, folded, open, h)
  const sender = senderOf(mail.sender)
  const bar = barOf(mail)
  return h.li.key(String(mail.id)).children(
    h.button
      .attr('type', 'button')
      .attr('aria-current', open ? 'true' : 'false')
      .on('click', () => Message.InboxChanged({ message: InboxMessage.Opened({ id: mail.id }) }))
      .class(
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
      )
      .children(
        bar === null
          ? undefined
          : h.span
              .class(
                cx(
                  css({
                    position: 'absolute',
                    insetBlock: '0',
                    left: '0',
                    width: '3px',
                  }),
                  bar,
                ),
              )
              .attr('role', 'img')
              .attr('aria-label', t.inbox.priorities[priorityOf(mail)])
              .children(),
        mail.read
          ? undefined
          : h.span
              .class(
                css({
                  position: 'absolute',
                  top: '17px',
                  left: '1.5',
                  width: '1.5',
                  height: '1.5',
                  borderRadius: 'full',
                  backgroundColor: 'primaryStrong',
                  _compact: {
                    top: '26px',
                    left: '2',
                  },
                }),
              )
              .attr('role', 'img')
              .attr('aria-label', t.inbox.unread)
              .children(),
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
        h.span
          .class(
            css({
              display: 'flex',
              minWidth: '0',
              flex: '1 1 0%',
              flexDirection: 'column',
              gap: '0.5',
            }),
          )
          .children(
            h.span
              .class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '2',
                }),
              )
              .children(
                h.span
                  .class(
                    cx(
                      css({
                        flex: '1 1 0%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 'type.12-5',
                        _compact: {
                          fontSize: 'type.13-5',
                        },
                      }),
                      mail.read
                        ? ''
                        : css({
                            fontWeight: 'semibold',
                          }),
                    ),
                  )
                  .children(sender.name),
                h.span
                  .class(
                    cx(
                      EYEBROW,
                      css({
                        flexShrink: '0',
                        _compact: {
                          display: 'none',
                        },
                      }),
                    ),
                  )
                  .children(t.inbox.kinds[kindOf(mail)]),
                mail.entries.length > 1
                  ? h.span
                      .class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'type.10-5',
                            color: 'mutedForeground',
                          }),
                        ),
                      )
                      .children(`×${mail.entries.length}`)
                  : undefined,
                h.span
                  .class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.10-5',
                        color: 'mutedForeground',
                      }),
                    ),
                  )
                  .children(clock(mail.time)),
              ),
            h.span
              .class(
                cx(
                  css({
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 'type.12',
                    _compact: {
                      fontSize: 'type.13-5',
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
              )
              .children(subjectOf(h, mail)),
            h.span
              .class(
                css({
                  display: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'type.11-5',
                  color: 'mutedForeground',
                  _compact: {
                    display: 'block',
                  },
                }),
              )
              .children(gist(h, mail)),
          ),
      ),
  )
}

const digestLine = (mail: Mail, h: H<Message>): Content => {
  const sender = senderOf(mail.sender)
  return h.li.key(`folded-${mail.id}`).children(
    h.button
      .attr('type', 'button')
      .on('click', () => Message.InboxChanged({ message: InboxMessage.Opened({ id: mail.id }) }))
      .class(
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
      )
      .children(
        h.span
          .class(
            css({
              display: 'flex',
              alignItems: 'baseline',
              gap: '2',
            }),
          )
          .children(
            h.span
              .class(
                css({
                  flex: '1 1 0%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'type.12-5',
                }),
              )
              .children(sender.name),
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'type.10-5',
                    color: 'mutedForeground',
                  }),
                ),
              )
              .children(clock(mail.time)),
          ),
        h.span
          .class(
            css({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'type.12',
              color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
            }),
          )
          .children(subjectOf(h, mail)),
        h.span
          .class(
            css({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'type.11-5',
              color: 'mutedForeground',
            }),
          )
          .children(gist(h, mail)),
      ),
  )
}

const digestRow = (
  mail: Mail,
  folded: ReadonlyArray<Mail>,
  open: boolean,
  h: H<Message>,
): Content => {
  const t = copy(h)
  return h.li.key('digest').children(
    h.button
      .attr('type', 'button')
      .attr('aria-current', open ? 'true' : 'false')
      .on('click', () => Message.InboxChanged({ message: InboxMessage.Opened({ id: DIGEST_ID }) }))
      .class(
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
      )
      .children(
        h.span
          .class(
            css({
              marginTop: '1px',
              display: 'grid',
              width: '6',
              height: '6',
              flexShrink: '0',
              placeItems: 'center',
              color: 'mutedForeground',
            }),
          )
          .children(
            icon(
              h,
              Layers,
              css({
                width: '4',
                height: '4',
              }),
            ),
          ),
        h.span
          .class(
            css({
              display: 'flex',
              minWidth: '0',
              flex: '1 1 0%',
              flexDirection: 'column',
              gap: '0.5',
            }),
          )
          .children(
            h.span
              .class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '2',
                }),
              )
              .children(
                h.span
                  .class(
                    cx(
                      css({
                        flex: '1 1 0%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 'type.12-5',
                        _compact: {
                          fontSize: 'type.13-5',
                        },
                      }),
                      mail.read
                        ? ''
                        : css({
                            fontWeight: 'semibold',
                          }),
                    ),
                  )
                  .children(t.inbox.digest),
                h.span
                  .class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.10-5',
                        color: 'mutedForeground',
                      }),
                    ),
                  )
                  .children(`×${folded.length}`),
                h.span
                  .class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.10-5',
                        color: 'mutedForeground',
                      }),
                    ),
                  )
                  .children(clock(mail.time)),
              ),
            h.span
              .class(
                cx(
                  css({
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 'type.12',
                    _compact: {
                      fontSize: 'type.13-5',
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
              )
              .children(subjectOf(h, mail)),
          ),
      ),
  )
}

const labelChip = (
  label: MailLabel | null,
  text: string,
  count: number | null,
  active: boolean,
  h: H<Message>,
): Content =>
  h.button
    .key(`label-${label ?? 'all'}`)
    .attr('type', 'button')
    .attr('aria-current', active ? 'true' : 'false')
    .on('click', () => Message.InboxChanged({ message: InboxMessage.LabelChosen({ label }) }))
    .class(
      css({
        display: 'flex',
        height: '6',
        flexShrink: '0',
        alignItems: 'center',
        gap: '1.5',
        borderRadius: 'full',
        borderWidth: '1px',
        borderStyle: 'solid',
        paddingInline: '2.5',
        fontSize: 'type.11',
        whiteSpace: 'nowrap',
      }),
      'press',
      active
        ? css({
            borderColor: 'hairline',
            layerStyle: 'raised',
            fontWeight: 'medium',
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
    )
    .children(
      text,
      count === null
        ? undefined
        : h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.10',
                }),
              ),
            )
            .children(String(count)),
    )

const folderTab = (
  folder: Folder,
  label: string,
  count: number,
  active: boolean,
  h: H<Message>,
): Content =>
  h.button
    .key(folder)
    .attr('type', 'button')
    .attr('aria-current', active ? 'true' : 'false')
    .on('click', () => Message.InboxChanged({ message: InboxMessage.FolderChosen({ folder }) }))
    .class(
      css({
        display: 'flex',
        height: '6',
        alignItems: 'center',
        gap: '1.5',
        borderRadius: 'lg',
        paddingInline: '2.5',
        fontSize: 'type.12',
        _compact: {
          height: '9',
          paddingInline: '3',
        },
      }),
      'press',
      active
        ? css({
            layerStyle: 'raised',
            fontWeight: 'medium',
            color: 'foreground',
            boxShadow: 'raised',
          })
        : css({
            color: 'mutedForeground',
            _hover: {
              color: 'foreground',
            },
          }),
    )
    .children(
      label,
      count > 0
        ? h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.10-5',
                }),
              ),
            )
            .children(String(count))
        : undefined,
    )

const tool = (label: string, glyph: IconNode, message: Message, h: H<Message>): Content =>
  button(
    h,
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
      attributes: { 'aria-label': label, title: label },
    },
    icon(
      h,
      glyph,
      css({
        width: '4',
        height: '4',
      }),
    ),
  )

const digestLetter = (mail: Mail, folded: ReadonlyArray<Mail>, h: H<Message>): Content => {
  const t = copy(h)
  return h.article
    .key('digest')
    .class(
      css({
        display: 'flex',
        minHeight: '0',
        flex: '1 1 0%',
        flexDirection: 'column',
      }),
    )
    .children(
      h.div
        .class(
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
        )
        .children(
          h.span.class(EYEBROW).children(t.inbox.digest),
          h.h2
            .class(
              css({
                fontSize: 'type.16',
                lineHeight: 'snug',
                fontWeight: 'semibold',
                letterSpacing: 'body',
                _compact: {
                  fontSize: 'type.18',
                },
              }),
            )
            .children(subjectOf(h, mail)),
          h.p
            .class(
              css({
                fontSize: 'type.12',
                lineHeight: 'relaxed',
                color: 'mutedForeground',
              }),
            )
            .children(t.inbox.moreThanEightThreadsWereUnread),
          h.ul
            .key('folded')
            .class(
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
            )
            .children(...folded.map((entry) => digestLine(entry, h))),
        ),
      h.div
        .class(
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
        )
        .children(
          h.span
            .class(
              css({
                flex: '1 1 0%',
                fontSize: 'type.11-5',
                color: 'mutedForeground',
              }),
            )
            .children(t.inbox.olderUpdates(folded.length)),
        ),
    )
}

const letter = (mail: Mail, folded: ReadonlyArray<Mail>, h: H<Message>): Content => {
  const t = copy(h)

  if (mail.id === DIGEST_ID) return digestLetter(mail, folded, h)
  const sender = senderOf(mail.sender)
  const threaded = mail.entries.length > 1
  const latest = mail.entries.at(-1)
  const earlier = mail.entries.slice(0, -1)
  const tell = advisoryTell(
    `${mail.subject}\n${mail.entries.map((entry) => entry.text).join('\n')}`,
  )
  const buttons: ReadonlyArray<Child> =
    mail.phase._tag === 'Answered'
      ? [
          h.p
            .class(
              css({
                flex: '1 1 0%',
                fontSize: 'type.12',
                color: 'mutedForeground',
              }),
            )
            .children(answerIn(t, { id: mail.phase.answerId, text: mail.phase.answer })),
        ]
      : mail.phase._tag !== 'Resolved'
        ? mail.actions.map((action, index) =>
            button(
              h,
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
                key: action.id,
                attributes: { title: destinationIn(t, action) },
              },
              [
                actionLabelIn(t, action),
                h.span
                  .class(
                    css({
                      _compact: {
                        display: 'none',
                      },
                    }),
                  )
                  .children(
                    kbd(
                      h,
                      String(index + 1),
                      css({
                        marginLeft: '1',
                        opacity: 0.8,
                      }),
                    ),
                  ),
              ],
            ),
          )
        : []
  return h.article
    .key(`${mail.id}:${mail.entries.length}`)
    .class(
      css({
        display: 'flex',
        minHeight: '0',
        flex: '1 1 0%',
        flexDirection: 'column',
      }),
    )
    .children(
      h.div
        .class(
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
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '2',
              }),
            )
            .children(
              h.span.class(EYEBROW).children(t.inbox.kinds[sender.kind]),
              tell === null
                ? undefined
                : h.a
                    .key(`glossary-${tell.id}`)
                    .attr('href', glossaryUrl(tell.term, localeOf(h)))
                    .attr('target', '_blank')
                    .attr('rel', 'noreferrer noopener')
                    .attr('title', t.inbox.opensTheGlossaryOnThisAdvisory)
                    .class(
                      buttonClass(
                        'ghost',
                        'sm',
                        css({
                          marginLeft: '-0.25rem',
                          height: '6',
                          paddingInline: '1.5',
                          color: 'mutedForeground',
                        }),
                      ),
                    )
                    .children(
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
                    ),
              mail.phase._tag === 'Resolved'
                ? h.span
                    .class(
                      css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1',
                        fontSize: 'type.11-5',
                        fontWeight: 'medium',
                        color: 'ok',
                      }),
                    )
                    .children(
                      icon(
                        h,
                        CircleCheck,
                        css({
                          width: '3.5',
                          height: '3.5',
                        }),
                      ),
                      t.inbox.resolved(clock(mail.phase.at)),
                    )
                : undefined,
            ),
          h.h2
            .class(
              css({
                fontSize: 'type.16',
                lineHeight: 'snug',
                fontWeight: 'semibold',
                letterSpacing: 'body',
                _compact: {
                  fontSize: 'type.18',
                },
              }),
            )
            .children(subjectOf(h, mail)),
          h.div
            .class(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '2.5',
              }),
            )
            .children(
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
              h.div
                .class(
                  css({
                    display: 'flex',
                    minWidth: '0',
                    flexDirection: 'column',
                  }),
                )
                .children(
                  h.span
                    .class(
                      css({
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 'type.12-5',
                        fontWeight: 'medium',
                      }),
                    )
                    .children(sender.name),
                  h.span
                    .class(
                      cx(
                        FIGURE,
                        css({
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 'type.11',
                          color: 'mutedForeground',
                        }),
                      ),
                    )
                    .children(sender.address),
                ),
            ),
          h.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '3',
                fontSize: 'type.13',
                lineHeight: 'relaxed',
                _compact: {
                  fontSize: 'type.15',
                  lineHeight: 'relaxed',
                },
              }),
            )
            .children(
              earlier.length > 0
                ? h.details
                    .key('earlier')
                    .class(
                      css({
                        display: 'flex',
                        flexDirection: 'column',
                      }),
                      'fold',
                      'group',
                    )
                    .children(
                      h.summary
                        .class(
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
                        )
                        .children(
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
                          h.span.class(EYEBROW).children(t.inbox.earlierMessages(earlier.length)),
                        ),
                      h.div
                        .class(
                          css({
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3',
                            paddingTop: '2',
                          }),
                        )
                        .children(
                          ...earlier.map((entry, index) => entryOf(h, entry, threaded, index)),
                        ),
                    )
                : undefined,
              latest ? entryOf(h, latest, threaded, mail.entries.length - 1) : undefined,
            ),
          h.p
            .class(
              css({
                fontSize: 'type.11-5',
                color: 'mutedForeground',
              }),
            )
            .children(signOf(t, mail.sender, sender)),
        ),
      h.div
        .class(
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
        )
        .children(
          ...buttons,
          h.span
            .class(
              css({
                flex: '1 1 0%',
              }),
            )
            .children(),
          mail.trashed
            ? tool(
                t.inbox.moveToInboxE,
                ArchiveRestore,
                Message.InboxChanged({ message: InboxMessage.Restored({ id: mail.id }) }),
                h,
              )
            : h.span
                .class(
                  css({
                    display: 'flex',
                    alignItems: 'center',
                  }),
                )
                .children(
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
                ),
        ),
    )
}

const emptyOf = (t: Messages): Record<Folder, string> => ({
  action: t.inbox.nothingNeedsYou,
  fyi: t.inbox.noUpdates,
  spam: t.inbox.spamIsEmpty,
  trash: t.inbox.trashIsEmpty,
})

const generator = (h: H<Message>, model: Model): Content => {
  const t = copy(h)
  return h.div
    .class(
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
    )
    .children(
      nativeSelect(h, {
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
            h,
            { label: group },
            SAMPLES.filter((sample) => sample.group === group).map((sample) =>
              nativeSelectOption(h, { value: sample.id, label: sample.label }),
            ),
          ),
        ),
      }),
      ...[1, 10, 50].map((count) =>
        button(
          h,
          {
            onClick: Message.InboxChanged({ message: InboxMessage.Generated({ count }) }),
            variant: count === 1 ? 'default' : 'outline',
            size: 'sm',
            key: `send-${count}`,
            attributes:
              count === 1
                ? {}
                : {
                    'aria-label': t.inbox.sendRandom(count),
                    title: t.inbox.sendRandom(count),
                  },
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
        ),
      ),
      h.span
        .class(
          css({
            flex: '1 1 0%',
          }),
        )
        .children(),
      button(
        h,
        {
          onClick: Message.InboxChanged({ message: InboxMessage.Resolved() }),
          variant: 'ghost',
          size: 'sm',
        },
        t.inbox.resolveThreads,
      ),
      button(
        h,
        {
          onClick: Message.InboxChanged({ message: InboxMessage.Cleared() }),
          variant: 'ghost',
          size: 'sm',
        },
        t.inbox.clear,
      ),
    )
}

export const inboxPanel = (h: H<Message>, model: Model): Content => {
  const t = copy(h)

  const newest = folderList(model.board.inbox)
  const folded = digestOf(model.board.inbox)
  const phone = isPhone()
  const focused =
    model.board.inbox.focus === null
      ? undefined
      : newest.find((mail) => mail.id === model.board.inbox.focus)
  const open = phone ? focused : (focused ?? newest[0])
  const labels = labelsIn(model.board.inbox)
  return h.section
    .key('inbox-panel')
    .attr('data-exit', 'gesture')
    .attr('aria-label', t.inbox.inbox)
    .class(
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
    )
    .children(
      h.div
        .class(
          css({
            display: 'none',
            flexShrink: '0',
            justifyContent: 'center',
            paddingTop: '2',
            _compact: {
              display: 'flex',
            },
          }),
        )
        .children(
          h.span
            .class(
              css({
                height: '1',
                width: '10',
                borderRadius: 'full',
                backgroundColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
              }),
            )
            .children(),
        ),
      h.div
        .class(
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
        )
        .children(
          phone && open
            ? button(
                h,
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
                  attributes: { 'aria-label': t.inbox.inbox },
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
              )
            : undefined,
          h.div
            .class(
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
            )
            .children(
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
            ),
          h.span
            .class(
              css({
                flex: '1 1 0%',
              }),
            )
            .children(),
          has(model.board.game, 'spam-filter')
            ? h.button
                .key('filter')
                .attr('type', 'button')
                .attr('aria-pressed', model.board.inbox.filter ? 'true' : 'false')
                .on('click', () => Message.InboxChanged({ message: InboxMessage.FilterToggled() }))
                .class(
                  css({
                    display: 'flex',
                    height: '6',
                    alignItems: 'center',
                    borderRadius: 'lg',
                    paddingInline: '2.5',
                    fontSize: 'type.12',
                    _compact: {
                      display: 'none',
                    },
                  }),
                  'press',
                  model.board.inbox.filter
                    ? css({
                        layerStyle: 'raised',
                        color: 'foreground',
                        boxShadow: 'raised',
                      })
                    : css({
                        color: 'mutedForeground',
                      }),
                )
                .children(
                  model.board.inbox.filter ? t.changes.spamFilterOn : t.changes.spamFilterOff,
                )
            : undefined,
          h.span
            .class(
              css({
                _compact: {
                  display: 'none',
                },
              }),
            )
            .children(kbdGroup(h, [kbd(h, 'J'), kbd(h, 'K')])),
          h.span
            .class(
              css({
                _compact: {
                  display: 'none',
                },
              }),
            )
            .children(kbd(h, t.inbox.esc)),
          button(
            h,
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
              attributes: { 'aria-label': t.inbox.closeEsc },
            },
            icon(
              h,
              X,
              css({
                width: '3.5',
                height: '3.5',
              }),
            ),
          ),
        ),
      boardSandbox(model.board) ? generator(h, model) : undefined,
      h.div
        .class(
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
        )
        .children(
          h.div
            .class(
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
              phone && open ? css({ _compact: { display: 'none' } }) : '',
            )
            .children(
              h.div
                .attr('aria-label', t.inbox.labels)
                .class(
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
                )
                .children(
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
                ),
              h.ul
                .attr('aria-label', t.inbox.mail)
                .class(
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
                )
                .children(
                  ...(newest.length === 0
                    ? [
                        h.li
                          .class(
                            css({
                              paddingInline: '4',
                              paddingBlock: '4',
                              fontSize: 'type.12-5',
                              color: 'mutedForeground',
                            }),
                          )
                          .children(
                            model.board.inbox.label === null
                              ? emptyOf(t)[model.board.inbox.folder]
                              : t.inbox.noMailWithThatLabelHere,
                          ),
                      ]
                    : newest.map((mail) => row(mail, mail.id === open?.id, folded, h))),
                ),
            ),
          h.div
            .class(
              css({
                display: 'flex',
                minHeight: '0',
                minWidth: '0',
                flexDirection: 'column',
              }),
              phone && !open ? css({ _compact: { display: 'none' } }) : '',
            )
            .children(...(open ? [letter(open, folded, h)] : [])),
        ),
    )
}
