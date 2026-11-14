import { Check, Circle, RotateCcw, X, createElement, type IconNode } from 'lucide'
import { DOCK_OF } from '@quorum/simulation/catalog'
import { priceOf } from '@quorum/simulation/lookups'
import { attachBoard, fitBoard, setBoard } from '@quorum/ui/board/board'
import { money } from '@quorum/ui/game/format'
import { COMPONENT_ICONS, GROUP_ICONS } from '@quorum/ui/game/icons'
import { GROUP_TEXT } from '@quorum/ui/game/bits'
import { css, cx } from '@quorum/styled-system/css'
import { en } from '../i18n/en/index.ts'
import { langOf, type Lang } from '../i18n/lang.ts'
import type { Locale } from '../i18n/locale.ts'
import {
  DOCK,
  boardState,
  complete,
  dockGroups,
  goals,
  start,
  update,
  type Practice,
  PracticeEvent,
  type PracticeId,
} from './practice.ts'

/** A goal's label in the page's language. The practice logic names goals in English, which is also the key. */
const goalLabel = (l: Lang, label: string): string => {
  const english = en.islands.practice.goals
  const key = (Object.keys(english) as Array<keyof typeof english>).find(
    (entry) => english[entry] === label,
  )
  return key ? l.t.islands.practice.goals[key] : label
}

const svg = (node: IconNode, size = 16): SVGElement =>
  createElement(node, { width: size, height: size, 'aria-hidden': 'true' })

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  children: ReadonlyArray<Node | string> = [],
  attrs: Readonly<Record<string, string>> = {},
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = className
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
  node.append(...children)
  return node
}

const BUTTON = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--border)',
  paddingInline: '0.625rem',
  paddingBlock: '0.25rem',
  fontSize: '13px',
  _hover: {
    backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
  },
  _focusVisible: {
    outlineWidth: '2px',
    outlineStyle: 'solid',
    outlineOffset: '2px',
    outlineColor: 'var(--ring)',
  },
})

export const mountPractice = (id: PracticeId, locale: Locale, root: HTMLElement): (() => void) => {
  const l = langOf(locale)
  const t = l.t.islands.practice
  const key = `practice-${id}`
  let state: Practice = start(id)
  let openGroup: string | null = null
  const events = new AbortController()

  const title = el(
    'h3',
    css({
      margin: '0',
      fontSize: '14px',
      fontWeight: '600',
      letterSpacing: '-0.025em',
    }),
    [t.titles[id]],
  )
  const reset = el('button', BUTTON, [svg(RotateCcw, 14), t.reset], { type: 'button' })
  const head = el(
    'div',
    css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
      borderBottomWidth: '1px',
      borderBottomStyle: 'solid',
      borderColor: 'var(--border)',
      paddingInline: '1rem',
      paddingBlock: '0.625rem',
    }),
    [title, reset],
  )
  const intro = el(
    'p',
    css({
      margin: '0',
      paddingInline: '1rem',
      paddingTop: '0.75rem',
      fontSize: '14px',
      lineHeight: '1.375',
      color: 'var(--muted-foreground)',
    }),
    [t.intro[id]],
  )
  const host = el(
    'div',
    css({
      position: 'relative',
      marginInline: '1rem',
      marginTop: '0.75rem',
      height: '440px',
      overflow: 'hidden',
      borderRadius: 'md',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'var(--border)',
      backgroundColor: 'color-mix(in oklab, var(--muted) 30%, transparent)',
    }),
    [],
    {
      role: 'application',
      'aria-label': t.area(t.titles[id]),
    },
  )
  // A board on a page lets the page scroll: only Ctrl or Cmd zooms it.
  host.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) event.stopPropagation()
    },
    { capture: true, signal: events.signal },
  )
  const dockHost = el(
    'div',
    css({
      paddingInline: '1rem',
      paddingTop: '0.75rem',
      '&:empty': { display: 'none' },
    }),
  )
  const cash = el(
    'span',
    css({
      fontSize: '12px',
      color: 'var(--muted-foreground)',
      fontVariantNumeric: 'tabular-nums',
    }),
  )
  const checklist = el(
    'ul',
    css({
      margin: '0',
      display: 'flex',
      listStyleType: 'none',
      flexDirection: 'column',
      gap: '0.25rem',
      padding: '0',
    }),
    [],
    {
      'aria-live': 'polite',
      'aria-label': t.goalsLabel,
    },
  )
  const note = el('p', css({ margin: '0', minHeight: '1.25rem', fontSize: '13px' }), [], {
    role: 'status',
    'aria-live': 'polite',
  })
  const foot = el(
    'div',
    css({
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      paddingInline: '1rem',
      paddingTop: '0.75rem',
      paddingBottom: '1rem',
    }),
    [
      el('div', css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }), [
        el('span', css({ fontSize: '12px', fontWeight: '500' }), [t.goalsLabel]),
        cash,
      ]),
      checklist,
      note,
    ],
  )
  root.replaceChildren(head, intro, host, dockHost, foot)

  const renderDock = () => {
    const groups = dockGroups(id)
    if (groups.length === 0) return dockHost.replaceChildren()
    const tabs = l.cat.DOCK_GROUPS.filter((group) => groups.includes(group.key)).map((group) => {
      const open = openGroup === group.key
      const button = el(
        'button',
        `${BUTTON} ${GROUP_TEXT[group.family]} ${open ? css({ backgroundColor: 'var(--muted)' }) : ''}`,
        [
          svg(GROUP_ICONS[group.family]),
          el('span', css({ color: 'var(--foreground)' }), [group.label]),
        ],
        { type: 'button', 'aria-pressed': String(open), title: group.label },
      )
      button.addEventListener('click', () => {
        openGroup = open ? null : group.key
        renderDock()
      })
      return button
    })
    const rows = DOCK[id]
      .filter((type) => openGroup !== null && DOCK_OF[type] === openGroup)
      .map((type) => {
        const price = priceOf(state.game, type)
        const armed = state.placing === type
        const button = el(
          'button',
          `${BUTTON} ${armed ? css({ backgroundColor: 'var(--muted)' }) : ''}`,
          [
            svg(COMPONENT_ICONS[type]),
            el('span', css({ fontWeight: '500' }), [l.cat.COMPONENTS[type].name]),
            el(
              'span',
              `${css({ fontVariantNumeric: 'tabular-nums' })} ${
                state.game.cash < price
                  ? css({ color: 'var(--danger)' })
                  : css({ color: 'var(--muted-foreground)' })
              }`,
              [money(price)],
            ),
          ],
          { type: 'button', 'aria-pressed': String(armed), title: l.cat.COMPONENTS[type].blurb },
        )
        button.addEventListener('click', () => {
          openGroup = null
          send(PracticeEvent.Arm({ type }))
        })
        return button
      })
    const armed = state.placing
    const stop = armed
      ? el('button', BUTTON, [svg(X, 14), t.stopPlacing(l.cat.COMPONENTS[armed].name)], {
          type: 'button',
        })
      : null
    stop?.addEventListener('click', () => send(PracticeEvent.Arm({ type: null })))
    dockHost.replaceChildren(
      el('div', css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }), [
        el('div', css({ display: 'flex', gap: '0.375rem' }), tabs, {
          role: 'group',
          'aria-label': t.build,
        }),
        ...rows,
        ...(armed
          ? [
              el('span', css({ fontSize: '12px', color: 'var(--muted-foreground)' }), [
                t.clickToPlace(l.cat.COMPONENTS[armed].name),
              ]),
              ...(stop ? [stop] : []),
            ]
          : []),
      ]),
    )
  }

  const render = () => {
    setBoard(key, boardState(state))
    renderDock()
    cash.textContent = id === 'place' ? t.cash(money(state.game.cash)) : ''
    checklist.replaceChildren(
      ...goals(state).map((goal) =>
        el(
          'li',
          cx(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '14px',
            }),
            goal.done ? css({ color: 'var(--ok)' }) : css({ color: 'var(--foreground)' }),
          ),
          [
            svg(goal.done ? Check : Circle, 14),
            goalLabel(l, goal.label),
            el(
              'span',
              css({
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
              [goal.done ? t.done : t.notYet],
            ),
          ],
        ),
      ),
    )
    const finished = complete(state)
    title.dataset['done'] = String(finished)
    note.className = cx(
      css({ margin: '0', minHeight: '1.25rem', fontSize: '13px' }),
      state.note?.tone === 'warn' ? css({ color: 'var(--warn)' }) : css({ color: 'var(--ok)' }),
    )
    // The refusals are the game's English sentences; the one note the board writes itself is translated.
    note.textContent = state.note
      ? state.note.text === en.islands.practice.databaseMoved
        ? t.databaseMoved
        : state.note.text
      : finished
        ? t.allDone
        : ''
    if (finished && !state.note)
      note.className = css({
        margin: '0',
        minHeight: '1.25rem',
        fontSize: '13px',
        color: 'var(--ok)',
      })
  }

  const send = (event: PracticeEvent) => {
    state = update(state, event)
    render()
    // A new card can land outside the view: show the whole Design again.
    if (event._tag === 'Place') requestAnimationFrame(() => fitBoard(key))
  }

  reset.addEventListener('click', () => {
    state = start(id)
    openGroup = null
    render()
    requestAnimationFrame(() => fitBoard(key))
  })

  // The game's own keys for a part in hand: Enter puts it in the next free spot, Esc puts it down.
  root.addEventListener(
    'keydown',
    (event) => {
      if (!state.placing) return
      const target = event.target as HTMLElement
      if (event.key === 'Escape') {
        event.preventDefault()
        send(PracticeEvent.Arm({ type: null }))
      } else if (event.key === 'Enter' && target.tagName !== 'BUTTON') {
        event.preventDefault()
        send(PracticeEvent.Place({ x: 400, y: 120 }))
      }
    },
    { signal: events.signal },
  )

  setBoard(key, boardState(state))
  const detach = attachBoard(key, host, {
    onNodeTap: (nodeId) => send(PracticeEvent.Tap({ nodeId })),
    onNodeMove: (nodeId, x, y) => send(PracticeEvent.Move({ nodeId, x, y })),
    onFooter: (nodeId) => send(PracticeEvent.Footer({ nodeId })),
    onLink: (from, to) => send(PracticeEvent.Link({ from, to })),
    onUnlink: (from, to) => send(PracticeEvent.Unlink({ from, to })),
    onPlace: (x, y) => send(PracticeEvent.Place({ x, y })),
    onEmptyTap: () => send(PracticeEvent.Empty()),
    onNodeToggle: (nodeId) => send(PracticeEvent.Toggle({ nodeId })),
    onBox: (ids, mode) => send(PracticeEvent.Box({ ids, mode })),
  })
  render()
  // The board starts asynchronously and draws a state sent before that; send it again over its
  // first second, as the card boards do.
  let frames = 0
  let frame = requestAnimationFrame(function again() {
    setBoard(key, boardState(state))
    frames += 1
    if (frames === 30) fitBoard(key)
    if (frames < 60) frame = requestAnimationFrame(again)
  })
  return () => {
    cancelAnimationFrame(frame)
    events.abort()
    detach()
  }
}
