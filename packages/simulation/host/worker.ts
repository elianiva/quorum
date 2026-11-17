import solver from '../src/solver.wasm'
import { installSolver } from '../src/solver.ts'

installSolver(() => new WebAssembly.Instance(solver).exports)
