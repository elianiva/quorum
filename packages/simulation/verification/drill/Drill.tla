---------------------------- MODULE Drill ----------------------------
(* The DR drill (drill-machine.ts), ticked each Step by ipo.ts `advanceDrill`. `elapsed` counts
   Steps since the drill began; LIMIT is DRILL_SECONDS + DRILL_RTO. The model follows one attempt
   from Idle: a drill started again after one finishes, and the audit Incident that resets one
   (director.ts), are new attempts and outside this model. `Timeout` = FALSE removes the limit,
   a negative control. *)
EXTENDS Naturals

CONSTANTS LIMIT, Timeout
VARIABLES phase, elapsed, reason
vars == <<phase, elapsed, reason>>

Init == phase = "Idle" /\ elapsed = 0 /\ reason = "none"

\* runDrill: a drill starts only from Idle.
Start == phase = "Idle" /\ phase' = "Running" /\ UNCHANGED <<elapsed, reason>>

\* Ticked: errors under 1% recover the drill; at the limit it fails. Other phases ignore the tick.
Tick(low) ==
  /\ phase = "Running" /\ elapsed' = elapsed + 1
  /\ IF low THEN phase' = "Recovered" /\ reason' = reason
     ELSE IF Timeout /\ elapsed' >= LIMIT THEN phase' = "Failed" /\ reason' = "timeout"
     ELSE phase' = "Running" /\ reason' = reason

Done == phase \in {"Recovered", "Failed"} /\ UNCHANGED vars

Next == Start \/ Tick(TRUE) \/ Tick(FALSE) \/ Done
Spec == Init /\ [][Next]_vars
Bounded == elapsed <= LIMIT + 1

\* A drill ends by its limit.
EndsByLimit == phase = "Running" => elapsed < LIMIT
\* A finished drill never changes.
Finished == phase \in {"Recovered", "Failed"}
Final == [][Finished => UNCHANGED vars]_vars
\* The only failure the machine can write is the timeout, so `data-loss` is dead.
NoDataLoss == reason # "data-loss"
=======================================================================
