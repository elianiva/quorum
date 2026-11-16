---------------------------- MODULE EraRound ----------------------------
(* The funding round (era-round-machine.ts). step.ts writes Offered when `canRaise` holds; actions.ts
   `advanceEra` (raise and decline) writes Raised or Declined and moves to the next Era. `users` is
   a level from 0 to 3; Era `stage` needs level stage + 1 (`raiseAt`). `Check` = TRUE is the code: advanceEra also
   needs round = Offered; FALSE is the old code. *)
EXTENDS Naturals

CONSTANT Check
VARIABLES stage, round, users, last
vars == <<stage, round, users, last>>

CanRaise == stage < 3 /\ users >= stage + 1

Init == stage = 0 /\ round = "Waiting" /\ users = 0 /\ last = "start"

Grow == users < 3 /\ users' = users + 1 /\ UNCHANGED <<stage, round>> /\ last' = "users grow"
Leave == users > 0 /\ users' = users - 1 /\ UNCHANGED <<stage, round>> /\ last' = "users leave"
\* step.ts: the Era's Milestone puts its round on the table.
Offer == CanRaise /\ round # "Offered" /\ round' = "Offered" /\ UNCHANGED <<stage, users>> /\ last' = "round offered"
\* actions.ts advanceEra: checks canRaise only.
Answer(r) == /\ CanRaise /\ (~Check \/ round = "Offered")
             /\ stage' = stage + 1 /\ round' = r /\ UNCHANGED users
             /\ last' = IF round = "Offered" THEN "you answer the offer" ELSE "you answer with no offer"

Next == Grow \/ Leave \/ Offer \/ Answer("Raised") \/ Answer("Declined")
Spec == Init /\ [][Next]_vars

\* A round is answered only when it is on the table (10-progression.md).
AnswerNeedsOffer == [][stage' = stage + 1 => round = "Offered"]_vars
=======================================================================
