import { Schema } from 'effect'

export const paletteCases = {
  PaletteOpened: {},
  PaletteClosed: {},
  PaletteQueryChanged: { query: Schema.String },
  PaletteMoved: { delta: Schema.Literals([1, -1]) },
  PaletteHighlighted: { id: Schema.String },
  PaletteChosen: { id: Schema.String },
}
