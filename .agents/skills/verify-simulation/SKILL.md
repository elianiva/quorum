---
name: verify-simulation
description: Model-check the Simulation's state machines against TLA+ models. Use when a change touches a machine under packages/simulation/src or packages/ui/src/board, or any code that writes a Node's `life` or `service`, a Study queue, a work item's block, an IaC tool, or an Incident.
---

# Verify the Simulation

Eleven small TLA+ models in `packages/simulation/verification/` check rules that the unit tests do not reach. Each model is a hand-written copy of the code. A pass covers the model, not the code.

## Run

```sh
packages/simulation/verification/run.sh
```

The script checks every model with the `statechart` skill and prints each report. It needs the network on the first run (mise installs Java and TLC). Run time is about two minutes. Read each result with the `statechart` skill.

Random plays of the real code run in `packages/simulation/test/invariants.test.ts` and `packages/simulation/test/system.test.ts`. `system.test.ts` also plays the Team, Studies and Mirrors (hire, layoff, features, items, Research, IaC moves) and checks unique engineers, items and Studies, Research prerequisites, no double Research, and the edges of the hire, study, work-item, mirror, reshard and engine-change machines. It places every Component in random Designs, links, answers and steps them, and after every move checks that the Game is valid, every figure is finite, a Shut Node is Stopped, and the bridge, round, drill, quarter, incident, Node service, scaler and Link fuse each moved along an edge their machine declares (edges are found by sending the machine random events, so a direct write that skips `step` is caught if it makes an illegal move) (`pnpm --filter @quorum/simulation test`).

## Coverage and sync

Last confirmed against commit `9fe79ad6`. Move this commit forward only after you confirm each model still describes the code at the new commit.

| Model                      | Rules                                                                                                                                                                         | Code it describes                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runway/Runway.tla`        | the bridge is offered once and taken once; no shutdown after accept; shutdown ends with net Burn 0; the player gets a Step to answer the offer                                | `runway.ts` `advanceRunway`, `acceptBridge`, `shutdown`; `bridge-machine.ts`                                                                                                          |
| `node-life/NodeLife.tla`   | a Shut Node is Stopped; a restart does not end early                                                                                                                          | `life.ts`; `node-service-machine.ts`; `lookups.ts` `restarted`; `step.ts` `advanceNode`; `actions.ts` `resize`, `drain`; `runway.ts` `shutdownNode`                                   |
| `quarter/Quarter.tla`      | guidance can be set at the start of every quarter                                                                                                                             | `quarter-machine.ts`; `quarters.ts` `advanceQuarter`; `actions.ts` `setGuidance`                                                                                                      |
| `drill/Drill.tla`          | a drill ends by its limit; a finished drill never changes; `data-loss` is never written                                                                                       | `drill-machine.ts`; `ipo.ts` `advanceDrill`                                                                                                                                           |
| `era-round/EraRound.tla`   | a round is answered only when it is on the table                                                                                                                              | `era-round-machine.ts`; `step.ts` (Offered); `actions.ts` `advanceEra`, `raise`, `decline`                                                                                            |
| `era-card/EraCard.tla`     | the card names the Era the Company entered; the card opens only after the round is answered, never while it is still on the table; answering moves one Era and opens the card | `eraPanel` in `apps/web/src/components/lab/panels.ts`; `step.ts` (Offered); `actions.ts` `advanceEra`; `update/exit.ts` `RoundRaised`, `RoundDeclined`; `update/companies.ts` `found` |
| `exit-file/ExitFile.tla`   | an Exited Company shows its Exit screen; a Company deleted at Exit never comes back, even when a save lands after the delete; an Exit needs a confirmed offer                 | `exit.ts` `takeExit`; `update/exit.ts` `ExitTaken`; `commands.ts` `WriteCompany`, `DeleteCompany`; `company-files.ts` `writeCompany`, `deleteCompany`; `view.ts`                      |
| `incident/Incident.tla`    | phase matches the recorded times; the first signal and ack stay                                                                                                               | `incident-machine.ts`; `director.ts` `markSignal`, `advanceIncident`; `actions.ts` `acknowledge`                                                                                      |
| `iac/Iac.tla`              | sync needs a tool; a switch blocks Apply; no Apply lands while another is landing                                                                                             | `state.ts` `Iac`; `mirror.ts` `pickIacTool`, `setSyncMode`, `switchLeft`, `applyRefusal`                                                                                              |
| `work-block/WorkBlock.tla` | a Held item is never rushed or worked; a Blocked item never finishes; only a Free or Approved item finishes                                                                   | `work-item-machine.ts`; `work.ts` `advanceTeam`, `cancelItem`, `resumeItem`, `approveBlock`, `rushItem`, `takeable`                                                                   |
| `gesture/Gesture.tla`      | a pointer up or cancel returns to Idle; a pinch drops the card; a hold needs a press; link, box and footer actions fire only from their phase                                 | `packages/ui/src/board/gesture-machine.ts`; `pointer.ts`; `controller.ts` `beginPinch`, `advanceHold`                                                                                 |

`run.sh` exits 1 when a rule breaks. Do not weaken a rule to make it pass.

## When you change covered code

1. Run `run.sh` before and after. A new failure is a bug or drift.
2. Replay the counterexample against the real code. If a step cannot happen, fix the model. If it can, it is a bug.
3. Update the model so each step points at code, one indivisible step per step. Then break the new code on purpose and confirm the check fails. Drop the break.
4. Change a rule only for an intended change in the promise. Cite the evidence.
5. Keep verification edits in their own commit.

Each model has a constant that removes one guard. Set it to confirm the model can still fail.
