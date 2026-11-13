---
title: 1 つのコマンドがインデックスを消した: AWS S3
summary: 打ち間違えた入力が S3 のインデックスと配置のサブシステムのサーバーを消し、us-east-1 は約 4 時間 S3 を失いました。
section: patterns
group: When it broke
order: 971
aliases: aws, s3, outage, index subsystem, cells, postmortem, us-east-1, 障害, インデックス, ポストモーテム, セル
---

2017 年 2 月 28 日、S3 チームのメンバーが課金サーバーを数台削除するコマンドを実行し、打ち間違えた入力がより多くの台数を削除しました。削除されたサーバーは us-east-1 のインデックスと配置のサブシステムを動かしており、S3 は約 4 時間 GET、LIST、PUT、DELETE のリクエストに応えられませんでした。

## システム

インデックスのサブシステムはリージョン内のすべてのオブジェクトのメタデータと位置を保持します。配置のサブシステムは新しいストレージを割り当て、動くのにインデックスを必要とします。チームは遅い課金処理を調べており、手順書を使って課金サーバーを数台削除しました。誤った入力がインデックスと配置のサブシステムが必要とする容量を削除し、両方とも完全な再起動が必要でした。そのリージョンでインデックスが完全に再起動されたことは何年もありませんでした。EC2 の起動や Lambda を含むほかの AWS サービスも失敗しました。ステータスダッシュボードも S3 に依存していました。

## ボード

::Design{id="s3-index-region"}

オブジェクトストレージがバイトを保持し、データベースがそれを見つけるインデックスです。ロードバランサーとアプリサーバーがフロントエンドです。ボードはインデックスのデータベースでゲームの [ディスク満杯](/incidents/disk-full) インシデントを動かし、これはインデックスが必要な容量を失ったことを表します。

## 何が壊れたか

1 つの破壊的なコマンドが、2 つの重要なサブシステムが必要とする容量を削除しました。インデックスにはその規模での速い再起動の道がなく、配置はインデックスが回復するまで回復できませんでした。被害範囲はサービスの境界を越え、ステータスページもその中にあったので、顧客は状態を見られませんでした。出来事は太平洋時間の `09:37` から `13:54` まで続きました。

## 何が変わったか

AWS は作業の優先順位を付け直し、インデックスのサブシステムをより小さなセルに分割しました。故障が 1 つのセルに留まり、復旧も小さく始まるようにするためです。ゲームでは [マルチゾーン](/research/multi-az) と [マルチリージョン](/research/multi-region) のリサーチが最も近いガードレールで、[バルクヘッド](/patterns/bulkhead) はサービスにおける同じ考え方です。

## ゲームが扱わない範囲

ゲームの Disk full インシデントはインデックスの書き込みを止めます。S3 はインデックスを保持するサーバーを失い、被害範囲はほかのサービスへ及びました。ボードにはセルも手順書もステータスダッシュボードの依存もありません。キャプションはゲームのインシデントで、2017 年の障害ではありません。

## 出典

- [Summary of the Amazon S3 Service Disruption in the Northern Virginia (US-EAST-1) Region, AWS](https://aws.amazon.com/message/41926): コマンド、インデックスと配置のサブシステム、時系列、セル。
- [Reliability Pillar, AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html): 被害範囲、復旧、サービスをセルに分割する理由。
- [Static stability using Availability Zones, AWS Builders' Library](https://aws.amazon.com/builders-library/static-stability-using-availability-zones/): ステータスの経路が、報告対象のシステムに依存してはいけない理由。
