import type { Locale } from './index.ts'
import { speak } from './messages.ts'

const builders = new WeakMap<object, Map<Locale, object>>()

export const localizeBuilder = <H extends object>(locale: Locale, h: H): H => {
  if (locale === 'en') return h
  const known = builders.get(h) ?? new Map<Locale, object>()
  builders.set(h, known)
  const cached = known.get(locale)
  if (cached) return cached as H
  const localized = speak(locale, new Proxy(h, {}))
  known.set(locale, localized)
  return localized
}
