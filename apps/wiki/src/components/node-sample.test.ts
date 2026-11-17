import { expect, test } from 'vitest'
import { COMPONENT_IDS, COMPONENTS } from '@quorum/simulation/catalog'
import { solveFlow } from '@quorum/simulation/solve'
import { wired } from './node-sample.ts'

test('every Component that takes requests has traffic on its card', () => {
  const idle = COMPONENT_IDS.filter((type) => {
    const def = COMPONENTS[type]
    if (def.control || def.accepts.length === 0) return false
    const { game, node } = wired(type)
    return (solveFlow(game).nodes[node.id]?.inbound ?? 0) === 0
  })
  expect(idle).toEqual([])
})
