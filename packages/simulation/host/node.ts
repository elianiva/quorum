import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { installSolver } from '../src/solver.ts'

const path = createRequire(import.meta.url).resolve('@quorum/simulation/solver.wasm')
const module = new WebAssembly.Module(readFileSync(path))
installSolver(() => new WebAssembly.Instance(module).exports)
