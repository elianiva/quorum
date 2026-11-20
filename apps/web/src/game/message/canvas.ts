import { BuildGroupKey } from '../model.ts'
import { BoardFault } from '../board-surface-machine.ts'
import { ComponentId } from '@quorum/simulation/state'
import { Schema } from 'effect'

export const canvasCases = {
  BoardReady: {},
  BoardFailed: { reason: BoardFault },
  BuildGroupChosen: { group: BuildGroupKey },
  PlacingChosen: { type: Schema.NullOr(ComponentId) },
  NodePlaced: { x: Schema.Finite, y: Schema.Finite },
  NodeSampleChosen: { nodeId: Schema.String, time: Schema.NullOr(Schema.Finite) },
  NodeTapped: { nodeId: Schema.String },
  ServiceAssigned: { nodeId: Schema.String, serviceId: Schema.String },
  RevealNode: { nodeId: Schema.String },
  NodeToggled: { nodeId: Schema.String },
  SelectionBoxed: {
    ids: Schema.Array(Schema.String),
    mode: Schema.Literals(['replace', 'add', 'subtract']),
  },
  SelectionAll: {},
  NodesCopied: {},
  NodesCut: {},
  NodesPasted: {},
  NodesDuplicated: {},
  NodesBoxed: {},
  NodesNudged: { dx: Schema.Finite, dy: Schema.Finite },
  SellAsked: {},
  SellConfirmed: {},
  SellDismissed: {},
  SelectionCleared: {},
  NodeMoved: { nodeId: Schema.String, x: Schema.Finite, y: Schema.Finite },
  LinkRequested: { from: Schema.String, to: Schema.String },
  LinkCut: { from: Schema.String, to: Schema.String },
  EmptyTapped: {},
  FooterPressed: { nodeId: Schema.String },
  UndoChosen: {},
  RedoChosen: {},
}
