import type { Html, HtmlBuilder } from 'foldkit/html'

/* A Mermaid diagram, drawn by Pele as SVG. The colours come from CSS variables (styles.css), so
   it follows the theme. A diagram Pele cannot read fails the build. Pele is about 700 kB, so it
   loads only for a page that has a diagram (src/page-assets.ts). */

/** The article column is about 780px wide inside the frame: Pele lays the diagram out for it, at the page's text size. */
const OPTIONS = {
  maxWidth: 780,
  fontSize: 14,
  fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
}

/** A diagram may shrink to fit its column, but not below this share of its own size: past that, a phone scrolls it. */
const SHRINK_LIMIT = 0.85

type Renderer = (source: string) => Readonly<{ svg: string; width: number }>

let renderer: Renderer | null = null

/** Brings Pele in once. A page with no Mermaid block never calls it. */
export const loadDiagram = async (): Promise<void> => {
  if (renderer !== null) return
  const { render } = await import('pele')
  renderer = (source) => render(source, OPTIONS)
}

export const diagramView = <M>(source: string, h: HtmlBuilder<M>): Html => {
  const draw = renderer
  if (draw === null) throw new Error('a diagram was drawn before its renderer loaded')
  const { svg, width } = draw(source)
  return h.figure(
    [h.Class('diagram')],
    [h.div([h.Style({ minWidth: `${Math.round(width * SHRINK_LIMIT)}px` }), h.InnerHTML(svg)], [])],
  )
}
