---
title: エッジルールをカナリアする: Cloudflare
summary: 1 つの WAF ルールが Cloudflare のすべてのエッジの CPU を 100% にし、修正はグローバル展開の前のカナリアでした。
section: patterns
group: Ran in production
order: 959
aliases: cloudflare, waf, regex, outage, canary, edge, postmortem, Cloudflare, WAF, 正規表現, 障害, カナリア, エッジ, ポストモーテム
---

2019 年 7 月 2 日、Cloudflare は `13:42` に新しい WAF のマネージドルールをデプロイしました。そのルールには長い入力でバックトラックする正規表現が含まれ、HTTP と HTTPS を提供するすべての CPU コアが 100% になりました。ネットワークは 27 分間 502 エラーを返し、修正はルールを無効にすることでした。

## システム

Cloudflare のエッジは anycast です。すべての拠点が同じプロキシ、WAF、キャッシュを動かし、グローバルにデプロイされたルールが一度にすべてへ届きます。それが強みであり、故障の形でもあります。ポストモーテムによれば、ルールは XSS 検出への小さな変更で、自動化された手順でデプロイされ、最初のページは 3 分後に来ました。チームにはキルスイッチがあり、障害が数時間ではなく 27 分で終わったのはそのためです。

## ボード

::Design{id="cloudflare-edge-rule"}

DNS が anycast の入口で、WAF がマネージドルールの層、CDN がエッジのキャッシュ、エッジ関数がワーカーです。アプリサーバーとデータベースはその背後にあります。ボードはゲームの[正規表現バックトラッキング](/incidents/regex)のインシデントを WAF で実行するので、キャプションには 1 つの悪いルールがリクエスト経路に何をするかが現れます。

## なぜうまくいくのか

この形はすべてのリクエストの前に 1 つのルールを置くので、CPU を食うルールはどこでも CPU を食います。カナリアはルールをまず 1 つの拠点へ送り、キルスイッチはデプロイなしで悪いロールアウトを終わらせます。[ブルーグリーンとカナリア](/patterns/blue-green-and-canary)と[WAF とボット管理](/patterns/waf-and-bot-management)が 2 つの制御です。

## ゲームが再現しないところ

ゲームの正規表現インシデントはトラフィックの一部を損ないます。実際のルールはネットワーク全体を 27 分止めました。ボードの WAF は 1 つで、グローバルな anycast の群ではなく、キルスイッチも示せません。キャプションはゲームのインシデントで、Cloudflare の障害ではありません。

## 出典

- [Details of the Cloudflare outage on July 2, 2019, Cloudflare](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019): 時系列、正規表現、27 分、キルスイッチ。
- [Cloudflare outage caused by bad software deploy, Cloudflare](https://blog.cloudflare.com/cloudflare-outage/): 最初のポストモーテムと即時の対応。
- [Cloudflare Global Network, Cloudflare](https://www.cloudflare.com/network/): 1 つのルールがどうすべての拠点に届くか。
