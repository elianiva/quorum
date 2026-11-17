import { CARD_CLEARANCE_PX, type Pt } from '../geometry.ts'
import { tidy } from '../tidy.ts'
import type { LabLink, LabNode } from './measure.ts'

export const roleLayout = (
  nodes: ReadonlyArray<LabNode>,
  links: ReadonlyArray<LabLink>,
  clearance: number = CARD_CLEARANCE_PX,
  maxHeight: number = 3000,
): ReadonlyMap<string, Pt> => tidy(nodes, links, ['all', 'a', 'b', 'c'], { clearance, maxHeight })
