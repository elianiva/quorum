---
title: CRDT（競合しない複製データ型）
summary: 競合しない複製データ型は、各レプリカが自分で書き込みを受け付け、それでも調整なしに同じ状態へマージできるようにします。
section: patterns
group: Outside the game
order: 1009
aliases: crdt, conflict-free replicated data type, merge, collaborative editing, offline first, g-counter, local-first, CRDT, 競合しない複製データ型, マージ, 共同編集, オフラインファースト
---

CRDT は、同じ更新を見た任意の 2 つのレプリカが、更新が届いた順序にかかわらず同じ状態に至るように作られたデータ構造です。crdt.tech のサイトは、競合の解決を自分でやってくれるものと説明しています。

レプリカが切断されたまま書き込み続けなければならないときに使います。2 台の電話が飛行機の中で共有の買い物リストを編集します。それぞれがオフラインで項目を足し、着陸して同期します。add-wins セットなら、片方の電話が足した項目は、もう片方が同時に消しても残り、サーバーが決めることなく両方の電話が同じリストを示します。カウンタ、セット、レジスタ、テキストの系列にはすべて CRDT の形があり、共同編集のエディタがそれを使っています。

コストは設計の自由です。各型には固定のマージ規則があるので、add-wins のように望まなかった規則が埋め込まれます。メタデータが増えます。レプリカは削除した項目の墓碑やレプリカごとのカウンタのベクタをしばしば保つので、状態を圧縮する必要があります。「在庫は 0 を下回らない」のような不変条件は調整なしには守れず、それがこのトレードオフの要点です。CRDT は、どんなマージ結果でも受け入れられるデータに選びます。

## Quorum で最も近いもの

ゲームに CRDT はありません。最も近い考えは、複数のレプリカで書き込みを受け付け、後で調整するストアです。[リーダーレスレプリケーション](/glossary/leaderless-replication)を持つワイドカラムストアがこれを行い、リサーチ[リーダーレスレプリケーション](/research/leaderless)がそれをアンロックします。その古い読み取りが[結果整合性](/glossary/eventual-consistency)のコストで、弱い[クォーラム](/glossary/quorum)がその調整つまみです。背景として[レプリケーション戦略](/patterns/replication-strategies)と[一貫性モデル](/patterns/consistency-models)を読んでください。

## 参考資料

- [About CRDTs, crdt.tech](https://crdt.tech/): 短い定義と分散動作の根拠、論文へのリンク。
- [CRDT Glossary, crdt.tech](https://crdt.tech/glossary): add-wins セット、状態ベースと操作ベースの型、デルタ CRDT を定義しています。
- [Conflict-free Replicated Data Types (Preguiça, Baquero, Shapiro, 2018)](https://arxiv.org/abs/1805.06358): 収束の性質を述べた概説論文。
