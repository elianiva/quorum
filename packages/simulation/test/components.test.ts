import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { COMPONENT_IDS, COMPONENTS } from '../src/catalog.ts'

/*
 * The layout of "one file per Component": each id has a data file, `components/<id>.ts`, and the
 * Actions and helpers only it has live in `components/<id>.rule.ts`. The solve itself runs in the
 * kernel (`kernel/`). The data file is imported by the catalog, so it must not
 * import anything that imports the catalog back (the solver, the lookups, the state): that is an
 * import cycle, and it crashes at load.
 */

const dir = new URL('../src/components/', import.meta.url)
const read = (name: string) => readFileSync(new URL(name, dir), 'utf8')
const importsOf = (text: string) =>
  [...text.matchAll(/^import (type )?[^']*from '([^']+)'/gm)].map(
    (match) => [Boolean(match[1]), match[2] ?? ''] as const,
  )

const ruleFile = (id: string): string | null =>
  existsSync(new URL(`${id}.rule.ts`, dir)) ? `${id}.rule.ts` : null

test('every Component has a data file, and every other file belongs to one', () => {
  for (const id of COMPONENT_IDS)
    expect(existsSync(new URL(`${id}.ts`, dir)), `${id}.ts`).toBe(true)
  const owned = new Set(COMPONENT_IDS.flatMap((id) => [`${id}.ts`, ruleFile(id) ?? []].flat()))
  const files = readdirSync(dir).filter((name) => !/^(define|defs|fields|index)\.ts$/.test(name))
  expect(files.filter((name) => !owned.has(name))).toEqual([])
})

test('a data file imports only data: effect, the catalog, and types from the state', () => {
  for (const id of COMPONENT_IDS) {
    for (const [type, spec] of importsOf(read(`${id}.ts`))) {
      const allowed =
        spec === 'effect' ||
        spec.startsWith('../catalog') ||
        spec === './define.ts' ||
        (type && spec === '../state.ts')
      expect(allowed, `${id}.ts imports ${spec}`).toBe(true)
    }
  }
})

test('no Component imports another', () => {
  const names = new Set<string>(COMPONENT_IDS)
  for (const id of COMPONENT_IDS) {
    for (const file of [`${id}.ts`, ruleFile(id) ?? []].flat()) {
      for (const [, spec] of importsOf(read(file))) {
        const other = /^\.\/([a-z0-9]+)(\.rule)?\.ts$/.exec(spec)?.[1]
        expect(!other || !names.has(other) || other === id, `${file} imports ${spec}`).toBe(true)
      }
    }
  }
})

test('every outbound kind has a Component that can take it, except a customer callout', () => {
  const sent = new Set(COMPONENT_IDS.flatMap((id) => COMPONENTS[id].sends))
  const accepted = new Set(COMPONENT_IDS.flatMap((id) => COMPONENTS[id].accepts))
  for (const kind of sent)
    if (kind !== 'callout') expect(accepted.has(kind), `${kind} has no taker`).toBe(true)
})

test('every accepted kind has a Component that sends it', () => {
  const sent = new Set(COMPONENT_IDS.flatMap((id) => COMPONENTS[id].sends))
  for (const id of COMPONENT_IDS)
    for (const kind of COMPONENTS[id].accepts)
      expect(sent.has(kind), `${id} takes ${kind}, which no Component sends`).toBe(true)
})
