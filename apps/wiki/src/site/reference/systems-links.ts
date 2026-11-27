import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { COMPONENT_IDS, type ComponentId, type IncidentId } from '@quorum/simulation/catalog'
import type { SandboxId } from '@quorum/simulation/sandbox-summary'
import { linksFrom } from '../content.ts'
import { link, linkList, type Lang } from './shared.ts'

export const componentPath = (id: ComponentId): string => `/components/${id}`

export const incidentPath = (id: IncidentId): string => `/incidents/${id}`

export const sandboxPath = (id: SandboxId): string => `/sandboxes/${id}`

const componentLinks = new Map(COMPONENT_IDS.map((id) => [id, linksFrom(componentPath(id))]))

/** The Components a Sandbox's prose places, as the old wiki's graph helper found them. */
export const componentsPlacing = (sandbox: SandboxId): ReadonlyArray<ComponentId> =>
  COMPONENT_IDS.filter((id) => componentLinks.get(id)?.sandboxes.has(sandbox))

export const componentList = <Msg>(
  l: Lang,
  ids: ReadonlyArray<ComponentId>,
  h: H<Msg>,
): View.Content<Msg> =>
  h.p.children(
    linkList(
      l,
      ids.map((id) => link(componentPath(id), l.cat.COMPONENTS[id].name, h)),
      h,
    ),
  )
