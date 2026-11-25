import { DataPattern, IacTool, RegionId, SyncMode } from '@quorum/simulation/state'
import { MANAGED } from '@quorum/simulation/mirror'
import { Schema } from 'effect'

export const mirrorsCases = {
  IacToolPicked: { tool: IacTool },
  SyncModePicked: { sync: Schema.NullOr(SyncMode) },
  MirrorStarted: { target: RegionId, source: RegionId },
  MirrorApplied: { region: RegionId, destroy: Schema.Boolean },
  MirrorDataPicked: { region: RegionId, source: Schema.String, pattern: DataPattern },
  MirrorOverrideSet: {
    region: RegionId,
    nodeId: Schema.String,
    field: Schema.Literals(MANAGED),
    keep: Schema.Boolean,
  },
  MirrorComputedSet: { region: RegionId, computed: Schema.Boolean },
  MirrorStopped: { region: RegionId },
  MirrorRefreshed: { region: RegionId },
  MirrorRepaired: { region: RegionId },
}
