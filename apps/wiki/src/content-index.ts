import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMarkdownWithFrontmatter } from '@foldkit/markdown/vite'
import { Option, Schema } from 'effect'
import type { Plugin } from 'vite'
import { Frontmatter } from './frontmatter.ts'
import { linksIn } from './links.ts'
import { islandAttributes } from './islands.ts'

/* The one thing the client needs from every prose file, without the prose itself: which files a
   language has, their frontmatter, and the wiki paths and Sandboxes each links to. A page's own
   prose loads as its own chunk (src/content.ts), and each language's index loads with that
   language's bundle, so an English reader never downloads the translations' metadata. */

const WIKI = fileURLToPath(new URL('..', import.meta.url))

const ROOTS = {
  en: resolve(WIKI, 'content'),
  es: resolve(WIKI, 'content-es'),
  ja: resolve(WIKI, 'content-ja'),
} as const

type Locale = keyof typeof ROOTS

/** The virtual module that carries each language's index. English also carries the link graph. */
const IDS: Readonly<Record<Locale, string>> = {
  en: 'virtual:content-index',
  es: 'virtual:content-index-es',
  ja: 'virtual:content-index-ja',
}

const RESOLVED: Readonly<Record<Locale, string>> = {
  en: `\0${IDS.en}`,
  es: `\0${IDS.es}`,
  ja: `\0${IDS.ja}`,
}

/** The public images' intrinsic sizes, so prose reserves their space before they load. */
const IMAGE_ID = 'virtual:image-sizes'
const IMAGE_RESOLVED = `\0${IMAGE_ID}`
const PUBLIC = resolve(WIKI, 'public')
const IMAGE = /\.(?:png|gif|jpe?g|webp)$/i

type ImageSize = Readonly<{ width: number; height: number }>

/** PNG and GIF carry their size in a fixed header; the wiki's screenshots are PNG. */
const imageSize = (data: Buffer): ImageSize | null => {
  if (data.length >= 24 && data.readUInt32BE(0) === 0x89504e47)
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  if (data.length >= 10 && data.toString('ascii', 0, 3) === 'GIF')
    return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) }
  return null
}

const buildImages = async (): Promise<string> => {
  const sizes: Record<string, ImageSize> = {}
  for (const file of await readdir(PUBLIC, { recursive: true })) {
    const relative = file.split('\\').join('/')
    if (!IMAGE.test(relative)) continue
    const size = imageSize(await readFile(join(PUBLIC, relative)))
    if (size !== null) sizes[`/${relative}`] = size
  }
  return `export const IMAGE_SIZES = ${JSON.stringify(sizes)}\n`
}

const decodeFrontmatter = Schema.decodeUnknownSync(Frontmatter)

const pathOf = (file: string): string => {
  const path = `/${file}`.replace(/\.md$/, '').replace(/\/index$/, '')
  return path === '' ? '/' : path
}

const filesIn = async (root: string): Promise<ReadonlyArray<string>> =>
  (await readdir(root, { recursive: true })).filter((file) => file.endsWith('.md')).sort()

const build = async (): Promise<Readonly<Record<Locale, string>>> => {
  const content: Record<Locale, Record<string, unknown>> = { en: {}, es: {}, ja: {} }
  const links: Record<string, { paths: ReadonlyArray<string>; sandboxes: ReadonlyArray<string> }> =
    {}
  for (const locale of Object.keys(ROOTS) as ReadonlyArray<Locale>) {
    const root = ROOTS[locale]
    for (const file of await filesIn(root)) {
      const source = await readFile(join(root, file), 'utf8')
      const parsed = parseMarkdownWithFrontmatter(source, {
        frontmatter: Frontmatter,
        islands: islandAttributes,
      })
      const path = pathOf(file)
      const raw = Option.getOrNull(parsed.maybeFrontmatter)
      content[locale][path] = {
        file,
        source: `apps/wiki/${locale === 'en' ? 'content' : `content-${locale}`}/${file}`,
        frontmatter: raw === null ? null : decodeFrontmatter(raw),
      }
      if (locale === 'en') {
        const found = linksIn(parsed.document)
        links[path] = { paths: [...found.paths], sandboxes: [...found.sandboxes] }
      }
    }
  }
  return {
    en: `export const CONTENT = ${JSON.stringify(content.en)}\nexport const LINKS = ${JSON.stringify(links)}\n`,
    es: `export const CONTENT = ${JSON.stringify(content.es)}\n`,
    ja: `export const CONTENT = ${JSON.stringify(content.ja)}\n`,
  }
}

export const contentIndex = (): Plugin => {
  let cached: Promise<Readonly<Record<Locale, string>>> | null = null
  let cachedImages: Promise<string> | null = null
  const localeOf = (id: string): Locale | null =>
    (Object.keys(RESOLVED) as ReadonlyArray<Locale>).find((locale) => RESOLVED[locale] === id) ??
    null
  return {
    name: 'wiki:content-index',
    resolveId: (id) => {
      if (id === IMAGE_ID) return IMAGE_RESOLVED
      const locale = (Object.keys(IDS) as ReadonlyArray<Locale>).find(
        (candidate) => IDS[candidate] === id,
      )
      return locale === undefined ? null : RESOLVED[locale]
    },
    async load(id) {
      if (id === IMAGE_RESOLVED) {
        cachedImages ??= buildImages()
        return cachedImages
      }
      const locale = localeOf(id)
      if (locale === null) return null
      cached ??= build()
      return (await cached)[locale]
    },
    configureServer(server) {
      // Markdown and public images are not imported by this module, so Vite cannot see their edits.
      server.watcher.add([...Object.values(ROOTS), PUBLIC])
      const reload = (file: string): void => {
        if (!file.endsWith('.md')) return
        cached = null
        for (const id of Object.values(RESOLVED)) {
          const module = server.moduleGraph.getModuleById(id)
          if (module) server.moduleGraph.invalidateModule(module)
        }
        server.ws.send({ type: 'full-reload' })
      }
      const reloadImage = (file: string): void => {
        if (!IMAGE.test(file)) return
        cachedImages = null
        const module = server.moduleGraph.getModuleById(IMAGE_RESOLVED)
        if (module) server.moduleGraph.invalidateModule(module)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('change', reload)
      server.watcher.on('add', reload)
      server.watcher.on('unlink', reload)
      server.watcher.on('change', reloadImage)
      server.watcher.on('add', reloadImage)
      server.watcher.on('unlink', reloadImage)
    },
  }
}
