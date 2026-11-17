import {
  COMPONENTS,
  COMPONENT_IDS,
  researchList,
  type ComponentId,
  type IncidentId,
  type ResearchId,
} from '@quorum/simulation/catalog'
import { GUIDED_SUMMARY, SANDBOX_IDS, type SandboxId } from '@quorum/simulation/sandbox-summary'
import { linksFrom } from '../content.ts'

const componentLinks = new Map(COMPONENT_IDS.map((id) => [id, linksFrom(`/components/${id}`)]))

export const componentsHitBy = (incident: IncidentId): ReadonlyArray<ComponentId> =>
  COMPONENT_IDS.filter((id) => componentLinks.get(id)?.paths.has(`/incidents/${incident}`))

export const incidentsOn = (component: ComponentId): ReadonlyArray<string> =>
  [...(componentLinks.get(component)?.paths ?? [])]
    .filter((path) => path.startsWith('/incidents/') && path !== '/incidents')
    .map((path) => path.slice('/incidents/'.length))

export const sandboxesFiring = (incident: IncidentId): ReadonlyArray<SandboxId> =>
  SANDBOX_IDS.filter((id) =>
    GUIDED_SUMMARY[id].objectives.some((objective) => objective.incident?.kind === incident),
  )

export const componentsPlacing = (sandbox: SandboxId): ReadonlyArray<ComponentId> =>
  COMPONENT_IDS.filter((id) => componentLinks.get(id)?.sandboxes.has(sandbox))

export const worksWith = (component: ComponentId): ReadonlyArray<ComponentId> =>
  COMPONENT_IDS.filter(
    (id) =>
      id !== component &&
      (componentLinks.get(component)?.paths.has(`/components/${id}`) ||
        componentLinks.get(id)?.paths.has(`/components/${component}`)),
  )

export const researchNext = (component: ComponentId): ReadonlyArray<ResearchId> => {
  const unlock = COMPONENTS[component].unlock
  return unlock
    ? researchList.filter((entry) => entry.requires.includes(unlock)).map((entry) => entry.id)
    : []
}
