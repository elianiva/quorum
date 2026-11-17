import { installSolver } from '../src/solver.ts'

export const solverReady: Promise<void> = fetch(new URL('../src/solver.wasm', import.meta.url))
  .then((response) => {
    if (!response.ok) throw new Error(`The Solver did not load: HTTP ${response.status}.`)
    return response.arrayBuffer()
  })
  .then((bytes) => WebAssembly.compile(bytes))
  .then((module) => installSolver(() => new WebAssembly.Instance(module).exports))
