import { expect, test } from 'vitest'
import { COMPONENT_IDS } from '@quorum/simulation/catalog'
import { COMPONENT_VIEWS } from '../components/index.ts'
import { LAYOUTS } from './layouts.ts'

test('the layout table matches every Component view', () => {
  for (const id of COMPONENT_IDS) expect(LAYOUTS[id], id).toEqual(COMPONENT_VIEWS[id].layout)
})
