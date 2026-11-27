import { beforeAll, expect, test } from 'vitest'
import { loadLocale } from './i18n/load.ts'
import { LOCALES, localeOfPath, stripLocale, withLocale } from './i18n/locale.ts'
import { loadAllProse, proseAt } from './site/content.ts'
import { pagesFor } from './site/pages.ts'

beforeAll(async () => {
  for (const locale of LOCALES) await loadLocale(locale)
  await loadAllProse()
}, 60_000)

test('a URL names its language by a prefix, and a path keeps its slug', () => {
  expect(withLocale('en', '/components/server')).toBe('/components/server')
  expect(withLocale('es', '/components/server')).toBe('/es/components/server')
  expect(localeOfPath('/es/components/server')).toBe('es')
  expect(stripLocale('/ja/components/server')).toBe('/components/server')
})

test('every language builds pages from the same catalog', () => {
  for (const locale of LOCALES) {
    const paths = pagesFor(locale).map((page) => page.path)
    expect(paths, locale).toContain('/components/server')
    expect(paths, locale).toContain('/research/tree')
    expect(new Set(paths).size, locale).toBe(paths.length)
  }
})

test('a translated article keeps its Markdown and its headings', () => {
  for (const locale of LOCALES) {
    const found = proseAt(locale, '/about/contributing', true)
    expect(found, locale).not.toBeNull()
    expect(found?.headings.length, locale).toBeGreaterThan(0)
  }
})
