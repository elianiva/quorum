import type { GameNode } from '../state.ts'
import { RUNTIMES, EDGE_LANGUAGES } from '../catalog.ts'

export const edgeRuns = (node: GameNode): boolean =>
  EDGE_LANGUAGES.includes(RUNTIMES[node.runtime].language)
