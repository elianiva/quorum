---
title: CQRS（コマンドとクエリの責務分離）
summary: CQRS はデータを変えるモデルと読むモデルを分けるので、両側をそれぞれの仕事に合わせて形作り、スケールできます。
section: patterns
group: Outside the game
order: 1002
aliases: cqrs, command query responsibility segregation, read model, write model, query side, CQRS, 読み取りモデル, 書き込みモデル, クエリ側, 責務分離
---

CQRS は、状態を変えるコマンドと、それを読むクエリに別々のモデルを使います。2 つは 1 つのサービスの中の別のクラスでも、別のデータベースでもかまいません。

読み取りと書き込みが違う形をしているときに使います。チェックアウトは正規化した注文を 5 つのテーブルに書き込みますが、注文履歴のページは商品名がすでに入った注文ごとの 1 行の平坦な行を求めます。そのページ向けに作られ、書き込み用ストアとは別にスケールする読み取りストアなら、1 回の参照で答えます。共同作業やタスク中心の画面も得をします。コマンドを小さく具体的にできるので衝突が少なくなるからです。

コストは歩調を合わせる 2 つ目のモデルです。読み取りストアが別なら結果整合なので、ユーザーは注文を保存しても一瞬それを見られず、コードがそれに対処しなければなりません。両側の間のメッセージングは重複とリトライをもたらします。Martin Fowler は、ほとんどのシステムでは CQRS が危険な複雑さを足し、素の CRUD 設計のほうが多くのドメインに合うと警告しています。モデルを分ける前にリードレプリカかビューから始めます。

## Quorum で最も近いもの

ゲームはモデルを分けずに読み取り側を作ります。[リードレプリカ](/patterns/read-replicas)は遅れたコピーからクエリに答え、[Materialized view と非正規化](/patterns/materialized-views-and-denormalization)はページが必要とする答えを保存します。[変更データキャプチャ](/patterns/change-data-capture)は書き込みログから 2 つ目のストアを養い、[CDC コネクタ](/components/cdc)がそのコンポーネントです。リサーチ[非正規化](/research/denormalization)と[変更データキャプチャ](/research/cdc)を行い、レポートでの同じ考えは[OLTP と OLAP の分離](/patterns/oltp-and-olap-split)を読んでください。

## 参考資料

- [CQRS, Martin Fowler](https://martinfowler.com/bliki/CQRS.html): 短い定義と、ほとんどのシステムには不要という警告。
- [CQRS pattern, Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs): ストアの分離、一貫性の問題、使う場面。
- [CQRS, microservices.io](https://microservices.io/patterns/data/cqrs.html): CQRS がサービスをまたぐクエリにどう答えるか。
