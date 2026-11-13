---
title: フロントエンド向けバックエンド
summary: フロントエンド向けバックエンドは、ウェブや iOS、Android などクライアントの種類ごとに小さな専用バックエンドを持たせ、1 つの共有 API にしません。
section: patterns
group: Outside the game
order: 1006
aliases: bff, backend for frontend, backends for frontends, mobile backend, api per client, edge service, BFF, フロントエンド向けバックエンド, クライアント別API, モバイル向けバックエンド
---

フロントエンド向けバックエンド（BFF）は、クライアントの種類ごとに専用のバックエンドをサービス群との間に置くので、モバイルアプリとウェブアプリがどちらにも合わない API を共有せずに済みます。

同じデータからクライアントが違うものを求める場合に使います。2015 年にこのパターンを名付けた Sam Newman はモバイルから始めました。電話は画面に表示できる量が少なく、より少なく小さな呼び出しを求め、ウェブアプリとはリリースサイクルが違います。汎用の API はどちらにも下手に仕え、各チームが相手のレビューを要する変更を求めます。BFF があれば、モバイルチームは 3 つのサービスを呼び、刈り込んだペイロードをちょうど 1 つ返すバックエンドを持ちます。

コストは動かすコードが増えることです。各 BFF にはデプロイ、監視、オーナーが必要で、認証ルールのようにすべてのクライアントが必要とするロジックは、BFF の間でコピーされがちです。Azure はすべてのインターフェースが同じ呼び出しをする場合は勧めていません。普通のルールは、1 つのチームがクライアントとその BFF の両方を持ち、共有する振る舞いは下のサービスに置くというものです。

## Quorum で最も近いもの

ゲームにあるのは入口 1 つで、クライアントごとの入口ではありません。[APIゲートウェイ](/components/gw)は 1 つの入口で、各リクエスト種別をレート制限し、選んだアプリサーバー群へルーティングします。つまりトラフィックをクライアントではなくリクエスト種別で分けます。BFF がどこに収まるかは[APIゲートウェイのパターン](/patterns/api-gateway-patterns)を読み、コンポーネントをアンロックするには[APIゲートウェイ](/research/api-gateway)をリサーチします。

## 参考資料

- [Backends For Frontends, Sam Newman](https://samnewman.io/patterns/architectural/bff/): 元の文章で、モバイルが動機です。
- [Backends for Frontends pattern, Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends): 使う場面と、コードの重複という欠点。
- [API Gateway / Backends for Frontends, microservices.io](https://microservices.io/patterns/apigateway.html): 単一のゲートウェイとクライアントごとのゲートウェイを比較します。
