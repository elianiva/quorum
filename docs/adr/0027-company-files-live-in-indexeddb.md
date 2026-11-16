# Company files live in IndexedDB

A Company file is one JSON text: the Game, the disclosure, the Dashboard history, and the Inbox. A
mature Company's file reaches about 1.4 million characters, and the autosave writes it every five
seconds of real time and when the tab loses focus. Under `localStorage` that write is synchronous,
so it blocks the page each time, and a few mature Companies fill the quota one origin gets. Once the
quota is full every save fails, and the player's only way out is to delete a Company.

IndexedDB has a far larger quota and writes off the main thread. It is also asynchronous, and a
page that closes does not wait for it. MDN says so directly: "there is no way to guarantee that
IndexedDB transactions will complete, even with normal browser shutdown"
([Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)).
The specification closes the connection when "the execution context where the connection was created
is destroyed (for example due to the user navigating away from that page)"
([Indexed Database API 3.0](https://www.w3.org/TR/IndexedDB-3/)), and no script is left to hear
whether the last transaction committed.

## Decision

1. A Company file lives in the IndexedDB database `quorum`, in the object store `companies`, under
   the Company's id. The record is the same JSON text the key `quorum.save.v3.<id>` held, so
   `SAVE_FORMAT` stays 1 and the import and export text is unchanged
   ([ADR 0023](0023-a-company-save-has-a-format.md)).
2. Only Company files move. The Company list, Settings, and the other small keys stay in
   `localStorage`, so the page boots without waiting for a database.
3. `apps/web/src/game/company-files.ts` is the one module that names the database. It reaches it
   through `CompanyDb`, four calls: get, put, remove, and keys. A `put` resolves on the
   transaction's `complete` event, never on the request's `success`.
4. A Company moves when it is next saved. A read tries the database first and the old key second.
   A save writes the database and removes the old key only after that write has committed. Nothing
   moves on boot, and nothing deletes the old copy first.
5. Where IndexedDB is absent, blocked, or refuses a write, the Company file is written to the old
   key as before. The save fails, with the storage toast, only when both places refuse.
6. The save of a hidden or unfocused tab writes the old key synchronously in the same turn, then
   writes the database, and removes the key when the database write commits. A page that closes in
   between leaves the newest Company under the key.
7. A Company with a copy in each place opens the one saved at the later sim time, the `time` field
   every Company file carries. The key wins a tie.
8. A write whose commit removes the key asks for `strict` durability, because it leaves a single
   copy. The plain autosave asks for `relaxed`: the next one replaces it five seconds later.

Considered options:

- **Move every Company on boot.** Rejected: boot would wait on a database, and a failure halfway
  would need its own recovery. Moving on save reuses the write the game already makes.
- **Trust the IndexedDB write on blur.** Rejected: the browser promises nothing about it, and the
  cost is the last seconds of play on every tab close.
- **Write the old key on every autosave as well.** Rejected: it keeps the blocking write and the
  quota problem this decision removes. The synchronous write happens only when the tab is leaving.
- **`strict` durability on every save.** Rejected: it flushes the disk every five seconds for a
  record the next autosave replaces.

## Consequences

- The five-second autosave leaves the main thread, and a Company's size counts against the
  IndexedDB quota instead of the `localStorage` one.
- A blur still pays one synchronous write of the whole file. If the `localStorage` quota is full,
  that write fails quietly and the database write stands alone, as it would for any autosave.
- `LoadCompany`, `WriteCompany`, `DeleteCompany`, and `PruneSaves` are asynchronous. A second save
  can start before the first commits, so each write of a Company is numbered, and an older write
  that finishes late neither removes a newer copy under the key nor lands over it.
- A database that refuses a read is not a missing file. `LoadCompany` answers `CompanyUnread`, the
  Company keeps its row, and the player is asked to try again.
- A pruned list removes a Company's record from both places. A Company founded since the list was
  read is skipped, because that prune's list is older than the Company.
- The test run has no IndexedDB. Tests pass an in-memory `CompanyDb`, and the Commands take the
  fallback path there.
- A browser that clears site data removes both places together, as before.
