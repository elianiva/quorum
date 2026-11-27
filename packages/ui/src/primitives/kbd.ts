import { css } from '@quorum/styled-system/css'

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

export const kbdGroupClass = css({
  gap: '1',
  display: 'inline-flex',
  alignItems: 'center',
})
