---------------------------- MODULE Runway ----------------------------
(* Model of packages/simulation/src/runway.ts `advanceRunway` and `acceptBridge`,
   run once per Step from step.ts. Money is whole units: one Tick is one Step,
   and a calendar day is DAY ticks (the real Step is 0.1 s of a 1440 s day). *)
EXTENDS Naturals, Integers, FiniteSets, TLC

CONSTANTS Salary, DAY, ReBridge, SameStep  \* ReBridge and SameStep = TRUE remove a guard

Nodes == {"a", "b"}
Cost == ("a" :> 2) @@ ("b" :> 3)

VARIABLES cash, bridge, grant, gone, offers, accepts, runwayShut, justShut, lastRev, offerAndShut
vars == <<cash, bridge, grant, gone, offers, accepts, runwayShut, justShut, lastRev, offerAndShut>>
Bounded == cash >= -90 /\ cash <= 90

RECURSIVE SumCost(_)
SumCost(S) == IF S = {} THEN 0 ELSE LET x == CHOOSE x \in S : TRUE IN Cost[x] + SumCost(S \ {x})
Billing(sh) == Nodes \ sh
Burn(sh) == Salary + SumCost(Billing(sh))        \* gross Burn, as `ledger.burn`
Dearest(sh) == CHOOSE x \in Billing(sh) : \A y \in Billing(sh) : Cost[x] >= Cost[y]

\* runway.ts `shutdown`: shut the dearest billing Node until net Burn is 0 or none bills.
RECURSIVE Shutdown(_, _)
Shutdown(sh, rev) ==
  IF Burn(sh) - rev <= 0 \/ Billing(sh) = {} THEN sh
  ELSE Shutdown(sh \union {Dearest(sh)}, rev)

Init ==
  /\ cash = 6 /\ bridge = "None" /\ grant = 0 /\ gone = {}
  /\ offers = 0 /\ accepts = 0 /\ runwayShut = FALSE
  /\ justShut = FALSE /\ lastRev = 0 /\ offerAndShut = FALSE

\* One Step: Cash moves by revenue minus Burn, then `advanceRunway` runs on the new Cash.
Tick(rev) ==
  LET b == Burn(gone)
      c == cash + rev - b
      canOffer == IF ReBridge THEN bridge # "Offered" ELSE bridge = "None"
      offered == canOffer /\ c <= -b * DAY
      br == IF offered THEN "Offered" ELSE bridge
      shut == (IF SameStep THEN br ELSE bridge) = "Offered" /\ c <= -b * DAY * 3
  IN /\ cash' = c
     /\ bridge' = IF shut THEN "Taken" ELSE br
     /\ grant' = IF offered THEN b * DAY * 3 ELSE grant
     /\ offers' = IF offered THEN offers + 1 ELSE offers
     /\ gone' = IF shut THEN Shutdown(gone, rev) ELSE gone
     /\ runwayShut' = (runwayShut \/ shut)
     /\ justShut' = shut /\ lastRev' = rev /\ offerAndShut' = (offered /\ shut)
     /\ UNCHANGED accepts

AcceptBridge ==
  /\ bridge = "Offered"
  /\ cash' = cash + grant /\ bridge' = "Taken" /\ accepts' = accepts + 1
  /\ justShut' = FALSE /\ offerAndShut' = FALSE
  /\ UNCHANGED <<grant, gone, offers, runwayShut, lastRev>>

\* The player sells a Node, or places one back while Cash is positive.
Sell(n) == /\ n \notin gone /\ gone' = gone \union {n}
           /\ justShut' = FALSE /\ offerAndShut' = FALSE
           /\ UNCHANGED <<cash, bridge, grant, offers, accepts, runwayShut, lastRev>>
Place(n) == /\ n \in gone /\ cash > 0 /\ gone' = gone \ {n}
            /\ justShut' = FALSE /\ offerAndShut' = FALSE
            /\ UNCHANGED <<cash, bridge, grant, offers, accepts, runwayShut, lastRev>>

TickWithoutRevenue == Tick(0)
TickEarningLittle == Tick(2)
TickEarningMuch == Tick(5)

Next == TickWithoutRevenue \/ TickEarningLittle \/ TickEarningMuch \/ AcceptBridge
        \/ (\E n \in Nodes : Sell(n)) \/ (\E n \in Nodes : Place(n))

Spec == Init /\ [][Next]_vars

\* ---- Rules ----
OfferedOnce == offers <= 1
\* The grant and the dilution are taken at most once.
TakenOnce == accepts <= 1
\* A bridge that was accepted never leads to a runway shutdown (09 "Runway and running out of Cash").
NoShutdownAfterAccept == ~(accepts > 0 /\ runwayShut)
\* After a shutdown, net Burn is zero or nothing bills.
ShutdownStops == justShut => (Burn(gone) - lastRev <= 0 \/ Billing(gone) = {})
\* The player always gets a Step to answer the offer.
AnswerWindow == ~offerAndShut
=======================================================================
