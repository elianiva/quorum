# Content is open at founding

Ventures, Mutators, and Challenges are open from the start. Legacy buys Perks only. Research stays
gated by Era, prerequisites, and Insight.

The game exists to teach system design. A player should be able to choose the rules they want to
learn. Gating content behind Legacy and achievements turns the content that makes a Company
different into a reward for playing the same Company again: a player who wants to learn data
residency must grind a default Venture first.

Legacy has a job. It is the score an Exit pays, and it buys the twelve Perks, which make later
Companies faster. That is a power curve, not a content gate.

Research is different. An Era's Research needs that Era's traffic, so the player cannot buy the
answer before meeting the problem. That order is the curriculum, and the free Sandbox gives every
Research item and unlimited Cash to anyone who wants to test a late-game Design.

Considered options:

- Keep Legacy costs on Ventures and Mutators. Rejected: a player must replay the default rules to
  reach the rules they want to learn, which is the grind the change removes.
- Unlock Research as well. Rejected: it removes the Eras' teaching order and turns every Company into
  the free Sandbox.
- Keep achievements as the unlock currency. Rejected: it is the same gate with a different name, and
  it turns achievements into chores.

## Consequences

- `Founder` stores the chosen Venture and Mutators, not unlocked ones, so the next Company starts
  with the same rules.
- `chooseVenture` and `toggleMutator` never refuse.
- Every Challenge route opens; there is no `challengeOpen`.
- A Venture row shows its Legacy multiplier, not a price.
- The Legacy shop is the only Legacy sink. Its prices rise 12.5%, so the twelve Perks cost 1,766★
  and the prestige curve stays where
  [Balancing](https://github.com/elianiva/quorum/blob/main/apps/wiki/content/design/16-balancing.md)
  put it.
- Achievements are badges. They unlock no content.
