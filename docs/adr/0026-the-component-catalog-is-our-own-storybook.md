# The component catalog is our own Storybook

A card has many states: idle, saturated, down, cold, selected. Checking one means building a Design that reaches it in the game, or finding a wiki page whose Design happens to show it. A card change needs a place to set a Node's ledger directly and see the card.

The wiki serves one at `/catalog`. A story tree lists the Components, a Pixi stage draws the card, and a panel of controls sets the Node and the ledger entry it draws. A link carries the story and the args that differ from their start, as Storybook's `args` parameter does.

## Decision

1. The catalog lives in `apps/wiki` (`src/catalog`, `src/submodels/catalog.ts`). It needs the Simulation and the board, and `packages/ui` may not import either into its primitives.
2. A story is data: a Component's id, its `argTypes`, and named states. The list comes from the catalog, so a new Component has a story with no edit. `catalog.test.ts` fails when a Component has none, or when a state does not draw.
3. A card is drawn from the Simulation's own ledger, with the args laid over one Node's entry. The States grid puts every state of a story on one board, so the page keeps one Pixi context.
4. The page is English only, and it is no wiki page. It stays out of `PAGES`, so search, the sitemap, the social cards, and the translations do not list it. It is `noindex`. Anyone can open it.
5. The controls use `@quorum/ui` primitives. The catalog's own labels are not Messages: it is a tool for people who build cards.

Considered options:

- **Storybook, Histoire, or Ladle.** All three mount React or Vue components. Our views are plain functions and the card is Pixi, so each needs an adapter, and the catalog would be a second app to deploy.
- **Tweakpane or lil-gui for the controls.** A dependency for what a switch, a select, and a range input already do.
- **Every primitive as a story.** Cards and Nodes are where states hide, so a primitive story teaches little. It would also be a new `kind` of story and a new test.

## Consequences

- A change to `rowsOf` or a component view shows up in the catalog with no edit to it.
- Controls cover what a Node and its ledger entry hold. A Component's own options (a cache's strategy, a Load Balancer's policy) are not controls.
- The catalog loads Pixi and the Simulation only on its own page, as the Node card does.
