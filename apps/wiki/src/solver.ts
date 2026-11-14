/* The Solver is a 350 kB WASM fetch. A reading page never waits for it; only a live board does
   (src/page-assets.ts and the board mounts). The client installs the browser host here. */

let loader: (() => Promise<void>) | null = null
let ready: Promise<void> | null = null

export const installSolver = (load: () => Promise<void>): void => {
  loader = load
}

export const solverReadyForBoard = async (): Promise<void> => {
  if (loader === null) return
  ready ??= loader()
  await ready
}
