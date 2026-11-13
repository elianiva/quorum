---
title: チャンネルでメッセージを分割する: Discord
summary: Discord は何兆ものメッセージをワイドカラムストアに保存し、チャンネルと時間で分割し、クォーラムで読みました。
section: patterns
group: Ran in production
order: 952
aliases: discord, cassandra, scylladb, wide column, quorum, hot partition, chat, ワイドカラム, クォーラム, チャット, パーティション
---

Discord は 2017 年、12 ノードと数十億のメッセージを抱えていたときに、メッセージを MongoDB から Cassandra へ移しました。2022 年初頭にはクラスタは 177 ノード、何兆ものメッセージになり、チームはそれを再び ScyllaDB へ移行しました。スキーマはメッセージをチャンネルと時間のバケットで分割し、各パーティションを 3 回複製します。

## システム

すべてのメッセージの行はチャンネルとバケットをキーにするので、チャンネルの最近のメッセージがまとまって置かれ、読み取りは範囲走査になります。読み書きはクォーラムの整合性を使います。弱点はホットパーティションです。数十万人のメンバーがいるサーバーは、小さなサーバーより 1 つのチャンネルにはるかに多くのトラフィックを送ります。Discord はストアの前にデータサービスを加え、チャンネルによるコンシステントハッシュのルーティングを行ったので、1 つのチャンネルへのリクエストは 1 つのサービスインスタンスに集まります。

## ボード

::Design{id="discord-channel-partitions"}

ワイドカラムストアがメッセージのクラスタで、キーごとに 3 つのレプリカと、読み書き 2 のクォーラムを持ちます。リアルタイムハブはゲートウェイの層で、接続ごとに軽量なプロセスを持つことが 1 台で多くを保持できる理由なので BEAM 上にあります。キャッシュはホットなチャンネルの状態を保持します。

## うまくいく理由

2 つのレプリカへのクォーラム読み取りは 2 つのレプリカへの最新の書き込みと重なるので、ノードが落ちたあとでも読み取りは最後のメッセージを見ます。チャンネルで分割すると会話の履歴が連続します。[クォーラムの読み取りと書き込み](/patterns/quorum-reads-and-writes) と [ホットキーとホットシャード](/patterns/hot-keys-and-hot-shards) が、このスキーマが頼る 2 つの考え方です。

## ゲームが扱わない範囲

ボードには 1 つのワイドカラムストアがあり、72 の ScyllaDB ノードはなく、データサービスやチャンネルごとのパーティションも示しません。キャプションは Quorum の結果で、Discord の p99 ではありません。ゲームのホットキーインシデントは、データサービスが吸収するために作られた同じ失敗です。

## 出典

- [How Discord Stores Trillions of Messages, Discord](https://discord.com/blog/how-discord-stores-trillions-of-messages): Cassandra から ScyllaDB への移行、177 から 72 ノードへの変更、レイテンシの数値。
- [How Discord Stores Billions of Messages, Discord](https://discord.com/blog/how-discord-stores-billions-of-messages): 元のスキーマと、メッセージを時間でバケットに分けた理由。
- [How Discord Supercharges Network Disks for Extreme Low Latency, Discord](https://discord.com/blog/how-discord-supercharges-network-disks-for-extreme-low-latency): ScyllaDB クラスタの背後のストレージ構成。
