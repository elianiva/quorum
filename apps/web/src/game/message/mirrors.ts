import { DataPattern, IacTool, Region, SyncMode } from '@quorum/simulation/state'
import { MANAGED } from '@quorum/simulation/mirror'
import { Schema } from 'effect'

export const mirrorsCases = {
  IacToolPicked: { tool: IacTool },
  SyncModePicked: { sync: Schema.NullOr(SyncMode) },
  MirrorStarted: { target: Region, source: Region },
  MirrorApplied: { region: Region, destroy: Schema.Boolean },
  MirrorDataPicked: { region: Region, source: Schema.String, pattern: DataPattern },
  MirrorOverrideSet: {
    region: Region,
    nodeId: Schema.String,
    field: Schema.Literals(MANAGED),
    keep: Schema.Boolean,
  },
  MirrorComputedSet: { region: Region, computed: Schema.Boolean },
  MirrorStopped: { region: Region },
  MirrorRefreshed: { region: Region },
  MirrorRepaired: { region: Region },
}
