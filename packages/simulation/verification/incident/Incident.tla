---------------------------- MODULE Incident ----------------------------
(* The running Incident's phase (incident-machine.ts), moved by director.ts `markSignal` and
   `advanceIncident` (Signalled, and Acked by on-call) and actions.ts `acknowledge` (Acked by any
   player action). `Resolved` is director.ts `resolve`. `NONE` stands for no time recorded. *)
EXTENDS Naturals

VARIABLES phase, signalAt, ackAt, now
vars == <<phase, signalAt, ackAt, now>>
NONE == 9

Init == phase = "Quiet" /\ signalAt = NONE /\ ackAt = NONE /\ now = 0

Time == /\ now < 3 /\ now' = now + 1 /\ UNCHANGED <<phase, signalAt, ackAt>>

\* markSignal runs only while no signal is recorded.
Signalled ==
  /\ signalAt = NONE
  /\ signalAt' = now
  /\ phase' = CASE phase = "Quiet" -> "Announced"
                [] phase = "Responded" -> "Acknowledged"
  /\ UNCHANGED <<ackAt, now>>

\* `acknowledge` and the on-call rotation can send Acked at any time; the machine ignores it
\* once an ack is recorded.
Acked ==
  /\ ackAt = NONE
  /\ ackAt' = now
  /\ phase' = CASE phase = "Quiet" -> "Responded"
                [] phase = "Announced" -> "Acknowledged"
  /\ UNCHANGED <<signalAt, now>>

Resolved == phase' = "Quiet" /\ signalAt' = NONE /\ ackAt' = NONE /\ UNCHANGED now

Next == Time \/ Signalled \/ Acked \/ Resolved
Spec == Init /\ [][Next]_vars

\* ---- Rules ----
PhaseMatchesTimes ==
  /\ (phase = "Quiet") => (signalAt = NONE /\ ackAt = NONE)
  /\ (phase = "Announced") => (signalAt # NONE /\ ackAt = NONE)
  /\ (phase = "Responded") => (signalAt = NONE /\ ackAt # NONE)
  /\ (phase = "Acknowledged") => (signalAt # NONE /\ ackAt # NONE)
\* The first signal and the first ack stay until the Incident ends.
FirstWins == [][ (phase' # "Quiet") => ((signalAt # NONE => signalAt' = signalAt) /\ (ackAt # NONE => ackAt' = ackAt)) ]_vars
=======================================================================
