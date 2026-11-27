import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import {
  BookOpen,
  FileText,
  Gamepad2,
  GraduationCap,
  Info,
  Lightbulb,
  NotebookPen,
  Wrench,
  type IconNode,
} from 'lucide'
import type { BuildGroup } from '@quorum/simulation/catalog'
import type { Section } from '../frontmatter.ts'
import { groupBadge } from './badge.ts'

export type Quadrant = Readonly<{ icon: IconNode; group: BuildGroup }>

export const QUADRANTS: Readonly<Record<Section, Quadrant>> = {
  play: { icon: Gamepad2, group: 'edge' },
  tutorials: { icon: GraduationCap, group: 'edge' },
  guides: { icon: Wrench, group: 'compute' },
  explanation: { icon: Lightbulb, group: 'data' },
  patterns: { icon: NotebookPen, group: 'compute' },
  reference: { icon: BookOpen, group: 'ops' },
  design: { icon: FileText, group: 'ops' },
  about: { icon: Info, group: 'ops' },
}

export const quadrantBadge = <Msg>(
  section: Section,
  className: string,
  h: H<Msg>,
): View.Content<Msg> =>
  section === 'about'
    ? groupBadge('ops', QUADRANTS.about.icon, className, h, true)
    : groupBadge(QUADRANTS[section].group, QUADRANTS[section].icon, className, h)

export const quadrantColor = (section: Section): string =>
  section === 'about' ? 'var(--muted-foreground)' : `var(--group-${QUADRANTS[section].group})`
