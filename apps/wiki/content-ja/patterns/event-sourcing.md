---
title: イベントソーシング
summary: イベントソーシングはすべての変更を追記専用のログにイベントとして保存し、それを再生して現在の状態を組み立てます。
section: patterns
group: Outside the game
order: 1003
aliases: event sourcing, event log, replay, snapshot, audit log, temporal query, イベントソーシング, イベントログ, 再生, スナップショット, 監査ログ, 時点クエリ
---

イベントソーシングは、エンティティへの各変更を不変のイベントとして順序のあるログに保存し、現在の状態はそれらのイベントを再生して得られるものです。

履歴が現在と同じくらい重要なときに使います。口座残高は入金と出金の合計なので、ログは静かに書き換えられない監査の証跡になります。Martin Fowler はそれが買うものを挙げています。状態をゼロから再構築する、過去の任意の時点で状態が何だったかを問う、訂正したイベントをその後のものと一緒に再生する、です。Chris Richardson はマイクロサービスに合う使い方を足します。イベントの公開が保存と同じ書き込みなので、別のメッセージを原子的に送る必要がないということです。

見た目より高くつきます。長い履歴の再生は遅いので、定期的なスナップショットを保ち、その後に来たものだけを再生します。イベントは永遠に残るので、形を変えるにはバージョン付きのスキーマが必要です。現在の状態を読むにはログから作る読み取りモデルが必要で、それが CQRS と組み合わせられる理由であり、その読み取りモデルは結果整合です。Azure はこれを、移行するにも移行から出るのにも費用のかかる複雑なパターンと呼ぶので、履歴がその価値を持つときにだけ採用します。

## Quorum で最も近いもの

ゲームにあるのはログで、パターンではありません。[イベントストリーム](/components/log)はメッセージを読まれた後も保ち、コンシューマーが再生できるようにし、リサーチ[イベントストリーミング](/research/event-streaming)がそれをアンロックします。[変更データキャプチャ](/patterns/change-data-capture)はデータベースの書き込みログをイベントに変え、イベントを真実の源にせずに利点の一部を得ます。[トランザクショナルアウトボックス](/patterns/transactional-outbox)は書き込みと公開の問題を普通の方法で解きます。

## 参考資料

- [Event Sourcing, Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html): 完全な再構築、時点クエリ、イベントの再生を、出荷の例で説明しています。
- [Event Sourcing pattern, Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing): 使う場面と、スナップショット、順序、バージョン管理の問題。
- [Event sourcing, microservices.io](https://microservices.io/patterns/data/event-sourcing.html): イベントストアがデータベースとブローカーの間の 2 相コミットの必要性をどうなくすか。
