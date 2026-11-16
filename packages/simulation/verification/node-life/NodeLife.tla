---------------------------- MODULE NodeLife ----------------------------
(* One Node's `life` (life.ts) and `service` (node-service-machine.ts), moved by the writers
   in actions.ts, director.ts, runway.ts, lookups.ts `restarted` and step.ts `advanceNode`.
   `left` is the seconds a Restarting Node still has to wait; 2 is the longest in this model. *)
EXTENDS Naturals

CONSTANT ResizeGuard   \* "down" is the code (isDown); "stopped" and "none" are broken variants

VARIABLES life, left, service, last
vars == <<life, left, service, last>>

Init == life = "Running" /\ left = 0 /\ service = "InService" /\ last = "start"

\* lookups.ts `restarted`: the Node restarts, and a Shut Node comes back in service.
Restart(why) ==
  /\ life' = "Restarting" /\ left' = 2
  /\ service' = IF service = "Shut" THEN "InService" ELSE service
  /\ last' = why
Fail == Restart("director fails a Node")                      \* director.ts 1123-1136, step.ts 590
PlayerRestart == life \notin {"Restarting", "Stopped"} /\ Restart("you restart a Node")  \* actions.ts 1207

\* step.ts `advanceNode`: the wait counts down, then the Node warms up and runs.
Wait == /\ life = "Restarting" /\ left > 0 /\ left' = left - 1 /\ UNCHANGED <<life, service>> /\ last' = "time passes"
Recover == /\ life = "Restarting" /\ left = 0 /\ life' = "Warming" /\ UNCHANGED <<left, service>> /\ last' = "restart ends"
WarmUp == /\ life = "Warming" /\ life' = "Running" /\ UNCHANGED <<left, service>> /\ last' = "warm-up ends"

\* runway.ts `shutdownNode`.
RunwayShut == /\ service # "Shut" /\ service' = "Shut" /\ life' = "Stopped" /\ left' = 0 /\ last' = "Cash runs out"

\* actions.ts `drain` and step.ts `DrainFinished`.
Drain == /\ service = "InService" /\ life \notin {"Restarting", "Stopped"}
         /\ service' = "Draining" /\ UNCHANGED <<life, left>> /\ last' = "you drain a Node"
DrainDone == /\ service = "Draining" /\ service' = "InService" /\ UNCHANGED <<life, left>> /\ last' = "drain ends"

\* actions.ts `resize` on a Doc, Wide-column or Log Node, and setQuorum, setLogReplicas:
\* `life: warming(0)` when the Node is not Stopped.
Resize ==
  /\ CASE ResizeGuard = "stopped" -> life # "Stopped"
       [] ResizeGuard = "down" -> life \notin {"Stopped", "Restarting"}
       [] ResizeGuard = "none" -> TRUE
  /\ life' = "Warming" /\ left' = 0 /\ UNCHANGED service /\ last' = "you resize a Node"

Next == Fail \/ PlayerRestart \/ Wait \/ Recover \/ WarmUp \/ RunwayShut \/ Drain \/ DrainDone \/ Resize
Spec == Init /\ [][Next]_vars

\* ---- Rules ----
\* A Shut Node is Stopped: it serves nothing and bills nothing.
ShutIsStopped == service = "Shut" => life = "Stopped"
\* A Node that is down comes back only when its wait is over.
NoEarlyRecovery == [][ (life = "Restarting" /\ left > 0) => life' \in {"Restarting"} \/ service' = "Shut" ]_vars
=======================================================================
