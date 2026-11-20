------------------------------ MODULE Iac ------------------------------
(* `Game.iac` (packages/simulation/src/state.ts: `Iac = NotChosen | Chosen { tool, until, sync }`)
   as packages/simulation/src/mirror.ts moves it. `pickIacTool` goes from NotChosen to Chosen, and
   a switch sets `until = time + IAC_SWITCH_MINUTES` and resets every Mirror's sync to InSync.
   `setSyncMode` needs a tool already chosen (and the `gitops` Research for a mode; the model
   assumes the player has it). `switchLeft` is `max(0, until - time)`. `applyRefusal` is the gate
   in front of `applyMirror` and `advanceMirrors`: no tool, a switch in flight, an Apply landing,
   unread drift and the price all refuse.
   `SwitchGuard` = "time" is the code: an Apply waits for `switchLeft` to reach 0. "none" drops
   that wait, a negative control. The plan itself, the drift, the cash and the price are outside
   this model; `Land` is `advanceMirrors` landing an Apply whose `readyAt` has passed.
   `PickGuard` = "landing" is the code: `pickIacTool` refuses while any Mirror is Applying. "none"
   drops that refusal, which lets a pick reset the Mirror to InSync and lose the Apply. *)
EXTENDS Naturals

CONSTANTS SwitchGuard, PickGuard

VARIABLES chosen, tool, until, time, sync, mirror, readyAt, applies, picks
vars == <<chosen, tool, until, time, sync, mirror, readyAt, applies, picks>>

Tools == {"terraform", "pulumi"}
Modes == {"none", "all", "staged"}

Init ==
  /\ chosen = FALSE
  /\ tool = "terraform"
  /\ until = 0
  /\ time = 0
  /\ sync = "none"
  /\ mirror = "InSync"
  /\ readyAt = 0
  /\ applies = 0
  /\ picks = 0

\* mirror.ts `switchLeft`: minutes left on a tool switch (IAC_SWITCH_MINUTES is a calendar day).
SwitchLeft == IF chosen THEN until - time ELSE 0

\* mirror.ts `pickIacTool`: the tool is refused while a switch is in flight or a Mirror is
\* applying, a switch starts the clock, and every Mirror drops its sync state.
Pick(t) ==
  /\ ~(chosen /\ tool = t)
  /\ SwitchLeft <= 0
  /\ (PickGuard = "none" \/ mirror # "Applying")
  /\ picks < 2
  /\ chosen' = TRUE
  /\ tool' = t
  /\ until' = IF chosen THEN time + 2 ELSE time
  /\ mirror' = "InSync"
  /\ picks' = picks + 1
  /\ UNCHANGED <<time, sync, readyAt, applies>>

\* mirror.ts `setSyncMode`: refused until a tool is chosen.
SetMode(m) ==
  /\ chosen
  /\ sync' = m
  /\ UNCHANGED <<chosen, tool, until, time, mirror, readyAt, applies, picks>>

\* The clock.
Time ==
  /\ time < 2
  /\ time' = time + 1
  /\ UNCHANGED <<chosen, tool, until, sync, mirror, readyAt, applies, picks>>

\* mirror.ts `applyRefusal` then `applyMirror`: an Apply starts only with a tool, no switch in
\* flight and no Apply already landing.
Apply ==
  /\ chosen
  /\ (SwitchGuard = "none" \/ SwitchLeft <= 0)
  /\ mirror # "Applying"
  /\ applies < 2
  /\ mirror' = "Applying"
  /\ readyAt' = time + 2
  /\ applies' = applies + 1
  /\ UNCHANGED <<chosen, tool, until, time, sync, picks>>

\* mirror.ts `advanceMirrors`: an Apply lands once its time has passed.
Land ==
  /\ mirror = "Applying"
  /\ time >= readyAt
  /\ mirror' = "InSync"
  /\ UNCHANGED <<chosen, tool, until, time, sync, readyAt, applies, picks>>

Next ==
  \/ \E t \in Tools : Pick(t)
  \/ \E m \in Modes : SetMode(m)
  \/ Time \/ Apply \/ Land
Spec == Init /\ [][Next]_vars

Bounded == applies <= 2 /\ picks <= 2

\* ---- Rules ----
\* A sync mode can only be set after a tool is chosen.
SyncNeedsTool == sync = "none" \/ chosen
\* A tool switch blocks Apply until its switch time passes.
SwitchBlocksApply == [][ (applies' > applies) => until <= time ]_vars
\* A Mirror cannot apply while a previous Apply is landing.
NoApplyWhileLanding == [][ (applies' > applies) => mirror # "Applying" ]_vars
\* A tool pick waits while a Mirror is landing an Apply.
PickWaitsForLanding == [][ (picks' > picks) => mirror # "Applying" ]_vars
=======================================================================
