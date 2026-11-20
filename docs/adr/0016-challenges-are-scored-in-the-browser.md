# Challenges are scored in the browser

A Challenge is scored in the browser only. The page sends no Replay, reads no histograms, and the
result card shows the run's own scores. A Challenge has no RPC group, no handlers, no `ResultStore`,
and no `results` table.

A server that re-ran every Replay would need a D1 table, replay CPU on the Worker, and a version
rule. Without accounts, that layer adds little. A device ID is a random string in `localStorage`, so
clearing storage makes a new player and a modified client can submit as many Replays as it likes.
With few players, a percentile means little. Each Simulation commit also starts a new histogram, so
results never accumulate.

The Replay format, the replay codec, and the verifier in `packages/simulation` stay, because a server
that verifies a user's best needs them.

## Consequences

- The `histogram` and `pareto` Achievements need percentiles, so they are not part of the game. A
  save that holds one does not decode, which is accepted.
- The D1 database keeps the name `Results` and holds only the Exit survey.
