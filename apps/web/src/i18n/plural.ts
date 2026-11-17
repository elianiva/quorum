import type { Locale } from './index.ts'

const rules = new Map<Locale, Intl.PluralRules>()

export const isOne = (locale: Locale, count: number): boolean => {
  const known = rules.get(locale) ?? new Intl.PluralRules(locale)
  rules.set(locale, known)
  return known.select(count) === 'one'
}
