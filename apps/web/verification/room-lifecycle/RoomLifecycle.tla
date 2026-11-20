---------------------------- MODULE RoomLifecycle ----------------------------
(* A Room's lifecycle (apps/backend/src/contexts/room/room-lifecycle-machine.ts: Live,
   Abandoned, Idle, Ended) as its callers write it. room.ts `openRoom` opens it Idle at the wall
   clock; `join` and `watching` send Joined, so a rejoin from Abandoned or Idle makes it Live;
   `leave` sends Emptied when the last seat goes and Joined otherwise; `resting` sends Emptied for
   a Room with no seat and Abandoned for a Live Room that still holds seats and has no socket
   (room-object.ts `stop`); `expired` treats Idle and Abandoned alike; `ballot` sends Ended when
   an exit vote passes. room-object.ts `fetch` opens a socket, `hello` joins or rejoins a seat,
   `part` leaves (and `rest` closes every socket), `alarm` clears an expired Room, steps a Live
   Room with a socket or calls `stop`, and `handOver` and `takeOffline` clear the Room.
   `seats` counts seats and `sockets` the sockets the object has attached. `Wake` is a Durable
   Object restart: `storedRoom` brings the saved Room and its seats back, and `getWebSockets()` is
   empty until the clients reconnect. `Expired` stands for `now - since > ROOM_IDLE_MS`, one Tick.
   `SeatGuard` selects `resting`: "abandoned" sends Abandoned for a Live Room that still holds
   seats and has no socket, "idle" sends Emptied, and "none" leaves the lifecycle unchanged.
   `Cleanup` = "stop" clears an Ended Room with no socket; "none" leaves it to the alarm.
   The vote's ballots and the game itself are outside this model, and `steps`, `vote`, `revivals`
   and `rests` stop at one: the model checks the first Step, the first vote, the first revival and
   the first `stop` of each behaviour. *)
EXTENDS Naturals

CONSTANT SeatGuard   \* "abandoned" is the code; "idle" and "none" remove one branch
CONSTANT Cleanup     \* "stop" is the code; "none" leaves cleanup to the alarm

VARIABLES phase, seats, sockets, since, now, exists, steps, vote, revivals, rests
vars == <<phase, seats, sockets, since, now, exists, steps, vote, revivals, rests>>

Expired == phase \in {"Idle", "Abandoned"} /\ now > since

Init ==
  /\ phase = "Idle"        \* openRoom: a published Room is Idle, empty, with no socket
  /\ seats = 0
  /\ sockets = 0
  /\ since = 0
  /\ now = 0
  /\ exists = TRUE
  /\ steps = 0
  /\ vote = FALSE
  /\ revivals = 0
  /\ rests = 0

\* Wall time passes, so `since` can be told apart from the moment a Room was rested.
Tick ==
  /\ now < 1
  /\ now' = now + 1
  /\ UNCHANGED <<phase, seats, sockets, since, exists, steps, vote, revivals, rests>>

\* room-object.ts constructor: the object restarts and restores the saved Room. No socket is
\* attached until the clients say Hello again, and the alarm clears an Ended Room.
Wake ==
  /\ exists /\ sockets > 0
  /\ sockets' = 0
  /\ exists' = IF phase = "Ended" THEN (Cleanup = "none") ELSE TRUE
  /\ UNCHANGED <<phase, seats, since, now, steps, vote, revivals, rests>>

\* room-object.ts `fetch`: a socket opens, unless the Room has ended.
Connect ==
  /\ exists /\ phase # "Ended" /\ sockets < 1
  /\ sockets' = sockets + 1
  /\ UNCHANGED <<phase, seats, since, now, exists, steps, vote, revivals, rests>>

\* room.ts `join` and `watching`: a player takes a seat in an empty Room and Joined makes it Live.
\* An expired Room refuses the join ('stale').
Join ==
  /\ exists /\ phase # "Ended" /\ sockets > 0 /\ seats = 0 /\ ~Expired
  /\ seats' = 1 /\ phase' = "Live"
  /\ UNCHANGED <<sockets, since, now, exists, steps, vote, revivals, rests>>

\* room.ts `join` and `watching`: a seated player comes back, and Joined from Abandoned makes the
\* Room Live again.
Rejoin ==
  /\ exists /\ phase \in {"Idle", "Abandoned"} /\ sockets > 0 /\ seats = 1 /\ ~Expired
  /\ phase' = "Live"
  /\ UNCHANGED <<seats, sockets, since, now, exists, steps, vote, revivals, rests>>

\* room.ts `leave` (from `part`, `kick` and `enter`) plus room-object.ts `rest`: the last seat out
\* closes every socket, sends Emptied at the wall clock, and `part` calls `stop` in the same
\* handler.
Leave ==
  /\ exists /\ seats = 1
  /\ seats' = 0
  /\ phase' = IF phase = "Ended" THEN "Ended" ELSE "Idle"
  /\ since' = IF phase' = "Idle" THEN now ELSE since
  /\ sockets' = 0
  /\ exists' = IF phase' = "Ended" THEN (Cleanup = "none") ELSE TRUE
  /\ UNCHANGED <<now, steps, vote, revivals, rests>>

\* room-object.ts `alarm` and `info`: an Idle or Abandoned Room past its date is cleared, which
\* frees its slot.
Expire ==
  /\ exists /\ Expired
  /\ exists' = FALSE
  /\ UNCHANGED <<phase, seats, sockets, since, now, steps, vote, revivals, rests>>

\* room-object.ts `alarm`: a Live Room with a socket advances the Game by one Step.
Step ==
  /\ exists /\ phase = "Live" /\ sockets > 0 /\ steps < 1
  /\ steps' = steps + 1
  /\ UNCHANGED <<phase, seats, sockets, since, now, exists, vote, revivals, rests>>

\* room-object.ts `stop`, the non-Ended part, reached from `alarm` (no socket, or not Live) and
\* from `part` after the last seat leaves. room.ts `resting` sends Emptied for a Room with no seat
\* and Abandoned for a Live Room that still holds one; resting an Idle or Abandoned Room changes
\* nothing.
Rest ==
  /\ exists /\ phase # "Ended"
  /\ (phase # "Live" \/ sockets = 0)
  /\ rests < 1
  /\ \/ /\ phase = "Live" /\ seats = 0
        /\ phase' = "Idle" /\ since' = now
        /\ UNCHANGED <<seats, sockets, now, exists, steps, vote, revivals>>
     \/ /\ phase = "Live" /\ seats > 0 /\ SeatGuard = "abandoned"
        /\ phase' = "Abandoned" /\ since' = now
        /\ UNCHANGED <<seats, sockets, now, exists, steps, vote, revivals>>
     \/ /\ phase = "Live" /\ seats > 0 /\ SeatGuard = "idle"
        /\ phase' = "Idle" /\ since' = now
        /\ UNCHANGED <<seats, sockets, now, exists, steps, vote, revivals>>
     \/ /\ phase = "Live" /\ seats > 0 /\ SeatGuard = "none"
        /\ UNCHANGED <<phase, seats, sockets, since, now, exists, steps, vote, revivals>>
     \/ /\ phase # "Live"
        /\ UNCHANGED <<phase, seats, sockets, since, now, exists, steps, vote, revivals>>
  /\ rests' = rests + 1

\* room-object.ts `stop`, the whole of it: an Ended Room with no socket is cleared, and the rest
\* of `stop` goes through `Rest`.
Stop ==
  /\ exists
  /\ (phase # "Live" \/ sockets = 0)
  /\ \/ Rest
     \/ /\ phase = "Ended" /\ sockets = 0 /\ Cleanup = "stop"
        /\ exists' = FALSE
        /\ UNCHANGED <<phase, seats, sockets, since, now, steps, vote, revivals, rests>>
     \/ /\ phase = "Ended" /\ ~(sockets = 0 /\ Cleanup = "stop")
        /\ UNCHANGED vars

\* room-object.ts `startVote`: a vote opens only in a Live Room that holds a seat.
StartVote ==
  /\ exists /\ phase = "Live" /\ seats > 0 /\ ~vote
  /\ vote' = TRUE
  /\ UNCHANGED <<phase, seats, sockets, since, now, exists, steps, revivals, rests>>

\* room-object.ts `ballot`: a passing exit vote sends Ended.
ExitPasses ==
  /\ exists /\ phase = "Live" /\ vote /\ seats > 0
  /\ phase' = "Ended" /\ vote' = FALSE
  /\ UNCHANGED <<seats, sockets, since, now, exists, steps, revivals, rests>>

\* room-object.ts `handOver` and `takeOffline`: the object clears its state. The owner's socket
\* stays open, so clearing does not wait for it.
Clear ==
  /\ exists
  /\ exists' = FALSE
  /\ UNCHANGED <<phase, seats, sockets, since, now, steps, vote, revivals, rests>>

\* The machine's declared revival (nothing in the code sends Revived).
Revive ==
  /\ exists /\ phase \in {"Idle", "Abandoned", "Ended"}
  /\ phase' = "Live"
  /\ revivals' = revivals + 1
  /\ UNCHANGED <<seats, sockets, since, now, exists, steps, vote, rests>>

Next ==
  \/ Tick \/ Wake \/ Connect \/ Join \/ Rejoin \/ Leave \/ Expire
  \/ Step \/ Stop \/ StartVote \/ ExitPasses \/ Clear \/ Revive
Spec == Init /\ [][Next]_vars

Bounded == now <= 1 /\ revivals <= 1 /\ rests <= 1

\* ---- Rules ----
\* An Idle Room has nobody in it.
IdleIsEmpty == phase = "Idle" => seats = 0
\* An Abandoned Room still holds the seats it was abandoned with.
AbandonedIsSeated == phase = "Abandoned" => seats > 0
\* A Room becomes Idle at the time its last seat leaves.
EmptyBecomesIdle ==
  [][ (phase \in {"Live", "Abandoned"} /\ seats > 0 /\ seats' = 0) =>
        (phase' = "Idle" /\ since' = now) ]_vars
\* An Idle Room never steps the Game and never opens a vote.
IdleNeverActs ==
  [][ phase = "Idle" => (steps' = steps /\ vote' = vote /\ phase' \in {"Idle", "Live"}) ]_vars
\* An Abandoned Room never steps the Game and never opens a vote.
AbandonedNeverActs ==
  [][ phase = "Abandoned" =>
        (steps' = steps /\ vote' = vote /\ phase' \in {"Abandoned", "Idle", "Live"}) ]_vars
\* Resting a Live Room never leaves it Live: a Room with seats and no socket moves to Abandoned
\* or Idle, so its expiry can free the slot.
RestLeavesLive == [][ (rests' > rests /\ phase = "Live") => phase' # "Live" ]_vars
\* An Ended Room never moves, except through the declared revival.
EndedStays ==
  [][ phase = "Ended" =>
        /\ phase' \in {"Ended", "Live"}
        /\ (phase' = "Live" => revivals' > revivals)
        /\ steps' = steps
        /\ vote' = vote
        /\ seats' <= seats ]_vars
\* An Ended Room is cleaned up when no socket remains.
EndedCleansUp == [][ (phase = "Ended" /\ sockets > 0 /\ sockets' = 0) => exists' = FALSE ]_vars
=====================================================================
