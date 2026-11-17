import { container, text } from 'takumi-js/helpers'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

export type OgCard = Readonly<{
  file: string
  title: string
  summary: string
  label: string
}>

const INK = '#eaebec'
const MUTED = '#9aa0a6'
const SIGNAL = '#58cef8'
const LINE = '#2c2f34'

export const ogFile = (path: string): string => `og${path === '/' ? '/index' : path}.png`

const titleSize = (title: string): number =>
  title.length <= 28 ? 84 : title.length <= 48 ? 68 : title.length <= 72 ? 56 : 46

const clip = (value: string, max: number): string => {
  if (value.length <= max) return value
  const cut = value.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).replace(/[,;:.\s]+$/, '')}…`
}

export const ogNode = ({ title, summary, label }: OgCard) =>
  container({
    style: {
      display: 'flex',
      width: OG_WIDTH,
      height: OG_HEIGHT,
      backgroundColor: '#141517',
      backgroundImage: 'radial-gradient(circle at 85% 20%, rgba(88,206,248,0.14), transparent 55%)',
      padding: 28,
    },
    children: [
      container({
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: OG_WIDTH - 56,
          height: OG_HEIGHT - 56,
          border: `1px solid ${LINE}`,
          padding: '48px 56px',
        },
        children: [
          text(label.toUpperCase(), {
            fontFamily: 'Geist Mono',
            fontSize: 24,
            letterSpacing: '0.16em',
            color: SIGNAL,
          }),
          container({
            style: { display: 'flex', flexDirection: 'column', gap: 24 },
            children: [
              text(title, {
                fontFamily: 'Geist',
                fontWeight: 600,
                fontSize: titleSize(title),
                letterSpacing: '-0.03em',
                lineHeight: '1.08em',
                color: INK,
              }),
              text(clip(summary, 150), {
                fontFamily: 'Geist',
                fontSize: 28,
                lineHeight: '1.4em',
                color: MUTED,
              }),
            ],
          }),
          container({
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
            children: [
              text('quorum', {
                fontFamily: 'Geist',
                fontWeight: 600,
                fontSize: 34,
                letterSpacing: '-0.04em',
                color: INK,
              }),
              text('wiki.playquorum.dev', {
                fontFamily: 'Geist Mono',
                fontSize: 22,
                color: MUTED,
              }),
            ],
          }),
        ],
      }),
    ],
  })
