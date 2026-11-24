import { expect, test } from 'vitest'
import { COMPONENT_GLOSSARY } from './components/defs.ts'
import { COMPONENTS } from './catalog/components.ts'
import { COMPONENT_GLOSSARY as LINKS } from './glossary-links.ts'

test('the term-link map matches every Component def', () => {
  expect(LINKS).toEqual(COMPONENT_GLOSSARY)
  expect(Object.keys(LINKS).every((id) => id in COMPONENTS)).toBe(true)
})
