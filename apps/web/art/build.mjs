import { readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as k from './kit/iso-kit.mjs'
import { QUORUM_CSS } from './theme.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'public', 'art')
const only = process.argv.slice(2)

const names = readdirSync(join(HERE, 'figures'))
  .filter((file) => file.endsWith('.mjs'))
  .map((file) => basename(file, '.mjs'))
  .filter((name) => only.length === 0 || only.includes(name))

for (const name of names) {
  const module = await import(pathToFileURL(join(HERE, 'figures', `${name}.mjs`)).href)
  const { width, height, label, body, theme = 'light' } = module.figure()
  const svg = k
    .figureSvg({ width, height, label, body, standalone: theme })
    .replace(`<style>${k.ISO_CSS}</style>`, `<style>${k.ISO_CSS}${QUORUM_CSS}</style>`)
  writeFileSync(join(OUT, `${name}.svg`), svg)
  console.log(`wrote public/art/${name}.svg`)
}
