import type { Locale } from './locale.ts'
import { isWikiHref, withLocale } from './locale.ts'

const languages = new WeakMap<object, Locale>()
const roots = new WeakMap<object, object>()
const cache = new WeakMap<object, Map<Locale, object>>()

export const builderFor = <H extends object>(locale: Locale, h: H): H => {
  if (locale === 'en') return h
  const known = cache.get(h) ?? new Map<Locale, object>()
  cache.set(h, known)
  const cached = known.get(locale)
  if (cached) return cached as H
  const href = (h as unknown as { Href: (value: string) => unknown }).Href
  const wrapped = new Proxy(h, {
    get: (target, key) =>
      key === 'Href'
        ? (value: string) => href(isWikiHref(value) ? withLocale(locale, value) : value)
        : Reflect.get(target, key),
  })
  languages.set(wrapped, locale)
  roots.set(wrapped, h)
  known.set(locale, wrapped)
  return wrapped
}

export const localeOf = (h: object): Locale => languages.get(h) ?? 'en'

export const rootBuilder = <H extends object>(h: H): H => (roots.get(h) as H | undefined) ?? h
