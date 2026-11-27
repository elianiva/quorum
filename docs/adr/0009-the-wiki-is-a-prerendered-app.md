# The wiki is a separate prerendered app

Players need one place to learn how Quorum works: what each Component does, why a Design breaks,
and how to fix it. Upload Labs players quit partly because "this game barely has any
documentation" ([Influences](https://github.com/elianiva/quorum/blob/main/apps/wiki/content/design/02-influences.md#why-players-quit)). The wiki lives in
`apps/wiki` and is served at `https://wiki.playquorum.dev`.

The wiki is an `@effect/ui` app. `HtmlServerVite` builds the client and server entries, and
`scripts/site-artifacts.ts` requests every page and writes a static HTML file, so pages load fast and
search engines read them. The client hydrates the page and starts the header controls, quizzes,
figures, and practice boards. `Cloudflare.Website.StaticSite` in `alchemy.run.ts` deploys
`apps/wiki/dist/site`; the wiki has no API and no custom Worker.

Content comes from two places:

- **Numbers, unlocks, and lists** come from `@quorum/simulation`'s catalog at build time, as the
  Path of Exile wiki exports its data from the game files. A writer never types a stat, so the wiki
  cannot disagree with the game. Each page shows the `SIM_VERSION` it matches.
- **Prose** is Markdown in `apps/wiki/content`, compiled by `@effect/ui/html/MarkdownVite`.
  Directives such as `::TradeoffCard{component="lb"}` place real game views in the text. An unknown
  island or attribute fails the build.

The design document lives in the wiki's `design` section ([ADR 0014](./0014-the-design-document-lives-in-the-wiki.md)).
It holds balance targets and open questions that players must not read as facts, and the player pages
rewrite it for them.

Considered options:

- **Pages inside `apps/web`.** One deploy, but the game's bundle, Pixi board, and client-side
  routing would load for every reader, and the pages would not be static HTML. Rejected.
- **A hosted wiki (MediaWiki, wiki.gg, Fandom).** Familiar editing, but no real game views, and
  stats copied by hand drift from the catalog. Rejected.
- **Publish the GDD as is.** No extra writing, but it mixes targets, roadmap, and rules, and it is
  written for developers. Rejected; the design pages stay a section of their own.

## Consequences

- All content is visible by default and an Era filter folds later Eras.
- The wiki serves English, Spanish, and Japanese, and each non-default locale has a route prefix.
- Community edits arrive as pull requests on `apps/wiki/content`.
- The mini-board replays a guided Sandbox and cannot be edited.
- Tests in `apps/wiki` fail when a catalog id has no page, an internal link has no target, or the
  version history has no entry for the current `SIM_VERSION`.
- The wiki depends on `@quorum/simulation` and `@quorum/ui` ([ADR 0010](./0010-ui-package.md)),
  never on `apps/web` or `packages/rpc`.
- What would change it: a need for reader accounts or comments, which would need an API.
