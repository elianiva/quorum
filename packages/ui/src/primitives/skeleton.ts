import { css, keyframes, cx as cn } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

const pulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.5 },
})

export const skeletonClass = css({
  backgroundColor: 'well',
  borderRadius: 'md',
  animation: `${pulse} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
})

type StyleConfig = Readonly<{ className?: string }>

/** Styled skeleton placeholder — a pulsing block. Mirrors the shadcn v4
 *  `skeleton.tsx`. */
export const skeleton = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cn(skeletonClass, config.className)), h.DataAttribute('slot', 'skeleton')],
    children,
  )
