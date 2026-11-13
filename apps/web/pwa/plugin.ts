import { createHash } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { precacheOf, type OutputEntry } from './precache.ts'
import { serviceWorkerSource } from './service-worker.ts'

/** Every file under `dir`, as paths relative to it. A missing directory holds nothing. */
const filesUnder = (dir: string): ReadonlyArray<string> => {
  if (!existsSync(dir)) return []
  const found: Array<string> = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      for (const child of filesUnder(path)) found.push(`${entry.name}/${child}`)
    } else if (entry.isFile()) {
      found.push(entry.name)
    }
  }
  return found
}

/**
 * Writes the hand-written service worker to the build root. The install list
 * comes from this build's own output, so the worker never names an asset the
 * deploy did not ship. The build fails when `sw.js` is not in the output.
 */
export const pwa = (): Plugin => {
  let config: ResolvedConfig

  return {
    name: 'quorum-pwa',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    generateBundle(_options, bundle) {
      const outputs: ReadonlyArray<OutputEntry> = Object.values(bundle).map((entry) =>
        entry.type === 'chunk'
          ? {
              fileName: entry.fileName,
              kind: 'chunk',
              isEntry: entry.isEntry,
              moduleIds: entry.moduleIds,
              imports: entry.imports,
            }
          : { fileName: entry.fileName, kind: 'asset' },
      )
      const publicFiles = filesUnder(config.publicDir)
      const precache = precacheOf(outputs, publicFiles)
      // The hashed names change with their content, so the list identifies the build that made it.
      const buildId = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorkerSource(buildId, precache),
      })
    },
    closeBundle() {
      const outDir = resolve(config.root, config.build.outDir)
      if (!existsSync(join(outDir, 'sw.js')))
        this.error('The PWA plugin did not write sw.js to the build output.')
    },
  }
}
