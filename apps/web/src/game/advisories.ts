import { CVE_DEFS, cveTermId } from '@quorum/simulation/catalog'

const CVE_ID = /CVE-\d{4}-\d{4,}/

export const cveIdIn = (text: string): string | null => CVE_ID.exec(text)?.[0] ?? null

const KNOWN = new Set(CVE_DEFS.map((def) => def.id))

export const glossaryKnowsCve = (id: string): boolean => KNOWN.has(id)

export const advisoryTell = (text: string): Readonly<{ id: string; term: string }> | null => {
  const id = cveIdIn(text)
  return id !== null && KNOWN.has(id) ? { id, term: cveTermId(id) } : null
}
