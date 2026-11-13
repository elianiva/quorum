---
title: 9 台のサーバー、1 つのデータベース: Stack Overflow
summary: Stack Overflow は 1 つの SQL Server と少数の大きな Web サーバーを保ち、その隣に Redis と Elasticsearch を置きました。
section: patterns
group: Ran in production
order: 950
aliases: stack overflow, stackexchange, monolith, scale up, one database, sql server, redis, elasticsearch, スケールアップ, モノリス, データベース 1 つ
---

Stack Overflow は 2016 年初頭に月およそ 2 億 900 万の HTTP リクエストを処理していました。9 台のプライマリ IIS Web サーバーが 4 台の HAProxy ロードバランサーの後ろでそれを受け、1 台の SQL Server プライマリ、ホットスタンバイ、読み取り専用コピー、2 台の Redis サーバー、3 台の Elasticsearch サーバーがありました。Nick Craver のアーキテクチャ連載がすべてのマシンを挙げています。

## システム

サイトは 1 つの .NET アプリケーションで、Stack Exchange ネットワーク全体にマルチテナントで、4 台の HAProxy ロードバランサーの後ろにありました。Redis が L1/L2 キャッシュを保持しました。Elasticsearch が検索に答えたので、データベースが見たのは書き込みとキャッシュミスだけでした。データベースはホットスタンバイ付きの大きな 1 台のままで、チームがもっと必要になったときはシャーディングを検討する前に RAM と速いディスクを買いました。

## ボード

::Design{id="so-nine-servers"}

ロードバランサーは 4 台の HAProxy を表します。9 つのアプリサーバーのコピーは 9 台のプライマリ IIS サーバーを表します。キャッシュは Redis、データベースは SQL Server のプライマリとそのスタンバイ、検索エンジンは 3 台の Elasticsearch です。リンクはリクエストの経路です。アプリはキャッシュを読み、ミスはデータベースへ渡り、検索は専用の層へ行きます。

## うまくいく理由

この形は、データベースから仕事を奪う 3 つにお金を使います。大きなバッファキャッシュ、Redis の層、検索の層です。データベースは書き込みと、Redis の層で外れた読み取りを引き受けます。[まずスケールアップ](/patterns/scale-up-first) は同じ判断で、[データベースのそばに検索を置く](/patterns/search-beside-the-database) が 3 つ目の層です。

## ゲームが扱わない範囲

Quorum には SQL Server がないので、ボードのデータベースは Postgres で動き、キャプションは Quorum の結果でサイトのレイテンシではありません。ボードは 384 GB のバッファキャッシュや読み取り専用の SQL コピーを表せません。示せるのは形です。キャッシュと検索の層を隣に持つ、1 つのプライマリデータベースです。

## 出典

- [Stack Overflow: The Architecture, 2016 Edition, Nick Craver](https://nickcraver.com/blog/2016/02/17/stack-overflow-the-architecture-2016-edition/): サーバー一覧、リクエスト数、キャッシュと検索の層。
- [Stack Overflow: The Hardware, 2016 Edition, Nick Craver](https://nickcraver.com/blog/2016/03/29/stack-overflow-the-hardware-2016-edition/): 各マシンの RAM、ディスク、ネットワーク。
- [Engineering Stack Overflow with Roberta Arcoverde, Hanselminutes #847](https://hanselminutes.com/847/engineering-stack-overflow-with-roberta-arcoverde): 同じアーキテクチャとそれを運用するチームの 2022 年の見方。
