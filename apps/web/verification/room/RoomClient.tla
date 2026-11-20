---------------------------- MODULE RoomClient ----------------------------
(* The browser Room phase (apps/web/src/game/room-machine.ts) and the socket
   status that drives it (apps/web/src/platform/room-socket.ts). `IgnoreError` = TRUE drops
   the socket failure transition, a negative control for the Connecting rules. *)
EXTENDS Naturals, TLC

CONSTANT IgnoreError

VARIABLES phase, status, welcomed, failures
vars == <<phase, status, welcomed, failures>>

Init ==
  /\ phase = "Idle"
  /\ status = "open"
  /\ welcomed = FALSE
  /\ failures = 0

Connect ==
  /\ phase \in {"Idle", "Closed", "Failed"}
  /\ phase' = "Connecting"
  /\ status' = "open"
  /\ welcomed' = FALSE
  /\ UNCHANGED failures

Welcome ==
  /\ phase \in {"Connecting", "Reconnecting", "Failed"}
  /\ phase' = "Online"
  /\ status' = "open"
  /\ welcomed' = TRUE
  /\ UNCHANGED failures

Drop ==
  /\ phase = "Online"
  /\ phase' = "Reconnecting"
  /\ status' = "closed"
  /\ welcomed' = FALSE
  /\ UNCHANGED failures

Fail(reason) ==
  /\ phase \in {"Connecting", "Online", "Reconnecting"}
  /\ status' = reason
  /\ phase' = IF IgnoreError THEN phase
             ELSE IF phase = "Connecting" THEN "Failed"
             ELSE IF phase = "Online" THEN "Reconnecting"
             ELSE phase
  /\ welcomed' = IF phase' = "Online" THEN welcomed ELSE FALSE
  /\ failures' = failures + 1

Full ==
  /\ status = "full"
  /\ status' = "full"
  /\ phase' = IF phase \in {"Connecting", "Online"} THEN "Failed" ELSE phase
  /\ welcomed' = FALSE
  /\ UNCHANGED failures

SocketOpen ==
  /\ status = "open"
  /\ UNCHANGED <<phase, status, welcomed, failures>>

Left ==
  /\ phase \in {"Connecting", "Online", "Reconnecting", "Closed", "Failed"}
  /\ phase' = "Idle"
  /\ status' = "open"
  /\ welcomed' = FALSE
  /\ UNCHANGED failures

Next ==
  \/ Connect \/ Welcome \/ Drop \/ Full \/ Left
  \/ Fail("closed") \/ Fail("error")
  \/ SocketOpen

Spec == Init /\ [][Next]_vars

Bounded == failures <= 3

\* A Connecting panel can only exist while the socket is open.
NoConnectingOnError == phase = "Connecting" => status = "open"
\* A full Room never leaves the panel on Online or Connecting.
FullIsFailed == status = "full" => phase \in {"Idle", "Failed"}
\* Online is only shown after a Welcome.
OnlineNeedsWelcome == phase = "Online" => welcomed
=============================================================================
