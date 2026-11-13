---
title: ID にシャードを入れる: Pinterest
summary: Pinterest は 4,096 の MySQL シャードを動かし、各オブジェクトの 64 ビット ID にシャード番号を符号化したので、読み取りは参照サービスを必要としませんでした。
section: patterns
group: Ran in production
order: 960
aliases: pinterest, sharding, mysql, shard id, 4096 shards, memcached, redis, シャーディング, シャード, ID
---

2012 年に Pinterest は MySQL フリートのシャーディングを始めました。8 台の EC2 サーバーを動かし、4,096 の仮想シャードを作り、すべての 64 ビットのオブジェクト ID の上位 16 ビットにシャード番号を入れました。Pin の ID がそのシャードと種類と行を名指すので、アプリケーションは正しいデータベースへ直接接続します。

## システム

各シャードは 1 つの MySQL データベースで、設定テーブルがシャードの範囲をマスターとそのスタンバイに対応づけます。その組はマスター同士で複製され、本番はマスターにだけ読み書きするので、遅れたコピーが古い行を返すことはありません。オブジェクトは Memcached に、対応表は Redis に置かれます。2 つのアクセスパターンが違うストアに合うからです。忙しい範囲は新しい組へ分割され、容量は範囲ごとに増えます。

## ボード

::Design{id="pinterest-id-shards"}

データベースはハッシュキー上の 8 つのシャードで、4,096 シャードを表します。キーは ID 内のシャード番号を表し、ゲームにはその項目がありません。キャッシュは Memcached と Redis の層を 1 つのノードにまとめたもので、アプリサーバーは ID を復号する API です。

## うまくいく理由

ID がシャードを運ぶので、読み取りは 1 回の ID 復号と 1 回のデータベースクエリで済みます。フリートの前に参照サービスがなく、範囲が分割されても再ハッシュは要りません。[データベースをシャードする](/patterns/shard-the-database) が一般的な取引を扱い、[ホットキーとホットシャード](/patterns/hot-keys-and-hot-shards) がこの分割が答える失敗です。

## ゲームが扱わない範囲

ボードには 4,096 ではなく 8 つのシャードがあり、設定テーブルもマスター同士の組もありません。ハッシュキーはオブジェクト ID ではなくユーザーによります。またキャッシュは 1 つで、Pinterest は Memcached と Redis を並べて動かしています。キャプションは Quorum の結果で、Pinterest のトラフィックではありません。

## 出典

- [Sharding Pinterest: How we scaled our MySQL fleet, Pinterest Engineering](https://medium.com/pinterest-engineering/sharding-pinterest-how-we-scaled-our-mysql-fleet-3f341e96ca6f): 8 台のサーバー、4,096 のシャード、64 ビットの ID、設定テーブル、2 つのキャッシュ。
- [Shard or Do Not Shard: Pinterest's Hand-Built MySQL Fleet, behindscale](https://www.behindscale.com/articles/pinterest-sharding-mysql): ID に符号化したシャードと範囲の分割の詳しい解説。
- [MySQL replication, MySQL Reference Manual](https://dev.mysql.com/doc/refman/8.4/en/replication.html): マスター同士の組がどう構成され、スタンバイがどう昇格するか。
