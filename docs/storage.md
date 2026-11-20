# Storage

Quorum keeps a Company in the browser. The API Worker keeps Rooms in Durable Objects, and the Exit
survey in D1. Nothing else is stored on a server. Once the game is public, the browser keys and the
save format are a compatibility surface: rename a key or change the format only with a migration.

## Browser keys

`apps/web/src/game/storage.ts` names every `localStorage` key below and is the only module that
reads and writes them. A blocked or full browser gets `null` from a read and `false` from a write,
so each caller decides what a lost value costs. `apps/web/src/game/company-files.ts` is the only
other module that names a place in the browser: the IndexedDB database that holds the Company
files.

| Key                     | Holds                                                     | Read by                       | Lifecycle                                   |
| ----------------------- | --------------------------------------------------------- | ----------------------------- | ------------------------------------------- |
| `quorum.saves.v1`       | The Company list: `current` and one file per Company      | `LoadSaves`                   | Written with every autosave                 |
| `quorum.save.v3.<id>`   | A Company file outside IndexedDB (see "Company files")    | `LoadCompany`                 | Removed once IndexedDB holds the file       |
| `quorum.prefs.v1`       | Settings: sound, motion, language, text, theme, consent   | `LoadPrefs`, Sentry           | Written on every Settings change            |
| `quorum.founder.v1`     | Founder record: Legacy, Perks, Playbooks, achievements    | `LoadFounder`                 | Written on every Founder change             |
| `quorum.sandbox.v1`     | Passed guided Sandboxes and the free Sandbox board        | `LoadSandboxStore`            | Written on Sandbox progress                 |
| `quorum.agent.rooms`    | A write key and Room id per Company, with Agent access on | `agent-room.ts`               | Written when a Room is first needed         |
| `quorum.room.name`      | The display name other Seats see                          | `room-socket.ts`              | Written when the player sets it             |
| `quorum.analytics.v1`   | The monthly and session event budget                      | `analytics-budget.ts`         | Written per captured event                  |
| `quorum.playlog.v1`     | The last 2,000 support log lines                          | `playlog.ts`, developer panel | Capped, written after a batch               |
| `quorum.save.broken.v1` | The last Company file this build could not read           | Nothing; a support copy       | Replaced by a failure, cleared by an import |

`quorum.room.seat` lives in `sessionStorage`: it names this tab's Seat and dies with the tab.
`quorum.pwa.updated` lives there too: it marks the reload after a deploy, so the game can say that
it updated.

The keys above are the only localStorage keys Quorum writes. `quorum.save.v1` and `quorum.save.v2` were the pre-public single saves. `sweepLegacyStorage` removes them on boot. `PruneSaves` removes Company files and Agent Room records that the index does not name, so a failed index write or a deleted Company cannot leak storage.

## Company files

A Company file is the Game, disclosure, Dashboard, and Inbox of one Company as one JSON text. It
lives in the IndexedDB database `quorum`, in the object store `companies`, under the Company's id.
A mature Company's file runs past a million characters, which is why it is not in `localStorage`:
a few of them fill that quota, and every write there blocks the page
([ADR 0027](adr/0027-company-files-live-in-indexeddb.md)). The Company list and every other key
stay in `localStorage`, so the page still boots without waiting for a database.

`quorum.save.v3.<id>` held the same text before the move, and it still holds it in three cases:

- **A Company that has not been saved since the move.** `LoadCompany` reads the database first and
  the key second. The Company's next save writes the database, and the key is removed only after
  that transaction's `complete` event. A write that fails leaves the key as it was.
- **A browser without IndexedDB, or one that refuses the write,** as some private modes do. The
  file is written to the key as before, and the save fails with the storage toast only when both
  places refuse. A record the database could not replace is removed, so it cannot answer a later
  read with an older Company.
- **A tab that is hidden or loses focus.** A page that closes does not wait for a transaction, so
  that one save writes the key in the same turn and then writes the database. The key goes when the
  database write commits.

`WriteCompany`, `LoadCompany`, `DeleteCompany`, and `PruneSaves` cover both places. A write whose
commit removes the key asks for `strict` durability, because it leaves one copy; the five-second
autosave asks for `relaxed`. Copy, download, and import never read a stored file: they encode the
open Company and decode the player's text, and an import is stored by the save that follows it.

## Reading rules

- The index decodes with `SaveIndex`. A broken list is kept under `quorum.save.broken.v1`, and the
  page does not prune Company files when the list cannot be read.
- A Company with a copy in each place opens the one saved at the later sim time, the `time` every
  Company file carries. The key wins a tie, because it outlives a commit only when the page closed
  on the write that put it there.
- A database that refuses a read is not a missing file. With no copy under the key, the Company
  keeps its row and its file, and the player is told to try again.
- A Company file must carry `format`. `SAVE_FORMAT` is 1, and a file with another format is kept
  aside with a warning. The format is not the build's git hash.
- A Company that cannot open leaves the list, and its file is removed. An unreadable file is copied
  to `quorum.save.broken.v1` first, so the warning shows once instead of on every load.
- Settings, the Founder, Sandbox progress, the agent Rooms, and the analytics budget
  decode with their schemas or guards. A bad value falls back to the default rather than throwing.
- The support log is filtered to well-formed lines and capped at 2,000. It shares the quota with
  the saves, so it does not grow without bound.

## Save format

`apps/web/src/game/save-file.ts` owns `SAVE_FORMAT` and the stored shape. The database record and
the key `quorum.save.v3.<id>` hold the same JSON text, so the place a file lives in is not part of
the format, and moving it did not change `SAVE_FORMAT`. The text export wraps the
same JSON in `QSV1:` with base64url encoding, and carries the same format. **Download save file**
writes that line to a file, and **Import a save file** reads one back. Import also takes a stored
Company file as it is, so a player can move one by hand. It checks the format before decoding the
Game; a mismatch leaves the open Company untouched, and a successful import clears the copy under
`quorum.save.broken.v1`. With no Company open, an import adds one to the list and opens its Board.

A later format change bumps `SAVE_FORMAT` and adds one migration from the previous format. No other
module learns about an old shape ([ADR 0023](adr/0023-a-company-save-has-a-format.md)).

## Server storage

- **RoomObject.** One SQLite-backed Durable Object per Room, so one value may hold 2 MB. It stores
  the Room in three values: the Game under `game`, the Dashboard samples under `samples`, and the
  small fields (Seats, vote, speed, clock) under `rest`. A save is one `put` of the values that
  changed, so a vote or a Seat joining writes `rest` alone and leaves the Game where it is. A Room
  stored as one value under `room` is still read: the object writes it out as three values on load
  and deletes `room`. The object deletes everything when the Room ends. An empty Room keeps one
  alarm, set for 24 hours after the last Seat left, and deletes itself when that alarm fires. A Room
  whose `simVersion` is not this build's is dropped on load, so a deploy cannot feed an old Game to
  the new Simulation.
- **AgentRoom.** One Durable Object per exposed Company. It stores `meta`, `head`, `inbox`, sample
  chunks, and per-node samples, deletes all of it when the write key is cleared, and expires after
  24 hours without a write.
- **D1.** The `survey_responses` table holds one Exit survey row per device and Exit. The
  `live_rooms` table holds one row per Room that counts against the cap of 20; a publish that finds
  it full asks each Room and drops the rows of those that are gone or hold nobody. A socket to an empty Room claims a slot again, or is refused with 503 when none is free. The `results` table was dropped when Challenges moved to local scoring, and `feature_keys` when
  Online Rooms opened to everyone.
