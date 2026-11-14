import { css, cx as cn } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

export const kbdClass = css({
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
  height: '1.25rem',
  width: 'fit-content',
  minWidth: '1.25rem',
  gap: '0.25rem',
  borderRadius: '5px',
  paddingInline: '0.375rem',
  fontFamily: 'mono',
  fontSize: '10.5px',
  fontWeight: '500',
  '& svg:not([data-svg-icon])': { width: '0.75rem', height: '0.75rem' },
  pointerEvents: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
})

export const kbdGroupClass = css({
  gap: '0.25rem',
  display: 'inline-flex',
  alignItems: 'center',
})

type StyleConfig = Readonly<{ className?: string }>

const kbdContainer = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.kbd([h.Class(cn(kbdClass, config.className)), h.DataAttribute('slot', 'kbd')], children)

const kbdGroup = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.kbd(
    [h.Class(cn(kbdGroupClass, config.className)), h.DataAttribute('slot', 'kbd-group')],
    children,
  )

/** Styled keyboard key(s). `Kbd.group` clusters several keys. Mirrors the
 *  shadcn v4 `kbd.tsx`. */
export const Kbd = Object.assign(kbdContainer, { group: kbdGroup })
