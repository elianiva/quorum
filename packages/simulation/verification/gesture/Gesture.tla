------------------------------ MODULE Gesture ------------------------------
(* The board's gesture (packages/ui/src/board/gesture-machine.ts) and the events pointer.ts and
   controller.ts route into it. pointerdown sends EmptyPressed (Panning, or Boxing with Shift),
   NodePressed (Dragging), FooterPressed (PressPending, with `since` set only when `holds` is
   true) and PortPressed (Linking). A non-primary second touch calls controller.ts `beginPinch`,
   which sends SecondTouch. pointermove sends PointerMoved. pointerup and pointercancel call
   `finish`: while Pinching it sends TouchEnded, otherwise PointerReleased or PointerCancelled,
   and then it reads the gesture it started with to fire onLink (only Linking), onBox (only
   Boxing) or onNodeMove (only a moved Dragging). `advanceHold` ticks PressPending and Holding and
   fires onFooter when a hold completes.
   `card` is the dragged card's view: held on pointerdown, lifted once a drag moves, none
   otherwise.
   `LetGo` = TRUE is the code: `beginPinch` calls `letGo` and `syncCards` after SecondTouch, so a
   drag card is not left held. `HoldGuard` = TRUE is the code: HoldTicked needs a recorded press
   time. Each FALSE removes one step, a negative control.
   Zooming, the world position, and the tap and footer answers that do not move the gesture are
   outside this model, and `links`, `boxes` and `footers` stop at one: the model checks each first
   release, not a second one. *)
EXTENDS Naturals

CONSTANTS LetGo, HoldGuard

VARIABLES gesture, since, touches, card, links, boxes, footers, moved
vars == <<gesture, since, touches, card, links, boxes, footers, moved>>

Init ==
  /\ gesture = "Idle"
  /\ since = "none"
  /\ touches = 0
  /\ card = "none"
  /\ links = 0
  /\ boxes = 0
  /\ footers = 0
  /\ moved = FALSE

\* pointer.ts pointerdown on empty canvas: Panning, or Boxing while Shift is held.
Press(box) ==
  /\ gesture = "Idle" /\ touches = 0
  /\ gesture' = IF box THEN "Boxing" ELSE "Panning"
  /\ touches' = 1
  /\ UNCHANGED <<since, card, links, boxes, footers, moved>>

\* pointer.ts pointerdown on a node, or on the selection frame.
PressNode ==
  /\ gesture = "Idle" /\ touches = 0
  /\ gesture' = "Dragging" /\ touches' = 1
  /\ card' = "held"
  /\ moved' = FALSE
  /\ UNCHANGED <<since, links, boxes, footers>>

\* pointer.ts pointerdown on a footer: `since` is set only when the footer holds. The footer
\* draws a pressed ring, not a held card, so `card` stays as it was.
PressFooter(s) ==
  /\ gesture = "Idle" /\ touches = 0
  /\ gesture' = "PressPending" /\ touches' = 1
  /\ since' = s
  /\ UNCHANGED <<card, links, boxes, footers, moved>>

\* pointer.ts pointerdown on an out port.
PressPort ==
  /\ gesture = "Idle" /\ touches = 0
  /\ gesture' = "Linking" /\ touches' = 1
  /\ UNCHANGED <<since, card, links, boxes, footers, moved>>

\* pointer.ts pointermove past the drag threshold: PressPending, Holding and Panning become a drag.
MoveFar ==
  /\ gesture \in {"PressPending", "Holding", "Dragging", "Panning"}
  /\ gesture' = "Dragging"
  /\ moved' = TRUE
  /\ card' = IF card = "none" THEN "none" ELSE "lifted"
  /\ UNCHANGED <<since, touches, links, boxes, footers>>

\* controller.ts `advanceHold`: a PressPending with a press time becomes Holding, and a Holding
\* whose progress reaches 1 completes into Idle and fires the footer answer.
TickStart ==
  /\ gesture = "PressPending"
  /\ (HoldGuard = FALSE \/ since = "set")
  /\ gesture' = "Holding"
  /\ UNCHANGED <<since, touches, card, links, boxes, footers, moved>>

TickDone ==
  /\ gesture = "Holding"
  /\ gesture' = "Idle"
  /\ footers' = IF footers < 1 THEN 1 ELSE footers
  /\ card' = "none"
  /\ UNCHANGED <<since, touches, links, boxes, moved>>

\* controller.ts `beginPinch` from a non-primary pointerdown: SecondTouch, then `letGo`.
Second ==
  /\ gesture # "Pinching" /\ touches = 1
  /\ gesture' = "Pinching"
  /\ touches' = 2
  /\ card' = IF LetGo THEN "none" ELSE card
  /\ UNCHANGED <<since, links, boxes, footers, moved>>

\* pointer.ts `finish` on pointerup: TouchEnded while Pinching, else PointerReleased, and the
\* release answer that belongs to the gesture it started with.
Up ==
  /\ touches > 0
  /\ touches' = IF gesture = "Pinching" THEN touches - 1 ELSE 0
  /\ gesture' = IF gesture = "Pinching" /\ touches' > 0 THEN "Pinching" ELSE "Idle"
  /\ card' = "none"
  /\ links' = IF gesture = "Linking" /\ links < 1 THEN 1 ELSE links
  /\ boxes' = IF gesture = "Boxing" /\ boxes < 1 THEN 1 ELSE boxes
  /\ UNCHANGED <<since, footers, moved>>

\* pointer.ts `finish` on pointercancel: the same event, and the cancelled answer fires nothing.
Cancel ==
  /\ touches > 0
  /\ touches' = IF gesture = "Pinching" THEN touches - 1 ELSE 0
  /\ gesture' = IF gesture = "Pinching" /\ touches' > 0 THEN "Pinching" ELSE "Idle"
  /\ card' = "none"
  /\ UNCHANGED <<since, links, boxes, footers, moved>>

Next ==
  \/ Press(FALSE) \/ Press(TRUE) \/ PressNode \/ PressPort
  \/ PressFooter("none") \/ PressFooter("set")
  \/ MoveFar \/ TickStart \/ TickDone \/ Second \/ Up \/ Cancel
Spec == Init /\ [][Next]_vars

\* ---- Rules ----
\* A pointer up or cancel always returns to Idle once no pointer is left.
UpReturnsIdle == [][ (touches > 0 /\ touches' = 0) => gesture' = "Idle" ]_vars
\* A second touch never leaves a drag card selected.
PinchDropsTheCard == gesture = "Pinching" => card = "none"
\* A hold cannot begin without a recorded press time.
HoldNeedsPress == [][ (gesture = "PressPending" /\ gesture' = "Holding") => since = "set" ]_vars
\* A link release fires only from Linking, and a box release only from Boxing.
LinkFromLinking == [][ (links' > links) => gesture = "Linking" ]_vars
BoxFromBoxing == [][ (boxes' > boxes) => gesture = "Boxing" ]_vars
\* The footer answer fires only when a hold completes.
FooterFromHolding == [][ (footers' > footers) => gesture = "Holding" ]_vars
===========================================================================
