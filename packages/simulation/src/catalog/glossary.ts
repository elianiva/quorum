export { GLOSSARY_CATEGORIES, GLOSSARY } from '../generated/glossary.ts'
import { GLOSSARY_CATEGORIES } from '../generated/glossary.ts'

export type GlossaryCategory = (typeof GLOSSARY_CATEGORIES)[number]

export type GlossaryEntry = Readonly<{
  id: string
  term: string
  category: GlossaryCategory
  definition: string
  inGame: string
  design?: ReadonlyArray<Readonly<{ label: string; url: string }>>
  related: ReadonlyArray<string>
  links: ReadonlyArray<Readonly<{ label: string; url: string }>>
}>
