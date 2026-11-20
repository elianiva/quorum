# Users are counted per region

From Series C, a share of demand comes from Europe, Asia-Pacific, and South America
([ADR 0005](./0005-regions-are-tabs-over-one-design.md)). One user count and one Apdex would move
60% of a single-region Company's demand abroad at once, and the far users' round trips would lower
the one Apdex that every user's churn reads. Users at home would leave because users abroad are
slow, and the player would see one Apdex number below target.

We keep a user count and an hourly Apdex per region in the Game. Growth and churn run per region on
that region's Apdex, demand per region is that region's Users, and each region's market is the Era
market times its share ([GDD 04](https://github.com/elianiva/quorum/blob/main/apps/wiki/content/design/04-simulation.md#users-and-growth)). At the Series C start, every existing user stays in North America and each far region starts from a seed
([Going global](https://github.com/elianiva/quorum/blob/main/apps/wiki/content/design/04-simulation.md#going-global)).

Considered options:

- **Keep one count and ramp the far shares in over days.** A smaller change, but a far region's
  slowness makes home users leave, and the Churn breakdown could not say which users leave.
  Rejected.
- **One count, but weight each region's Apdex by its share for churn.** The same as one global
  Apdex in effect. Rejected.

## Consequences

- The save keeps `users` as the total and adds `userShares`, each region's share of it,
  `steady`, each region's share of steady users, and `regionApdex`. Code that changes the total, such as a Data breach, scales every region together.
- `userShares` and `steady` decode to null. A null `userShares` means everyone at home before Series
  C and the catalog's 40/30/20/10 from Series C, so a save without the field, and every Sandbox and
  Challenge, plays that split. Only the raise into Series C writes the seeded split.
- The Ledger gives each region's users their own Apdex (`regions`), from the outcome the solve
  computes for each region's route before it blends them.
- The Milestone, Valuation, the Rule of 40, and the HUD read the total.
- A Region outage makes the failed region's users leave, not every user.
- What would change it: a playtest finding that four counts are harder to read than one. The HUD
  shows the total, so only the Churn breakdown and the Users Nodes would change.
