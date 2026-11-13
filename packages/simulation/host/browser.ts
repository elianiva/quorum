import { installKernel } from '../src/kernel.ts'

/*
 * Installs the solve kernel in a browser page or Web Worker. The bundler emits the module as an
 * asset; `kernelReady` resolves once it is installed, and nothing may solve before then.
 */
export const kernelReady: Promise<void> = fetch(new URL('../src/kernel.wasm', import.meta.url))
  .then((response) => response.arrayBuffer())
  .then((bytes) => WebAssembly.instantiate(bytes))
  .then(({ instance }) => installKernel(instance.exports))
