declare module 'virtual:content-index' {
  import type { Frontmatter } from './frontmatter.ts'

  export type ContentEntry = Readonly<{
    /** The file under the language's content root, such as `guides/read-p99.md`. */
    file: string
    /** The repository path to edit, such as `apps/wiki/content/guides/read-p99.md`. */
    source: string
    /** Null for an entity's prose file: its title and facts come from the catalog. */
    frontmatter: Frontmatter | null
  }>

  export const CONTENT: Readonly<Record<string, ContentEntry>>

  export const LINKS: Readonly<
    Record<string, Readonly<{ paths: ReadonlyArray<string>; sandboxes: ReadonlyArray<string> }>>
  >
}

declare module 'virtual:content-index-es' {
  import type { Frontmatter } from './frontmatter.ts'

  export const CONTENT: Readonly<
    Record<
      string,
      Readonly<{ file: string; source: string; frontmatter: Frontmatter | null }>
    >
  >
}

declare module 'virtual:content-index-ja' {
  import type { Frontmatter } from './frontmatter.ts'

  export const CONTENT: Readonly<
    Record<
      string,
      Readonly<{ file: string; source: string; frontmatter: Frontmatter | null }>
    >
  >
}
