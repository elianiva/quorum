import kernel from '../src/kernel.wasm'
import { installKernel } from '../src/kernel.ts'

/*
 * Installs the solve kernel in a Cloudflare Worker. The Workers runtime refuses to compile
 * WebAssembly from bytes, so the bundle uploads the module and the import is a compiled module.
 */
installKernel(new WebAssembly.Instance(kernel).exports)
