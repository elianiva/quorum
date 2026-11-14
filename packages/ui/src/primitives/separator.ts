import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

export type SeparatorOrientation = 'horizontal' | 'vertical'

export const separatorClass = css({
  flexShrink: '0',
  backgroundColor: 'var(--border)',
  '&[data-horizontal]': {
    height: '1px',
    width: '100%',
  },
  '&[data-vertical]': {
    width: '1px',
    alignSelf: 'stretch',
  },
})

type SeparatorConfig = Readonly<{
  orientation?: SeparatorOrientation
  className?: string
}>

export const separator = <M>(config: SeparatorConfig, h: HtmlBuilder<M>): Html => {
  const orientation = config.orientation ?? 'horizontal'
  return h.div(
    [
      h.Class(cx(separatorClass, config.className)),
      h.Role('separator'),
      h.AriaOrientation(orientation),
      h.DataAttribute('slot', 'separator'),
      h.DataAttribute('orientation', orientation),
      h.DataAttribute(orientation, ''),
    ],
    [],
  )
}
