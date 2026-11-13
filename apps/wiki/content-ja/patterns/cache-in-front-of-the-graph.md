---
title: グラフの前のキャッシュ: Meta
summary: Meta はシャーディングした MySQL の前にライトスルーの memcached 層を置き、シャードごとに 1 つのプライマリリージョンを保ちました。
section: patterns
group: Ran in production
order: 956
aliases: meta, facebook, tao, memcached, social graph, write through, sharding, Meta, ソーシャルグラフ, ライトスルー, シャーディング, キャッシュ
---

Facebook は 2013 年に TAO を作り、ソーシャルグラフの読み取りの多いクエリを、すべて MySQL に送らずに答えるようにしました。TAO はライトスルーのキャッシュです。読み取りは memcached から返り、書き込みはキャッシュを通ってオブジェクトを所有するシャードへ行きます。データセットは数十万のシャードに分割され、各シャードには 1 つのプライマリリージョンがあります。

## システム

API は小さく固定されています。オブジェクトを取得する、その外向きのエッジを取得する、数える、範囲を反復する、の 4 つです。TAO サーバーがリージョン間でキャッシュの一貫性を保ち、MySQL のレプリケーションが各シャードの更新をプライマリリージョンからセカンダリリージョンへ運びます。セカンダリリージョンは書き込みをプライマリへ転送し、そのライトスルーのキャッシュが変更した本人に対して read-after-write の一貫性を保ちます。2022 年までに TAO は毎秒 10 億リクエスト以上を処理しました。

## ボード

::Design{id="meta-cache-graph"}

キャッシュは TAO の memcached 層で、ライトスルーなので書き込みがキャッシュとデータベースの両方を更新します。データベースはハッシュキーで 8 つのシャードを持ち、TAO の数十万のシャードを表します。ボードは 1 つのリージョンを示します。2 つ目のリージョンは独自のキャッシュを通して読み、書き込みをプライマリへ転送しますが、ボードには描かれません。

## なぜうまくいくのか

読み取りの多いグラフは、クエリの大半を同じ人気のオブジェクトに費やします。ライトスルーのキャッシュがそれらのオブジェクトをメモリに保ち、書き込みのときもキャッシュを正しく保つので、データベースが見るのは書き込みとミスだけです。[ライトスルーとライトビハインド](/patterns/write-through-and-write-behind)と[データベースをシャーディングする](/patterns/shard-the-database)が 2 つの半分です。

## ゲームが再現しないところ

ゲームのデータベースはシャードごとではなく 1 つのプライマリリージョンを持ち、ボードは 1 つのリージョンを描きます。TAO の API、シャードごとのプライマリの対応表、memcached の群は示しません。キャプションは Quorum の結果で、Meta の毎秒 10 億リクエストではありません。

## 出典

- [TAO: The power of the graph, Engineering at Meta](https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph): API、ライトスルーのキャッシュ、シャード、シャードごとのプライマリリージョン。
- [Open-sourcing TAOBench, Engineering at Meta](https://engineering.fb.com/2022/09/07/core-infra/taobench): 毎秒 10 億リクエストという数字とワークロードの形。
- [Scaling Memcache at Facebook, NSDI 2013](https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf): キャッシュの群とその背後の一貫性モデル。
