import { expect, test } from 'vitest'
import { COMPONENT_IDS } from '@quorum/simulation/catalog'
import { COMPONENT_VIEWS } from '../components/index.ts'
import { LAYOUTS, placementRows } from './layouts.ts'

test('the layout table matches every Component view, plus the placement row', () => {
  for (const id of COMPONENT_IDS) {
    const view = COMPONENT_VIEWS[id].layout
    expect(LAYOUTS[id], id).toEqual({ ...view, rows: view.rows + placementRows(id) })
  }
})
