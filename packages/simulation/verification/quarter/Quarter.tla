---------------------------- MODULE Quarter ----------------------------
(* The quarter's state (quarter-machine.ts), written by actions.ts `advanceEra` at the IPO
   (Started, via quarters.ts `firstQuarter`), actions.ts `setGuidance` (GuidanceSet), and
   quarters.ts `advanceQuarter` (Ended, once every 7 days). `Reopen` = TRUE is the code: a new
   quarter opens guidance again (10-progression.md); FALSE removes the guard. *)
EXTENDS Naturals

CONSTANT Reopen
VARIABLES phase, index, opened
vars == <<phase, index, opened>>

Init == phase = "NotStarted" /\ index = 0 /\ opened = FALSE

\* firstQuarter: the IPO opens the first quarter with guidance.
Start == /\ phase = "NotStarted" /\ phase' = "AwaitingGuidance" /\ index' = 1 /\ opened' = TRUE

\* setGuidance: refused unless the phase is AwaitingGuidance.
SetGuidance ==
  /\ phase = "AwaitingGuidance"
  /\ phase' = "Running"
  /\ UNCHANGED <<index, opened>>

\* advanceQuarter: the Ended event moves a started quarter to the next one.
QuarterEnds ==
  /\ phase \in {"AwaitingGuidance", "Running"}
  /\ index' = index + 1
  /\ phase' = IF Reopen THEN "AwaitingGuidance" ELSE "Running"
  /\ opened' = (phase' = "AwaitingGuidance")

Next == Start \/ SetGuidance \/ QuarterEnds
Spec == Init /\ [][Next]_vars
Bounded == index <= 3

\* The player can set guidance at the start of every quarter (10-progression.md).
GuidanceOpensEachQuarter == phase # "NotStarted" => opened
=======================================================================
