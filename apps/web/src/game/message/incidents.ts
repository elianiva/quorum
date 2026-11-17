import { Schema } from 'effect'

export const incidentsCases = {
  LeaderFenced: {},
  DrillRun: {},
  GuidanceChosen: { growth: Schema.Finite, margin: Schema.Finite },
  ReportCancelled: {},
  VolumeExpanded: {},
  CertificateRenewed: {},
  ProviderSwitched: {},
  ProviderChosen: { nodeId: Schema.String, provider: Schema.Literals(['first', 'second']) },
  MessageDeleted: {},
  SchemaMigrationCancelled: {},
  DependencyPinned: {},
  TableRestored: {},
  ClocksRestarted: {},
  RoutesRolledBack: {},
  ConfigRolledBack: {},
  NodeSold: { nodeId: Schema.String },
  Collected: {},
  AlertsAcknowledged: {
    rules: Schema.Array(Schema.Literals(['errors', 'latency', 'saturation', 'queue', 'budget'])),
  },
}
