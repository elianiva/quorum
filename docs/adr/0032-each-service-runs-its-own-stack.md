# Each Service runs its own Stack

The Stack belongs to the Design today. A Stack change moves every App Server, and its cost counts
the codebase of every Service. A new Service gets the Stack the rest of the Design runs, and the
first split needs `service-boundaries`, a Series B Study. Real companies do it differently. Slack ran
its PHP web app next to a Java message server, and Discord ran an Elixir realtime gateway next to a
Python API. Both were small teams that added a second language for one kind of work. Twitter
started splitting its Rails monolith into services in 2010, when about 200 engineers worked in it.
So the split for runtime fit comes early, and the split for team size comes late.

We give each Service its own Stack. A Service is a codebase, and its Nodes run it. The player puts
work in the codebase whose language suits it: `search` in a Rust Service for speed, and new product
Features in a Python Service because Python builds them faster.

## Rules

- **A Service runs one Stack.** Each App Server runs one Service, and a Stack change migrates one
  Service and costs that Service's codebase. Workers keep their own Stack and their own migration,
  because they pull `task` from a Queue and serve no other kind. The Realtime Hub keeps its own
  Stack too.
- **A capability is what moves.** A capability is one Request kind and every Feature that unlocks
  it or changes its load, value, payload, or queries. `search` and Search filters are one
  capability. A kind that no Feature brings, such as `page`, `read`, or `search`, starts in the
  starting Service, and the player can move it. A Feature that touches kinds in two capabilities
  goes with the kind it unlocks. When it unlocks none, the player picks.
- **A Node starts empty.** A new App Server runs no Service and serves nothing until the player
  deploys a Service to it. No balancer sends to it, because nothing listens on it. The Garage's first
  App Server starts on the starting Service, and a copy runs its source's Service.
- **A new Feature goes to the Service the player picks.** The target Service's Stack velocity
  applies to its Dev Hours, so a Feature in Python with FastAPI costs about half of the same Feature
  in Rust with Axum. A Feature that changes a kind another Service holds goes to that Service.
  Background Features (digests, exports, notifications, webhooks, push) are built in the language of
  the Workers that pull their `task`.
- **Moving a capability is a migration.** It costs the moved share of the codebase × 0.3 when the
  target Service runs the same language, and × the language factor when it does not.
- **Routing depends on the layer.** An L7 Load Balancer and an API Gateway read the path, so they
  send each kind only to the targets whose Service serves it. An L4 Load Balancer cannot read the
  path, so it sends every kind to every target, and a kind that reaches a Node without its
  capability fails as `misrouted` with no retry. A kind that no target serves fails as `no route`.
  The Churn breakdown names both causes.
- **A second Service comes at Seed.** Study `service-carve-out` (Seed, 600 ◇) lets the player carve
  a capability out into a new Service. The team that owns the source owns the new one, so the
  carve-out adds a codebase, a deploy timer, and a blast radius, but no team. `service-boundaries`
  stays at Series B and lets the player give a Service its own team, which is where the
  coordination gain comes from.
- **Each extra language costs velocity.** A team that owns Services in more than one language loses
  10% velocity for each language past the first. Hiring for a Service hires for its language, as it
  does today.

## Considered options

- **A Stack per Node.** The finest control, but two Nodes on different Stacks are two codebases
  with two deploy pipelines, and every rule that reads a Service (tech debt, blast radius, codebase
  size, ownership) would need a per-Node copy. Rejected.
- **Features assigned to Nodes directly.** Close to the player's view of the Board, but each
  unique Feature set on a Node is a Service without a name. We keep the action and change its
  meaning: assigning a capability to a Node moves the capability into that Node's Service, and
  assigning it to an empty Node carves out a new Service.
- **Misroutes always fail.** Simple, but placing a second Service behind the existing L7 balancer
  breaks traffic at once, which teaches a trap and not a decision. Rejected.
- **Balancers always route by kind.** Gentle, but an L4 balancer cannot see a path, and the API
  Gateway loses its purpose. Rejected.

## Consequences

- A save without a Stack per Service loads with every App Server on the starting Service, which
  takes the Stack its App Servers run most. A running migration stays on the starting Service.
- The L4 balancer is the cheap choice in front of one Service and stops working in front of two,
  which gives the L7 variant a second reason to exist.
- A Stack change no longer has to rewrite the whole product, so language migrations get cheaper.
  The Polyglot pacing bot and the Polyglot challenge need new targets.
- The shared database penalty applies only between Services with different owners, because one
  team agrees with itself on a schema change.
- What would change it: playtests that show players lose track of which Service runs where. A
  Service colour on each Node card needs no model change.
