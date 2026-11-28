import { Schema } from 'effect'
import { UiSchema } from '@effect/ui'
import { FeatureId, LanguageId, PolicyId, RequestKind, TeamKind } from '@quorum/simulation/state'
import * as Drag from './drag.ts'
import type { UpdateReturnWithOutMessage } from './step.ts'
import { RenameTarget, type Team } from './model.ts'

export const TeamMessage = UiSchema.TaggedEnum({
  DragChanged: { message: Drag.Message },
  HireChosen: { language: LanguageId },
  LayoffChosen: { engineerId: Schema.String },
  TrainChosen: { engineerId: Schema.String },
  OffsiteChosen: { teamId: Schema.String },
  Created: {},
  Removed: { teamId: Schema.String },
  EngineerAssigned: { engineerId: Schema.String, teamId: Schema.String },
  PolicyChosen: { teamId: Schema.String, policy: PolicyId },
  KindChosen: { teamId: Schema.String, kind: TeamKind },
  ResearchTeamChosen: { teamId: Schema.String },
  ResearchTeamCleared: {},
  FeatureQueued: { id: FeatureId },
  FeatureRemoved: { id: FeatureId },
  ServiceNamed: { name: Schema.String },
  ServiceTargetChosen: { target: Schema.String },
  ServiceKindsPicked: { kinds: Schema.Array(RequestKind) },
  BuildInChosen: { serviceId: Schema.NullOr(Schema.String) },
  SplitChosen: {},
  ServiceMoved: { serviceId: Schema.String, teamId: Schema.String },
  DatastoreChosen: { serviceId: Schema.String, datastore: Schema.NullOr(Schema.String) },
  RenameStarted: { target: RenameTarget, id: Schema.String },
  RenameChanged: { name: Schema.String },
  RenameCommitted: {},
  RenameCancelled: {},
})
export type TeamMessage = typeof TeamMessage.Type

export const TeamOutMessage = UiSchema.TaggedEnum({
  Hire: { language: LanguageId },
  Layoff: { engineerId: Schema.String },
  Train: { engineerId: Schema.String },
  Offsite: { teamId: Schema.String },
  CreateTeam: {},
  RemoveTeam: { teamId: Schema.String },
  Assign: { engineerId: Schema.String, teamId: Schema.String },
  SetPolicy: { teamId: Schema.String, policy: PolicyId },
  SetKind: { teamId: Schema.String, kind: TeamKind },
  SetResearchTeam: { teamId: Schema.NullOr(Schema.String) },
  QueueFeature: { id: FeatureId, service: Schema.NullOr(Schema.String) },
  RemoveFeature: { id: FeatureId },
  SplitService: {
    name: Schema.String,
    kinds: Schema.Array(RequestKind),
    service: Schema.NullOr(Schema.String),
    node: Schema.NullOr(Schema.String),
  },
  MoveService: { serviceId: Schema.String, teamId: Schema.String },
  DatastoreService: { serviceId: Schema.String, datastore: Schema.NullOr(Schema.String) },
  Rename: { target: RenameTarget, id: Schema.String, name: Schema.String },
})
export type TeamOutMessage = typeof TeamOutMessage.Type

export const initTeam = (): Team => ({
  drag: Drag.init(),
  service: { name: '', kinds: [], target: '', buildIn: null },
  rename: null,
})

type TeamReturn = UpdateReturnWithOutMessage<Team, TeamMessage, TeamOutMessage>

const out = (team: Team, outMessage: TeamOutMessage): TeamReturn => ({ model: team, outMessage })

const dragged = (team: Team, message: Drag.Message): TeamReturn => {
  const next = Drag.update(team.drag, message)
  const drop = next.outMessage
  return {
    model: { ...team, drag: next.model },
    ...(drop?._tag === 'Reordered' && drop.fromContainerId !== drop.toContainerId
      ? {
          outMessage: TeamOutMessage.Assign({
            engineerId: drop.itemId,
            teamId: drop.toContainerId,
          }),
        }
      : {}),
  }
}

const drafted = (team: Team, change: Partial<Team['service']>): TeamReturn => ({
  model: { ...team, service: { ...team.service, ...change } },
})

export const updateTeam = (team: Team, message: TeamMessage): TeamReturn =>
  TeamMessage.match(message, {
    DragChanged: ({ message: child }) => dragged(team, child),
    HireChosen: ({ language }) => out(team, TeamOutMessage.Hire({ language })),
    LayoffChosen: ({ engineerId }) => out(team, TeamOutMessage.Layoff({ engineerId })),
    TrainChosen: ({ engineerId }) => out(team, TeamOutMessage.Train({ engineerId })),
    OffsiteChosen: ({ teamId }) => out(team, TeamOutMessage.Offsite({ teamId })),
    Created: () => out(team, TeamOutMessage.CreateTeam()),
    Removed: ({ teamId }) => out(team, TeamOutMessage.RemoveTeam({ teamId })),
    EngineerAssigned: ({ engineerId, teamId }) =>
      out(team, TeamOutMessage.Assign({ engineerId, teamId })),
    PolicyChosen: ({ teamId, policy }) => out(team, TeamOutMessage.SetPolicy({ teamId, policy })),
    KindChosen: ({ teamId, kind }) => out(team, TeamOutMessage.SetKind({ teamId, kind })),
    ResearchTeamChosen: ({ teamId }) => out(team, TeamOutMessage.SetResearchTeam({ teamId })),
    ResearchTeamCleared: () => out(team, TeamOutMessage.SetResearchTeam({ teamId: null })),
    FeatureQueued: ({ id }) =>
      out(team, TeamOutMessage.QueueFeature({ id, service: team.service.buildIn })),
    FeatureRemoved: ({ id }) => out(team, TeamOutMessage.RemoveFeature({ id })),
    ServiceNamed: ({ name }) => drafted(team, { name }),
    ServiceTargetChosen: ({ target }) => drafted(team, { target }),
    ServiceKindsPicked: ({ kinds }) => drafted(team, { kinds }),
    BuildInChosen: ({ serviceId }) => drafted(team, { buildIn: serviceId }),
    SplitChosen: () =>
      team.service.kinds.length === 0
        ? { model: team }
        : out(
            team,
            TeamOutMessage.SplitService({
              name: team.service.name,
              kinds: team.service.kinds,
              service: team.service.target.startsWith('service:')
                ? team.service.target.slice(8)
                : null,
              node: team.service.target.startsWith('node:') ? team.service.target.slice(5) : null,
            }),
          ),
    ServiceMoved: ({ serviceId, teamId }) =>
      out(team, TeamOutMessage.MoveService({ serviceId, teamId })),
    DatastoreChosen: ({ serviceId, datastore }) =>
      out(team, TeamOutMessage.DatastoreService({ serviceId, datastore })),
    RenameStarted: ({ target, id }) => ({
      model: { ...team, rename: { target, id, draft: '' } },
    }),
    RenameChanged: ({ name }) =>
      team.rename === null
        ? { model: team }
        : { model: { ...team, rename: { ...team.rename, draft: name } } },
    RenameCancelled: () => ({ model: { ...team, rename: null } }),
    RenameCommitted: () =>
      team.rename === null
        ? { model: team }
        : {
            model: { ...team, rename: null },
            outMessage: TeamOutMessage.Rename({
              target: team.rename.target,
              id: team.rename.id,
              name: team.rename.draft,
            }),
          },
  })
