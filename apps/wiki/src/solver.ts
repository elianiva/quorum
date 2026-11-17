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
