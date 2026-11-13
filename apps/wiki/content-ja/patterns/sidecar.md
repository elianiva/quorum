---
title: サイドカー
summary: サイドカーは、メインのアプリケーションの隣で独自のプロセスやコンテナとして動き、ログ、プロキシ、セキュリティといった共通の雑事を引き受けます。
section: patterns
group: Outside the game
order: 1004
aliases: sidecar, sidekick, proxy, envoy, istio, linkerd, service mesh, ambassador, サイドカー, プロキシ, サービスメッシュ
---

サイドカーは、アプリケーションの隣に配備され、そのライフサイクルを共有する補助のプロセスやコンテナで、アプリケーションのコードに触れずに機能を足せます。

異なる言語の多くのサービスが同じ雑事を必要とするときに使います。あるチームは Go、別のチームは Ruby で動かし、どちらも相互 TLS、リトライ、メトリクスを必要としています。Istio のメッシュにおける Envoy のように各サービスの隣のプロキシが、それを全員のために 1 度だけ行い、アプリケーションの呼び出しはコードを変えずにそこを通ります。Azure は分離についても述べています。補助側のクラッシュはアプリのプロセスを落とさず、2 つは別の言語を使え、それぞれでリリースできます。

コストは現実にあります。各サイドカーはすべてのインスタンスで CPU とメモリを使い、Azure は余分なホップがレイテンシを足すとも指摘しています。ポッドごとに 2 つ目のものを動かしてアップグレードする必要があり、プロキシのバグはすべてのサービスに一度に当たります。1 つのサービスには過剰でもあり、ライブラリの方が単純です。

## Quorum で最も近いもの

ゲームはこれを実装しています。[サービスメッシュ](/components/mesh)は、リンクした各アプリサーバーとワーカーの隣にサイドカーのプロキシを置き、リトライ、サーキットブレーカー、メトリクスを与え、その分の CPU とホップを請求します。[サービスメッシュ](/research/service-mesh)のリサーチが必要で、サイドカーが付くのは [Kubernetesクラスター](/components/cluster)で動くサービスだけです。[メッシュとともにサービスへ分割する](/patterns/split-into-services-with-a-mesh)がそのステップを示し、[サーキットブレーカー](/patterns/circuit-breaker)はそこで配られる機能の 1 つです。

## 参考

- [Sidecar pattern, Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/sidecar): 定義、分離の利点、余分なレイテンシ。
- [Ambassador pattern, Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/ambassador): サービスの外向き呼び出しをプロキシするサイドカー。
- [Istio architecture](https://istio.io/latest/docs/ops/deployment/architecture/): 実際のメッシュが、サイドカープロキシのデータプレーンとコントロールプレーンをどう分けるか。
