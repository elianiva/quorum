------------------------------ MODULE RoomVote ------------------------------
(* A Room's vote (packages/simulation/src/vote-machine.ts: `RoomVote = Idle | Open { vote }` with
   `Opened`, `Balloted` and `Closed`; the machine keeps Open on Balloted and has no handler for a
   second Opened) as its callers move it. apps/backend/src/contexts/room/room.ts `startVote` sends
   Opened and refuses while a vote is open; `ballot` sends Balloted while the vote does not pass,
   and Closed when it passes, when it is an exit, when the deadline has gone and when `raise` or
   `decline` refuses; `leave` sets the vote to Idle when the last seat goes; `advance` sends Closed
   when `game.time` reaches `closesAt`. room-object.ts routes `startVote` and `ballot` and gates
   them with `openVoteOf` and the open vote's id. apps/web/src/game/update/room.ts projects the
   wire `Vote | null` into `RoomVote` (`roomVoteOf`); like the wire, that is outside this model.
   `phase` and `seats` are the Room lifecycle's, so "only a Live Room with a seat opens a vote"
   means something; the exit's Room end (`stepLifecycle` Ended, then `handOver`) is
   RoomLifecycle's, and this model stops at Closed. `votePasses` and the Game's answer are outside
   the model: `Pass` and `FailedAnswer` are the two ways a passing fund or decline vote ends.
   `leave` closes the vote when the last seat goes, so an Idle Room never carries an Open vote;
   `seats` stops at one, so every Leave is the last seat. A leave that keeps a seat drops that
   seat's ballot through Balloted, which this one-seat model does not need.
   `AllowSecondOpen` = FALSE is the code: `startVote` refuses while a vote is open. TRUE drops
   that guard, so a second Opened reaches the machine, which ignores it, and `SecondOpenRefused`
   breaks. `CloseOnLeave` = "close" is the code: `leave` sets the vote to Idle when the last seat
   goes. "none" keeps it Open, so `NoOpenVoteWhenIdle` breaks. *)
EXTENDS Naturals

CONSTANTS AllowSecondOpen, CloseOnLeave

VARIABLES phase, seats, vote, kind, opens, ballots, lastClose
vars == <<phase, seats, vote, kind, opens, ballots, lastClose>>

Init ==
  /\ phase = "Idle"
  /\ seats = 0
  /\ vote = "Idle"
  /\ kind = "none"
  /\ opens = 0
  /\ ballots = 0
  /\ lastClose = "none"

\* room.ts `join` and `watching`: a seat joins and the Room is Live.
Join ==
  /\ phase = "Idle" /\ seats = 0
  /\ phase' = "Live" /\ seats' = 1
  /\ UNCHANGED <<vote, kind, opens, ballots, lastClose>>

\* room.ts `leave`: the last seat goes, the Room turns Idle, and the vote goes with it.
Leave ==
  /\ seats = 1
  /\ seats' = 0 /\ phase' = "Idle"
  /\ vote' = IF CloseOnLeave = "none" THEN vote ELSE "Idle"
  /\ kind' = IF CloseOnLeave = "none" THEN kind ELSE "none"
  /\ UNCHANGED <<opens, ballots, lastClose>>

\* room.ts `startVote`, then the machine's Opened: only a Live Room with a seat starts one, and
\* only when no vote is open. A second Opened is ignored by the machine.
Open(k) ==
  /\ phase = "Live" /\ seats > 0 /\ opens < 2
  /\ (AllowSecondOpen \/ vote = "Idle")
  /\ opens' = opens + 1
  /\ vote' = IF vote = "Idle" THEN "Open" ELSE vote
  /\ kind' = IF vote = "Idle" THEN k ELSE kind
  /\ lastClose' = IF vote = "Idle" THEN "none" ELSE lastClose
  /\ UNCHANGED <<phase, seats, ballots>>

\* room.ts `ballot`: a ballot that does not pass is Balloted, and the vote stays open.
Ballot ==
  /\ vote = "Open" /\ seats > 0 /\ ballots < 2
  /\ ballots' = ballots + 1
  /\ UNCHANGED <<phase, seats, vote, kind, opens, lastClose>>

\* room.ts `ballot`: the fund or decline vote passes and its answer lands.
Pass ==
  /\ vote = "Open" /\ seats > 0 /\ kind # "exit" /\ ballots < 2
  /\ ballots' = ballots + 1
  /\ vote' = "Idle" /\ lastClose' = "pass"
  /\ UNCHANGED <<phase, seats, kind, opens>>

\* room.ts `ballot`: the exit vote passes, so Closed (the Room then ends through RoomLifecycle).
Exit ==
  /\ vote = "Open" /\ seats > 0 /\ kind = "exit" /\ ballots < 2
  /\ ballots' = ballots + 1
  /\ vote' = "Idle" /\ lastClose' = "exit"
  /\ UNCHANGED <<phase, seats, kind, opens>>

\* room.ts `ballot`: the vote passes but `raise` or `decline` refuses, so it closes without an
\* answer.
FailedAnswer ==
  /\ vote = "Open" /\ seats > 0 /\ kind # "exit" /\ ballots < 2
  /\ ballots' = ballots + 1
  /\ vote' = "Idle" /\ lastClose' = "failed"
  /\ UNCHANGED <<phase, seats, kind, opens>>

\* room.ts `advance`, and `ballot` when the deadline has gone: Closed.
Lapse ==
  /\ vote = "Open" /\ phase = "Live"
  /\ vote' = "Idle" /\ lastClose' = "lapse"
  /\ UNCHANGED <<phase, seats, kind, opens, ballots>>

Next ==
  \/ Join \/ Leave \/ Ballot \/ Pass \/ Exit \/ FailedAnswer \/ Lapse
  \/ \E k \in {"fund", "exit"} : Open(k)
Spec == Init /\ [][Next]_vars

Bounded == opens <= 2 /\ ballots <= 2

\* ---- Rules ----
\* Only a Live Room with a seat opens a vote.
OpenNeedsLiveSeat == [][ (opens' > opens) => (phase = "Live" /\ seats > 0) ]_vars
\* A second open is refused: no Opened reaches the machine while a vote is open.
SecondOpenRefused == [][ (opens' > opens) => vote = "Idle" ]_vars
\* Only an Open vote accepts a ballot.
BallotNeedsOpen == [][ (ballots' > ballots) => vote = "Open" ]_vars
\* A passing ballot closes the vote.
PassCloses == [][ (lastClose' = "pass") => vote' = "Idle" ]_vars
\* A passing exit closes the vote.
ExitCloses == [][ (lastClose' = "exit") => vote' = "Idle" ]_vars
\* A lapse closes the vote.
LapseCloses == [][ (lastClose' = "lapse") => vote' = "Idle" ]_vars
\* A refused raise or decline closes the vote.
FailedAnswerCloses == [][ (lastClose' = "failed") => vote' = "Idle" ]_vars
\* An Idle Room carries no Open vote.
NoOpenVoteWhenIdle == phase = "Idle" => vote = "Idle"
\* An Open vote always carries its Vote.
OpenHasVote == vote = "Idle" \/ kind # "none"
===========================================================================
