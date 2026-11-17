import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SECTIONS = ['explanation', 'components', 'guides', 'tutorials']

const ID = 'virtual:quorum-wiki'
const content = fileURLToPath(new URL('../../apps/wiki/content/', import.meta.url))

const sources = (): Record<string, string> =>
  Object.fromEntries(
    SECTIONS.flatMap((section) =>
      readdirSync(`${content}${section}`)
        .filter((file) => file.endsWith('.md'))
        .map((file) => [
          `${section}/${file.replace(/\.md$/, '')}`,
          readFileSync(`${content}${section}/${file}`, 'utf8'),
        ]),
    ),
  )

export const wikiSources = () => ({
  name: 'wiki-sources',
  resolveId: (id: string): string | null => (id === ID ? `\0${ID}` : null),
  load: (id: string): string | null =>
    id === `\0${ID}` ? `export default ${JSON.stringify(sources())}` : null,
})
