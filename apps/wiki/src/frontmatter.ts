import { Schema } from 'effect'

export const SECTIONS = [
  'play',
  'tutorials',
  'guides',
  'explanation',
  'patterns',
  'reference',
  'design',
  'about',
] as const
export type Section = (typeof SECTIONS)[number]

export const Frontmatter = Schema.Struct({
  title: Schema.String.check(Schema.isNonEmpty()),
  summary: Schema.String.check(Schema.isNonEmpty()),
  section: Schema.Literals(SECTIONS),
  group: Schema.optionalKey(Schema.String),
  order: Schema.optionalKey(Schema.String),
  era: Schema.optionalKey(Schema.String),
  seoTitle: Schema.optionalKey(Schema.String),
  aliases: Schema.optionalKey(Schema.String),
  gdd: Schema.optionalKey(Schema.String),
  toc: Schema.optionalKey(Schema.Literal('top')),
})
export type Frontmatter = typeof Frontmatter.Type
