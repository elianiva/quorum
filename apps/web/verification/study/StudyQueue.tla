---------------------------- MODULE StudyQueue ----------------------------
(* The Study queue (packages/simulation/src/study-machine.ts: `StudyQueue`,
   `studyQueueMachine`, `phaseStep`, `queueStep`) as `advanceStudies` in studies.ts moves it: it
   cancels the Studies whose Research is already in `researched` (Drop), ticks only the head
   (Tick) and sends Finished when the head reaches 1. actions.ts `study` sends Added with the
   prerequisites the queue is missing, `moveStudyTo` sends Moved, and `cancelStudy` sends
   Cancelled for the id and every queued Study that needs it (`needs` in lookups.ts).
   The queue holds up to three Research: a, b that needs a, and c that needs nothing. A Study is
   Queued until Tick marks it Running; the model leaves out progress values, the Insight pools,
   the stall checks, the booster and the Step events.
   `Merge` = "id" is the code: Added drops the ids it brings from the queue before it inserts.
   "none" drops that merge, a negative control. *)

EXTENDS Naturals, FiniteSets, Sequences

CONSTANT Merge     \* "id" is the code; "none" drops the merge

VARIABLES q, tag, ticked, cancelled, cancels, finished
vars == <<q, tag, ticked, cancelled, cancels, finished>>

Ids == {"a", "b", "c"}

\* lookups.ts `needs`: b requires a; c requires nothing.
Needs(x, y) == x = "b" /\ y = "a"

\* actions.ts `study`: the prerequisites the Game is missing, then the id.
Chain(id) == IF Needs(id, "a") THEN <<"a", id>> ELSE <<id>>

Has(seq, id) == \E i \in 1..Len(seq) : seq[i] = id

RECURSIVE Remove(_, _)
Remove(seq, ids) ==
  IF Len(seq) = 0 THEN <<>>
  ELSE IF Head(seq) \in ids THEN Remove(Tail(seq), ids)
  ELSE <<Head(seq)>> \o Remove(Tail(seq), ids)

Index(id) == CHOOSE i \in 1..Len(q) : q[i] = id

\* moveStudy: swap one entry with its neighbour.
Swap(i) == [j \in 1..Len(q) |-> IF j = i THEN q[i + 1] ELSE IF j = i + 1 THEN q[i] ELSE q[j]]

Tag(s) == IF Len(s) = 0 THEN "Empty" ELSE "Working"

Init ==
  /\ q = <<>>
  /\ tag = "Empty"
  /\ ticked = "none"
  /\ cancelled = "none"
  /\ cancels = 0
  /\ finished = 0

\* The machine's `insert` and `remove` branches both pick Empty or Working from what is left, so
\* the tag follows the length. actions.ts `study` / `filePostmortem`: Added with the missing
\* prerequisites. `first` puts the chain at the head.
Add(id, first) ==
  /\ (~Has(q, id) \/ first)
  /\ LET chain == Chain(id)
         held == {x \in Ids : Has(q, x)}
         fresh == Remove(chain, held)
         added == IF first THEN chain ELSE fresh
         kept == Remove(q, {x \in Ids : Has(added, x)})
     IN q' = IF Merge = "id"
             THEN (IF first THEN added \o kept ELSE kept \o added)
             ELSE (IF first THEN chain \o q ELSE q \o added)
  /\ tag' = Tag(q')
  /\ UNCHANGED <<ticked, cancelled, cancels, finished>>

\* studies.ts `advanceStudies`: only the head Study ticks, and only while it is Running.
Tick ==
  /\ Len(q) > 0
  /\ ticked' = q[1]
  /\ UNCHANGED <<q, tag, cancelled, cancels, finished>>

\* studies.ts `advanceStudies`: Finished takes the head, and only the head.
Finish ==
  /\ Len(q) > 0 /\ ticked = q[1] /\ finished < 1
  /\ q' = Tail(q)
  /\ tag' = Tag(q')
  /\ finished' = finished + 1
  /\ UNCHANGED <<ticked, cancelled, cancels>>

\* actions.ts `cancelStudy`: the id and every queued Study that needs it.
Cancel(id) ==
  /\ Has(q, id)
  /\ q' = Remove(q, {x \in Ids : x = id \/ Needs(x, id)})
  /\ tag' = Tag(q')
  /\ cancelled' = IF id = "a" THEN "a" ELSE "none"
  /\ cancels' = cancels + 1
  /\ UNCHANGED <<ticked, finished>>

\* studies.ts `advanceStudies`: it cancels the ids already in `researched`, and only those ids, so
\* a queued Study that needs one of them stays.
Drop(id) ==
  /\ Has(q, id)
  /\ q' = Remove(q, {id})
  /\ tag' = Tag(q')
  /\ UNCHANGED <<ticked, cancelled, cancels, finished>>

\* actions.ts `moveStudy`: one step up or down, refused when the Study it crosses is one it needs.
MoveUp(id) ==
  /\ Has(q, id) /\ Index(id) > 1
  /\ ~Needs(id, q[Index(id) - 1])
  /\ q' = Swap(Index(id) - 1)
  /\ UNCHANGED <<tag, ticked, cancelled, cancels, finished>>

MoveDown(id) ==
  /\ Has(q, id) /\ Index(id) < Len(q)
  /\ ~Needs(q[Index(id) + 1], id)
  /\ q' = Swap(Index(id))
  /\ UNCHANGED <<tag, ticked, cancelled, cancels, finished>>

Next ==
  \/ \E id \in Ids : Add(id, FALSE) \/ Add(id, TRUE) \/ Cancel(id) \/ Drop(id)
  \/ \E id \in Ids : MoveUp(id) \/ MoveDown(id)
  \/ Tick \/ Finish
Spec == Init /\ [][Next]_vars

\* ---- Rules ----
\* The queue never holds the same Research twice.
NoDuplicates == Cardinality({q[i] : i \in 1..Len(q)}) = Len(q)
\* Working always has a current Study.
WorkingHasStudy == tag = "Working" => Len(q) > 0
\* Only the current Study ticks.
OnlyCurrentTicks == [][ (Len(q) > 0 /\ ticked' # ticked) => ticked' = q[1] ]_vars
\* Finished removes only the current Study.
FinishedTakesCurrent == [][ (finished' > finished) => (Len(q) > 0 /\ q' = Tail(q)) ]_vars
\* Cancelling a prerequisite removes the queue children the code removes, and keeps the rest.
CancelTakesChildren ==
  [][ (cancels' > cancels /\ cancelled' = "a")
      => (~Has(q', "b") /\ (Has(q, "c") => Has(q', "c"))) ]_vars

Bounded == Len(q) <= 3 /\ cancels <= 1
==========================================================================
