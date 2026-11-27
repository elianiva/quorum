# Shared UI data and the board live in one package

The wiki shows the game's board and reads its catalog data. A copy would drift from the game, and an
app cannot import another app. The shared data and board move to `packages/ui` (`@quorum/ui`), which
both apps import.

The package has subpath exports:

- `@quorum/ui/primitives/*`: shared style fragments, such as keyboard hints and hit groups. They
  import only `@quorum/styled-system`.
- `@quorum/ui/game/*`: pure data over the Simulation, such as number formats, icons, labels, and
  style values. The module returns no UI framework types, so each app renders it with Effect UI.
- `@quorum/ui/board`: the Pixi board. It takes a `BoardState` and callbacks, so it does not know
  about sound or the app's Messages.
- `src/panda/preset.ts`: the Panda preset both apps' Panda configs load. It holds the Graphite
  palette as custom properties, the tokens that read them, the document base, and the motion
  classes, so the wiki and the game share one design language.

Only the board and pure data move. Screens that exist only in the game (the dock, the HUD,
Settings) stay in `apps/web`, and the wiki writes its own Effect UI views from the shared data.

Considered options:

- **Two packages**, one for primitives and one for game views. Cleaner layering, but both have the
  same two consumers, and the repository adds a package only for a real boundary. Rejected;
  subpaths keep the wiki from loading Pixi through a primitives import.
- **Wiki-only copies of the views.** Rejected: they would drift from the game.

## Consequences

- `primitives` never imports `game` or `board`. `game` and `board` import `@quorum/simulation` and
  `primitives`, never an app.
- The package ships TypeScript source, as `@quorum/simulation` does. Each app's Vite build compiles
  it, and Panda reads its tokens and styles through the shared preset and the app source globs.
- What would change it: a third consumer with different needs, such as a native client.
