import type { Html, HtmlBuilder } from 'foldkit/html'
import { css } from '@quorum/styled-system/css'

type Renderer = (source: string) => string

let renderer: Renderer | null = null

export const loadMath = async (): Promise<void> => {
  if (renderer !== null) return
  const { default: katex } = await import('katex')
  renderer = (source) =>
    katex.renderToString(source, {
      displayMode: true,
      throwOnError: true,
      strict: 'error',
    })
}

/* A ```latex fence, typeset by KaTeX. KaTeX's own stylesheet is unlayered, so the display
   margin it sets only yields to an important declaration from a layer. */
const mathStyle = css({
  position: 'relative',
  margin: '1.5rem 0',
  overflowX: 'auto',
  overflowY: 'hidden',
  fontSize: 'type.16',
  _narrow: { fontSize: 'type.15' },
  color: 'color-mix(in oklch, var(--foreground) 88%, transparent)',
  '& .katex-display': { margin: '0!' },
})

export const mathView = <M>(source: string, h: HtmlBuilder<M>): Html => {
  const draw = renderer
  if (draw === null) throw new Error('math was drawn before its renderer loaded')
  return h.figure([h.Class(mathStyle), h.InnerHTML(draw(source))], [])
}
