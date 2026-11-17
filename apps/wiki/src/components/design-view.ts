import type { Html, HtmlBuilder } from 'foldkit/html'
import type { Message } from '../main.ts'
import type { DesignId } from '../patterns/designs/ids.ts'

type Draw = (id: DesignId, h: HtmlBuilder<Message>) => Html

let draw: Draw | null = null

export const loadDesignView = async (): Promise<void> => {
  if (draw !== null) return
  const module = await import('./design-card.ts')
  draw = module.designView
}

export const designView = (id: DesignId, h: HtmlBuilder<Message>): Html => {
  if (draw === null) throw new Error('a design was drawn before its view loaded')
  return draw(id, h)
}
