import solver from '../src/solver.wasm'
import { installSolver } from '../src/solver.ts'

/*
 * Installs the Solver in a Cloudflare Worker. The Workers runtime refuses to compile
 * WebAssembly from bytes, so the bundle uploads the module and the import is a compiled module.
 */
installSolver(new WebAssembly.Instance(solver).exports)
