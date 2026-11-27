import { Schema } from 'effect'
import { UiSchema } from '@effect/ui'
import { REQUEST_KINDS } from '@quorum/simulation/catalog'
import { RegionId } from '@quorum/simulation/state'
import { AnnotationGroup, type Dashboard } from './model.ts'
import type { UpdateReturn } from './step.ts'

export const DashboardMessage = UiSchema.TaggedEnum({
  RangeChosen: { minutes: Schema.Finite },
  Hovered: { index: Schema.NullOr(Schema.Finite) },
  PostmortemChosen: { id: Schema.NullOr(Schema.Finite) },
  GroupToggled: { group: AnnotationGroup },
  CompareToggled: {},
  TableToggled: {},
  KindChosen: { kind: Schema.NullOr(Schema.Literals(REQUEST_KINDS)) },
  ServiceChosen: { service: Schema.NullOr(Schema.String) },
  RegionChosen: { region: Schema.NullOr(RegionId) },
})
export type DashboardMessage = typeof DashboardMessage.Type

export const updateDashboard = (
  dashboard: Dashboard,
  message: DashboardMessage,
): UpdateReturn<Dashboard, DashboardMessage> =>
  DashboardMessage.match(message, {
    RangeChosen: ({ minutes }) => ({ model: { ...dashboard, range: minutes, hover: null } }),
    Hovered: ({ index }) => ({ model: { ...dashboard, hover: index } }),
    PostmortemChosen: ({ id }) => ({
      model: { ...dashboard, postmortem: dashboard.postmortem === id ? null : id },
    }),
    GroupToggled: ({ group }) => ({
      model: {
        ...dashboard,
        groups: dashboard.groups.includes(group)
          ? dashboard.groups.filter((entry) => entry !== group)
          : [...dashboard.groups, group],
      },
    }),
    CompareToggled: () => ({ model: { ...dashboard, compare: !dashboard.compare } }),
    TableToggled: () => ({ model: { ...dashboard, table: !dashboard.table } }),
    KindChosen: ({ kind }) => ({ model: { ...dashboard, kind } }),
    ServiceChosen: ({ service }) => ({ model: { ...dashboard, service } }),
    RegionChosen: ({ region }) => ({ model: { ...dashboard, region } }),
  })
