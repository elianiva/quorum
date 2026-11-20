------------------------------ MODULE WorkBlock ------------------------------
(* One work item's `block` (packages/simulation/src/work-item-machine.ts: Free | Blocked |
   Approved | Held) and what the team does with it (packages/simulation/src/work.ts):
   `advanceTeam` takes an item only when it is `takeable` (not Held, not Blocked), blocks a Free
   item that needs the player's answer, pays work into the item it holds, and then completes every
   Free or Approved item whose `spent` reached `cost`. actions.ts `cancelItem` sends Held,
   `resumeItem` sends Resumed, `approveBlock` sends Approved, and `rushItem` pays Dev Hours in.
   `Unblocked` is declared but nothing sends it, and Later only moves `remindAt`. `cost` is 1, the
   item is assumed to be worked by a team whenever it is takeable, and an unassigned cancel, which
   deletes the item, is outside this model.
   `RushGuard` = "blocked" is the code: `rushItem` refuses a Blocked or Held item. "all" is the old
   code, which refused only a Spike and allowed a Held item to be paid and then finished. *)
EXTENDS Naturals

CONSTANT RushGuard   \* "blocked" is the code; "all" drops the refusal

VARIABLES block, spent, rushed, done, assigned, pool
vars == <<block, spent, rushed, done, assigned, pool>>

Init ==
  /\ block = "Free"
  /\ spent = 0
  /\ rushed = 0
  /\ done = 0
  /\ assigned = FALSE
  /\ pool = TRUE

\* work.ts `advanceTeam`: a team takes a takeable item (not Held, not Blocked).
Assign ==
  /\ ~assigned
  /\ (block = "Free" \/ block = "Approved")
  /\ assigned' = TRUE
  /\ UNCHANGED <<block, spent, rushed, done, pool>>

\* work.ts `advanceTeam`: a Free item that needs an answer becomes Blocked before any work.
Block ==
  /\ block = "Free" /\ spent = 0
  /\ block' = "Blocked"
  /\ UNCHANGED <<spent, rushed, done, assigned, pool>>

\* actions.ts `approveBlock`.
Approve ==
  /\ block = "Blocked"
  /\ block' = "Approved"
  /\ UNCHANGED <<spent, rushed, done, assigned, pool>>

\* actions.ts `cancelItem`: it holds an item a team has, and the team lets go of it.
Hold ==
  /\ assigned
  /\ block # "Held"
  /\ block' = "Held"
  /\ assigned' = FALSE
  /\ UNCHANGED <<spent, rushed, done, pool>>

\* actions.ts `resumeItem`.
Resume ==
  /\ block = "Held"
  /\ block' = "Free"
  /\ UNCHANGED <<spent, rushed, done, assigned, pool>>

\* work.ts `advanceTeam`: the team pays work into the item it holds.
Work ==
  /\ assigned
  /\ (block = "Free" \/ block = "Approved")
  /\ spent = 0
  /\ spent' = 1
  /\ UNCHANGED <<block, rushed, done, assigned, pool>>

\* actions.ts `rushItem`: Dev Hours pay the item, and `game.devHours` must hold at least 0.01.
Rush ==
  /\ (RushGuard = "all" \/ block \in {"Free", "Approved"})
  /\ spent = 0
  /\ pool
  /\ spent' = 1
  /\ rushed' = 1
  /\ UNCHANGED <<block, done, assigned, pool>>

\* work.ts `advanceTeam`: every Free or Approved item at `spent = cost` is completed.
Finish ==
  /\ spent = 1 /\ done = 0
  /\ (block = "Free" \/ block = "Approved")
  /\ done' = 1
  /\ UNCHANGED <<block, spent, rushed, assigned, pool>>

Next == Assign \/ Block \/ Approve \/ Hold \/ Resume \/ Work \/ Rush \/ Finish
Spec == Init /\ [][Next]_vars

\* ---- Rules ----
\* A Held item is never rushed or worked.
HeldNeverWorked == [][ block = "Held" => (spent' = spent /\ rushed' = rushed) ]_vars
\* A Blocked item never finishes.
BlockedNeverFinishes == [][ block = "Blocked" => done' = done ]_vars
\* Only an Approved or Free item can finish.
OnlyApprovedOrFreeFinishes == [][ (done' > done) => block \in {"Free", "Approved"} ]_vars
============================================================================
