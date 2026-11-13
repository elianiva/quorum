---
title: ショップ単位でシャードする：Shopify
summary: Shopify は MySQL のフリートをショップごとのポッドに分け、各リクエストを所有するポッドへルーティングしました。
section: patterns
group: Ran in production
order: 951
aliases: shopify, pods, sharding, multi-tenant, mysql, sorting hat, black friday, ポッド, シャーディング, マルチテナント, ソーティングハット
---

Shopify は 2015 年まで 1 つの大きな MySQL データベースで動いていましたが、より大きなサーバーを買うことが選択肢でなくなると、`shop_id` でシャードし、さらに進めました。各シャードは専用のデータベース、キャッシュ、アプリサーバーを持つポッドになりました。Sorting Hat と呼ばれるロードバランサーのコンポーネントがリクエストからショップを読み、正しいポッドへ送るヘッダーを足します。

## システム

ポッドが分離の単位です。ポッドはショップの一部と、専用の MySQL シャード、Redis、Memcached を持ち、どこでも動かせます。アプリサーバーとジョブワーカーはポッド間で共有されるので、あるポッドのフラッシュセールがリージョンの残りの容量を使えます。2024 年、このプラットフォームはエッジで毎分 4 億 8,900 万リクエスト、アプリサーバーで毎分 1 億 1,700 万リクエスト、週末で 14 兆 8,000 億のデータベースクエリというピークに達しました。

## ボード

::Design{id="shopify-tenant-shards"}

データベースはテナントキーで 4 つのシャードを持ち、それがポッドの境界です。ロードバランサーは Sorting Hat を表し、キャッシュはポッドごとの Redis と Memcached、キューとワーカーは共有のジョブ層です。決済プロバイダがチェックアウトに答えます。

## なぜ効くのか

テナントキーは 1 つのショップの行を 1 つのシャードに保つので、ほとんどのクエリはローカルに済み、故障も 1 つのポッドの中に留まります。代償はホットなテナントです。1 つの巨大なショップがやはりそのシャードを最も忙しくでき、Shopify が大口の加盟店に専用のポッドを与えるのはそのためです。[データベースをシャードする](/patterns/shard-the-database)が一般的な代償を扱います。

## ゲームが止まるところ

ボードはデータベースをシャードしますが、アプリサーバーは 1 組のままです。Quorum にはポッド単位のアプリ層がないためです。Sorting Hat もないので、Shopify でヘッダーが行うルーティングをシャードキーが行います。キャプションは Quorum の結果で、Shopify のトラフィックではありません。

## 出典

- [A Pods Architecture To Allow Shopify To Scale, Shopify Engineering](https://shopify.engineering/a-pods-architecture-to-allow-shopify-to-scale): ポッド、Sorting Hat、シャーディングだけでは足りなかった理由。
- [Shard Balancing: Moving Shops Confidently with Zero-Downtime at Terabyte-scale, Shopify Engineering](https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale): ショップがポッド間をどう移動するか。
- [How we prepare Shopify for BFCM, Shopify Engineering](https://shopify.engineering/bfcm-readiness-2025): 2024 年のピークの数字と 2025 年のテスト計画。
