import { expect, test } from 'vitest'
import { COMPONENT_DEFS, COMPONENT_GLOSSARY } from './components/defs.ts'
import { COMPONENT_GLOSSARY as LINKS } from './glossary-links.ts'

/* The light term-link map and the Component definitions must name the same glossary entries. */
test('the term-link map matches every Component def', () => {
  expect(LINKS).toEqual(COMPONENT_GLOSSARY)
  expect(Object.keys(LINKS).every((id) => id in COMPONENT_DEFS)).toBe(true)
})
