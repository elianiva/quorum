import type { Locale } from './locale.ts'

export const loadLocale = async (locale: Locale): Promise<void> => {
  if (locale === 'es') await import('../locales/es.ts')
  if (locale === 'ja') await import('../locales/ja.ts')
}
