import { en } from './en/index.ts'
import { supportedLocales } from './index.ts'
import { nodeLabelOf } from '@quorum/simulation/labels'
import type { Game, GameNode } from '@quorum/simulation/state'
import type { Locale } from './index.ts'

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer Args) => infer Result
    ? Result extends string
      ? (...args: Args) => string
      : T
    : { [Key in keyof T]: Widen<T[Key]> }

export type Messages = Widen<typeof en>

const messages: Partial<Record<Locale, Messages>> = { en }

export const loadLocale = async (locale: Locale): Promise<void> => {
  if (messages[locale] !== undefined) return
  switch (locale) {
    case 'en':
      return
    case 'es':
      messages.es = (await import('./es/index.ts')).es
      return
    case 'fr':
      messages.fr = (await import('./fr/index.ts')).fr
      return
    case 'ja':
      messages.ja = (await import('./ja/index.ts')).ja
      return
    case 'zh-CN':
      messages['zh-CN'] = (await import('./zh-CN/index.ts')).zhCN
      return
  }
}

export const preloadLocales = (): void => {
  for (const { value } of supportedLocales) void loadLocale(value)
}

const languageOf = new WeakMap<object, Locale>()

export const speak = <H extends object>(locale: Locale, h: H): H => {
  languageOf.set(h, locale)
  return h
}

export const localeOf = (h: object): Locale => languageOf.get(h) ?? 'en'

export const copyIn = (locale: Locale): Messages => messages[locale] ?? en

export const copy = (h: object): Messages => copyIn(languageOf.get(h) ?? 'en')

export const localized = <Entry extends object, Words extends object>(
  entry: Entry,
  words: Words,
): Entry & Words => ({ ...entry, ...words })

export const eraWords = (t: Messages, game: Game): Messages['catalog']['eras'][number] =>
  t.catalog.eras[Math.min(game.stage, t.catalog.eras.length - 1)]!

export const nodeLabelIn = (
  t: Messages,
  game: Game,
  node: GameNode,
): Readonly<{ name: string; ordinal: number }> => ({
  name: t.catalog.components[node.type].name,
  ordinal: nodeLabelOf(game, node).ordinal,
})

export const nodeTitle = (t: Messages, game: Game, node: GameNode): string => {
  const label = nodeLabelIn(t, game, node)
  return label.ordinal > 0 ? `${label.name} ${label.ordinal}` : label.name
}

export const insightName = (t: Messages, pool: keyof Messages['catalog']['pools']): string =>
  t.pools.insightName(t.catalog.pools[pool].label)
