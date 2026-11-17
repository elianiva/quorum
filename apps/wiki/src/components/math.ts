import type { Html, HtmlBuilder } from 'foldkit/html'

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

export const mathView = <M>(source: string, h: HtmlBuilder<M>): Html => {
  const draw = renderer
  if (draw === null) throw new Error('math was drawn before its renderer loaded')
  return h.figure([h.Class('math'), h.InnerHTML(draw(source))], [])
}
