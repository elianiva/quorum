import { COMPONENTS, type ComponentId } from './components.ts'
import type { GlossaryEntry } from './glossary.ts'

export type CveDef = Readonly<{
  id: string
  score: number
  affects: ReadonlyArray<ComponentId>
}>

export const CVE_DEFS: ReadonlyArray<CveDef> = [
  { id: 'CVE-2026-1337', score: 9.8, affects: ['lb', 'cdn', 'waf'] },
  { id: 'CVE-2026-0451', score: 7.5, affects: ['server'] },
  { id: 'CVE-2026-2718', score: 8.1, affects: ['database'] },
  { id: 'CVE-2026-0042', score: 5.3, affects: ['server', 'worker'] },
  { id: 'CVE-2026-3141', score: 7.5, affects: ['server'] },
  { id: 'CVE-2026-1024', score: 9.9, affects: ['server', 'worker'] },
]

export const BACKDOOR_FUSE = 300
export const VENDOR_DISCOUNT = 0.2

export const CVE_EVERY = 420
export const PATCH_GRACE = 60
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
