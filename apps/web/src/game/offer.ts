import { RESEARCH, type ResearchId } from '@quorum/simulation/catalog'
import type { Refusal } from '@quorum/simulation/actions'

export type ResearchOffer = Readonly<{ id: ResearchId; what: string }>

const named = (name: string): ResearchId | null =>
  (Object.keys(RESEARCH) as Array<ResearchId>).find((id) => RESEARCH[id].name === name) ?? null

export const offerOf = (refusal: Refusal): ResearchOffer | null => {
  if (refusal._tag !== 'Locked') return null
  const id = named(refusal.research)
  return id === null ? null : { id, what: refusal.what }
}
