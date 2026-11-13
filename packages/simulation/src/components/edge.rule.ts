import type { GameNode } from '../state.ts'
import { RUNTIMES, EDGE_LANGUAGES } from '../catalog.ts'

/** Whether the Service's Stack runs at the edge: JavaScript, TypeScript, or Rust or Go to WASM. */
export const edgeRuns = (node: GameNode): boolean =>
  EDGE_LANGUAGES.includes(RUNTIMES[node.runtime].language)
