import { Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { DragAndDrop } from '@foldkit/ui'
import { LeverKindId, ResearchId } from '@quorum/simulation/state'
import type { Research } from './model.ts'

export const STUDY_QUEUE = 'study-queue'

export const ResearchMessage = defineMessageUnion({
  Focused: { id: ResearchId },
  Bought: { id: ResearchId },
  DragChanged: { message: DragAndDrop.Message },
  StudyMoved: { id: ResearchId, direction: Schema.Literals([1, -1]) },
  StudyPrioritized: { id: ResearchId },
  StudyCancelled: { id: ResearchId },
  PoolsToggled: {},
  SheetResized: { width: Schema.Finite },
  LeverBuilt: { kind: LeverKindId },
  LeverRemoved: { kind: LeverKindId },
})
export type ResearchMessage = typeof ResearchMessage.Type

export const ResearchOutMessage = defineMessageUnion({
  Study: { id: ResearchId },
  MovedTo: { id: ResearchId, index: Schema.Finite },
  Move: { id: ResearchId, direction: Schema.Literals([1, -1]) },
  StudyNow: { id: ResearchId },
  Cancel: { id: ResearchId },
  LeverUp: { kind: LeverKindId },
  LeverDown: { kind: LeverKindId },
})
export type ResearchOutMessage = typeof ResearchOutMessage.Type

export const SHEET_MIN_WIDTH_PX = 280
export const SHEET_MAX_WIDTH_PX = 640
export const SHEET_DEFAULT_WIDTH_PX = 320

export const EMPTY_RESEARCH: Research = {
  focus: null,
  drag: DragAndDrop.init({ id: STUDY_QUEUE }),
  poolsOpen: false,
  sheetWidth: SHEET_DEFAULT_WIDTH_PX,
}

type ResearchReturn = Update.ReturnWithOutMessage<Research, ResearchMessage, ResearchOutMessage>

const out = (research: Research, outMessage: ResearchOutMessage): ResearchReturn => ({
  model: research,
  outMessage,
})

export const queueIndex = (fromIndex: number, dropIndex: number): number =>
  dropIndex > fromIndex ? dropIndex - 1 : dropIndex

export const speedFactorOf = (speed: number): string =>
  Number.isInteger(speed) ? `${speed}` : `${Number(speed.toFixed(2))}`

const dragged = (research: Research, message: DragAndDrop.Message): ResearchReturn => {
  const next = DragAndDrop.update(research.drag, message)
  const drop = next.outMessage
  const moved: ResearchReturn = {
    model: { ...research, drag: next.model },
    commands: Command.mapMessages(next.commands, (child) =>
      ResearchMessage.DragChanged({ message: child }),
    ),
  }
  if (
    drop?._tag !== 'Reordered' ||
    drop.fromContainerId !== STUDY_QUEUE ||
    drop.toContainerId !== STUDY_QUEUE
  )
    return moved
  const index = queueIndex(drop.fromIndex, drop.toIndex)
  return index === drop.fromIndex
    ? moved
    : {
        ...moved,
        outMessage: ResearchOutMessage.MovedTo({
          id: drop.itemId as typeof ResearchId.Type,
          index,
        }),
      }
}

export const updateResearch = (research: Research, message: ResearchMessage): ResearchReturn =>
  ResearchMessage.match<ResearchReturn>(message, {
    Focused: ({ id }) => ({ model: { ...research, focus: id } }),
    Bought: ({ id }) => out(research, ResearchOutMessage.Study({ id })),
    DragChanged: ({ message: child }) => dragged(research, child),
    StudyMoved: ({ id, direction }) => out(research, ResearchOutMessage.Move({ id, direction })),
    StudyPrioritized: ({ id }) => out(research, ResearchOutMessage.StudyNow({ id })),
    StudyCancelled: ({ id }) => out(research, ResearchOutMessage.Cancel({ id })),
    PoolsToggled: () => ({ model: { ...research, poolsOpen: !research.poolsOpen } }),
    LeverBuilt: ({ kind }) => out(research, ResearchOutMessage.LeverUp({ kind })),
    LeverRemoved: ({ kind }) => out(research, ResearchOutMessage.LeverDown({ kind })),
    SheetResized: ({ width }) => ({
      model: {
        ...research,
        sheetWidth: Math.round(Math.max(SHEET_MIN_WIDTH_PX, Math.min(SHEET_MAX_WIDTH_PX, width))),
      },
    }),
  })
