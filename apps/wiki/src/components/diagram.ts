import type { Html, HtmlBuilder } from 'foldkit/html'
import { css } from '@quorum/styled-system/css'

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

/* A ```mermaid fence, drawn by Pele. Pele takes its colours from these variables, so a
   diagram follows the theme, light or dark. */
const diagramStyle = css({
  '--pele-bg': 'var(--background)',
  '--pele-fg': 'var(--foreground)',
  '--pele-muted': 'var(--muted-foreground)',
  '--pele-line': 'color-mix(in oklch, var(--foreground) 45%, transparent)',
  '--pele-surface': 'var(--card)',
  '--pele-surface-alt': 'var(--muted)',
  '--pele-border': 'var(--border)',
  margin: '1.5rem 0',
  padding: '20px',
  overflowX: 'auto',
  border: '1px solid var(--border)',
  borderRadius: 'lg',
  backgroundColor: 'var(--canvas)',
  backgroundImage: 'radial-gradient(var(--canvas-grid) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
  '& svg': { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' },
})

export const diagramView = <M>(source: string, h: HtmlBuilder<M>): Html => {
  const draw = renderer
  if (draw === null) throw new Error('a diagram was drawn before its renderer loaded')
  const { svg, width } = draw(source)
  return h.figure(
    [h.Class(diagramStyle)],
    [
      h.div(
        [h.Style({ minWidth: `${Math.round(width * MIN_SHRINK_SHARE)}px` }), h.InnerHTML(svg)],
        [],
      ),
    ],
  )
}
