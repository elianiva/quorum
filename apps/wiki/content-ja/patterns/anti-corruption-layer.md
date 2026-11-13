---
title: 腐敗防止層
summary: 腐敗防止層は自分のモデルとレガシーや外部システムのモデルの間で変換し、古い設計が新しい設計に漏れないようにします。
section: patterns
group: Outside the game
order: 1005
aliases: anti-corruption layer, acl, adapter, facade, translation layer, legacy integration, bounded context, 腐敗防止層, アダプター, ファサード, 変換層, レガシー統合, 境界づけられたコンテキスト
---

腐敗防止層（anti-corruption layer）は、同じモデルを共有しない 2 つのサブシステムの間のアダプターで、呼び出しとデータを両方向に変換します。Eric Evans が Domain-Driven Design で説明しました。

新しいサービスが、モデルをコピーしたくない何かと話さなければならないときに使います。レガシーの請求システムは顧客を ACCT と呼び、4 文字のステータスコードを付けます。一方、新しいサービスの Customer には型付きの状態があります。層が両者を 1 か所で対応づけるので、サービスが ACCT を見ることはありません。Azure はストラングラーフィグを関連するパターンとして挙げています。レガシーシステムから機能を少しずつ移す間、層が古い側と新しい側をどちらも変えずに話させます。

構築、デプロイ、運用するコンポーネントが 1 つ増え、すべての呼び出しにホップが 1 つ増えます。ボトルネックになりえますし、2 つのモデルが離れていくとマッピングは静かに腐ります。システムがすでに概念を共有している場合や、統合が小さく短命な場合は、直接呼び出したほうが安く済みます。レガシーシステムがなくなったら層を削除する計画を立てます。

## Quorum で最も近いもの

ゲームに変換層はありません。最も近いのは、この層が支える動き、つまり古い部分を徐々に置き換えることです。[ストラングラーパターン](/patterns/strangler-pattern)はトラフィックを新しいコードへ一片ずつ流し、[展開と縮小（Expand and contract）](/patterns/expand-and-contract)は読み手を壊さずにスキーマを変え、リサーチ[サービス境界](/research/service-boundaries)はコードベースを独自のチームを持つサービスに分割します。用語集の[ストラングラーパターン](/glossary/strangler-pattern)も参照してください。

## 参考資料

- [Anti-Corruption Layer pattern, Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer): 定義、Domain-Driven Design での起源、トレードオフ。
- [Strangler Fig pattern, Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig): 層が支える段階的な移行で、古い側と新しい側の間をルーティングするファサードを伴います。
- [Bounded Context, Martin Fowler](https://martinfowler.com/bliki/BoundedContext.html): 同じ概念の 2 つのモデルがなぜ存在し、マッピングが必要なのか。
