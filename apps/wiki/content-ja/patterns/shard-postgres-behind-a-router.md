---
title: ルーターの後ろで Postgres をシャードする：Figma
summary: Figma は Postgres を手放さず、垂直分割が尽きたあとに水平シャードの手前にクエリルーターを構築しました。
section: patterns
group: Ran in production
order: 958
aliases: figma, postgres, sharding, dbproxy, query router, scatter gather, シャーディング, クエリルーター, スキャッターギャザー
---

Figma は 2020 年に AWS の最大の物理インスタンスで 1 つの Postgres データベースを動かしていました。2 年後にはキャッシュ、リードレプリカ、十数の垂直分割されたデータベースを持ち、それでも最大のテーブルは数テラバイトと数十億行を抱えていました。それらのテーブルの `VACUUM` はトランザクション ID の上限に触れる危険があり、垂直分割の最小単位はテーブル 1 つです。

## システム

チームはアプリケーション層で水平にシャードし、そのシャードを物理データベースへ移しました。DBProxy と呼ばれるサービスが各 SQL クエリを解析し、キーを持つシャードへ送ります。シャードキーのないクエリはすべてのシャードにまたがる scatter-gather になるので、アプリケーションがキーを渡す必要があります。最初のテーブルには約 9 か月かかり、Figma はシャードしていない Postgres をロールバック経路として残しました。

## ボード

::Design{id="figma-shard-router"}

コネクションプーラーが DBProxy を表し、すべての書き込みとトランザクションがそれを経由してデータベースへ行きます。データベースはハッシュキーで 4 つのシャードを持ちます。キャッシュは繰り返される読み取りをルーターに届く前に返します。キーのない読み取りが高くつく場合なので、ボードはルーターを書き込み経路に置いています。

## なぜ効くのか

Postgres はそのままなので、プロダクトのコードとリレーショナルモデルもそのままです。ルーターがアプリケーションからシャードマップを隠し、キャッシュが最もホットな行を scatter-gather の経路から外します。[データベースをシャードする](/patterns/shard-the-database)と[コネクションプーリング](/patterns/connection-pooling)が 2 つの部品です。

## ゲームが止まるところ

ゲームのコネクションプーラーは PgBouncer で、クエリエンジンではありません。SQL を解析することも、キーでルーティングすることも、scatter-gather もできません。ボードは形を示します。1 つのルーター、多くのシャード、手前のキャッシュです。キャプションは Quorum の結果で、Figma のクエリレイテンシではありません。

## 出典

- [How Figma's databases team lived to tell the scale, Figma](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale): 垂直パーティション、DBProxy、シャードの展開、最初のテーブルに要した 9 か月。
- [PostgreSQL documentation: VACUUM](https://www.postgresql.org/docs/current/sql-vacuum.html): トランザクション ID の上限が分割を強いる理由。
- [PostgreSQL documentation: Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html): トランザクション ID の周回と、テーブルが育つコスト。
