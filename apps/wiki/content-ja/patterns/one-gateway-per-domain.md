---
title: ドメインごとに 1 つのゲートウェイ: Uber
summary: Uber は 2,200 の重要なマイクロサービスをドメインにまとめ、各ドメインの前にゲートウェイを置き、ドメイン間の呼び出しにはメッシュを使いました。
section: patterns
group: Ran in production
order: 961
aliases: uber, doma, microservices, api gateway, service mesh, domain oriented, layers, マイクロサービス, APIゲートウェイ, サービスメッシュ, ドメイン指向
---

2020 年までに Uber は 2,200 の重要なマイクロサービスを動かしていました。Domain-Oriented Microservice Architecture はそれらをドメインにまとめ、各ドメインに 1 つの API と 1 人の所有者を与え、ドメインの前にゲートウェイを置きます。呼び出し側は背後のすべてのサービスではなくゲートウェイに依存します。

## システム

DOMA はドメインを層に整理します。インフラストラクチャ層はストレージとネットワークに答え、ビジネス層は製品をまたいで共有される能力を持ち、製品層はライダーやドライバーが呼ぶサービスを持ちます。ドメインは自分の上の層に依存してはいけないので、グラフは一方向です。各ドメインは 1 つの API を公開し、そのゲートウェイが呼び出し側に必要な唯一の入口です。サービスメッシュが、サービス間の再試行、サーキットブレーカー、相互 TLS、呼び出しごとのメトリクスを加えます。

## ボード

::Design{id="uber-domain-gateway"}

ロードバランサーがゲートウェイへトラフィックを散らします。APIゲートウェイが 1 つのドメインの入口を表します。ボード上ではトークンを 1 回検証し、呼び出しをアプリサーバーへ送ります。アプリサーバーはドメインのサービスを表します。データベースはそのドメインのものです。Kubernetes Cluster と Service Mesh はコントロールのノードで、トラフィックを運びません。

## うまくいく理由

ドメインごとに 1 つのゲートウェイがあると、呼び出し側が学ぶ契約は 1 つ、呼ぶ所有者も 1 人になり、ドメイン内の変更が呼び出し側に届きません。メッシュはサービス間のすべての呼び出しに同じ再試行、ブレーカー、メトリクスのポリシーを課します。[メッシュとともにサービスへ分割する](/patterns/split-into-services-with-a-mesh) と [APIゲートウェイのパターン](/patterns/api-gateway-patterns) がその 2 つの部分を扱います。

## ゲームが扱わない範囲

ボードには 1 つのドメインがあり、2,200 のサービスと 5 つの層はありません。層の規則も、ドメインの所有も、製品層とビジネス層も表せません。キャプションは Quorum の結果で、Uber のトラフィックではありません。

## 出典

- [Introducing Domain-Oriented Microservice Architecture, Uber Engineering](https://www.uber.com/blog/microservice-architecture): ドメイン、5 つの層、ゲートウェイ、2,200 のサービス。
- [The Uber Engineering Tech Stack, Part I: The Foundation, Uber Engineering](https://www.uber.com/blog/tech-stack-part-one-foundation): DOMA の下にあるサービス、ストレージ、ディスカバリ。
- [Istio architecture, Istio](https://istio.io/latest/docs/ops/deployment/architecture/): サイドカーのデータプレーンとコントロールプレーンがメッシュの仕事をどう分けるか。
