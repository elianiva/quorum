import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { installSolver } from '../src/solver.ts'

/*
 * Installs the Solver in Node: test runs, scripts, and builds that solve. Import it once,
 * before the first solve. The module is found by package name, so a bundle that inlines this file
 * still finds it.
 */
const path = createRequire(import.meta.url).resolve('@quorum/simulation/solver.wasm')
installSolver(new WebAssembly.Instance(new WebAssembly.Module(readFileSync(path))).exports)
