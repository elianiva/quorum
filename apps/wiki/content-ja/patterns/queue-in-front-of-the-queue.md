---
title: キューの前のキュー: Slack
summary: Slack は Redis の前に Kafka を置き、ジョブのバーストがキューのメモリを埋める代わりに耐久性のあるログで待つようにしました。
section: patterns
group: Ran in production
order: 955
aliases: slack, kafka, redis, job queue, background jobs, jqrelay, ジョブキュー, バックグラウンドジョブ, キュー
---

2017 年までに Slack のジョブキューは Redis で動いていて、Web リクエストの中で終えられないすべての処理がそこを通りました。リンクの展開、通知の送信、メッセージの索引付けです。Redis クラスタがメモリを使い果たし、キューは新しい仕事を受けられなくなりました。チームは Redis を置き換えるのではなく、その前に Kafka を加えました。

## システム

Kafkagate という小さなサービスが各ジョブを Kafka へ書き、確認応答します。ステートレスなリレーである JQRelay が Kafka のトピックを読み、そのジョブを実行する Redis クラスタへ書き込みます。この変更は既存のスケジューリングと重複排除のコードを保ち、バーストのための耐久性のあるバッファを加えました。当時、システムは 50 の Redis クラスタと 1,600 の Kafka パーティションにまたがって 1 日 14 億のジョブを運んでいました。

## ボード

::Design{id="slack-queue-in-front"}

イベントストリームが Kafka です。Web 層が確認応答したあともジョブを保持する耐久性のあるログです。キューは Redis、ワーカーはジョブの実行役、データベースはジョブが読み書きする状態を保持します。Web 層はエンキューするだけなので、ユーザーは処理ではなくエンキューを待ちます。

## うまくいく理由

2 つのホップが違う仕事をします。Kafka はバーストを吸収し、消費者が読むまでジョブを保ちます。Redis はワーカーがポーリングする短命なスケジューリング状態を保持します。[遅い仕事をキューとワーカーへ](/patterns/slow-work-to-a-queue-and-workers) と [キューによる負荷平準化](/patterns/queue-load-leveling) が 2 つの効果を説明します。

## ゲームが扱わない範囲

ボードには 1 つのイベントストリームと 1 つのキューがあり、50 の Redis クラスタと 1,600 のパーティションはありません。JQRelay や、それが Consul から読むレート制限も示しません。キャプションは Quorum の結果で、Slack の 1 日 14 億ジョブではありません。

## 出典

- [Scaling Slack's Job Queue, Slack Engineering](https://slack.engineering/scaling-slacks-job-queue): Redis のインシデント、Kafkagate、JQRelay、規模の数値。
- [Building self-driving Kafka clusters using open source components, Slack Engineering](https://slack.engineering/building-self-driving-kafka-clusters-using-open-source-components): Kafka のフリート、スループット、運用の仕事。
- [Apache Kafka documentation](https://kafka.apache.org/documentation/): パーティション、コンシューマーグループ、確認応答。
