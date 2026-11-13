---
title: サーガ
summary: サーガは、複数のサービスにまたがるビジネストランザクションをローカルトランザクションの連鎖として実行し、あとのステップが失敗したら完了したステップを補償トランザクションで取り消します。
section: patterns
group: Outside the game
order: 1001
aliases: saga, distributed transaction, compensating transaction, orchestration, choreography, long-running transaction, サーガ, 分散トランザクション, 補償トランザクション, オーケストレーション, コレオグラフィ, 長時間トランザクション
---

サーガは、サービスごとに 1 つのローカルトランザクションに分けたビジネストランザクションで、途中の失敗は、すでに終わったステップの補償トランザクションを実行して修復します。

1 つの操作が複数のサービスの持つデータに触れ、単一の ACID トランザクションではまたげないときに使います。注文の流れは在庫を引き当て、カードに課金し、配送を手配します。配送のステップが失敗すると、サーガはカードを返金し、在庫を解放します。やり方は 2 つあります。コレオグラフィでは各サービスが次のきっかけとなるイベントを発行します。オーケストレーションでは中央のコーディネーターが各参加者に指示し、状態を追跡します。ワークフローが複雑になると、こちらが追いやすくなります。

代償はロールバックと分離です。補償は新しいビジネスロジックで、ステップごとに設計してテストする必要があり、送信済みのメールなど、まったく取り消せないステップもあります。Azure は引き返せない点をピボットトランザクションと呼んでいます。他のリクエストが途中の状態を見るので、サーガが終わるまで注文を PENDING にしておくような対策が必要です。話が複数のサービスのログに散らばるので、デバッグも難しくなります。

## Quorum で最も近いもの

ゲームにサーガはありませんが、必要な部品は教えてくれます。[トランザクショナルアウトボックス](/patterns/transactional-outbox)は、きっかけとなった書き込みと原子的にイベントを発行し、サーガのステップが確実に行うべきことを実現します。[冪等キー](/patterns/idempotency-keys)は繰り返したステップを無害にし、[キュー](/components/queue)がメッセージを運びます。[トランザクショナルアウトボックス](/research/outbox)と[冪等キー](/research/idempotency-keys)をリサーチして構築します。

## 参考

- [Saga pattern, microservices.io](https://microservices.io/patterns/data/saga.html): Chris Richardson による定義で、コレオグラフィとオーケストレーションの例、欠点の簡潔な一覧があります。
- [Saga design pattern, Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga): 補償可能なトランザクションとピボットトランザクション、オーケストレーションを選ぶ前に比べるべき点。
- [Sagas, Garcia-Molina and Salem (1987)](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf): このパターンに名前を与えた原論文で、長時間生きるデータベーストランザクションのためのものです。
