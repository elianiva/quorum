import { measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import { Text } from 'pixi.js'

export const MONO = '"Geist Mono", ui-monospace, monospace'
export const SANS = '"Geist", ui-sans-serif, system-ui, sans-serif'

const fontOf = new WeakMap<Text, string>()

const shapes = new WeakMap<
  Text,
  Readonly<{
    text: string
    font: string
    width: number
    segments: readonly string[]
    widths: ArrayLike<number>
  }>
>()

const shapeOf = (view: Text, text: string) => {
  const font = fontOf.get(view) ?? `500 12px ${SANS}`
  const known = shapes.get(view)
  if (known && known.text === text && known.font === font) return known
  const prepared = prepareWithSegments(text, font)
  const shape = {
    text,
    font,
    segments: prepared.segments,
    widths: prepared.widths,
    width: measureNaturalWidth(prepared),
  }
  shapes.set(view, shape)
  return shape
}

const ellipses = new Map<string, number>()

const ellipsisIn = (font: string): number => {
  const known = ellipses.get(font)
  if (known !== undefined) return known
  const width = measureNaturalWidth(prepareWithSegments('…', font))
  ellipses.set(font, width)
  return width
}

const fits = new WeakMap<
  Text,
  Readonly<{ text: string; room: number; fit: string; scale: number }>
>()

const MIN_LABEL_SCALE = 0.72
const LABEL_RESOLUTION = 2

export const fitText = (view: Text, text: string, room: number): void => {
  const last = fits.get(view)
  if (last?.text === text && last.room === room) {
    view.text = last.fit
    if (view.scale.x !== last.scale) view.scale.set(last.scale)
    return
  }
  const shape = shapeOf(view, text)
  const scale = shape.width > room ? Math.max(MIN_LABEL_SCALE, room / shape.width) : 1
  const budget = room / scale
  let fit = shape.text
  if (shape.width > budget) {
    const tail = ellipsisIn(shape.font)
    let used = 0
    let kept = ''
    for (let index = 0; index < shape.segments.length; index += 1) {
      const width = shape.widths[index] ?? 0
      if (used + width + tail > budget) break
      used += width
      kept += shape.segments[index]
    }
    fit = budget > tail ? `${kept.trimEnd()}…` : ''
  }
  view.text = fit
  view.scale.set(scale)
  fits.set(view, { text, room, fit, scale })
}

export const label = (
  size: number,
  family: string,
  weight: '400' | '500' | '600' | '700' = '500',
) => {
  const view = new Text({
    text: '',
    style: { fontFamily: family, fontSize: size, fontWeight: weight, fill: 0x16233d },
    resolution: LABEL_RESOLUTION,
  })
  fontOf.set(view, `${weight} ${size}px ${family}`)
  return view
}
