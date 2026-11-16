---
name: verify-simulation
description: Model-check the Simulation's runway and bridge, Node life, and Incident phase against TLA+ models. Use when a change touches runway.ts, life.ts, node-service-machine.ts, incident-machine.ts, bridge-machine.ts, or any code that writes a Node's `life` or `service`.
---

# Verify the Simulation

Six small TLA+ models in `packages/simulation/verification/` check rules that the unit tests do not reach. Each model is a hand-written copy of the code. A pass covers the model, not the code.

## Run

```sh
packages/simulation/verification/run.sh
```

The script checks every model with the `statechart` skill and prints each report. It needs the network on the first run (mise installs Java and TLC). Run time is about 15 seconds. Read each result with the `statechart` skill.

Random plays of the real code run in `packages/simulation/test/invariants.test.ts` and `packages/simulation/test/system.test.ts`. `system.test.ts` also plays the Team, Studies and Mirrors (hire, layoff, features, items, Research, IaC moves) and checks unique engineers, items and Studies, Research prerequisites, no double Research, and the edges of the hire, study, work-item, mirror, reshard and engine-change machines. It places every Component in random Designs, links, answers and steps them, and after every move checks that the Game is valid, every figure is finite, a Shut Node is Stopped, and the bridge, round, drill, quarter, incident, Node service, scaler and Link fuse each moved along an edge their machine declares (edges are found by sending the machine random events, so a direct write that skips `step` is caught if it makes an illegal move) (`pnpm --filter @quorum/simulation test`).

## Coverage and sync

Last confirmed against commit `9fe79ad6`. Move this commit forward only after you confirm each model still describes the code at the new commit.

| Model                    | Rules                                                                                                                                          | Code it describes                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runway/Runway.tla`      | the bridge is offered once and taken once; no shutdown after accept; shutdown ends with net Burn 0; the player gets a Step to answer the offer | `runway.ts` `advanceRunway`, `acceptBridge`, `shutdown`; `bridge-machine.ts`                                                                        |
| `node-life/NodeLife.tla` | a Shut Node is Stopped; a restart does not end early                                                                                           | `life.ts`; `node-service-machine.ts`; `lookups.ts` `restarted`; `step.ts` `advanceNode`; `actions.ts` `resize`, `drain`; `runway.ts` `shutdownNode` |
| `quarter/Quarter.tla`    | guidance can be set at the start of every quarter                                                                                              | `quarter-machine.ts`; `quarters.ts` `advanceQuarter`; `actions.ts` `setGuidance`                                                                    |
| `drill/Drill.tla`        | a drill ends by its limit; a finished drill never changes; `data-loss` is never written                                                        | `drill-machine.ts`; `ipo.ts` `advanceDrill`                                                                                                         |
| `era-round/EraRound.tla` | a round is answered only when it is on the table                                                                                               | `era-round-machine.ts`; `step.ts` (Offered); `actions.ts` `advanceEra`, `raise`, `decline`                                                          |
| `incident/Incident.tla`  | phase matches the recorded times; the first signal and ack stay                                                                                | `incident-machine.ts`; `director.ts` `markSignal`, `advanceIncident`; `actions.ts` `acknowledge`                                                    |

## Findings fixed (each model keeps its old code as a variant that must fail)

- Runway `AnswerWindow`: `advanceRunway` now shuts Nodes down only when the bridge was already `Offered` before this Step. Variant: `SameStep = TRUE`.
- NodeLife `NoEarlyRecovery`: `resize`, `setQuorum`, the Log replica setting, and the Search index change rebalance only a Node that is not down (`isDown`). Variant: `ResizeGuard = "stopped"`.
- Quarter `GuidanceOpensEachQuarter`: `Started` now moves the quarter to `AwaitingGuidance` from either phase, and `guidanceOpen` also needs the first calendar day (`GUIDANCE_WINDOW`). The model does not describe that window. Variant: `Reopen = FALSE`.
- EraRound `AnswerNeedsOffer`: `advanceEra` refuses when the round is not `Offered`. Variant: `Check = FALSE`. The `Advanced` event is still never sent.
- Work item `Blocked`: `rushItem` paid Dev Hours into a Blocked item, and a fully paid one finishes without the player's answer. `rushItem` now refuses a Blocked item. Found by `system.test.ts` ("a Blocked item has no work").
- `random.ts`: the generator multiplied in a double, lost precision above 2^53 and fell into a 10,466-value cycle. It now uses `Math.imul`; `invariants.test.ts` checks it against exact BigInt math.
- Dead events (no sender in `src/`, so their arrows never run): drill `Reset`, era-round `Advanced`, hire `Hired`, study `Queued`. Left alone; they are design leftovers, not bugs.
- Machines with no TLA+ model (autoscaler, breaker, node service, hire, study, work item, mirror, data move, feature): each has one or two writers and a linear or two-state shape, so `system.test.ts` checks their edges on the real code instead. Add a model if one gains a second writer that races with time.

`packages/simulation/test/invariants.test.ts` covers the first two and the last two on the real code.

`run.sh` exits 1 when a rule breaks. Do not weaken a rule to make it pass.

## When you change covered code

1. Run `run.sh` before and after. A new failure is a bug or drift.
2. Replay the counterexample against the real code. If a step cannot happen, fix the model. If it can, it is a bug.
3. Update the model so each step points at code, one indivisible step per step. Then break the new code on purpose and confirm the check fails. Drop the break.
4. Change a rule only for an intended change in the promise. Cite the evidence.
5. Keep verification edits in their own commit.

Each model has a variable that switches on a broken variant (`ReBridge` in Runway, `ResizeGuard = "none"` in NodeLife). Use it to confirm a model can still fail.
