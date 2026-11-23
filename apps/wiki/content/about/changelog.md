---
title: Changelog
summary: What changed in Quorum over the last few days.
section: about
order: 3
aliases: changes, updates, release notes, patch notes, what is new
toc: top
---

Quorum has no versions. It changes all the time, and this page lists the latest days, newest first, so you can see what moved since you last played. A page on this wiki can lag behind the game by a few days. Older days are in the [full changelog](/about/changelog/all).

## Saturday, 21 November 2026

### Changed

- Make ARM cost capacity by language, and on data nodes ([36f0ffb](https://github.com/elianiva/quorum/commit/36f0ffb1845d9222555876437d01c6fa87ea4017))
- Make the pacing bot fix the worst failing kind after Series B ([a21efb4](https://github.com/elianiva/quorum/commit/a21efb4af6df03b01f9bc8d3016cf28fdb217bfe))
- Pin each server behind a consistent-hash Load Balancer, like sticky but evenly ([4935b1c](https://github.com/elianiva/quorum/commit/4935b1cc19b18480bb919c8b469abc0f9ce6ff20))
- Make the pacing bot skip a replica it cannot put a pooler in front of ([403d148](https://github.com/elianiva/quorum/commit/403d1484f3973821c1dfbb14f8321d0423134d9d))
- Let the Cache hot set grow with the square root of the Users ([4ca8423](https://github.com/elianiva/quorum/commit/4ca842372436986ce46dc4fd8722ac2668d30e6d))
- Unlock Load Balancer policies in the Solver once lb-algorithms is researched ([c8fb223](https://github.com/elianiva/quorum/commit/c8fb223743eaa2d84d974b0de5e4c7179ee5f5d3))
- Make Database disk I/O scale with load and let retention shrink the hot set ([befdc2c](https://github.com/elianiva/quorum/commit/befdc2c14d4727955a9646ea1cdcbaceb486a4af))
- Make server memory, GC tuning, shedding and leaks scale with load ([500bc2e](https://github.com/elianiva/quorum/commit/500bc2e2664bdf2e993c942e43a8fb2fbab979bb))

## Friday, 20 November 2026

### Changed

- Replace implicit phases with explicit state machines ([dd5f688](https://github.com/elianiva/quorum/commit/dd5f6882738c29d1b2a104400ac11e6423a5f519))
- Record the ADRs as current decisions and renumber the duplicates ([3aba303](https://github.com/elianiva/quorum/commit/3aba30308515fcb12da4ab32cd7ff52a19d52727))
- Remove the reference example, the art generator, and unused code, dependencies and exports ([42070c3](https://github.com/elianiva/quorum/commit/42070c367298adc112523a7812518170f407ad8d))
- Let idle teams boost the running Study ([f5c92f2](https://github.com/elianiva/quorum/commit/f5c92f21e2496eea2aaae0a44bd5ca21b18e0bee))
- Show what the Autoscaler is doing and what it does next ([1c4b845](https://github.com/elianiva/quorum/commit/1c4b84588a4e39b433c0f31adec4bf20e380d3b2))
- Show which Link runs past its timeout on the Dashboard ([430a166](https://github.com/elianiva/quorum/commit/430a166238b2154a80468330eda4de8639ef18b7))
- Replace the running build when a deploy lands ([fe8640f](https://github.com/elianiva/quorum/commit/fe8640fbd90cd0f747e1dc108788af94b1ec9397))

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
