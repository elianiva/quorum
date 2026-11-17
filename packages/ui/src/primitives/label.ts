import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

export const labelClass = css({
  gap: '2',
  fontSize: 'type.14',
  lineHeight: 'none',
  fontWeight: 'medium',
  '.group[data-disabled] &': {
    opacity: 0.5,
  },
  display: 'flex',
  alignItems: 'center',
  userSelect: 'none',
  '.group-field-set[data-disabled] &': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
})

type LabelConfig = Readonly<{ forId?: string; className?: string }>

export const label = <M>(
  config: LabelConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.label(
    [
      h.Class(cx(labelClass, config.className)),
      h.DataAttribute('slot', 'label'),
      ...(config.forId === undefined ? [] : [h.For(config.forId)]),
    ],
    children,
  )
