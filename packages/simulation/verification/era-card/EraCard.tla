---------------------------- MODULE EraCard ----------------------------
(* The Era card (components/lab/panels.ts eraPanel), and the round that opens it. Each step is one
   indivisible step of the real code:

     Offer     step.ts writes round = "Offered" once `canRaise` holds (Progression milestones).
     OpenOffer Message.PanelOpened({ panel: "offer" }) from the HUD's offer row.
     Raise     Message.RoundRaised: actions.ts `raise` -> `advanceEra` moves one Era, takes the
               grant and the dilution, and update/exit.ts sets panel = afterRound(game) = "era".
     Decline   Message.RoundDeclined: `advanceEra` keeps Equity, lowers growth, panel = "era".
     Found     `found` (update/companies.ts): a Head start Company starts above Garage and opens
               the card at once, with no round on the table.
     Close     Message.PanelClosed -> `closePanel` returns to the board.

   Card = TRUE is the code: the card names the Era the Company entered. EarlyCard = FALSE is the
   code: the card never opens while the round is still on the table. Each flip removes a guard. *)
EXTENDS Naturals, Integers, TLC

CONSTANT Card, EarlyCard

VARIABLES stage, round, panel, card, start
vars == <<stage, round, panel, card, start>>

Bounded == stage <= 2

Init ==
  /\ stage = 0
  /\ round = "Waiting"
  /\ panel = "board"
  /\ card = -1
  /\ start = FALSE

\* step.ts: the Era's Milestone puts its round on the table.
Offer ==
  /\ stage < 2
  /\ round = "Waiting"
  /\ round' = "Offered"
  /\ UNCHANGED <<stage, panel, card, start>>

OpenOffer ==
  /\ panel = "board"
  /\ round = "Offered"
  /\ panel' = "offer"
  /\ UNCHANGED <<stage, round, card, start>>

\* advanceEra: only a round that is on the table can be answered, and the answer moves one Era.
Answer(r) ==
  /\ panel = "offer"
  /\ round = "Offered"
  /\ stage < 2
  /\ stage' = stage + 1
  /\ round' = r
  /\ panel' = "era"
  /\ card' = IF Card THEN stage' ELSE stage
  /\ start' = FALSE

Raise == Answer("Raised")
Decline == Answer("Declined")

\* found + startCompany with the head-start Perk: the card opens with no round behind it.
Found ==
  /\ panel = "board"
  /\ round = "Waiting"
  /\ stage < 2
  /\ stage' = stage + 1
  /\ panel' = "era"
  /\ card' = IF Card THEN stage' ELSE stage
  /\ start' = TRUE
  /\ UNCHANGED round

\* The card opens itself while the round is on the table: the bug EarlyCard models.
EarlyOpen ==
  /\ EarlyCard
  /\ round = "Offered"
  /\ panel = "board"
  /\ panel' = "era"
  /\ card' = stage
  /\ UNCHANGED <<stage, round, start>>

Close ==
  /\ panel = "era"
  /\ panel' = "board"
  /\ card' = -1
  /\ start' = FALSE
  /\ UNCHANGED <<stage, round>>

Next == Offer \/ OpenOffer \/ Raise \/ Decline \/ Found \/ EarlyOpen \/ Close

Spec == Init /\ [][Next]_vars

\* ---- Rules ----
\* The card names the Era the Company just entered.
CardNamesEnteredEra == panel = "era" => card = stage
\* The card opens only once the round is answered, never while it is still on the table.
CardOpensAfterAnswer == [][panel' = "era" /\ panel # "era" => round' # "Offered"]_vars
\* Answering a round moves one Era and opens the card.
AnswerMovesEra == [][round # round' /\ round' \in {"Raised", "Declined"} => stage' = stage + 1 /\ panel' = "era"]_vars
=======================================================================
