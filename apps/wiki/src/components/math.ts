import type { Html, HtmlBuilder } from 'foldkit/html'

/* A rule from the Simulation, typeset by KaTeX. A rule KaTeX cannot read fails the build rather
   than reaching a reader. KaTeX is about 250 kB, so it loads only for a page with a `latex` block
   (src/page-assets.ts). */

type Renderer = (source: string) => string

let renderer: Renderer | null = null

/** Brings KaTeX in once. A page with no `latex` block never calls it. */
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

export const mathView = <M>(source: string, h: HtmlBuilder<M>): Html => {
  const draw = renderer
  if (draw === null) throw new Error('math was drawn before its renderer loaded')
  return h.figure([h.Class('math'), h.InnerHTML(draw(source))], [])
}
