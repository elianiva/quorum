import { COMPONENTS } from '@quorum/simulation/catalog'
import type { Game } from '@quorum/simulation/state'
import type { LogEntry } from './playlog.ts'

export type AnalyticsEvent = Readonly<{
  event: string
  properties: Record<string, unknown>
}>

export type BridgeContext = Readonly<{
  game: Game
  seenComponents: Set<string>
}>

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)

const listOf = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [])

const addedOf = (data: Record<string, unknown>): ReadonlyArray<Record<string, unknown>> =>
  listOf(record(data.diff)?.added).flatMap((node) => {
    const entry = record(node)
    return entry === null ? [] : [entry]
  })

const linkedOf = (data: Record<string, unknown>): ReadonlyArray<string> =>
  listOf(record(data.diff)?.linked).flatMap((link) => {
    const key = text(link)
    return key === null ? [] : [key]
  })

const eraOf = (data: Record<string, unknown>): number | null => count(record(data.context)?.stage)

const changedOf = (data: Record<string, unknown>): ReadonlyArray<Record<string, unknown>> =>
  listOf(record(data.diff)?.changed).flatMap((change) => {
    const entry = record(change)
    return entry === null ? [] : [entry]
  })

const sizedOf = (data: Record<string, unknown>): ReadonlyArray<Record<string, unknown>> =>
  changedOf(data).filter((change) => change['field'] === 'size')

const nestedTag = (data: Record<string, unknown>): string | null => text(record(data.message)?._tag)

const nodeTypeOf = (game: Game, id: string | null): string | null =>
  id === null ? null : (game.nodes.find((node) => node.id === id)?.type ?? null)

const nodeOf = (data: Record<string, unknown>): string | null => text(data.id) ?? text(data.nodeId)

export const eventsOf = (
  entries: ReadonlyArray<LogEntry>,
  context: BridgeContext,
): ReadonlyArray<AnalyticsEvent> => {
  const events: Array<AnalyticsEvent> = []

  for (const entry of entries) {
    let parsed: unknown
    try {
      parsed = JSON.parse(entry.data)
    } catch {
      continue
    }
    const data = record(parsed)
    if (data === null) continue

    const refused = text(data.refused)
    if (refused !== null)
      events.push({
        event: 'ui:action_refused',
        properties: {
          action: entry.type,
          reason: refused,
          era: eraOf(data),
          component_id: text(data.type),
        },
      })

    switch (entry.type) {
      case 'CompanyStarted':
        events.push({
          event: 'company:founded',
          properties: {
            venture: text(data.venture),
            mutators: listOf(data.mutators).flatMap((id) => (text(id) === null ? [] : [text(id)])),
            mutator_count: listOf(data.mutators).length,
            is_first_company: bool(data.first) ?? false,
            era: count(data.stage) ?? 0,
          },
        })
        break

      case 'EraReached':
        events.push({ event: 'company:era_reached', properties: data })
        break

      case 'SandboxStarted':
        events.push({
          event: 'sandbox:started',
          properties: {
            sandbox: text(data.sandbox),
            free: text(data.sandbox) === 'free',
          },
        })
        break

      case 'ChallengeStarted':
        events.push({
          event: 'challenge:started',
          properties: { challenge: text(data.challenge) },
        })
        break

      case 'SessionResumed':
        events.push({ event: 'session:resumed', properties: { era: eraOf(data) } })
        break

      case 'AchievementEarned':
        events.push({
          event: 'achievement:earned',
          properties: { achievement_id: text(data.id) },
        })
        break

      case 'ObjectivePassed':
        events.push({
          event: 'sandbox:objective_passed',
          properties: {
            sandbox: text(data.sandbox),
            objective: count(data.objective),
          },
        })
        break

      case 'Collected': {
        const amount = count(record(data.diff)?.cash)
        if (amount !== null && amount > 0)
          events.push({ event: 'game:collected', properties: { amount, era: eraOf(data) } })
        break
      }

      case 'ResizeChosen':
      case 'UpgradeAllChosen':
        for (const change of sizedOf(data))
          events.push({
            event: 'board:node_resized',
            properties: {
              component_id: text(change['type']),
              from_size: count(change['from']),
              to_size: count(change['to']),
              era: eraOf(data),
            },
          })
        break

      case 'InstallCpu':
      case 'InstallRam':
      case 'InstallDisk':
        if (refused !== null) break
        events.push({
          event: 'shop:part_bought',
          properties: {
            slot:
              entry.type === 'InstallCpu' ? 'cpu' : entry.type === 'InstallRam' ? 'ram' : 'disk',
            component_id: nodeTypeOf(context.game, nodeOf(data)),
            era: eraOf(data),
          },
        })
        break

      case 'SelectInstance':
        if (refused !== null) break
        events.push({
          event: 'shop:instance_selected',
          properties: {
            component_id: nodeTypeOf(context.game, nodeOf(data)),
            family: text(data.family),
            size: count(data.size),
            era: eraOf(data),
          },
        })
        break

      case 'ShopOpened':
        events.push({
          event: 'shop:opened',
          properties: {
            component_id: nodeTypeOf(context.game, text(data.nodeId)),
            slot: text(data.slot),
            mode: text(data.mode),
            era: eraOf(data),
          },
        })
        break

      case 'PanelOpened':
        if (text(data.panel) === 'inbox')
          events.push({ event: 'inbox:opened', properties: { era: eraOf(data) } })
        break

      case 'InboxChanged': {
        const tag = nestedTag(data)
        if (tag === 'Opened' || tag === 'PeekOpened')
          events.push({ event: 'mail:opened', properties: { era: eraOf(data) } })
        break
      }

      case 'TeamChanged':
        if (nestedTag(data) === 'HireChosen' && refused === null)
          events.push({
            event: 'team:hired',
            properties: { era: eraOf(data), engineers: context.game.engineers.length },
          })
        break

      case 'ResearchCompleted': {
        const ids = listOf(data.ids).flatMap((id) => (text(id) === null ? [] : [text(id)]))
        for (const id of ids)
          events.push({
            event: 'research:completed',
            properties: {
              research_id: id,
              era: count(data.era),
              researched_count: ids.length,
            },
          })
        break
      }

      case 'Exited':
        events.push({
          event: 'company:exited',
          properties: {
            exit_type: text(data.exit),
            payout: count(data.payout),
            legacy: count(data.legacy),
            era: count(data.era),
          },
        })
        break

      case 'SurveySent': {
        const survey = record(data.survey)
        if (survey === null) break
        const issues = count(survey.issues_chars) ?? 0
        const likes = count(survey.likes_chars) ?? 0
        events.push({
          event: 'survey:submitted',
          properties: {
            exit_type: text(survey.exit),
            era: count(survey.stage),
            payout: count(survey.payout),
            legacy: count(survey.legacy),
            locale: text(survey.locale),
            answered_issues: issues > 0,
            answered_likes: likes > 0,
            issues_chars: issues,
            likes_chars: likes,
            answer_chars: issues + likes,
          },
        })
        break
      }

      case 'NodePlaced':
      case 'NodesPasted':
        for (const node of addedOf(data)) {
          const type = text(node.type)
          if (type === null) continue
          const first = !context.seenComponents.has(type)
          context.seenComponents.add(type)
          const def = COMPONENTS[type as keyof typeof COMPONENTS]
          events.push({
            event: 'board:node_placed',
            properties: {
              component_id: type,
              component_kind: def?.group ?? null,
              size: count(node.size),
              era: eraOf(data),
              region: text(node.region),
              placement_method: entry.type === 'NodesPasted' ? 'paste' : 'click',
              is_first_placement_of_component: first,
            },
          })
        }
        break

      case 'LinkRequested':
        for (const key of linkedOf(data)) {
          const [from, to] = key.split('>')
          if (from === undefined || to === undefined) continue
          const source = context.game.nodes.find((node) => node.id === from)
          const target = context.game.nodes.find((node) => node.id === to)
          events.push({
            event: 'board:link_created',
            properties: {
              from_component: source?.type ?? null,
              to_component: target?.type ?? null,
              is_cross_region:
                source !== undefined && target !== undefined && source.region !== target.region,
              era: eraOf(data),
            },
          })
        }
        break

      default:
        break
    }
  }

  return events
}
