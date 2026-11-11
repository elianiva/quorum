# A Room sleeps when nobody watches, and the account caps how many run

A Room costs Durable Object duration for every second its alarm runs. The alarm runs every 500 ms
while a socket is attached, so a tab left open in the background bills a Room for hours after its
player stopped looking. That is $0.135 per Room per day on the Workers Paid plan, and it spends the
13,000 GB-s the Free plan gives the whole account.

## Decision

1. A tab on screen sends `Ping` every thirty seconds. A hidden tab, a closed tab, and a sleeping
   laptop send nothing.
2. The Room stamps the time of every frame on the socket's attachment. When the alarm finds every
   attached socket silent for two minutes, it saves, deletes the alarm, and stops.
3. The Durable Object hibernates with its sockets still attached. The tab keeps its Seat, and the
   Company stays at the Step it reached.
4. Any frame wakes the object. An Intent re-arms the alarm at once, and a `Ping` does the same
   within thirty seconds.
5. A Room claims one of twelve slots when it is published. The `RoomSlots` object holds the list, so
   two Rooms published at the same moment cannot both take the last slot. A Room gives its slot back
   when it sleeps, ends, or expires.
6. A deploy sets `CPU_LIMIT_MS` to cap the CPU one invocation may spend. The setting stays off until
   then, because the Free plan rejects a custom CPU limit with error 100328.

## Considered options

- **Closing the socket when the tab goes idle.** Rejected: the client reconnects on its backoff
  timer, so every hidden tab would wake the Room every ten seconds for nothing.
- **Holding the slot until the Room expires.** Rejected: a Room that was open for five minutes would
  hold a slot for twenty-four hours, which turns a busy day into "every Room is busy" by lunch.
- **A quota per IP address.** Not built yet: the RPC handler does not see the client address without
  an `effect/http` import that the boundary rules keep out of contexts, and the rate limiter already
  caps create attempts at sixty a minute per address.
- **Refusing a Room that wakes while the slots are full.** Rejected: the player would watch a frozen
  Board. A waking Room holds no slot, so the account can overshoot by the Rooms that come back, and
  each one needs a person to come back.

## Consequences

- A hidden tab freezes its Company and costs nothing. The player who returns sees the Room resume
  with at most one wake of catch-up, which is six seconds of Simulation time.
- Twelve slots bound the bill at about $1.60 a day on the Paid plan. They also stop the account from
  spending its whole daily Durable Object duration in two and a half hours.
- The cap protects the bill, not availability. One person can hold all twelve slots for a day, and
  the next player to go online is told every Room is busy.
- Publishing makes one call to `RoomSlots`, and a Room that sleeps or ends makes another. Both fail
  open: a counter that cannot answer opens the Room, because a counter outage must not stop the game.
