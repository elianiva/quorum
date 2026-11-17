export type OutputEntry = Readonly<{
  fileName: string
  kind: 'asset' | 'chunk'
  isEntry?: boolean
  moduleIds?: ReadonlyArray<string>
  imports?: ReadonlyArray<string>
}>

const FONT = /\.(?:woff2?|ttf|otf)$/i
const WASM = /\.wasm$/i

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

export const precacheOf = (
  outputs: ReadonlyArray<OutputEntry>,
  publicFiles: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const files = new Set<string>(['/'])
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
    if (entry.fileName === 'index.html') files.add('/')
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
