import { COMPONENTS, type ComponentId } from './components.ts'
import type { GlossaryEntry } from './glossary.ts'
export {
  CVE_DEFS,
  BACKDOOR_FUSE,
  VENDOR_DISCOUNT,
  CVE_EVERY,
  PATCH_GRACE,
} from '../generated/cves.ts'
import { CVE_DEFS } from '../generated/cves.ts'

export type CveDef = Readonly<{
  id: string
  score: number
  affects: ReadonlyArray<ComponentId>
}>

export const patchCost = (score: number): number => Math.max(2, Math.round(score / 2))
export const patchWindow = (score: number): number => Math.round(600 - 40 * score)

export const cveTermId = (id: string): string => `cve-${id.replace(/^cve-/i, '').toLowerCase()}`

export const CVE_TERMS: ReadonlyArray<GlossaryEntry> = CVE_DEFS.map((def) => ({
  id: cveTermId(def.id),
  term: def.id,
  category: 'security',
  definition: `Score ${def.score} of 10. Affects ${def.affects
    .map((id) => COMPONENTS[id].name)
    .join(', ')}.`,
  inGame: `Security mail names it and files a patch ticket: ${patchCost(def.score)} DH, due ${Math.round(
    patchWindow(def.score) / 60,
  )} minutes after disclosure. Overdue, it turns red on the Team backlog, and a minute later it is exploited.`,
  related: ['dependency-scanning'],
  links: [],
}))
