import { beforeAll, expect, test } from 'vitest'
import {
  COMPONENT_IDS,
  CVE_TERMS,
  GLOSSARY,
  INCIDENT_IDS,
  RUNTIME_IDS,
  FRAMEWORK_IDS,
  researchList,
} from '@quorum/simulation/catalog'
import { SANDBOX_IDS } from '@quorum/simulation/sandbox'
import { buildIndex, loadIndex, indexJson, search } from './search.ts'
import { loadAllProse } from './site/content.ts'
import { markdownFiles, markdownPath } from './site/markdown.ts'
import { pageAt, pagesFor } from './site/pages.ts'
import { prosePaths } from './site/content.ts'

beforeAll(async () => {
  await loadAllProse()
})

test('every page has one path, without a trailing slash', () => {
  const paths = pagesFor('en').map((page) => page.path)
  expect(new Set(paths).size).toBe(paths.length)
  expect(paths.filter((path) => path !== '/' && path.endsWith('/'))).toEqual([])
})

test('every catalog entry has its own page', () => {
  const paths = [
    ...COMPONENT_IDS.map((id) => `/components/${id}`),
    ...researchList.map((entry) => `/research/${entry.id}`),
    ...INCIDENT_IDS.map((id) => `/incidents/${id}`),
    ...RUNTIME_IDS.map((id) => `/runtimes/${id}`),
    ...FRAMEWORK_IDS.map((id) => `/frameworks/${id}`),
    ...GLOSSARY.map((entry) => `/glossary/${entry.id}`),
    ...CVE_TERMS.map((entry) => `/glossary/${entry.id}`),
    ...SANDBOX_IDS.map((id) => `/sandboxes/${id}`),
  ]
  expect(paths.filter((path) => pageAt(path) === null)).toEqual([])
})

test('every prose file belongs to a page', () => {
  expect(prosePaths.filter((path) => pageAt(path) === null)).toEqual([])
})

test('search ranks a title match first and survives a typo', () => {
  const index = buildIndex(pagesFor('en'))
  expect(search(index, 'improve the wiki')[0]?.path).toBe('/about/contributing')
  expect(search(index, 'kubernets')[0]?.path).toBe('/components/cluster')
  expect(search(index, 'zzzz')).toEqual([])
})

test('the built search index loads the way the browser loads it', () => {
  const loaded = loadIndex(indexJson(pagesFor('en'), 'en'))
  expect(search(loaded, 'lb')[0]?.path).toBe('/components/lb')
  expect(search(loaded, 'kubernets')[0]?.path).toBe('/components/cluster')
})

test('every page has a Markdown twin', async () => {
  const files = await markdownFiles()
  expect(pagesFor('en').filter((page) => !(markdownPath(page.path).slice(1) in files))).toEqual([])
  expect(files['llms.txt']).toContain('/components/server.md')
})
