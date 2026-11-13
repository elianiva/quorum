---
title: 手前に置く DNS
summary: DNS を複数のロードバランサーの前に置いて入口が 1 台のマシンにならないようにし、フェイルオーバーに必要な速さに合わせて TTL を設定します。
section: patterns
group: Scaling steps
order: 108
aliases: dns round robin, route 53, ttl, multiple load balancers, redundant load balancer, domain, DNS, ラウンドロビン, TTL, ロードバランサー, ドメイン
---

ドメインを DNS に向け、DNS に 2 つ以上のロードバランサーのアドレスを配らせます。

## ステップを進める時期

- ロードバランサー自体が単一障害点です。
- ユーザーが取れるリンクが 1 本しかなく、入口が 1 つ以上必要です。

## 設計

::Design{id="dns-slow-ttl"}

::Design{id="dns-fast-ttl"}

どちらの図もロードバランサーが死んでから 1 分後を示します。DNS は 2 つのロードバランサーの間でトラフィックを均等に分け、どちらも同じ 2 台のアプリサーバーに届きます。長い TTL はユーザーを死んだほうへ送り続けます。短い TTL はそれを外しています。

## なぜうまくいくのか

DNS の応答はリゾルバが TTL の間キャッシュします。長い TTL だと、リクエストの半分が TTL が切れるまで死んだロードバランサーへ行き続けます。短い TTL だと、DNS は 1、2 回の参照で死んだアドレスを配るのをやめ、エラーはゼロに戻ります。

## コスト

DNS にはリサーチするまでヘルスチェックがないので、死んだホストが自分の分を保ちます。大きさも無視するので、小さなホストが大きなホストと同じだけ受けます。短い TTL は参照を増やし、リゾルバによっては求めたより長く応答を保ちます。TTL は最善の場合についての約束で、保証ではありません。

## Quorum では

[DNS](/components/dns)のコンポーネントは[DNS ラウンドロビン](/research/dns-rr)でアンロックされます。TTL を変えるには[ヘルスチェック](/research/health-checks)が必要で、DNS が死んだホストを外すのはチームがヘルスチェックのエンドポイントも作ってからです。用語集が[DNS ラウンドロビン](/glossary/dns-round-robin)を定義しています。次のステップは[オブジェクトストレージと CDN 上の静的ファイル](/patterns/static-files-on-object-storage-and-a-cdn)です。
