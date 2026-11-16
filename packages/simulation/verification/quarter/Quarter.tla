---------------------------- MODULE Quarter ----------------------------
(* The quarter's phase (quarter-machine.ts), written by actions.ts `setGuidance` (GuidanceSet)
   and quarters.ts `advanceQuarter` (Started, once every 7 days). `Reopen` = TRUE is the code: a new quarter
   opens guidance again (10-progression.md); FALSE is the old code. *)
EXTENDS Naturals

CONSTANT Reopen
VARIABLES phase, index, opened
vars == <<phase, index, opened>>

Init == phase = "AwaitingGuidance" /\ index = 1 /\ opened = TRUE

\* setGuidance: refused unless the phase is AwaitingGuidance.
SetGuidance == /\ phase = "AwaitingGuidance" /\ phase' = "Running" /\ UNCHANGED <<index, opened>>

\* advanceQuarter: the Started event moves AwaitingGuidance to Running and leaves Running alone.
QuarterEnds ==
  /\ index' = index + 1
  /\ phase' = IF Reopen THEN "AwaitingGuidance" ELSE "Running"
  /\ opened' = (phase' = "AwaitingGuidance")

Next == SetGuidance \/ QuarterEnds
Spec == Init /\ [][Next]_vars
Bounded == index <= 3

\* The player can set guidance at the start of every quarter (10-progression.md).
GuidanceOpensEachQuarter == opened
=======================================================================
