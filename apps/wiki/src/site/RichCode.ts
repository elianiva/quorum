import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css } from '@quorum/styled-system/css'
import { Effect, Schema } from 'effect'

const MATH = css({
  position: 'relative',
  margin: '1.5rem 0',
  overflowX: 'auto',
  overflowY: 'hidden',
  fontSize: 'type.16',
  _narrow: { fontSize: 'type.15' },
  color: 'color-mix(in oklch, var(--foreground) 88%, transparent)',
  '& .katex-display': { margin: '0!' },
})

const DIAGRAM = css({
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

const DrawMath = Mount.make(
  'DrawMath',
  { args: { source: Schema.String } },
  (node: HTMLElement, { source }) =>
    Effect.promise(async () => {
      const { default: katex } = await import('katex')
      node.innerHTML = katex.renderToString(source, {
        displayMode: true,
        throwOnError: true,
        strict: 'error',
      })
    }).pipe(Effect.as(Component.noop)),
)

const DrawDiagram = Mount.make(
  'DrawDiagram',
  { args: { source: Schema.String } },
  (node: HTMLElement, { source }) =>
    Effect.promise(async () => {
      const { render } = await import('pele')
      const { svg, width } = render(source, {
        maxWidth: 780,
        fontSize: 14,
        fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
      })
      node.innerHTML = svg
      node.style.minWidth = `${Math.round(width * 0.85)}px`
    }).pipe(Effect.as(Component.noop)),
)

export const MathBlock = <Msg>(h: H<Msg>, source: string): View.Content<Msg> =>
  h.figure
    .class(MATH)
    .onMount(DrawMath({ source }))
    .children(
      h.pre
        .class(css({ margin: '0', background: 'none', boxShadow: 'none' }))
        .children(h.code.children(source)),
    )

export const DiagramBlock = <Msg>(h: H<Msg>, source: string): View.Content<Msg> =>
  h.figure
    .class(DIAGRAM)
    .onMount(DrawDiagram({ source }))
    .children(
      h.pre
        .class(css({ margin: '0', background: 'none', boxShadow: 'none' }))
        .children(h.code.children(source)),
    )
