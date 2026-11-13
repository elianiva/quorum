---
title: エッジを自前で持つ: Netflix
summary: Netflix は自前の CDN を作り、データベースの前に memcached の層を置いたので、動画もパーソナライズされた読み取りもオリジンに届きません。
section: patterns
group: Ran in production
order: 953
aliases: netflix, open connect, cdn, evcache, memcached, streaming, CDN, エッジ, キャッシュ
---

Netflix は 2011 年に Open Connect を始めました。ストリーミングの成長で標準的な CDN が高くなりすぎたあとです。Open Connect は Netflix 自前のキャッシュアプライアンスの網で、インターネットエクスチェンジポイントの中、また対象となる ISP では ISP 自身のデータセンターの中に置かれます。Netflix は 2016 年に、動画トラフィックの 100%、1 日およそ 1 億 2,500 万時間を、1,000 か所近くから運んでいると述べました。

## システム

コントロールプレーンは AWS で動きます。登録、閲覧、再生、そしてその背後のパーソナライズされたデータです。memcached の層である EVCache がそのデータを保持します。各書き込みはリージョン内のすべてのゾーンへ行き、Kafka のパイプラインがリージョンをまたいで複製するので、どのリージョンでもどの会員にも応えられます。動画そのものは AWS に触れません。プレイヤーが Open Connect にビットを求めます。

## ボード

::Design{id="netflix-own-cdn"}

CDN が Open Connect です。視聴者に近いキャッシュが、オリジンなしでメディアに答えます。アプリサーバーはコントロールプレーン、キャッシュは EVCache、データベースは信頼できる源で、オブジェクトストレージはエッジがまだキャッシュしていない動画オブジェクトを保持します。

## うまくいく理由

2 つのキャッシュが 2 つの違う問いに答えます。エッジは同じバイトを何百万の視聴者に返すので、近くのコピーが長距離のトラフィックをほぼすべて取り除きます。EVCache はパーソナライズされた読み取りにメモリから答え、データベースが見るクエリを減らします。[CDN のプッシュとプル](/patterns/cdn-push-and-pull) と [キャッシュウォーミングと階層キャッシュ](/patterns/cache-warming-and-tiered-caching) がその 2 つの層を扱います。

## ゲームが扱わない範囲

ゲームの CDN はマネージドなコンポーネントで、ISP の中にある Netflix のアプライアンス群ではありません。ボードは EVCache のリージョン間 Kafka 複製やゾーンごとの書き込みを示しません。キャプションは Quorum の結果で、Netflix のトラフィックではありません。持ち帰れるのは形です。バイトのためのエッジと、個人データのためのメモリの層です。

## 出典

- [Open Connect Overview, Netflix](https://openconnect.netflix.com/Open-Connect-Overview.pdf): Open Connect とは何か、アプライアンスがどう置かれるか、コントロールプレーンが何をするか。
- [Caching for a Global Netflix, Netflix Technology Blog](https://netflixtechblog.com/caching-for-a-global-netflix-7bcc457012f1): EVCache、そのゾーンごとの書き込み、Kafka 複製の経路。
- [How Netflix works with ISPs around the globe, About Netflix](https://about.netflix.com/en/news/how-netflix-works-with-isps-around-the-globe-to-deliver-a-great-viewing-experience): 2016 年の動画の割合と拠点数。
