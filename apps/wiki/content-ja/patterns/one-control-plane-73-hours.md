---
title: 1 つのコントロールプレーン、73 時間: Roblox
summary: 負荷下での Consul のストリーミングの変更が Roblox を 73 時間止めました。コントロールプレーンがデプロイと監視の経路でもあったからです。
section: patterns
group: When it broke
order: 970
aliases: roblox, consul, outage, control plane, boltdb, postmortem, 73 hours, 障害, コントロールプレーン, ポストモーテム
---

2021 年 10 月 28 日、Roblox は 73 時間止まりました。サービスディスカバリと協調の層である Consul の新しいストリーミング機能が負荷下で競合を起こし、BoltDB のバグがそれを悪化させました。コントロールプレーンがデプロイと監視も運んでいたので、チームは障害を見ることも直すこともできませんでした。

## システム

Roblox は数百の社内サービスを動かし、1 つの Consul クラスタが複数のワークロードを支えていました。チームは障害の前日に、トラフィックルーティングのバックエンドで Consul 1.10 の新しいストリーミング機能を有効にしました。高い負荷の下で新しいプロトコルが競合し、BoltDB の空きページリストが書き込みを病的に遅くしました。Consul のリーダーが遅れ、コントロールプレーンはサービスを一貫した状態に保てませんでした。

## ボード

::Design{id="roblox-control-plane"}

ロードバランサーとアプリサーバーがゲームの層、データベースが状態、Kubernetes Cluster と Service Mesh がコントロールプレーンです。ボードはアプリサーバーでゲームの [不正な設定投入](/incidents/config) インシデントを動かし、これはフリートに届いたコントロールプレーンの変更を表します。

## 何が壊れたか

コントロールプレーンは共有の依存です。負荷下でのその変更は、それに頼るすべてのサービスを落としえ、監視とデプロイの経路も同じ被害範囲に入ります。Roblox はコントロールプレーンが不健全な間、可視性と修正をデプロイする能力を失いました。複数のワークロードに 1 つの Consul クラスタを使っていたことが影響を広げました。復旧に 73 時間かかったのは、1 つのデプロイを巻き戻すのではなく、Consul クラスタとキャッシュを作り直す必要があったからです。

## 何が変わったか

Roblox はストリーミング機能を無効にし、Consul クラスタを作り直し、不要なデータを削除し、BoltDB の後継について HashiCorp と協力しました。[GitOps](/research/gitops) が最も近いガードレールです。変更はまず 1 つのリージョンに着地します。[バルクヘッド](/patterns/bulkhead) がもう 1 つです。故障を 1 つの部分に留めます。

## ゲームが扱わない範囲

ゲームに Consul はないので、クラスタとメッシュがコントロールプレーンを表します。設定インシデントは設定のプッシュで、ストリーミング機能ではありません。ボードは 73 時間も、BoltDB のバグも、監視の依存も表せません。キャプションはゲームのインシデントで、Roblox の障害ではありません。

## 出典

- [Roblox Return to Service, Roblox](https://about.roblox.com/newsroom/2022/01/roblox-return-to-service-10-28-10-31-2021): 時系列、Consul のストリーミング、BoltDB のバグ、行われた変更。
- [An Update on Our Outage, Roblox](https://about.roblox.com/newsroom/2021/11/update-recent-service-outage): 最初の声明と 73 時間の復旧。
- [Consul architecture, HashiCorp](https://developer.hashicorp.com/consul/docs/architecture): Consul が何をするか、コントロールプレーンが共有の依存である理由。
