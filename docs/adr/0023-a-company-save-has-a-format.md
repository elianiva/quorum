# A Company save has a format version

A Company lives in the browser, and the player can copy it as text. The stored file and the copy
need a version that changes only when the format changes. The build's git hash is not that version:
it changes on every deploy, so a backup copied under one build would be refused under the next.

A save text that carried `SIM_VERSION` would need migration code for every schema change, and a
copied backup would stop working on the next deploy.

## Decision

1. `SAVE_FORMAT` in `apps/web/src/game/save-file.ts` is the version of a Company save. It is 1, and
   the number is not shown to the player.
2. A stored Company file carries `format` beside the Game. A file without this format is not read.
   The board keeps it under the broken-save key and says the Company could not be read.
3. The text from **Copy save as text** carries the same `format`. **Import a save** refuses another
   format with a message instead of decoding it, and the open Company stays as it was.
4. There is no migration path for a save that predates the format. A save without it is not read.
5. A later format change bumps `SAVE_FORMAT` and adds one function that turns the previous format
   into the new one. The rest of the game keeps reading the current shape only.

## Consequences

- A player's backup opens in a later build while the format stays the same, so a deploy does not
  invalidate it.
- A save from another format is refused, not guessed at. The player sees why, and the current
  Company does not change.
- The game carries no migration code for shapes that no player can produce. The current format is
  the baseline.
- The Simulation's own version stays on replays, Challenge results, and Rooms, where results from
  different builds must never be compared. It is not a save version.
