---
title: Changelog
summary: What changed in Quorum over the last few days.
section: about
order: 3
aliases: changes, updates, release notes, patch notes, what is new
toc: top
---

Quorum has no versions. It changes all the time, and this page lists the latest days, newest first, so you can see what moved since you last played. A page on this wiki can lag behind the game by a few days. Older days are in the [full changelog](/about/changelog/all).

## Monday, 23 November 2026

### Changed

- Restyle the Node card around a frame hierarchy and add a Placement row ([97fbe08](https://github.com/elianiva/quorum/commit/97fbe08735e32d2f102438ca0df81d6bcf974cb4))
- Draw earned badges flat on the tree and drop the bus wire's pointer block ([6e6c728](https://github.com/elianiva/quorum/commit/6e6c72863d71bec90f51502192eb44e3d2b046e1))
- Gate Chat, AI assistant, Push notifications and Activity feed on the research that fixes their kind ([491c7c0](https://github.com/elianiva/quorum/commit/491c7c05987974d3ecdf4d2670ef03cb89a41650))
- Fix the Exit and describe each Era in full ([64b6de9](https://github.com/elianiva/quorum/commit/64b6de96bf56dd15c4a89e790a4ba6152d3c81af))
- Add the changelog entry for 2026-11-22 (#67) ([9a07ffd](https://github.com/elianiva/quorum/commit/9a07ffd7b34f5cdae74e7d4e661ee1d510d401db))
- Add the changelog entry for 2026-11-21 (#66) ([252a851](https://github.com/elianiva/quorum/commit/252a8515bcfd3738ab0973d5431832784706e49e))
- Add the changelog entry for 2026-11-20 (#65) ([cb1273f](https://github.com/elianiva/quorum/commit/cb1273f5ea69a761a834a4e993ce1f2a613ad05c))
- Add the changelog entry for 2026-11-19 (#64) ([3643879](https://github.com/elianiva/quorum/commit/364387940d7fbef23ba8d4d5281b89b1baf0539c))

## Sunday, 22 November 2026

### Changed

- Describe the two shop modes in the docs ([16b71a7](https://github.com/elianiva/quorum/commit/16b71a7ea3c2baa7f6f4741c1c57225cc5dafab5))
- Offer both catalogs after Custom instances ([b242162](https://github.com/elianiva/quorum/commit/b24216220f120d29b65aef20d32cf8da08be868c))
- Add the instance catalog to the shop ([15a1420](https://github.com/elianiva/quorum/commit/15a142051158cf925a5fadf6903f1b96a47e0ff4))
- Gate the Parts behind Custom instances ([51fbc7a](https://github.com/elianiva/quorum/commit/51fbc7a194a886cb5324e01045c47a9e8592e777))
- Adjust the Parts for the rebased balance ([febe16c](https://github.com/elianiva/quorum/commit/febe16c2508e3a43a7efdef367e98847b8e0931b))
- Update the wiki and design record for the balance, cache engine, ARM and GPU changes ([646e45b](https://github.com/elianiva/quorum/commit/646e45b9e559d5f1f6742c4217eea45781b75a40))
- Give Redis and Memcached real tradeoffs and make ARM cost Dev Hours to port ([37d2a2b](https://github.com/elianiva/quorum/commit/37d2a2b04fc8fb0a0fa95977376a6eb42ceb5f4e))
- Record the Redis, Memcached and ARM porting tradeoffs in the reality check ([32bbda6](https://github.com/elianiva/quorum/commit/32bbda6deafef49e444ba0511162d6572daec238))
- Move Cache engines, ARM and GPU precision toward real figures ([0abb716](https://github.com/elianiva/quorum/commit/0abb716905e9ce5e8651b72d831562ce8dbb6ab6))
- Document the balance numbers that are tuned on purpose, and the real figures behind them ([22eb7bf](https://github.com/elianiva/quorum/commit/22eb7bfda7150063d7561598719be714c496e363))
- Replace the pool size stepper with a log slider that shows how many workers RAM fits ([a5599d6](https://github.com/elianiva/quorum/commit/a5599d64603e65a5373af04c77492f617d5a3e98))
- Make each prefetched Worker task hold RAM ([86cf66a](https://github.com/elianiva/quorum/commit/86cf66af0bee46972b086045d58b4558e806151d))
- Make INT4 and INT8 serving cost answer quality and lengthen the batch delay ([5a35895](https://github.com/elianiva/quorum/commit/5a35895a515a7dd82f37c6f63eda7eb8ec8b66dd))

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
