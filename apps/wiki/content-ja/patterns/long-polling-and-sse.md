---
title: ロングポーリングとサーバー送信イベント
summary: ロングポーリングとサーバー送信イベントを使うと、WebSocket の双方向接続なしに、サーバーが素の HTTP で更新をブラウザへ押し出せます。
section: patterns
group: Outside the game
order: 1011
aliases: long polling, sse, server-sent events, eventsource, push, comet, realtime, websocket alternative, ロングポーリング, サーバー送信イベント, プッシュ通知
---

ロングポーリングとサーバー送信イベント（SSE）は、どちらもサーバーの更新を HTTP でクライアントへ押し出します。ロングポーリングでは、サーバーがデータを得るかタイムアウトするまでリクエストを開いたままにし、答えてからクライアントが再び尋ねます。SSE では 1 つのレスポンスを開いたままにし、サーバーが `text/event-stream` としてイベントを書き込みます。

更新がサーバーからクライアントへ一方向に流れるときに使います。ビルドのダッシュボード、通知バッジ、ライブスコアは返すメッセージを必要としません。RFC 6202 はロングポーリングと、その上に SSE が成り立つ HTTP ストリーミング、およびそれらの落とし穴を扱っています。SSE がよりきれいな選択です。ブラウザが自分で再接続し、`Last-Event-ID` ヘッダーを送るので、サーバーは途切れた所から再開できます。ロングポーリングは古いクライアントと扱いにくいプロキシのための代替です。

コストは開いた接続です。待つクライアントごとに 1 つを保持するので、10,000 ユーザーは 10,000 の保持されたリクエストを意味し、各リクエストにスレッドを与えるサーバーは倒れます。MDN は、HTTP/2 がなければブラウザはすべてのタブを通じてドメインあたり 6 つの SSE 接続しか許さず、HTTP/2 なら 100 前後で折り合うと警告しています。プロキシがアイドル接続をタイムアウトさせることがあるので、サーバーは定期的なコメントを送って生かします。クライアントも頻繁に送る必要がある場合や、バイナリフレームが要る場合は、WebSocket の方が合います。

## Quorum で最も近いもの

ゲームがモデル化するのは WebSocket の形です。[リアルタイムハブ](/components/ws) がオンラインの各ユーザーの接続を開いたまま保持し、リサーチ [WebSocket](/research/websockets) がそれを解除し、スティッキーな [ロードバランサー](/components/lb) がクライアントを自分のハブに保ちます。保持接続の計算は [リトルの法則](/patterns/littles-law) です。[リアルタイムのための WebSocket 層](/patterns/websockets-tier-for-realtime) と [スティッキーセッション](/patterns/sticky-sessions) を読んでください。

## 参考文献

- [RFC 6202: Known Issues and Best Practices for Long Polling and Streaming in Bidirectional HTTP](https://www.rfc-editor.org/rfc/rfc6202): ロングポーリングと、SSE の土台である HTTP ストリーミングを定義し、その限界とタイムアウトを挙げています。
- [Using server-sent events, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events): ブラウザ API、エラー処理、接続数の上限の警告。
- [Server-sent events, HTML Standard](https://html.spec.whatwg.org/multipage/server-sent-events.html): 再接続と `Last-Event-ID` の規範的な規則。
- [RFC 6455: The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455): 全二重の代替。
