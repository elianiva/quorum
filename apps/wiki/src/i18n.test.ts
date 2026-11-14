import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { langOf } from './i18n/lang.ts'
import { en } from './i18n/en/index.ts'
import { es } from './i18n/es/index.ts'
import { ja } from './i18n/ja/index.ts'
import {
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  localeOfPath,
  stripLocale,
  withLocale,
  type Locale,
} from './i18n/locale.ts'
import { prerenderPaths, renderDocument, renderPage, sitemap } from './entry.server.ts'
import { PAGES, pageAt, pageIn, pagesFor } from './pages.ts'
import { slug } from './page.ts'
import { buildIndex, search } from './search.ts'
import { THEME_KEY } from './theme.ts'
// The translated bundles register their copy and prose when they load.
import './locales/es.ts'
import './locales/ja.ts'

/* Every translated wiki's contract. The structure tests read whatever files `content-<language>/`
   holds, so a translator who drifts from the English page, in its headings, links, islands or
   frontmatter, fails here with the file and the difference. */

const TRANSLATIONS = ['es', 'ja'] as const
type Translation = (typeof TRANSLATIONS)[number]

const root = fileURLToPath(new URL('..', import.meta.url))

const filesIn = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesIn(join(dir, entry.name))
      : entry.name.endsWith('.md')
        ? [join(dir, entry.name)]
        : [],
  )

const read = (file: string): string => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')

/** The prose files a language has, by their path relative to its content directory. */
const filesOf = (locale: Translation): ReadonlyArray<string> =>
  filesIn(join(root, `content-${locale}`)).map((file) =>
    relative(join(root, `content-${locale}`), file),
  )

const englishOf = (name: string): string => join(root, 'content', name)
const translatedOf = (locale: Translation, name: string): string =>
  join(root, `content-${locale}`, name)

type Parsed = Readonly<{ frontmatter: Readonly<Record<string, string>>; body: string }>

const parse = (text: string): Parsed => {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!match) return { frontmatter: {}, body: text }
  const frontmatter = Object.fromEntries(
    (match[1] ?? '').split('\n').flatMap((line) => {
      const at = line.indexOf(':')
      return at === -1 ? [] : [[line.slice(0, at).trim(), line.slice(at + 1).trim()]]
    }),
  )
  return { frontmatter, body: match[2] ?? '' }
}

/** The lines of a body that are not inside a code fence. */
const proseLines = (body: string): ReadonlyArray<string> => {
  let fenced = false
  return body.split('\n').filter((line) => {
    if (line.startsWith('```')) {
      fenced = !fenced
      return false
    }
    return !fenced
  })
}

const headingLevels = (body: string): ReadonlyArray<number> =>
  proseLines(body).flatMap((line) => {
    const match = /^(#{1,6}) /.exec(line)
    return match ? [match[1]?.length ?? 0] : []
  })

const linksOf = (body: string): ReadonlyArray<string> =>
  proseLines(body)
    .flatMap((line) => [...line.matchAll(/\]\(([^)\s]+)/g)].map((match) => match[1] ?? ''))
    .sort()

/** An island line: `::Name{key="value" …}` or `:::Name{…}`. */
const islandsOf = (
  body: string,
): ReadonlyArray<Readonly<{ name: string; attributes: Record<string, string> }>> =>
  proseLines(body).flatMap((line) => {
    const match = /^:{2,3}([A-Za-z]+)(?:\{(.*)\})?\s*$/.exec(line)
    if (!match) return []
    const attributes = Object.fromEntries(
      [...(match[2] ?? '').matchAll(/([A-Za-z]+)="((?:[^"\\]|\\.)*)"/g)].map((pair) => [
        pair[1] ?? '',
        pair[2] ?? '',
      ]),
    )
    return [{ name: match[1] ?? '', attributes }]
  })

/** The attributes of an island that a translator writes in their language. Every other one is code. */
const TRANSLATED = new Set(['question', 'options', 'explain', 'label', 'title', 'caption', 'text'])

const STRUCTURAL = ['section', 'group', 'order', 'era', 'gdd', 'toc'] as const

const problems = (
  locale: Translation,
  check: (name: string, translated: Parsed, english: Parsed) => ReadonlyArray<string>,
) =>
  filesOf(locale).flatMap((name) => {
    let english: string
    try {
      english = read(englishOf(name))
    } catch {
      return []
    }
    return check(name, parse(read(translatedOf(locale, name))), parse(english)).map(
      (issue) => `${name}: ${issue}`,
    )
  })

test.each(TRANSLATIONS)('every %s file has an English counterpart at the same path', (locale) => {
  const missing = filesOf(locale).filter((name) => {
    try {
      read(englishOf(name))
      return false
    } catch {
      return true
    }
  })
  expect(missing).toEqual([])
})

test.each(TRANSLATIONS)(
  'a %s file keeps the structural frontmatter of the English file',
  (locale) => {
    expect(
      problems(locale, (_name, translated, english) =>
        STRUCTURAL.flatMap((key) =>
          translated.frontmatter[key] === english.frontmatter[key]
            ? []
            : [
                `${key} is "${translated.frontmatter[key]}", English has "${english.frontmatter[key]}"`,
              ],
        ),
      ),
    ).toEqual([])
  },
)

test.each(TRANSLATIONS)(
  'a %s file has the same headings at the same levels as the English file',
  (locale) => {
    expect(
      problems(locale, (_name, translated, english) => {
        const own = headingLevels(translated.body)
        const source = headingLevels(english.body)
        return own.join('') === source.join('')
          ? []
          : [`heading levels are [${own.join(' ')}], English has [${source.join(' ')}]`]
      }),
    ).toEqual([])
  },
)

test.each(TRANSLATIONS)('a %s file links the same targets as the English file', (locale) => {
  expect(
    problems(locale, (_name, translated, english) => {
      const own = linksOf(translated.body)
      const source = linksOf(english.body)
      return own.join('\n') === source.join('\n')
        ? []
        : [
            `links differ: missing ${JSON.stringify(source.filter((url) => !own.includes(url)))}, extra ${JSON.stringify(own.filter((url) => !source.includes(url)))}`,
          ]
    }),
  ).toEqual([])
})

test.each(TRANSLATIONS)(
  'a %s file places the same islands, and only translates their words',
  (locale) => {
    expect(
      problems(locale, (_name, translated, english) => {
        const own = islandsOf(translated.body)
        const source = islandsOf(english.body)
        if (own.length !== source.length)
          return [`has ${own.length} islands, English has ${source.length}`]
        return own.flatMap((island, index) => {
          const twin = source[index]
          if (!twin || island.name !== twin.name)
            return [`island ${index + 1} is ${island.name}, English has ${twin?.name}`]
          const keys = Object.keys(island.attributes).sort().join(',')
          if (keys !== Object.keys(twin.attributes).sort().join(','))
            return [`island ${index + 1} (${island.name}) has attributes [${keys}]`]
          return Object.entries(island.attributes).flatMap(([key, value]) => {
            const original = twin.attributes[key] ?? ''
            if (!TRANSLATED.has(key))
              return value === original ? [] : [`island ${index + 1} changes ${key}`]
            return key === 'options' && value.split('|').length !== original.split('|').length
              ? [`island ${index + 1} has a different number of options`]
              : []
          })
        })
      }),
    ).toEqual([])
  },
)

test('the chrome messages have every key in both languages', () => {
  // A list of aliases may differ in length, since a translation adds its own words; every other
  // list is a table's columns, so its length must match.
  const shape = (value: unknown, key = ''): unknown =>
    Array.isArray(value) && /aliases/i.test(key)
      ? 'aliases'
      : typeof value === 'object' && value !== null
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, entry]) => [name, shape(entry, name)]),
          )
        : typeof value
  for (const copy of [es, ja]) expect(shape(copy)).toEqual(shape(en))
})

test('a heading anchor drops accents, and English anchors do not change', () => {
  expect(slug('Cómo funciona')).toBe('como-funciona')
  expect(slug('¿Qué desbloquea?')).toBe('que-desbloquea')
  expect(slug('How it works')).toBe('how-it-works')
  expect(slug('L0: Pulse (1–10 seconds)')).toBe('l0-pulse-110-seconds')
})

test('a URL names its language by a prefix, and a path keeps its slug', () => {
  expect(localeOfPath('/es')).toBe('es')
  expect(localeOfPath('/es/glossary/cache-stampede')).toBe('es')
  expect(localeOfPath('/ja')).toBe('ja')
  expect(localeOfPath('/ja/glossary/cache-stampede')).toBe('ja')
  expect(localeOfPath('/essays')).toBe('en')
  expect(localeOfPath('/jargon')).toBe('en')
  expect(stripLocale('/es')).toBe('/')
  expect(stripLocale('/es/glossary/cache-stampede')).toBe('/glossary/cache-stampede')
  expect(stripLocale('/ja')).toBe('/')
  expect(stripLocale('/ja/glossary/cache-stampede')).toBe('/glossary/cache-stampede')
  expect(stripLocale('/glossary/cache-stampede')).toBe('/glossary/cache-stampede')
  expect(withLocale('es', '/')).toBe('/es')
  expect(withLocale('ja', '/')).toBe('/ja')
  expect(withLocale('ja', '/team#features')).toBe('/ja/team#features')
  expect(withLocale('en', '/team#features')).toBe('/team#features')
})

const rendered = async (path: string) => {
  const result = await renderPage(new Request(`https://wiki.playquorum.dev${path}`))
  if (result._tag !== 'Rendered') throw new Error(`${path} did not render`)
  return result
}

const termOf = (locale: Locale): string =>
  langOf(locale).cat.GLOSSARY.find((entry) => entry.id === 'cache-stampede')?.term ?? ''

test.each(TRANSLATIONS)(
  '/%s renders a page with the catalog words in that language',
  async (locale) => {
    const term = termOf(locale)
    expect(term).toBeTruthy()
    expect(term).not.toBe(termOf('en'))
    const result = await rendered(`/${locale}/glossary/cache-stampede`)
    expect(result.status).toBeUndefined()
    expect(result.application.lang).toBe(locale)
    expect(result.application.html).toContain(term)
    expect(result.application.title).toContain(term)
    expect(pageAt(`/${locale}/glossary/cache-stampede`)?.locale).toBe(locale)
    expect((await rendered(`/${locale}/no/such/page`)).status).toBe(404)
  },
)

test('an English page still reads English', async () => {
  const english = await rendered('/glossary/cache-stampede')
  expect(english.application.lang).toBe('en')
  expect(pageAt('/glossary/cache-stampede')?.locale).toBe('en')
})

test('every internal link on a translated page points into its language', async () => {
  const stray: Array<string> = []
  for (const locale of TRANSLATIONS) {
    for (const path of ['/', '/components/lb', '/glossary/cache-stampede', '/patterns']) {
      const url = withLocale(locale, path)
      const { application } = await rendered(url)
      for (const [, href] of application.html.matchAll(/href="(\/[^"]*)"/g)) {
        const target = href ?? ''
        // The switcher points at this same page in another language, and a file is not a page.
        if (localeOfPath(target) === locale) continue
        if (/\.[a-z0-9]+$/i.test(target.split('#')[0] ?? '')) continue
        if (stripLocale(target) === path) continue
        stray.push(`${url} → ${target}`)
      }
    }
  }
  expect(stray).toEqual([])
})

/** The logical path a content file serves: `about/contributing.md` is `/about/contributing`. */
const pathOfFile = (name: string): string => {
  const bare = name.split('\\').join('/').replace(/\.md$/, '')
  return bare === 'index' ? '/' : `/${bare.replace(/\/index$/, '')}`
}

const authoredIn = (locale: Translation): string | undefined =>
  filesOf(locale).find(
    (name) => parse(read(translatedOf(locale, name))).frontmatter['title'] !== undefined,
  )

test.each(TRANSLATIONS)(
  'a %s file replaces its page, and a page without one shows the English text with a notice',
  async (locale) => {
    const notice = langOf(locale).t.article.untranslated
    const translated = authoredIn(locale)
    if (translated) {
      const path = pathOfFile(translated)
      const own = pageIn(locale, path)
      expect(own?.title).toBe(parse(read(translatedOf(locale, translated))).frontmatter['title'])
      expect(own?.fallback).toBe(false)
      expect(own?.source).toContain(`content-${locale}/`)
      expect(pageIn('en', path)?.title).not.toBe(own?.title)
    }
    // The design record stays English (ADR 0014).
    const design = pageIn(locale, '/design')
    expect(design?.fallback).toBe(true)
    expect(design?.title).toBe(pageIn('en', '/design')?.title)
    expect((await rendered(`${withLocale(locale, '/design')}`)).application.html).toContain(notice)
    expect((await rendered('/design')).application.html).not.toContain(notice)
  },
)

test.each(TRANSLATIONS)(
  'a heading keeps its English id on a %s page, in the table of contents and in the text',
  async (locale) => {
    const different = pagesFor(locale).flatMap((page) => {
      const twin = pageIn('en', page.path)
      const own = page.headings.map((heading) => heading.id).join(' ')
      const source = twin?.headings.map((heading) => heading.id).join(' ')
      return own === source ? [] : [`${page.path}: [${own}] is not [${source}]`]
    })
    expect(different).toEqual([])
    const translated = authoredIn(locale)
    if (!translated) return
    const path = pathOfFile(translated)
    const ids = (html: string) =>
      [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((match) => match[1])
    const own = ids((await rendered(withLocale(locale, path))).application.html)
    const english = ids((await rendered(path)).application.html)
    expect(own).toEqual(english)
  },
)

test('every page is prerendered in every language, and the sitemap lists each with its alternates', () => {
  expect(prerenderPaths).toContain('/es')
  expect(prerenderPaths).toContain('/ja')
  expect(prerenderPaths).toContain('/ja/glossary/cache-stampede')
  expect(prerenderPaths).toContain('/glossary/cache-stampede')
  expect(prerenderPaths).toHaveLength(PAGES.length * LOCALES.length)
  const map = sitemap(() => null)
  expect(map).toContain('<loc>https://wiki.playquorum.dev/glossary/cache-stampede</loc>')
  expect(map).toContain('<loc>https://wiki.playquorum.dev/es/glossary/cache-stampede</loc>')
  expect(map).toContain('<loc>https://wiki.playquorum.dev/ja/glossary/cache-stampede</loc>')
  expect(map).toContain(
    'hreflang="es" href="https://wiki.playquorum.dev/es/glossary/cache-stampede"',
  )
  expect(map).toContain(
    'hreflang="ja" href="https://wiki.playquorum.dev/ja/glossary/cache-stampede"',
  )
})

test.each(TRANSLATIONS)(
  'the head of a %s page names its language, the alternates and the default',
  async (locale) => {
    const assets = { entryScript: '/entry.js', stylesheets: [], modulePreloads: [] }
    const tags = LOCALE_TAGS[locale]
    const path = withLocale(locale, '/glossary/cache-stampede')
    const page = renderDocument((await rendered(path)).application, assets)
    expect(page).toContain(`<html lang="${tags.lang}"`)
    expect(page).toContain(`property="og:locale" content="${tags.og}"`)
    expect(page).toContain(`"inLanguage":"${tags.lang}"`)
    for (const other of LOCALES)
      expect(page).toContain(
        `hreflang="${LOCALE_TAGS[other].lang}" href="https://wiki.playquorum.dev${withLocale(other, '/glossary/cache-stampede')}"`,
      )
    expect(page).toContain(
      'hreflang="x-default" href="https://wiki.playquorum.dev/glossary/cache-stampede"',
    )
    // The Markdown twin is English.
    expect(page).not.toContain('type="text/markdown"')
    const missing = renderDocument(
      (await rendered(`${withLocale(locale, '/no/such/page')}`)).application,
      assets,
    )
    expect(missing).toContain(`<html lang="${tags.lang}"`)
    expect(missing).toContain('<meta name="robots" content="noindex">')
    expect(missing).toContain(`property="og:locale" content="${tags.og}"`)
    expect(missing).toContain(`content="${escapeHtml(langOf(locale).t.site.description)}"`)
  },
)

test('the head of an English page names English and links its Markdown twin', async () => {
  const assets = { entryScript: '/entry.js', stylesheets: [], modulePreloads: [] }
  const page = renderDocument((await rendered('/glossary/cache-stampede')).application, assets)
  expect(page).toContain('<html lang="en"')
  expect(page).toContain('property="og:locale" content="en_US"')
  expect(page).toContain('type="text/markdown"')
  expect(page).toContain(
    `hreflang="ja" href="https://wiki.playquorum.dev/ja/glossary/cache-stampede"`,
  )
})

test('the page offers a theme switch and applies the saved theme before paint', async () => {
  const assets = { entryScript: '/entry.js', stylesheets: [], modulePreloads: [] }
  const page = renderDocument((await rendered('/glossary/cache-stampede')).application, assets)
  expect(page).toContain('data-theme-toggle')
  expect(page).toContain(THEME_KEY)
  expect(page).toContain('prefers-color-scheme: dark')
})

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

test.each(TRANSLATIONS)('the %s search index finds a page by its own words', (locale) => {
  const index = buildIndex(pagesFor(locale), locale)
  const term = termOf(locale)
  expect(search(index, term, locale).map((hit) => hit.path)).toContain('/glossary/cache-stampede')
  // Spanish finds the term typed without accents, since the text is folded.
  if (locale === 'es') {
    const plain = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    expect(search(index, plain, locale).map((hit) => hit.path)).toContain(
      '/glossary/cache-stampede',
    )
  }
  // Japanese is indexed two characters at a time, so the end of the term finds it too.
  if (locale === 'ja')
    expect(search(index, term.slice(-6), locale).map((hit) => hit.path)).toContain(
      '/glossary/cache-stampede',
    )
  expect(search(index, 'zzzz', locale)).toEqual([])
  expect(LOCALE_NAMES[locale]).toBeTruthy()
})
