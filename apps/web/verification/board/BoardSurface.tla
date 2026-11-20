---------------------------- MODULE BoardSurface ----------------------------
(* The board mount (apps/web/src/game/board-surface-machine.ts) and the tick
   subscription (subscriptions.ts). `IgnoreSurface` = TRUE drops the Unavailable state, a
   negative control for TickSafe. *)
EXTENDS Naturals, TLC

CONSTANT IgnoreSurface

VARIABLES onBoard, surface, clock, ticks, tickOk
vars == <<onBoard, surface, clock, ticks, tickOk>>

Init ==
  /\ onBoard = FALSE
  /\ surface = "Starting"
  /\ clock = "Running"
  /\ ticks = 0
  /\ tickOk = FALSE

Open ==
  /\ ~onBoard
  /\ onBoard' = TRUE
  /\ surface' = "Starting"
  /\ clock' = "Running"
  /\ UNCHANGED ticks /\ tickOk' = FALSE

Ready ==
  /\ onBoard
  /\ surface \in {"Starting", "Unavailable"}
  /\ surface' = "Ready"
  /\ UNCHANGED <<onBoard, clock, ticks>> /\ tickOk' = FALSE

Unavailable ==
  /\ onBoard
  /\ surface \in {"Starting", "Ready"}
  /\ surface' = "Unavailable"
  /\ UNCHANGED <<onBoard, clock, ticks>> /\ tickOk' = FALSE

Leave ==
  /\ onBoard
  /\ onBoard' = FALSE
  /\ UNCHANGED <<surface, clock, ticks>> /\ tickOk' = FALSE

Pause ==
  /\ onBoard
  /\ clock' = IF clock = "Running" THEN "Paused" ELSE "Running"
  /\ UNCHANGED <<onBoard, surface, ticks>> /\ tickOk' = FALSE

Tick ==
  /\ onBoard
  /\ clock = "Running"
  /\ IF IgnoreSurface THEN TRUE ELSE surface = "Ready"
  /\ ticks' = ticks + 1
  /\ tickOk' = TRUE
  /\ UNCHANGED <<onBoard, surface, clock>>

Quiet ==
  /\ tickOk
  /\ tickOk' = FALSE
  /\ UNCHANGED <<onBoard, surface, clock, ticks>>

Next == Open \/ Ready \/ Unavailable \/ Leave \/ Pause \/ Tick \/ Quiet
Spec == Init /\ [][Next]_vars

Bounded == ticks <= 4

\* A tick only happens on a mounted, ready board with a running clock.
TickSafe == tickOk => onBoard = TRUE /\ surface = "Ready" /\ clock = "Running"
\* An unavailable board never ticks.
UnavailableStops == surface = "Unavailable" => tickOk = FALSE
=============================================================================
