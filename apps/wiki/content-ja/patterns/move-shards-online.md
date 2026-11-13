---
title: シャードをオンラインで移す: Stripe
summary: Stripe は数億のオブジェクトをダウンタイムなしで移し、その後、アプリが書き込み続ける間に MongoDB のシャード間でチャンクをコピーする Data Movement Platform を作りました。
section: patterns
group: Ran in production
order: 963
aliases: stripe, docdb, mongodb, sharding, online migration, kafka, oplog, シャーディング, オンライン移行, データ移行
---

2017 年に Stripe は数億の Subscription を 4 つの段階、二重書き込みと MapReduce のバックフィルで移行し、その間ずっとサービスを続けました。後に MongoDB 上に DocDB を作り、シャード間でチャンクをオンラインに移す Data Movement Platform を備えました。

## システム

DocDB は自社運用の MongoDB フリートです。Data Movement Platform は各シャードの oplog を読み、Kafka へ送り、オブジェクトストレージへアーカイブし、変更を対象のシャードで再生します。切り替えは、計画されたプライマリのフェイルオーバーより短く保たれます。それが製品アプリケーションの既に持つ再試行の予算だからです。Stripe は移行を通じて 99.999% の稼働率を報告しています。

## ボード

::Design{id="stripe-online-shards"}

データベースはハッシュキー上の 4 つのシャードで、DocDB のシャードを表します。CDC Connector は oplog の読み手、イベントストリームは Kafka、データウェアハウスは変更を再生する対象のシャードの代役です。アプリが古いシャードへ書き込み続ける間に、変更ストリームが新しい方を追いつかせます。チャンクのコピーと二重書き込みの切り替えはボードの外です。

## うまくいく理由

シャードの移動はダンプとリストアではなく、コピーと変更ストリームです。アプリは 1 回書き、変更ストリームが同じ書き込みを対象へ運びます。切り替えは最後の数秒を覆うだけで済むので、読み取り専用の窓が再試行の予算に収まります。[オンライン移行](/patterns/online-migrations) と [変更データキャプチャ](/patterns/change-data-capture) が 2 つの仕組みです。

## ゲームが扱わない範囲

ゲームのデータベースは MongoDB でも DocDB でもなく、ボードにはチャンクのコピーも二重書き込みの切り替えもありません。表せるのはシャーディングしたストアと変更ストリームで、設計が担える部分です。キャプションは Quorum の結果で、Stripe の稼働率ではありません。

## 出典

- [How Stripe's document databases supported 99.999% uptime with zero-downtime data migrations, Stripe](https://stripe.dev/blog/how-stripes-document-databases-supported-99.999-uptime-with-zero-downtime-data-migrations): DocDB、Data Movement Platform、oplog から Kafka と S3 への流れ、フェイルオーバーに収まる切り替え。
- [Online migrations at scale, Stripe](https://stripe.com/blog/online-migrations): 4 段階の Subscription 移行と MapReduce のバックフィル。
- [Sharding, MongoDB documentation](https://www.mongodb.com/docs/manual/sharding/): DocDB が土台にするシャード、チャンク、移動の操作。
