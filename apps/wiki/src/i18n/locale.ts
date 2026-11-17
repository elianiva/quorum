import { Schema } from 'effect'

export const LOCALES = ['en', 'es', 'ja'] as const
export const Locale = Schema.Literals(LOCALES)
export type Locale = typeof Locale.Type

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  en: 'English',
  es: 'Español',
  ja: '日本語',
}

export const LOCALE_TAGS: Readonly<Record<Locale, Readonly<{ lang: string; og: string }>>> = {
  en: { lang: 'en', og: 'en_US' },
  es: { lang: 'es', og: 'es_ES' },
  ja: { lang: 'ja', og: 'ja_JP' },
}

const PREFIX: Readonly<Record<Locale, string>> = { en: '', es: '/es', ja: '/ja' }

const PREFIXED: ReadonlyArray<Locale> = LOCALES.filter((locale) => PREFIX[locale] !== '')

export const localeOfPath = (pathname: string): Locale =>
  PREFIXED.find((locale) => {
    const prefix = PREFIX[locale]
    return (
      pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}#`)
    )
  }) ?? DEFAULT_LOCALE

export const stripLocale = (pathname: string): string => {
  const locale = localeOfPath(pathname)
  if (locale === DEFAULT_LOCALE) return pathname
  const rest = pathname.slice(PREFIX[locale].length)
  return rest === '' || rest.startsWith('#') ? `/${rest}` : rest
}

export const withLocale = (locale: Locale, path: string): string => {
  const prefix = PREFIX[locale]
  if (prefix === '') return path
  if (path === '/') return prefix
  if (path.startsWith('/#')) return `${prefix}${path.slice(1)}`
  return `${prefix}${path}`
}

export const isWikiHref = (href: string): boolean => {
  if (!href.startsWith('/') || href.startsWith('//')) return false
  if (localeOfPath(href) !== DEFAULT_LOCALE) return false
  const path = href.split('#')[0] ?? href
  return !/\.[a-z0-9]+$/i.test(path.split('/').pop() ?? '')
}
