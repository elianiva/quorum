# The Company has one player

A Company has one player, who owns it and keeps the Company file. A Room opens it to guest Seats,
and every Seat acts on the same Company ([ADR 0019](./0019-anonymous-multiplayer-rooms.md)).

Considered options: a Company with several owners. Rejected because the core loop must hold alone,
and a shared authority for the Simulation costs more than the game needs.

## Consequences

- The Company Simulation runs in the browser, and in a Room while the Company is online
  ([ADR 0022](./0022-the-company-pauses-when-the-player-leaves.md),
  [ADR 0019](./0019-anonymous-multiplayer-rooms.md)).
- Teams in the game are simulated Engineers, not other players.
