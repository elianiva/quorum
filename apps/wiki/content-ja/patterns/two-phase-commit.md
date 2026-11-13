---
title: 2 フェーズコミット
summary: 2 フェーズコミットは、複数のデータベースが 1 つのトランザクションを一緒にコミットするか中断するかを決められるようにし、まず投票してからコミットしますが、コーディネーターが落ちるとブロックする代償があります。
section: patterns
group: Outside the game
order: 1008
aliases: two-phase commit, 2pc, xa, distributed transaction, atomic commit, coordinator, 2フェーズコミット, 分散トランザクション, 原子的コミット, コーディネーター
---

2 フェーズコミット（2PC）は原子的コミットのプロトコルです。コーディネーターがすべての参加者に準備を求め、全員が yes と投票したときだけコミットを指示します。

自分の管理する少数のデータベースにまたがってトランザクションがオール・オア・ナッシングでなければならず、レイテンシが許容できるときに使います。2 つのデータベースにある 2 つの口座の間でお金を移すのが教科書的な例です。第 1 フェーズでコーディネーターは両方に準備を求め、それぞれが変更を自分のログに書き、投票します。第 2 フェーズで、両方が yes と言えばコーディネーターはコミットを指示し、どちらかが no と言えば中断を指示します。

可用性と速度が犠牲になります。yes と投票した参加者は判定を聞くまでロックを保持するので、投票のあとにコーディネーターが死ぬと、参加者は待ち、他の何もそれらの行に触れません。すべてのトランザクションが余分な往復を払い、最も遅い参加者と同じくらい遅くなります。Pat Helland は 2007 年に、大規模でスケールするアプリケーションは分散トランザクションをほとんど前提にしないと論じました。そのもろさが可用性に受け入れがたい圧力をかけるためです。チームは通常、代わりにサーガやアウトボックスに進み、結果整合を受け入れます。

## Quorum で最も近いもの

ゲームに 2PC はありません。分散 SQL のノードは、Raft でレプリカの過半数を待つという別の方法で各書き込みの合意を得て、[合意形成データベース](/research/consensus)のリサーチがそれをアンロックします。[合意とリーダー選出](/patterns/consensus-and-leader-election)、[分散SQL](/components/dsql)のコンポーネント、[Raft](/glossary/raft)を参照してください。分散トランザクションなしの回避策は[トランザクショナルアウトボックス](/patterns/transactional-outbox)で、補償の側は[サーガ](/patterns/saga)が扱います。

## 参考

- [Two-phase commit protocol, Wikipedia](https://en.wikipedia.org/wiki/Two-phase_commit_protocol): 投票とコミットのフェーズ、手作業の修復が必要になる故障のケース。
- [Life beyond Distributed Transactions, Pat Helland (CIDR 2007)](https://www.cidrdb.org/cidr2007/papers/cidr07p15.pdf): スケールするシステムが分散トランザクションを避ける理由。
- [Saga pattern, microservices.io](https://microservices.io/patterns/data/saga.html): マイクロサービスでの通常の代替で、独自のトレードオフがあります。
