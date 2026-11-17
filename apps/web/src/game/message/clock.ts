import { Schema } from 'effect'

export const clockCases = {
  Ticked: { elapsedMs: Schema.Finite },
  SpeedCycled: {},
  SpeedChosen: { speed: Schema.Finite },
  PauseToggled: {},
  FullscreenToggled: {},
  ScreenshotToggled: {},
  BoardFitted: {},
  BoardTidied: {},
  ZoomChosen: { direction: Schema.Literals([1, -1]) },
}
