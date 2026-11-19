---
title: Changelog
summary: What changed in Quorum over the last few days.
section: about
order: 3
aliases: changes, updates, release notes, patch notes, what is new
toc: top
---

Quorum has no versions. It changes all the time, and this page lists the latest days, newest first, so you can see what moved since you last played. A page on this wiki can lag behind the game by a few days. Older days are in the [full changelog](/about/changelog/all).

## Wednesday, 18 November 2026

### Changed

- Keep saved settings that still read when one saved setting does not ([55b9d94](https://github.com/elianiva/quorum/commit/55b9d9418676ba520cf0ada7fbe0db0cae72ccc3))

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

## Thursday, 12 November 2026

### Changed

- Speed up the simulation solve with dense per-pass caches ([3ed0c95](https://github.com/elianiva/quorum/commit/3ed0c95e30b0ec8610d27fab6b225e1eedf38290))
- Polish the install shell with maskable icons and startup images ([805ced8](https://github.com/elianiva/quorum/commit/805ced87339978f15d0ec2343480cfa53a73fc32))
- Build sound Nodes from the context, not from globals ([8de1b1b](https://github.com/elianiva/quorum/commit/8de1b1b40387c896929aa7b2e2be3a2819c6acd1))
- Stop Tidy from crashing on Links with no place ([2c710e5](https://github.com/elianiva/quorum/commit/2c710e5b59996abc3bb43ca27b4fbf4e656bb805))
- Add the changelog entry for 2026-11-11 (#49) ([f6ffca9](https://github.com/elianiva/quorum/commit/f6ffca9c730df1a55afd39df8370e0fd616a5f7d))
- Add a command palette over the board ([fa727da](https://github.com/elianiva/quorum/commit/fa727da928d515639d2997f83abb5dc96ae600b2))
- Write down feature keys ([9a23e91](https://github.com/elianiva/quorum/commit/9a23e91fb0eaf5b5bd9ed245993eea88be4d0aeb))
- Gate online Rooms behind a feature key ([23fc23b](https://github.com/elianiva/quorum/commit/23fc23b380625d8107229b9e84c481cb2dac5e27))

## Wednesday, 11 November 2026

### Changed

- Show the sectioned menu and settings in the wiki ([67f1e40](https://github.com/elianiva/quorum/commit/67f1e408a1d704176e0f8fa6bba3900ecfea3dfd))
- Rework the home menu and settings into sections ([41cd1e9](https://github.com/elianiva/quorum/commit/41cd1e955f1156c27e9ee10288d8a10ae512329a))
- Keep a panel above the scrim that blurs the board ([1bb68ca](https://github.com/elianiva/quorum/commit/1bb68ca3842024d2ebb90e66d772536a2d5672cf))
- Open the pause menu from the Sandbox HUD button ([21e4e55](https://github.com/elianiva/quorum/commit/21e4e55d59c7fc94280596968991ad5720e86285))
- Add the changelog entry for 2026-11-10 (#48) ([6bb6fcc](https://github.com/elianiva/quorum/commit/6bb6fcc4e06339918392a3eec648cf0b07d4f1ea))
- Remove the press page ([b835409](https://github.com/elianiva/quorum/commit/b835409bcf86774e4ee179e1944dd0d83fc59fa4))
- Give every Venture its own traffic profile ([dd286ff](https://github.com/elianiva/quorum/commit/dd286ff572fbc686cb86c2ba5ab4ed823b709824))
- Report board start failures to Sentry ([61c70f8](https://github.com/elianiva/quorum/commit/61c70f832ebf65355b1213413f75c29edac40761))
- Fix board start under a CSP without unsafe-eval ([05f269d](https://github.com/elianiva/quorum/commit/05f269d4454af1e30da8de9154ea3f22ca454d78))
- feat(web): import a Company from a save file on the title screen ([f2293dd](https://github.com/elianiva/quorum/commit/f2293dd2b4a83a4f82046c6c0966d3d0847a4a96))
- feat(web): move Company saves as files and prune unreadable ones ([8aec25e](https://github.com/elianiva/quorum/commit/8aec25ea8c2e201916918190ba1c6f72d71f08b6))
- Describe the reason first lever card in the wiki ([e289326](https://github.com/elianiva/quorum/commit/e289326240e3f3ac3fe620bd01dd7b381098ad88))
- Rework the Product lever card into a reason first hint ([047afe9](https://github.com/elianiva/quorum/commit/047afe9014307694af53ba1be5a77567a721a77d))
- Teach players to raise a pool with a product lever ([bfdae3c](https://github.com/elianiva/quorum/commit/bfdae3cf7ddeeab29eb5e5e6a738347f9f173c17))
- Record the product levers as built in the design record ([6769c39](https://github.com/elianiva/quorum/commit/6769c396496d1f90c8b2d01ab4d3a3252fd20b6e))
- Put product levers in the Research screen and the free Sandbox ([6f29014](https://github.com/elianiva/quorum/commit/6f2901477d2237376cb1344b567a0916bc0d7ac0))
- Build product levers into the Simulation ([8dd7b00](https://github.com/elianiva/quorum/commit/8dd7b00d0f654f592398418b22e6fff8d2319982))
- Trace product levers to real products and mark the baseline ([7299ef0](https://github.com/elianiva/quorum/commit/7299ef06d61f39a7c53c072c9a191afaaa3f3a74))
- Set the lever constants and put the mechanic on the roadmap ([52a19cf](https://github.com/elianiva/quorum/commit/52a19cf8e1921eeddc715a035c21766b2e58a7dc))
- Cap product levers by Venture and turn them off in Challenges ([c5a38b6](https://github.com/elianiva/quorum/commit/c5a38b6c4f4e6b9e850a2e7608a090b9b7116fb8))
