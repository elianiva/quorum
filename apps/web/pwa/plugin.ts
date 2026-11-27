import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { precacheOf, type OutputEntry } from './precache.ts'
import { serviceWorkerSource } from './service-worker.ts'

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
      /* Built chunks carry a content hash in their names; public files and art do not, and the
         worker serves them cache-first, so their bytes must change the build id. */
      const buildHash = createHash('sha256').update(precache.join('\n'))
      for (const file of [...publicFiles].sort())
        buildHash.update(file).update(readFileSync(join(config.publicDir, file)))
      const buildId = buildHash.digest('hex').slice(0, 12)
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
