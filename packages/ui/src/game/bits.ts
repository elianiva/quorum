import { css, cx } from '@quorum/styled-system/css'
import type { SystemStyleObject } from '@quorum/styled-system/types'
import type { BuildGroup } from '@quorum/simulation/catalog'

export const EYEBROW_STYLE: SystemStyleObject = {
  fontFamily: 'mono',
  fontSize: 'type.10-5',
  fontWeight: 'medium',
  textTransform: 'uppercase',
  letterSpacing: 'eyebrow',
  color: 'mutedForeground',
}
export const EYEBROW = css(EYEBROW_STYLE)
export const SCROLL = css({ overflow: 'auto', scrollbarWidth: 'thin' })
export const PANEL_STYLE: SystemStyleObject = {
  borderRadius: '2xl',
  layerStyle: 'surface',
  boxShadow: 'card',
}
export const PANEL = css(PANEL_STYLE)
export const FLOAT = css({ borderRadius: '2xl', layerStyle: 'surface', boxShadow: 'float' })
export const NESTED = css({
  borderRadius: 'xl',
  backgroundColor: 'nested',
  boxShadow: 'line',
  '& > :not(:last-child):not([data-slot="button"])': {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderColor: 'hairline',
  },
})
export const WELL_STYLE: SystemStyleObject = {
  borderRadius: 'xl',
  backgroundColor: 'well',
  boxShadow: 'well',
}
export const WELL = css(WELL_STYLE)
export const CHIPS = css({
  _compact: {
    flexDirection: 'row',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    '& > :not(:last-child)': {
      borderTopWidth: '0px',
      borderTopStyle: 'solid',
      borderRightWidth: '1px',
      borderRightStyle: 'solid',
      borderBottomWidth: '0px',
      borderBottomStyle: 'solid',
      borderLeftWidth: '0px',
      borderLeftStyle: 'solid',
    },
  },
})

export const FIGURE_STYLE: SystemStyleObject = {
  fontFamily: 'mono',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 'subtle',
}
export const FIGURE = css(FIGURE_STYLE)

const toolBase: SystemStyleObject = {
  position: 'relative',
  display: 'grid',
  width: '10',
  height: '10',
  flexShrink: 0,
  placeItems: 'center',
  borderRadius: 'xl',
}

const toolOn: SystemStyleObject = {
  layerStyle: 'primaryFill',
  color: 'onPrimaryFill',
  boxShadow: 'primary',
  _dark: {
    layerStyle: 'raised',
    color: 'foreground',
    boxShadow: 'raised',
  },
}

const toolOff: SystemStyleObject = {
  color: 'mutedForeground',
  _hover: { backgroundColor: 'well', color: 'foreground' },
}

export const tool = (active: boolean, style: SystemStyleObject = {}): string =>
  cx(css(toolBase, active ? toolOn : toolOff, style), 'press')

export type Tone = 'plain' | 'ok' | 'warn' | 'danger'

const toneClasses: Record<Tone, string> = {
  plain: css({ color: 'foreground' }),
  ok: css({ color: 'ok' }),
  warn: css({ color: 'warn' }),
  danger: css({ color: 'danger' }),
}

export const toneText = (tone: Tone): string => toneClasses[tone]

export const GROUP_TEXT: Record<BuildGroup, string> = {
  edge: css({ color: 'groupEdge' }),
  compute: css({ color: 'groupCompute' }),
  data: css({ color: 'groupData' }),
  ops: css({ color: 'groupOps' }),
}
