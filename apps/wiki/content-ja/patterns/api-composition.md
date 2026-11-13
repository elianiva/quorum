---
title: APIコンポジション
summary: APIコンポジションは複数のサービスにまたがるクエリを、各サービスを呼び出して結果をメモリ上で結合することで答えます。
section: patterns
group: Outside the game
order: 1007
aliases: api composition, gateway aggregation, aggregator, scatter gather, join across services, in-memory join, APIコンポジション, ゲートウェイ集約, アグリゲータ, メモリ上での結合, サービス横断のクエリ
---

APIコンポジションは、データが複数のサービスにあるクエリに、コンポーザーが各所有者を呼び出して応答をメモリ上で結合することで答えます。クライアントのためにこれをゲートウェイが行うことをゲートウェイ集約と呼びます。

サービス境界をまたいで読み取る最も簡単な方法で、各呼び出しが安く結果が小さい場合に向いています。注文ページは、注文をあるサービスから、顧客を別のサービスから、配送状況を 3 つ目のサービスから必要とします。コンポーザーは 3 つを並列に呼び、1 つの応答を返すので、クライアントは 3 回ではなく 1 回リクエストします。Azure はこれが遅いモバイルネットワーク上の通信回数を減らすと述べています。

データが増えると破綻します。Chris Richardson は欠点として大きなデータセットの非効率なメモリ上結合を挙げているので、「過去 1 年に $500 を超える注文のある顧客」のようなクエリはこの方法では実行できません。失敗も掛け算になります。99.9% のサービスが 3 つあるとページの可用性は 99.7% になり、最も遅い呼び出しがレイテンシを決めます。これが[テールレイテンシ](/patterns/tail-latency)のテール問題です。タイムアウトを使い、任意の部分がなくてもページを描画できるようにします。重いクエリには、代わりに事前計算した読み取りモデルを保ちます。

## Quorum で最も近いもの

ゲームにコンポーザーはありませんが、形は作れます。[APIゲートウェイ](/components/gw)はアプリサーバーの前に立ち、複数のデータ系ノードを呼ぶアプリサーバーはそれらを順番に待つので、レイテンシは足し算になり成功率は掛け算になります。[APIゲートウェイのパターン](/patterns/api-gateway-patterns)はエッジでの集約を扱います。読み取り時に合成する代わりに結合した答えを保存する方法が[Materialized view と非正規化](/patterns/materialized-views-and-denormalization)で、[タイムアウト](/patterns/timeouts)のページは各呼び出しに必要な防御を扱います。

## 参考資料

- [API Composition, microservices.io](https://microservices.io/patterns/data/api-composition.html): サービスをまたぐクエリのパターンで、利点とメモリ上結合の欠点。
- [Gateway Aggregation pattern, Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-aggregation): コンポーザーをゲートウェイに置き、おしゃべりなクライアントを減らします。
- [The Tail at Scale, Dean and Barroso](https://cacm.acm.org/research/the-tail-at-scale/): 多くのサーバーを待つリクエストがなぜ最も遅い 1 台に合わせるのか。
