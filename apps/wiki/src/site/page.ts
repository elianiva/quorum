import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import type { Section } from '../frontmatter.ts'
import type { Locale } from '../i18n/locale.ts'

export type Heading = Readonly<{ id: string; text: string; level: 2 | 3 }>

export type PageKind =
  | 'article'
  | 'component'
  | 'era'
  | 'glossary'
  | 'incident'
  | 'measurements'
  | 'pattern'
  | 'research'
  | 'runtime'
  | 'framework'
  | 'system'
  | 'venture'

/** The body of a page drawn without Markdown, such as a generated reference page. */
export type PageView<Msg> = (h: H<Msg>) => View.Content<Msg>

export type Page<Msg = never> = Readonly<{
  kind: PageKind
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
  /** A body drawn without Markdown. Authored articles leave it null and render their prose. */
  body: PageView<Msg> | null
  /** Content beside the article, above the table of contents. */
  aside: PageView<Msg> | null
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
