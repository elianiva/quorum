---
title: ブロブに索引を張る: Dropbox
summary: Dropbox は Magic Pocket の不変ブロブの前にシャーディングした MySQL の Block Index を置き、読み取りを 1 回のハッシュ参照と 1 回のブロブ取得にしました。
section: patterns
group: Ran in production
order: 962
aliases: dropbox, magic pocket, object storage, block index, exabyte, erasure coding, ブロブ, ブロックインデックス, オブジェクトストレージ, イレイジャーコーディング
---

2016 年に Dropbox はファイルデータを S3 から自社の数エクサバイト規模のストア、Magic Pocket へ移しました。ファイルは最大 4 MB のブロブに分割され、各ブロブは SHA-256 でハッシュ化され、そのハッシュがシャーディングした MySQL の Block Index に入ります。読み取りはハッシュを参照してブロブを取得します。

## システム

ブロブは 1 GB のバケットに詰められ、複製またはイレイジャーコーディングされた形で、米国の 3 つのゾーンにあるマシン上のボリュームに書き込まれます。Block Index は RPC 層の後ろにあるシャーディングした MySQL クラスタで、どのボリュームがブロブを持つかを決めます。Watcher は書き込まれたブロブの 1% をサンプリングし、1 分後、1 時間後、1 日後、1 週間後、1 か月後に取得します。メタデータスキャナーは毎秒およそ 100 万ブロブの速さでインデックスを走査します。

## ボード

::Design{id="dropbox-block-index"}

オブジェクトストレージがブロブのストアです。不変のブロブをハッシュで引く形です。データベースが Block Index で、ハッシュキー上の 4 つのシャードです。アプリサーバーはブロブをハッシュ化し、ストレージへ書き、そのハッシュと位置をインデックスへ書き込みます。

## うまくいく理由

ブロブは不変なので、インデックスは追記だけを行い、行を更新しません。インデックスはバイト数に比べて非常に小さく、ブロブが安いディスクに載る一方でシャーディングした MySQL クラスタがそれを保持できます。読み取りは 1 回のハッシュ参照と 1 回の取得です。[オブジェクトストレージとライフサイクル規則](/patterns/object-storage-and-lifecycle-rules) と [データベースをシャードする](/patterns/shard-the-database) がその両半分です。

## ゲームが扱わない範囲

ゲームのオブジェクトストレージはマネージドサービスで、Magic Pocket の自社ハードウェアではありません。ボードは 4 MB のブロブ、1 GB のバケット、イレイジャーコーディング、3 つのゾーンを表せません。表せるのは分割です。不変のブロブストアの前に置かれたハッシュインデックスです。キャプションは Quorum の結果で、Dropbox のエクサバイトではありません。

## 出典

- [Inside the Magic Pocket, Dropbox](https://dropbox.tech/infrastructure/inside-the-magic-pocket): ブロブ、バケット、ボリューム、シャーディングした MySQL の Block Index、マルチゾーン設計。
- [Scaling to exabytes and beyond, Dropbox](https://dropbox.tech/infrastructure/magic-pocket-infrastructure): Dropbox が S3 を離れた理由と、ストアに求められたこと。
- [Pocket watch: Verifying exabytes of data, Dropbox](https://dropbox.tech/infrastructure/pocket-watch): ブロブをサンプリングして再取得するスキャナーと Watcher。
