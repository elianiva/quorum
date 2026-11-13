---
title: クラスタ間でテーブルを移す: GitHub
summary: GitHub は 1 つの MySQL クラスタをスキーマドメインに分割し、その後 Vitess と書き込みの切り替えでテーブルを別々のクラスタへ移しました。
section: patterns
group: Ran in production
order: 954
aliases: github, mysql, vitess, proxysql, partitioning, schema domains, monolith, スキーマドメイン, 分割, モノリス
---

GitHub.com は約 10 年間、`mysql1` という 1 つの MySQL クラスタで動いていました。2019 年までにそのクラスタは毎秒 100 万クエリ近くに答え、すべての機能が同じテーブルを共有していました。チームはまずコードを分割しました。テーブルは名前付きのスキーマドメインに入り、クエリがドメインの境界をまたぐとリンターがビルドを失敗させました。テーブルが動いたのはその後です。

## システム

移動には独立した 2 つの方法を使いました。Vitess は MySQL の前にプロキシを置き、バックグラウンドでテーブル全体をクラスタ間でコピーしました。独自の書き込み切り替えは通常の MySQL レプリケーションと ProxySQL に乗り、読み取り専用の窓は数十 ms でした。2021 年までに同じテーブルが複数のクラスタにまたがって毎秒 120 万クエリに答え、各ホストの平均負荷は半分になりました。

## ボード

::Design{id="github-move-tables"}

2 台のアプリサーバーは 2 つのスキーマドメイン、core と feature です。それぞれが ProxySQL を表す専用のコネクションプーラーと、専用のデータベースを持ちます。リードレプリカはプライマリから負荷を奪った読み取りコピーの 1 つです。ロードバランサーの種別はドメインの分割を表し、実際の読み取りと書き込みの分割ではありません。

## うまくいく理由

分割は物理より先に仮想的なものです。コードがドメインをまたいで結合できなくなれば、テーブルは 1 ドメインずつ移せ、誤りは 1 つのクラスタ内に留まります。[機能ごとにデータベースを分ける](/patterns/split-the-database-by-feature) と [展開と縮小（Expand and contract）](/patterns/expand-and-contract) が、移動を安全にする 2 つの段階です。

## ゲームが扱わない範囲

ゲームのコネクションプーラーは PgBouncer で、Vitess でも ProxySQL でもなく、テーブルでクエリを振り分けられません。ボードは 2 つのドメインと 2 つのデータベースを示し、リンターや VTGate プロセス、1 回の切り替えで動いた 130 のテーブルは示しません。キャプションは Quorum の結果で、GitHub のクエリレートではありません。

## 出典

- [Partitioning GitHub's relational databases to handle scale, The GitHub Blog](https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale): スキーマドメイン、リンター、Vitess、書き込みの切り替え。
- [Vitess documentation](https://vitess.io/docs/): プロキシ、VTGate と VTTablet のプロセス、シャーディングのモデル。
- [ProxySQL](https://proxysql.com/): GitHub が切り替えに使ったコネクションプーラー。
