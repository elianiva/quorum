/**
 * The files a fresh install keeps in the service worker's cache. The list is
 * computed from the bundle and the public directory at build time, so a hashed
 * asset is always the one the HTML names.
 */

export type OutputEntry = Readonly<{
  fileName: string
  kind: 'asset' | 'chunk'
  isEntry?: boolean
  moduleIds?: ReadonlyArray<string>
  /** The chunks this chunk imports before it runs. */
  imports?: ReadonlyArray<string>
}>

const FONT = /\.(?:woff2?|ttf|otf)$/i
/** The Solver's WebAssembly module: the game solves from its first frame, so boot waits for it. */
const WASM = /\.wasm$/i

/** The public files the shell needs. Everything else is fetched when the game asks for it. */
const PUBLIC = new Set([
  'manifest.webmanifest',
  'favicon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-96.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'icon-monochrome.png',
])

/** Files the deploy keeps out of the cache: they belong to a page the worker never serves. */
export const excludedFromCache = (path: string): boolean => {
  const clean = path.replace(/^\/+/, '')
  return (
    clean === 'og.png' ||
    clean === 'harness.html' ||
    clean === 'sw.js' ||
    clean.startsWith('harness/') ||
    clean.startsWith('art/')
  )
}

/**
 * The install list: the shell, every code chunk the app can ask for, the
 * Solver's module, the manifest and icons, and any font the build serves itself. The art, the
 * screenshots, and the iOS splash load on first use instead. Every chunk is
 * kept because the board selects its renderer at runtime and the app preloads
 * the four catalogs after boot, so a first offline Company must still draw and
 * a saved language must still load.
 */
export const precacheOf = (
  outputs: ReadonlyArray<OutputEntry>,
  publicFiles: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  // Vite writes the HTML after the plugin's bundle hook, so it is never in the list it hands us.
  const files = new Set<string>(['/index.html'])
  for (const entry of outputs) {
    if (excludedFromCache(entry.fileName)) continue
    if (
      entry.kind === 'chunk' ||
      entry.fileName.includes('compute.worker') ||
      WASM.test(entry.fileName)
    ) {
      files.add(`/${entry.fileName}`)
      continue
    }
    if (entry.fileName === 'index.html') files.add('/index.html')
    else if (entry.fileName.endsWith('.css')) files.add(`/${entry.fileName}`)
    else if (FONT.test(entry.fileName)) files.add(`/${entry.fileName}`)
  }
  for (const file of publicFiles) {
    const clean = file.replace(/^\/+/, '').replaceAll('\\', '/')
    if (excludedFromCache(clean)) continue
    if (PUBLIC.has(clean) || (clean.startsWith('fonts/') && FONT.test(clean)))
      files.add(`/${clean}`)
  }
  return [...files].sort()
}
