import { linkRefusalOf } from '@quorum/simulation/actions'
import type { Game } from '@quorum/simulation/state'
import type { Locale } from '../i18n/index.ts'
import { copyIn } from '../i18n/messages.ts'
import { reasonIn } from '../i18n/refusal.ts'

const LIMIT = 72

/** The first sentence of a refusal, short enough to draw over the Board. */
export const shortReason = (text: string): string => {
  const end = text.indexOf('. ')
  const first = end === -1 ? text : text.slice(0, end + 1)
  return first.length <= LIMIT ? first : `${first.slice(0, LIMIT - 1).trimEnd()}…`
}

export const linkPreviewOf = (
  game: Game,
  locale: Locale,
  from: string,
  to: string,
): string | null => {
  const refusal = linkRefusalOf(game, from, to)
  return refusal === null ? null : shortReason(reasonIn(copyIn(locale), refusal))
}
