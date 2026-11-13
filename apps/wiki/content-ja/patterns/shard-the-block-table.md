---
title: ブロックテーブルをシャードする：Notion
summary: Notion はブロックテーブルを 480 の論理シャードに分け、変更を Kafka 経由でデータレイクへ流しました。
section: patterns
group: Ran in production
order: 957
aliases: notion, postgres, sharding, cdc, data lake, kafka, s3, シャーディング, データレイク, 論理シャード
---

Notion はページを構成する単位であるブロックを、5 年間 1 つの Postgres データベースに保っていました。2021 年までにブロックテーブルは 200 億行を超え、`VACUUM` が止まり始めました。チームはそれを 32 の物理データベースにまたがる 480 の論理シャードに分け、2023 年には 480 の論理シャードを保ったまま 96 の物理データベースへ増やしました。

## システム

論理シャードは Postgres のスキーマで、物理データベースがそのいくつかを持ちます。アプリケーションがシャードを知っているので、キーがあるクエリは 1 つのデータベースへ行きます。アナリティクスの経路はプライマリから離れました。Debezium が Postgres の書き込み先行ログを読み、Kafka が変更を運び、Hudi がそれを S3 に書きます。2024 年までにレイクは毎秒数十メガバイトの行の変更を扱い、ブロックテーブルは 2,000 億行を超えていました。

## ボード

::Design{id="notion-block-shards"}

データベースはハッシュキーで 4 つのシャードを持ち、480 の論理シャードを表します。CDCコネクターは Debezium、イベントストリームは Kafka、データウェアハウスは変更が着地するレイクです。アプリは二度書きません。ブロックを書き、コネクターがその変更を読みます。

## なぜ効くのか

シャードはオンラインのテーブルを、`VACUUM` と 1 台のマシンの IOPS に収まる大きさに保ちます。ログはアナリティクスをプライマリから離し、レイクに順序だった変更のストリームを与えます。[変更データキャプチャ](/patterns/change-data-capture)と[オブジェクトストレージとライフサイクルルール](/patterns/object-storage-and-lifecycle-rules)が 2 つの経路です。

## ゲームが止まるところ

ボードには 480 ではなく 4 つのシャードがあり、物理データベースの中にスキーマはありません。Hudi も、チームが置き換えた 480 の Fivetran コネクターも、レイクが書き込む S3 の層も、切り替えを安全にしたダークリードも示しません。キャプションは Quorum の結果で、Notion の変更レートではありません。

## 出典

- [Herding elephants: Lessons learned from sharding Postgres at Notion, Notion](https://www.notion.com/blog/sharding-postgres-at-notion): 480 の論理シャード、32 の物理データベース、そしてマイグレーション。
- [The Great Re-shard: adding Postgres capacity (again) with zero downtime, Notion](https://www.notion.com/blog/the-great-re-shard): 96 の物理データベースへの移行とシャードマップ。
- [Building and scaling Notion's data lake, Notion](https://www.notion.com/blog/building-and-scaling-notions-data-lake): Debezium、Kafka、Hudi、S3、そして 2,000 億行のブロック。
