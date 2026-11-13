---
title: スティッキーセッション
summary: スティッキーセッションは、ロードバランサーがクライアントを最初に使ったサーバーへ戻すようにし、そのサーバーのメモリがクライアントの状態を持てるようにします。
section: patterns
group: Outside the game
order: 1010
aliases: sticky sessions, session affinity, ip hash, cookie affinity, session persistence, load balancer, スティッキーセッション, セッションアフィニティ, セッションの永続化, ロードバランサー
---

スティッキーセッションはセッションアフィニティとも呼ばれ、ロードバランサーが各リクエストでクライアントを同じバックエンドへルーティングするようにします。通常は発行する Cookie か、クライアントのアドレスのハッシュによります。

再構築にコストがかかるクライアントごとの状態をバックエンドがメモリに持つときに使います。チャットやゲームのサーバーはソケットと最近のメッセージを持ち、アプリはユーザーごとの温かいキャッシュを持ちます。AWS Application Load Balancer は Cookie を設定でき、トラフィックは決めた期間そのインスタンスに貼り付きます。nginx も `ip_hash` と `sticky` のディレクティブで同じことを提供します。オフィスの 1 つのアドレスを多くのユーザーが共有できるので、Cookie の方が IP のハッシュより正確です。

コストは固定から生まれます。長いセッションは古いサーバーに残り、新しいサーバーは新しいクライアントしか得ないので、負荷が偏ります。落ちたサーバーやドレインされたサーバーはセッションも連れていくので、ユーザーはログアウトされたり作業を失ったりします。オートスケーリングも効きにくくなります。よくある修正は、セッション状態を共有のストアに置き、ステートレスなサーバーを動かすことです（[ステートレスなアプリサーバー](/patterns/stateless-app-servers)）。アフィニティは最適化としてだけ使い、状態の唯一のコピーには決してしません。

## Quorum で最も近いもの

ゲームはこれをそのまま実装しています。[ロードバランサー](/components/lb)にはスティッキーセッションのスイッチがあり、ユーザーを最初に到達したターゲットに固定します。プロセス内キャッシュとリアルタイムのクライアントには有利で、負荷は偏ります。スティッキーなロードバランサーはクライアントを以前のハブへ戻すので、再起動した[リアルタイムハブ](/components/ws)は再接続の自分の取り分だけを引き受けます。[ロードバランシングアルゴリズム](/patterns/load-balancing-algorithms)と[リアルタイムのための WebSocket 層](/patterns/websockets-tier-for-realtime)を読んでください。

## 参考

- [Sticky sessions with load balancer generated cookies, AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/load-balancer-stickiness/alb-cookies-stickiness.html): ALB の Cookie が決めた期間トラフィックを固定する仕組みと、具体的な例。
- [ngx_http_upstream_module, nginx](https://nginx.org/en/docs/http/ngx_http_upstream_module.html): `ip_hash`、`hash`、`sticky` のディレクティブと、重みとの関わり。
- [RFC 6265: HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265): Cookie によるアフィニティが頼る Cookie の標準。
