---
title: Changelog
summary: What changed in Quorum over the last few days.
section: about
order: 3
aliases: changes, updates, release notes, patch notes, what is new
toc: top
---

Quorum has no versions. It changes all the time, and this page lists the latest days, newest first, so you can see what moved since you last played. A page on this wiki can lag behind the game by a few days. Older days are in the [full changelog](/about/changelog/all).

## Thursday, 19 November 2026

### Changed

- Show the Cache's memory and load, and name a low hit ratio's cause ([19b4517](https://github.com/elianiva/quorum/commit/19b4517b993f599ab81e4ce35aa0b230b6b5cc88))
- Open the Component's wiki page from the Inspector ([d72d04a](https://github.com/elianiva/quorum/commit/d72d04abbf968b0d05a08cab60bd2082b8487559))
- Return cancelled work in progress to the queue ([59840c8](https://github.com/elianiva/quorum/commit/59840c8e55dec512c70d3d47d00d8312cc78fdf9))
- Put the whole menu on one spine and move Settings into the list ([0c4d771](https://github.com/elianiva/quorum/commit/0c4d77155de0266e908818c2c735ec7a5deab1d7))
- Turn the menu into a tree on a panning canvas ([786aff3](https://github.com/elianiva/quorum/commit/786aff32728b558ae4eacd74428175725447b1aa))
- Add the changelog entry for 2026-11-18 (#62) ([768de40](https://github.com/elianiva/quorum/commit/768de40903e103fdfa0ed6b4bd512a49da062663))
- Add the changelog entry for 2026-11-17 (#61) ([a60af49](https://github.com/elianiva/quorum/commit/a60af49b388488991628ff20f0dd6d154942d538))

## Wednesday, 18 November 2026

### Changed

- Keep saved settings that still read when one saved setting does not ([55b9d94](https://github.com/elianiva/quorum/commit/55b9d9418676ba520cf0ada7fbe0db0cae72ccc3))

## Tuesday, 17 November 2026

### Changed

- Move type-aware lint to tsrs and bump dependencies ([518e651](https://github.com/elianiva/quorum/commit/518e65180f24e809ee4a656b80d7263be4c61987))
- Add the changelog entry for 2026-11-16 (#60) ([2f8f191](https://github.com/elianiva/quorum/commit/2f8f191948d63c9a05112e950bd77bad6df573ce))
- Remove all comments and carry their intent in names, constants and helpers ([04d6e9e](https://github.com/elianiva/quorum/commit/04d6e9eb815c5394678b1209f9d79f01b1805f87))
- Open online Rooms to everyone, hold 20 Seats, and cap the deployment at 20 live Rooms ([39e2de3](https://github.com/elianiva/quorum/commit/39e2de3c1dade07536ea29b6b182ec6bbb08b6d7))
- Open the phone Inspector as a bottom sheet and slide the tapped card clear of it ([516f65a](https://github.com/elianiva/quorum/commit/516f65a3c5317e93bab25f3b22ad7d9430f83a09))

## Monday, 16 November 2026

### Changed

- Draw the Dashboard's Node table once per solve ([e6fd216](https://github.com/elianiva/quorum/commit/e6fd216ac84de5bf1d69f7b6ecde3decc35b49a7))
- Look up each Node's Autoscaler once per Step, not once per Link ([db99f13](https://github.com/elianiva/quorum/commit/db99f13ce001743b2c8230c08f6039756021625e))
- Memoize the Dashboard's Charts and stat tiles on what they are drawn from ([1525167](https://github.com/elianiva/quorum/commit/15251673d6bee2217b716f32f72001af7f4797b3))
- Memoize the Dashboard's per-Node panels on the Nodes and the Ledger ([293a1f5](https://github.com/elianiva/quorum/commit/293a1f56f892edf44c8ad1daa73680fbb1226fd5))
- Give the views one Ledger object per solve ([5fb9992](https://github.com/elianiva/quorum/commit/5fb999209f0c2025ebdf67c6a91a9407daa8404f))
- Keep the Game's list of Nodes through a Step that changed none ([a92b133](https://github.com/elianiva/quorum/commit/a92b1333d6a37424281366bd817936d3f99b0bd9))
- Keep Company files in IndexedDB, with the old localStorage key as the fallback ([dc701f3](https://github.com/elianiva/quorum/commit/dc701f3909bf6202ab4eea0ebb4b240bca8b098b))
- Solve an open incident once a second while the solve reads the same incident ([31f7798](https://github.com/elianiva/quorum/commit/31f779830d07f8197081935d1c232f596aafa755))
- Keep the Solver's compiled Design between solves that changed no Node or Link ([b0c1745](https://github.com/elianiva/quorum/commit/b0c1745ca779310855c26c6477cab0b6550657f8))
- Memoize the Dashboard's Node table rows and Node timelines ([8f8953e](https://github.com/elianiva/quorum/commit/8f8953eaeea133857702eba06a30ef0cba7e5c67))
- Map each Node's load history for the board once per history ([56f90f4](https://github.com/elianiva/quorum/commit/56f90f496369dd5b4d9caf14a5008490f758d53f))
- Reuse the board's boxes, replication lines, and focus path between frames ([a491855](https://github.com/elianiva/quorum/commit/a491855971938b22a000ccf1e8f7188e1cb4eec7))
- Memoize the Dashboard's LCD gauges ([2cd1d14](https://github.com/elianiva/quorum/commit/2cd1d14712b7099b4315f8f8abb82f2174dde9e9))
- Memoize each item of the Research tree ([5a134c0](https://github.com/elianiva/quorum/commit/5a134c036e87495914634c41208dbe96af5982ec))
- Look up a Company's agent Room once, not after every Message ([8652212](https://github.com/elianiva/quorum/commit/86522122addc39283dc27643168479a5af7481da))
- Give the Dashboard's latency stat its own key ([083cec9](https://github.com/elianiva/quorum/commit/083cec9eb05ef97881864ea434b6c5d1af927081))
- Split the web app's one chunk into libraries, catalog, copy, and game ([585cf89](https://github.com/elianiva/quorum/commit/585cf891ad6d98ac91604b5b93f7c2d868bf0826))
- Reuse the Dashboard's rows and annotations between Samples ([424cb44](https://github.com/elianiva/quorum/commit/424cb44fa7854d7edb1499284b460a651b98480b))
- Cap a chart's hover targets at 240 ([88fa1b2](https://github.com/elianiva/quorum/commit/88fa1b22b37f8f7edf94c96e00b8e662945404a3))
- Remove the Bottleneck search the browser no longer runs ([3edd866](https://github.com/elianiva/quorum/commit/3edd8666513892e2f0b14156bb49eb173aa30451))

## Sunday, 15 November 2026

### Changed

- Explain that the game's name comes from the quorum term ([7805061](https://github.com/elianiva/quorum/commit/78050610ef0144f9f196ddffe6c4c407118a84fd))
- Add system design interview guides, concept hubs, and query-shaped titles ([2461054](https://github.com/elianiva/quorum/commit/2461054aa645a17109f1f8e6a8c408afc86d18e3))
- Add seoTitle, FAQ and learning-resource data, and links to the new hubs ([ce2caaf](https://github.com/elianiva/quorum/commit/ce2caaf5f0102070bd54bb1fff5de235503019d6))
- Note that the Cache graph is a simplification of cache-aside ([e8da189](https://github.com/elianiva/quorum/commit/e8da189d994fb455b802d33b6f21a6fd3ac27b16))
- Answer unknown game paths with a real 404 ([94fbc2e](https://github.com/elianiva/quorum/commit/94fbc2e06077f656f693fb50bc8b4d85e27620a9))
- Improve search metadata for the game and the wiki ([6d62265](https://github.com/elianiva/quorum/commit/6d62265002abd4de10dfa4e395a5b6d81a02e925))

## Saturday, 14 November 2026

### Changed

- Put the Cache left of the Pooler in Tidy ([b25e62d](https://github.com/elianiva/quorum/commit/b25e62dce69cdedd241099c50fc7fa552032b2c4))
- Cache the shell at / so the service worker never serves a redirect ([a383859](https://github.com/elianiva/quorum/commit/a3838599fd728eb833ae22da8cfe120c8bdea231))
- Load the wiki app only when a page needs it ([8b5a6da](https://github.com/elianiva/quorum/commit/8b5a6da4d55484f6865e34a042f48c36f96dc5b4))
- Pick the board renderer from what the browser can run ([eca1aa1](https://github.com/elianiva/quorum/commit/eca1aa118eef466148a59b04f327b1420e01207d))
- Allow WebAssembly compile in the web CSP ([4f759ab](https://github.com/elianiva/quorum/commit/4f759abdc2ceba291017af37988754d4490f74bf))
- Merge shared styles with css() so an override wins again ([d121ac6](https://github.com/elianiva/quorum/commit/d121ac6fbf9a4e25f460287ab93a04b3bc2707f7))
- Replace a trapped Solver, drop the blocks it never reads, and tidy the host ([7a9e0ca](https://github.com/elianiva/quorum/commit/7a9e0ca8b418575883432b0bd8916886d77b1923))
- Precache the Solver and keep a failed solve away from the Bottleneck search ([02c9e0d](https://github.com/elianiva/quorum/commit/02c9e0d182cae3ee2ff7b4706b3779af30ed55d9))
- Replace leftover Tailwind classes with Panda and shorten the class prefix to q ([9717cac](https://github.com/elianiva/quorum/commit/9717cac2c150fa070896017cba536e9675668fb9))
- Use dark ink for group badges in dark mode ([5ff981f](https://github.com/elianiva/quorum/commit/5ff981f0ed539fe97e3d39e0fff443dd7e5e0026))
- Use the shared design tokens across the interfaces ([ea8a41e](https://github.com/elianiva/quorum/commit/ea8a41eb4aa52e4afeb83da155cc6ad51350a121))
- Add the changelog entry for 2026-11-13 (#54) ([30af726](https://github.com/elianiva/quorum/commit/30af726de877663574339a638d84db410fe83a98))
- Add the shared type, radius, motion, and shadow tokens ([0961d27](https://github.com/elianiva/quorum/commit/0961d278c1aabcf946280d186cf99c6e8978f8cd))
- Add light and dark mode to the wiki ([6e8be0e](https://github.com/elianiva/quorum/commit/6e8be0e99386d6d290ae7eb73c4e403fda73f0dd))
- Use Panda tokens across the game views ([a023ecc](https://github.com/elianiva/quorum/commit/a023ecc1b71e12b05165ed124288380b478d1463))
- Use Panda tokens in the shared controls ([7e87df7](https://github.com/elianiva/quorum/commit/7e87df73fbcb90981af11f69f9ac4d448c1fb810))
- Make Panda tokens follow the dark theme ([9266d81](https://github.com/elianiva/quorum/commit/9266d81c0e38bc30fa9de6af3303901968eb66bd))
- Use Panda's class joiner directly ([f036b09](https://github.com/elianiva/quorum/commit/f036b096a2cc4725b969997bf37bc9ab070255d3))
- Remove Tailwind from the build ([1b89b5e](https://github.com/elianiva/quorum/commit/1b89b5e5183aa4e876f343691b6ad38a5748551c))
- Move the app shell and lab views onto Panda CSS ([6ecc403](https://github.com/elianiva/quorum/commit/6ecc403f685600b6d79997fc8589e7933fe02fa5))

## Friday, 13 November 2026

### Changed

- Serve the wiki in Japanese ([86704dd](https://github.com/elianiva/quorum/commit/86704ddb17d43b7fdcc5c76af3f46610f3927433))
- Write the wiki's pages in Japanese ([b68afe7](https://github.com/elianiva/quorum/commit/b68afe7797487f790b413eeb5c0bdffc7d121999))
- Translate the wiki's interface copy into Japanese ([18838f6](https://github.com/elianiva/quorum/commit/18838f64b1937987904b72d345cfc785f650d048))
- Add the changelog entry for 2026-11-12 (#53) ([faa9781](https://github.com/elianiva/quorum/commit/faa9781ff220f726e824a67ac7810d4d267b9f77))
- Reuse each Node's calls and cost table while the Design holds ([7bd3cfa](https://github.com/elianiva/quorum/commit/7bd3cfaffbe1902de8662dfc5132fb8ef3bebea6))
- Serve the wiki in Spanish (#51) ([6b464be](https://github.com/elianiva/quorum/commit/6b464bedc4b33f51853653b29b0d6773312b3d8f))
- Keep the Graph while the Design holds, and stop copying lists on every Link ([1e82900](https://github.com/elianiva/quorum/commit/1e82900ac337f52c280431c9558fa55bc2195596))
- Build the Era's mix once per Game, and share one probe record across its Nodes ([9bffae3](https://github.com/elianiva/quorum/commit/9bffae348c0a0a52ac5da80bb401d2eace341087))
- Make the solve stop when it settles, and score the bottleneck on revenue alone ([674b035](https://github.com/elianiva/quorum/commit/674b035724e5a76de3101bdf213a3805368a2e1f))
- Add the installable PWA shell and offline play ([e86e17a](https://github.com/elianiva/quorum/commit/e86e17ace69a469b4e00ee66f02e4b2ad03ecf24))
