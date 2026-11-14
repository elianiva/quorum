import { installSolver } from '../src/solver.ts'

/*
 * Installs the Solver in a browser page or Web Worker. The bundler emits the module as an
 * asset; `solverReady` resolves once it is installed, and nothing may solve before then.
 */
export const solverReady: Promise<void> = fetch(new URL('../src/solver.wasm', import.meta.url))
  .then((response) => {
    if (!response.ok) throw new Error(`The Solver did not load: HTTP ${response.status}.`)
    return response.arrayBuffer()
  })
  .then((bytes) => WebAssembly.instantiate(bytes))
  .then(({ instance }) => installSolver(instance.exports))
