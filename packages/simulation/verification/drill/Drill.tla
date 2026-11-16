---------------------------- MODULE Drill ----------------------------
(* The DR drill (drill-machine.ts), ticked each Step by ipo.ts `advanceDrill`. `elapsed` counts
   Steps since the drill began; LIMIT is DRILL_SECONDS + DRILL_RTO. `Timeout` = FALSE is a broken
   variant with the timeout guard removed. *)
EXTENDS Naturals

CONSTANTS LIMIT, Timeout
VARIABLES phase, elapsed, reason
vars == <<phase, elapsed, reason>>

Init == phase = "Running" /\ elapsed = 0 /\ reason = "none"

\* Ticked: errors under 1% recover the drill; at the limit it fails. Other phases ignore the tick.
Tick(low) ==
  /\ phase = "Running" /\ elapsed' = elapsed + 1
  /\ IF low THEN phase' = "Recovered" /\ reason' = reason
     ELSE IF Timeout /\ elapsed' >= LIMIT THEN phase' = "Failed" /\ reason' = "timeout"
     ELSE phase' = "Running" /\ reason' = reason

Next == Tick(TRUE) \/ Tick(FALSE) \/ (phase # "Running" /\ UNCHANGED vars)
Spec == Init /\ [][Next]_vars
Bounded == elapsed <= LIMIT + 1

\* A drill ends by its limit.
EndsByLimit == phase = "Running" => elapsed < LIMIT
\* A finished drill never changes.
Final == [][phase # "Running" => UNCHANGED vars]_vars
\* The only failure the machine can write is the timeout, so `data-loss` is dead.
NoDataLoss == reason # "data-loss"
=======================================================================
