import { expect, test } from 'vitest'
import { COMPONENT_IDS } from '@quorum/simulation/catalog'
import { COMPONENT_VIEWS } from '../components/index.ts'
import { COMPONENT_ICONS } from './component-icons.ts'

/* The light icon table and each Component's own view must name the same glyph. */
test('the icon table matches every Component view', () => {
  for (const id of COMPONENT_IDS) expect(COMPONENT_ICONS[id], id).toBe(COMPONENT_VIEWS[id].icon)
})
