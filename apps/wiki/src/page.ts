import type { Html, HtmlBuilder } from 'foldkit/html'
import type { Locale } from './i18n/locale.ts'
import type { Section } from './frontmatter.ts'
import type { Message, Model } from './main.ts'

export type Heading = Readonly<{ id: string; text: string; level: 2 | 3 }>

export type View = (model: Model, h: HtmlBuilder<Message>) => Html

export type Page = Readonly<{
  locale: Locale
  path: string
  title: string
  seoTitle?: string | undefined
  summary: string
  section: Section
  parent: string | null
  group: string | null
  order: number
  era: number | null
  aliases: ReadonlyArray<string>
  source: string | null
  gdd: string | null
  headings: ReadonlyArray<Heading>
  wide: boolean
  aside: View | null
  body: View
  related: ReadonlyArray<string>
  text: string
  fallback: boolean
}>

export const slug = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
