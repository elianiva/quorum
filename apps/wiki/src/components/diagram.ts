import type { Html, HtmlBuilder } from 'foldkit/html'

const ARTICLE_COLUMN_OPTIONS = {
  maxWidth: 780,
  fontSize: 14,
  fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
}

const MIN_SHRINK_SHARE = 0.85

type Renderer = (source: string) => Readonly<{ svg: string; width: number }>

let renderer: Renderer | null = null

export const loadDiagram = async (): Promise<void> => {
  if (renderer !== null) return
  const { render } = await import('pele')
  renderer = (source) => render(source, ARTICLE_COLUMN_OPTIONS)
}

export const diagramView = <M>(source: string, h: HtmlBuilder<M>): Html => {
  const draw = renderer
  if (draw === null) throw new Error('a diagram was drawn before its renderer loaded')
  const { svg, width } = draw(source)
  return h.figure(
    [h.Class('diagram')],
    [
      h.div(
        [h.Style({ minWidth: `${Math.round(width * MIN_SHRINK_SHARE)}px` }), h.InnerHTML(svg)],
        [],
      ),
    ],
  )
}
