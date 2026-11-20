---------------------------- MODULE ClockOverlay ----------------------------
(* The clock and its overlays (clock-machine.ts, model.ts `halted`). `IgnoreOverlay` = FALSE
   models the clock with PausedByOverlay; TRUE drops that state, so the tick can run behind an
   overlay. `TickOnlyRunning` and `NoHiddenOverlay` fail for TRUE. *)
EXTENDS Naturals, FiniteSets, TLC

CONSTANT IgnoreOverlay

Causes == {"palette", "menu", "boot"}

VARIABLES clock, overlays, before, ticks, tickOk
vars == <<clock, overlays, before, ticks, tickOk>>

Init ==
  /\ clock = "Running"
  /\ overlays = {}
  /\ before = "running"
  /\ ticks = 0
  /\ tickOk = FALSE

OpenNew(c) ==
  /\ ~IgnoreOverlay
  /\ c \in Causes
  /\ clock # "Overlay"
  /\ clock' = "Overlay"
  /\ before' = IF clock = "Player" THEN "player"
               ELSE IF clock = "Blur" THEN "blur"
               ELSE IF clock = "Incident" THEN "incident"
               ELSE "running"
  /\ overlays' = overlays \union {c}
  /\ UNCHANGED ticks /\ tickOk' = FALSE

OpenBypass(c) ==
  /\ IgnoreOverlay
  /\ c \in Causes
  /\ overlays' = overlays \union {c}
  /\ UNCHANGED <<clock, before, ticks>> /\ tickOk' = FALSE

CloseNew(c) ==
  /\ ~IgnoreOverlay
  /\ c \in Causes
  /\ clock = "Overlay"
  /\ c \in overlays
  /\ overlays' = overlays \ {c}
  /\ clock' = IF overlays' = {}
               THEN (CASE before = "player" -> "Player"
                     [] before = "blur" -> "Blur"
                     [] before = "incident" -> "Incident"
                     [] OTHER -> "Running")
               ELSE "Overlay"
  /\ UNCHANGED <<before, ticks>> /\ tickOk' = FALSE

CloseBypass(c) ==
  /\ IgnoreOverlay
  /\ c \in Causes
  /\ c \in overlays
  /\ overlays' = overlays \ {c}
  /\ UNCHANGED <<clock, before, ticks>> /\ tickOk' = FALSE

Pause ==
  /\ clock \in {"Running", "Player"}
  /\ clock' = IF clock = "Running" THEN "Player" ELSE "Running"
  /\ UNCHANGED <<overlays, before, ticks>> /\ tickOk' = FALSE

Blur ==
  /\ clock = "Running"
  /\ clock' = "Blur"
  /\ UNCHANGED <<overlays, before, ticks>> /\ tickOk' = FALSE

Focus ==
  /\ clock = "Blur"
  /\ clock' = "Running"
  /\ UNCHANGED <<overlays, before, ticks>> /\ tickOk' = FALSE

Severe ==
  /\ clock = "Running"
  /\ clock' = "Incident"
  /\ UNCHANGED <<overlays, before, ticks>> /\ tickOk' = FALSE

Tick ==
  /\ clock = "Running"
  /\ IF IgnoreOverlay THEN TRUE ELSE overlays = {}
  /\ ticks' = ticks + 1
  /\ tickOk' = TRUE
  /\ UNCHANGED <<clock, overlays, before>>

Quiet ==
  /\ tickOk
  /\ tickOk' = FALSE
  /\ UNCHANGED <<clock, overlays, before, ticks>>

Next ==
  \/ (\E c \in Causes : OpenNew(c))
  \/ (\E c \in Causes : OpenBypass(c))
  \/ (\E c \in Causes : CloseNew(c))
  \/ (\E c \in Causes : CloseBypass(c))
  \/ Pause \/ Blur \/ Focus \/ Severe \/ Tick \/ Quiet

Spec == Init /\ [][Next]_vars

Bounded == ticks <= 4

\* A tick only happens while the clock is Running and no overlay is open.
TickOnlyRunning == tickOk => clock = "Running" /\ overlays = {}
\* A non-empty overlay set is never hidden behind a Running clock.
NoHiddenOverlay == overlays = {} \/ clock = "Overlay"
\* An overlay is always visible as the clock's own state.
OverlayPauses == overlays # {} => clock = "Overlay"
=============================================================================
