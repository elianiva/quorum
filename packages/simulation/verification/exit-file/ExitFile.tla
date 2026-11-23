---------------------------- MODULE ExitFile ----------------------------
(* The Exit, from the menu to the deleted Company, and the screen it leaves behind.
   Each step is one indivisible step of the real code:

     OpenExit  menuPanel's "Exit company" (panels.ts) writes panel = "exit".
     Ask       Message.ExitAsked (message/exit.ts) holds the offer the player picked.
     Cancel    Message.ExitCancelled clears it.
     Take      Message.ExitTaken (update/exit.ts) runs takeExit (exit.ts), records the row and the
               Legacy (founder.ts recordExit), dispatches DeleteCompany (commands.ts) and writes
               panel = "exited".
     SaveStarts a WriteCompany dispatched by the clock's autosave (update/shared.ts saveCommands).
     SaveLands  writeCompany (company-files.ts): it captures the delete generation before the
               database write and refuses, removing the copy, when a delete happened since.
     Render    view.ts: an Exited Company renders exitScreen (components/lab/legacy.ts), every
               other Company renders the board.
     Dismiss   Escape or PanelClosed (update/panels.ts) leaves the Exit screen for the menu.

   Stage 3 is Series A, the first Era with an Exit (catalog/legacy.ts EXITS). Guard = TRUE is the
   code: a save that lands after the delete does not bring the Company back. Screen = TRUE is the
   code: an Exited Company shows its Exit screen. Each FALSE removes one guard. *)
EXTENDS Naturals, TLC

CONSTANT Guard, Screen

Exits == {"none", "acqui-hire", "acquisition"}
Playing == {"board", "exit", "confirm"}

VARIABLES stage, panel, asked, phase, screen, file, listed, saving, history
vars == <<stage, panel, asked, phase, screen, file, listed, saving, history>>

\* catalog/legacy.ts EXITS: acqui-hire from stage 3, acquisition from stage 4.
Eligible ==
  IF stage >= 4 THEN {"acqui-hire", "acquisition"}
  ELSE IF stage = 3 THEN {"acqui-hire"}
  ELSE {}

Init ==
  /\ stage = 0
  /\ panel = "board"
  /\ asked = "none"
  /\ phase = "open"
  /\ screen = "board"
  /\ file = TRUE
  /\ listed = TRUE
  /\ saving = FALSE
  /\ history = 0

\* A milestone, then the next Era. The round and its card are checked in era-card/EraCard.tla.
Advance ==
  /\ stage < 4
  /\ stage' = stage + 1
  /\ UNCHANGED <<panel, asked, phase, screen, file, listed, saving, history>>

\* The menu item (panels.ts): an Era with an Exit lists it.
OpenExit ==
  /\ stage >= 3
  /\ panel = "board"
  /\ panel' = "exit"
  /\ UNCHANGED <<stage, phase, screen, file, listed, saving, history, asked>>

Ask(e) ==
  /\ e \in Eligible
  /\ panel = "exit"
  /\ panel' = "confirm"
  /\ asked' = e
  /\ UNCHANGED <<stage, phase, screen, file, listed, saving, history>>

Cancel ==
  /\ panel = "confirm"
  /\ panel' = "exit"
  /\ asked' = "none"
  /\ UNCHANGED <<stage, phase, screen, file, listed, saving, history>>

\* takeExit only returns an offer that exitOffers lists, so a confirmed Exit is always eligible.
Take ==
  /\ panel = "confirm"
  /\ asked # "none"
  /\ panel' = "exited"
  /\ phase' = "exited"
  /\ screen' = IF Screen THEN "exit" ELSE "board"
  /\ file' = FALSE
  /\ listed' = FALSE
  /\ history' = history + 1
  /\ UNCHANGED <<stage, asked, saving>>

SaveStarts ==
  /\ phase = "open"
  /\ panel \in Playing
  /\ file
  /\ ~saving
  /\ saving' = TRUE
  /\ UNCHANGED <<stage, panel, asked, phase, screen, file, listed, history>>

\* writeCompany: a write that lands after the delete keeps the Company deleted. The index is only
\* written when the write reports that it landed, so it moves with the stored copy.
SaveLands ==
  /\ saving
  /\ saving' = FALSE
  /\ file' = (file \/ ~Guard)
  /\ listed' = file'
  /\ UNCHANGED <<stage, panel, asked, phase, screen, history>>

\* leaveExited (update/companies.ts): Next company closes the Exited Company and opens the menu.
Dismiss ==
  /\ phase = "exited"
  /\ panel = "exited"
  /\ phase' = "closed"
  /\ panel' = "none"
  /\ UNCHANGED <<stage, asked, screen, file, listed, saving, history>>

Next == Advance \/ OpenExit \/ (\E e \in Exits : Ask(e)) \/ Cancel \/ Take
        \/ SaveStarts \/ SaveLands \/ Dismiss

Spec == Init /\ [][Next]_vars

\* ---- Rules ----
\* An Exited Company shows its Exit screen, never an empty board.
ExitScreenShows == phase = "exited" => screen = "exit"
\* Once the Company is deleted, no save that lands later brings it back (the save index included).
ExitedFileGone == phase \in {"exited", "closed"} => ~file /\ ~listed
\* One Company records one Exit, and only after the player confirms an offer.
ExitNeedsConfirm == history = 1 => asked # "none"
=======================================================================
