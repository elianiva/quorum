---
title: GPU 上のゲートウェイの後ろに置く LLM
summary: AI プロンプトをホスト型 LLM API と並べて自前の GPU ノードから配信し、モデル、精度、バッチサイズを調整します。GPU がプロンプトあたりで安くなるのは、動き続けている間だけです。
section: patterns
group: Scaling steps
order: 133
aliases: llm, gpu, inference, vllm, quantization, batching, model serving, tokens, hosted model, ai prompts, LLM, GPU, 推論, 量子化, モデル配信, バッチ処理
---

AI プロンプトの前にゲートウェイを置き、自前の GPU はトラフィックが動かし続けるときだけ使います。

## 次の段階に進むとき

- ホスト型 LLM API の請求が売上より速く伸びる、あるいはそのレート制限がプロンプトを絞ります。
- AI プロンプトがリクエストの大きな割合を占め、モデルを自分で制御したいとき。
- ホスト型 API の最初のトークンまでのレイテンシが高すぎるとき。

## 設計

::Design{id="gpu-behind-gateway"}

ゲートウェイがすべてのリクエストをレート制限し、アプリサーバーへ渡します。アプリサーバーは 1 つの GPU ノードにリンクするので、すべてのプロンプトがそこで動きます。ホスト型 LLM API が代替で、両方をリンクすると容量に応じてプロンプトが分かれます。

## うまくいく理由

GPU ノードは毎秒何トークンかを処理します。GPU の種類、モデル、精度、バッチサイズがすべてそれを掛け算で増やします。INT8 の重みは速く配信でき、少ないメモリに収まりますが、答えの価値は少し下がります。バッチを大きくするとスループットが上がり、最初のトークンまでの待ちも増えます。連続バッチ処理なら待ちを増やさずにスループットを保てます。GPU のメモリに対して大きすぎるモデルは、すべてのプロンプトをメモリ不足で失敗させます。精度を下げると小さくなり、収まるまで縮みます。

## コスト

GPU ノードは常に課金され、プロンプトあたりで安くなるのは動き続けている間だけです。GPU とホスト型 API を同じアプリサーバーにリンクすると容量で分かれるので、ホスト型 API がほとんどのプロンプトを引き受け、GPU は遊び、支出は両方に払います。この設計は GPU だけをリンクし、コストが下がる程度に動かし続けます。大きいモデルはプロンプトあたりの儲けが増えますが、配信できる数はわずかです。H100 は [GPU不足](/incidents/gpu-shortage) の間は手に入らないことがあります。ゲートウェイの上限はすべてのリクエスト種別を数えるので、実際の需要より上に設定します。ゲームには GPU を優先するルーターがありません。

## Quorum では

[GPUノード](/components/gpu) と [LLM API](/components/llm) を置きます。[ホスト型モデル](/research/hosted-models)、[モデルサービング](/research/model-serving)、[量子化](/research/quantization)、[continuous batching](/research/continuous-batching) をリサーチします。[モデル推論](/glossary/model-inference)、[量子化](/glossary/quantization)、[continuous batching](/glossary/continuous-batching) を読んでください。次の段階である [ベクトル検索とエンベディング](/patterns/vector-search-and-embeddings) は、モデルに自分のデータを与えます。
