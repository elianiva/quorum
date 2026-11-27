import type { Lang } from '../../i18n/lang.ts'
import type { Page } from '../page.ts'
import { componentPages } from './components.ts'
import { eraPages } from './eras.ts'
import { glossaryPages } from './glossary.ts'
import { incidentPages } from './incidents.ts'
import { patternsPages } from './patterns.ts'
import { researchPages } from './research.ts'
import { stackPages } from './stacks.ts'
import { systemPages } from './systems.ts'
import { venturePages } from './ventures.ts'

/** Generated reference pages, grouped as the old wiki grouped them. */
export const referencePages = <Msg>(l: Lang): ReadonlyArray<Page<Msg>> => [
  ...componentPages<Msg>(l),
  ...researchPages<Msg>(l),
  ...eraPages<Msg>(l),
  ...stackPages<Msg>(l),
  ...incidentPages<Msg>(l),
  ...glossaryPages<Msg>(l),
  ...patternsPages<Msg>(l),
  ...systemPages<Msg>(l),
  ...venturePages<Msg>(l),
]
