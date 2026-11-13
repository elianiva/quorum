import type { Catalog } from './en.ts'

export const catalog: Catalog = {
  achievements: {
    'hello-world': { name: 'ハローワールド', condition: '最初のリクエストをさばく' },
    'works-on-my-machine': { name: '私の環境では動く', condition: '不正なデプロイを出す' },
    'split-brain': { name: 'スプリットブレイン', condition: 'データベースを専用のノードに分ける' },
    'averages-lie': {
      name: '平均は嘘をつく',
      condition: 'p99が平均の5倍を超えているときにパーセンタイルを研究する',
    },
    'shared-nothing': {
      name: 'シェアードナッシング',
      condition: 'PHP-FPMのサーバーだけで、メモリのインシデントを起こさずシードへ到達する',
    },
    blocked: {
      name: 'ブロック',
      condition: '1つの種別のせいでp99が100 ms上がるNode.jsサービスを持つ',
    },
    'off-by-one-region': {
      name: 'リージョンが一つずれる',
      condition: '150 ms以上離れたリージョンからユーザーに応答する',
    },
    'littles-law': {
      name: 'リトルの法則',
      condition: 'データベースを直すことでアプリサーバーのボトルネックを解消する',
    },
    metastable: { name: 'メタステーブル', condition: 'リトライストームから復旧する' },
    'big-rewrite': {
      name: '大規模書き直し',
      condition: '1つの会社で全サービスを新しい言語へ移行する',
    },
    strangler: {
      name: 'ストラングラー',
      condition: '4段階のトラフィックでマイグレーションを終え、エラーを1%未満に抑える',
    },
    quorum: {
      name: 'クォーラム',
      condition: '3つのリージョンでR + W > Nのワイドカラムストアを動かす',
    },
    eventually: { name: 'いずれ整合', condition: '10億ユーザーでR = 1、W = 1の構成を動かす' },
    polyglot: { name: 'ポリグロット', condition: '本番で5つの言語を同時に動かす' },
    'zero-gc': { name: 'GCゼロ', condition: 'Rustのサービスを100,000 rpsで動かす' },
    'no-cache': { name: 'キャッシュなし', condition: 'キャッシュもCDNもなしでシリーズAへ到達する' },
    celebrity: {
      name: 'セレブリティ',
      condition: 'フォロワー1,000万人の投稿を、ホットキーのエラーなしでさばく',
    },
    'follow-the-sun': {
      name: '太陽を追う',
      condition: '4つのリージョンを、現地のピーク時にどのノードも70%以下でさばく',
    },
    'postgres-for-everything': {
      name: '全部Postgres',
      condition: 'PostgresのデータコンポーネントだけでシリーズBへ到達する',
    },
    'hug-of-death': { name: '抱擁死', condition: 'ユーザーを失わずに×10のスパイクを乗り切る' },
    'egress-shock': {
      name: 'エグレス衝撃',
      condition: 'エグレスが請求書で最大の項目になる',
    },
    'chaos-monkey': { name: 'カオスモンキー', condition: '100回のランダムな停止を乗り切る' },
    blameless: { name: '非難なし', condition: 'ポストモーテムを50本書く' },
    nines: { name: 'ナイン', condition: '99.99%を1週間保つ' },
    'five-nines': { name: 'ファイブナイン', condition: 'ファイブナインのチャレンジをクリアする' },
    monoglot: { name: 'モノグロット', condition: '1つの言語でIPOへ到達する' },
    'default-alive': { name: 'デフォルト生存', condition: 'ラウンドを一度も上げずにIPOへ到達する' },
    unicorn: { name: 'ユニコーン', condition: '評価額10億ドルに到達する' },
    decacorn: { name: 'デカコーン', condition: '評価額100億ドルに到達する' },
    'everyone-online': { name: '全員オンライン', condition: '60億ユーザーに到達する' },
    'warm-start': {
      name: 'ウォームスタート',
      condition: 'スパイク中にJVMサービスをスケールし、p99を悪化させない',
    },
    'rule-of-40': {
      name: '40の法則',
      condition: '上場企業として40の法則のスコア80に到達する',
    },
    'beat-and-raise': {
      name: 'ビート・アンド・レイズ',
      condition: 'ガイダンスを8四半期連続で上回る',
    },
    'serial-founder': { name: '連続起業家', condition: 'すべての事業でエグジットする' },
    'two-hard-things': {
      name: '二つの難題',
      condition: 'キャッシュで古い読み取りのインシデントを起こす',
    },
    'conways-law': {
      name: 'コンウェイの法則',
      condition: 'チームの数よりサービスが多くなり、それを直す',
    },
    fallacies: {
      name: '誤謬',
      condition: 'インシデントで分散コンピューティングの8つの誤謬をすべて経験する',
    },
    'thundering-herd': {
      name: 'サンダリングハード',
      condition: 'エラーなしで再接続ストームを乗り切る',
    },
    runbook: { name: 'ランブック', condition: 'プレイヤーが何もしないままインシデントが解決する' },
    finops: {
      name: 'FinOps',
      condition: 'リザーブド・オンデマンド・スポットのノードを同時に動かす',
    },
    'spot-the-difference': {
      name: 'まちがいさがし',
      condition: 'エラーなしでスポット回収を乗り切る',
    },
    'let-it-crash': {
      name: 'クラッシュに任せる',
      condition: 'Elixirのサービスが、失敗するリクエストなしに1,000回のクラッシュを生き延びる',
    },
  },
  backups: {
    none: { name: 'なし' },
    nightly: { name: '毎晩' },
    pitr: { name: 'PITR' },
  },
  buildGroups: {
    edge: { label: 'エッジ' },
    compute: { label: 'コンピュート' },
    data: { label: 'データ' },
    ops: { label: '運用' },
  },
  cacheKeys: {
    full: { name: 'パス・クエリ・Cookie' },
    query: { name: 'パスとクエリ' },
    path: { name: 'パスのみ' },
  },
  cacheStrategies: {
    aside: { name: 'キャッシュアサイド' },
    'read-through': { name: 'リードスルー' },
    'write-through': { name: 'ライトスルー' },
    'write-behind': { name: 'ライトビハインド' },
  },
  collectors: {
    g1: { label: 'G1' },
    parallel: { label: 'Parallel' },
    zgc: { label: 'ZGC' },
  },
  dbRetentions: {
    keep: { name: 'すべて保持' },
    archive: { name: '30日後にアーカイブ' },
    delete: { name: '30日後に削除' },
  },
  deployStrategies: {
    recreate: { name: '再作成' },
    rolling: { name: 'ローリング' },
    'blue-green': { name: 'ブルーグリーン' },
    canary: { name: 'カナリア' },
  },
  deviceInfo: {
    desktop: { name: 'デスクトップ' },
    mobile: { name: 'モバイル' },
    tablet: { name: 'タブレット' },
  },
  dockGroups: {
    edge: { label: 'エッジ' },
    compute: { label: 'コンピュート' },
    data: { label: 'データ' },
    messaging: { label: 'メッセージング' },
    platform: { label: 'プラットフォーム' },
    insight: { label: '可観測性' },
    managed: { label: 'マネージド' },
  },
  exits: {
    'acqui-hire': { name: 'アクハイア' },
    acquisition: { name: '買収' },
    ipo: { name: 'IPO' },
    'step-down': { name: '退任' },
  },
  families: {
    burstable: {
      name: 'バースト可能',
      blurb: '安い。アイドル中にCPUクレジットを貯め、使い切るとCPUが20%まで落ちます。',
    },
    general: { name: '汎用', blurb: '1 vCPU : 4 GB。' },
    compute: { name: 'コンピューティング', blurb: '1 vCPU : 2 GB。' },
    memory: { name: 'メモリ', blurb: '1 vCPU : 8 GB。' },
    arm: {
      name: 'ARM',
      blurb:
        '汎用ファミリーと同じ構成で20%安い。一部のランタイムとライブラリは移植に手間がかかります。',
    },
  },
  gpuModels: {
    small: { name: '小型 (3B)' },
    medium: { name: '中型 (7B)' },
    large: { name: '大型 (34B)' },
  },
  guided: {
    'out-of-credits': {
      name: 'クレジット切れ',
      objectives: [
        { goal: 'すべてのリクエストを90秒間さばいてください。' },
        { goal: '需要が4倍になります。Apdexを0.85以上に2分間保ってください。' },
        {
          goal: '夜間のトラフィックが元の水準に戻ります。Apdexを0.85以上に保ち、支出は$0.12/s以下にしてください。',
        },
      ],
    },
    'shared-box': {
      name: '相乗りボックス',
      objectives: [
        { goal: 'Apdexを0.85以上に90秒間保ってください。' },
        { goal: '需要が2倍になります。Apdexを0.9以上に保ち、支出は$0.16/s以下にしてください。' },
        {
          goal: '夜間のトラフィックが元の水準に戻ります。Apdexを0.9以上に保ち、支出は$0.11/s以下にしてください。',
        },
      ],
    },
    'second-server': {
      name: '2台目のサーバー',
      objectives: [
        { goal: 'Apdexを0.9以上に90秒間保ってください。' },
        { goal: 'サーバーが1台落ちます。Apdexを0.85以上に2分間保ってください。' },
        {
          goal: '需要が2倍になります。もう1台落ちてもApdexを0.9以上に保ってください。',
        },
      ],
    },
    'connection-limit': {
      name: '接続上限',
      objectives: [
        { goal: 'すべてのリクエストを90秒間さばいてください。' },
        { goal: '需要が2倍になります。Apdexを0.9以上に2分間保ってください。' },
        {
          goal: 'デプロイで全プールが2倍になります。エラーを1%未満に抑えてください。',
        },
      ],
    },
    'event-loop-stall': {
      name: 'イベントループ停止',
      objectives: [
        { goal: 'p99を300 ms未満に2分間保ってください。' },
        {
          goal: 'パスワードのハッシュ化が4倍遅くなります。p99を600 ms未満に2分間保ってください。',
        },
      ],
    },
    'read-mostly': {
      name: '読み取り中心',
      objectives: [
        { goal: 'Apdexを0.9以上に90秒間保ってください。' },
        { goal: '需要が2倍になります。Apdexを0.9以上に保ち、支出は$2.60/s以下にしてください。' },
        {
          goal: 'インデックスなしのクエリが出荷されます。その後2分間、Apdexを0.85以上に保ってください。',
        },
      ],
    },
    stampede: {
      name: 'スタンピード',
      objectives: [
        { goal: 'Apdexを0.9以上に90秒間保ってください。' },
        { goal: 'キャッシュが再起動します。Apdexを0.85以上に2分間保ってください。' },
        {
          goal: '需要が50%増えます。キャッシュがまた再起動します。Apdexを0.85以上に保ち、支出は$8.00/s以下にしてください。',
        },
      ],
    },
    'slow-uploads': {
      name: '遅いアップロード',
      objectives: [
        { goal: 'Apdexを0.9以上に90秒間保ってください。' },
        { goal: '需要が60%増えます。Apdexを0.9以上に保ち、支出は$6.00/s以下にしてください。' },
        {
          goal: 'あるタスクが永久に失敗します。キューを500タスク未満に2分間保ってください。',
        },
      ],
    },
    bots: {
      name: 'ボット',
      objectives: [
        { goal: 'Apdexを0.9以上に90秒間保ってください。' },
        { goal: 'スクレイパーが来ます。Apdexを0.9以上に2分間保ってください。' },
        {
          goal: 'また来ました。Apdexを0.9以上に保ち、支出は$10.80/s以下にしてください。',
        },
      ],
    },
    'zone-outage': {
      name: 'ゾーン障害',
      objectives: [
        { goal: 'Apdexを0.9以上に90秒間保ってください。' },
        { goal: 'ゾーンが1つ落ちます。Apdexを0.85以上に2分間保ってください。' },
        {
          goal: '需要が50%増えます。ゾーンがまた落ちます。Apdexを0.85以上に保ち、支出は$22.20/s以下にしてください。',
        },
      ],
    },
    'cold-start': {
      name: 'コールドスタート',
      objectives: [
        { goal: 'Apdexを0.9以上に90秒間保ってください。' },
        { goal: '4倍のスパイクが来ます。Apdexを0.85以上に2分間保ってください。' },
        {
          goal: '夜間のトラフィックです。Apdexを0.9以上に保ち、支出は$17.40/s以下にしてください。',
        },
      ],
    },
    'stale-checkout': {
      name: '古いデータのチェックアウト',
      objectives: [
        { goal: 'Apdexを0.9以上に90秒間保ってください。' },
        {
          goal: '書き込みが溜まります。2分間、すべてのチェックアウトを正しいまま保ってください。',
          watch: { label: 'チェックアウト' },
        },
        {
          goal: '需要が50%増え、書き込みも戻ってきます。その間もすべてのチェックアウトを正しいまま保ってください。',
          watch: { label: 'チェックアウト' },
        },
      ],
    },
    'gc-pauses': {
      name: 'GCポーズ',
      objectives: [
        {
          goal: 'API読み取りのp99を110 ms未満に90秒間保ってください。',
          watch: { label: '読み取りp99' },
        },
        {
          goal: 'ヒープが埋まります。API読み取りのp99を110 ms未満に2分間保ってください。',
          watch: { label: '読み取りp99' },
        },
        {
          goal: 'また埋まります。読み取りのp99を110 ms未満に保ち、支出は$93.20/s以下にしてください。',
          watch: { label: '読み取りp99' },
        },
      ],
    },
    'retry-storm': {
      name: 'リトライストーム',
      objectives: [
        { goal: 'Apdexを0.9以上に90秒間保ってください。' },
        {
          goal: 'データベースが20秒間遅くなります。エラーを1%未満に戻し、2分間保ってください。',
        },
        {
          goal: 'また遅くなります。エラーを1%未満に戻し、支出$197.00/s以下で保ってください。',
        },
      ],
    },
    'analytics-primary': {
      name: 'プライマリでの分析',
      objectives: [
        { goal: 'Apdexを0.9以上に90秒間保ってください。' },
        {
          goal: '四半期末です。レポートが全テーブルをスキャンします。Apdexを0.85以上に2分間保ってください。',
        },
        {
          goal: '需要が50%増えます。Apdexを0.9以上に保ち、支出は$254.00/s以下にしてください。',
        },
      ],
    },
    'far-away': {
      name: '遠隔ユーザー',
      objectives: [
        { goal: 'すべてのリクエストを2分間さばいてください。' },
        {
          goal: 'ユーザーの半分は北米の外に住んでいます。API読み取りの平均を140 ms未満に2分間保ってください。',
          watch: { label: '読み取り平均' },
        },
      ],
    },
    'missed-write': {
      name: '書き込みの取りこぼし',
      objectives: [
        {
          goal: 'すべてのAPI読み取りに最新の書き込みが見えるようにし、2分間保ってください。',
          watch: { label: '最新の読み取り' },
        },
        {
          goal: 'レプリカが1台落ちます。読み取りを最新に保ち、エラーを1%未満に2分間抑えてください。',
          watch: { label: '最新の読み取り' },
        },
      ],
    },
    'hot-key': {
      name: 'ホットキー',
      objectives: [
        { goal: 'Apdexを0.9以上に2分間保ってください。' },
        { goal: '有名人が投稿します。Apdexを0.85以上に2分間保ってください。' },
      ],
    },
  },
  lbPolicies: {
    weighted: { label: '重み付き' },
    'round-robin': { label: 'ラウンドロビン' },
    'least-conn': { label: '最小接続数' },
    p2c: { label: '2択' },
    hash: { label: 'コンシステントハッシュ' },
  },
  logAcks: {
    '0': { name: '確認なし' },
    '1': { name: 'リーダー' },
    all: { name: '全レプリカ' },
  },
  mutators: {
    'chaos-monkey': {
      name: 'カオスモンキー',
      rule: 'シード以降はインスタンス障害が支配的になる',
    },
    'hn-front-page': {
      name: 'Hacker Newsのトップページ',
      rule: 'トラフィックスパイクが3倍の頻度で起きる',
    },
    'legacy-monolith': {
      name: 'レガシーモノリス',
      rule: '巨大なPHPコードベース。マイグレーションは×3、技術的負債は40%から始まる',
    },
    'one-region': {
      name: '単一リージョン縛り',
      rule: 'ホームリージョンの外にノードを置けない',
    },
    'no-caches': { name: 'キャッシュ禁止', rule: 'キャッシュもCDNもなし' },
    'tight-budget': { name: '厳しい予算', rule: '資金調達の額が半分になる' },
    'single-language': { name: '単一言語', rule: 'すべてのアプリサーバーがPHPで動く' },
    postgres: {
      name: '全部Postgres',
      rule: 'キャッシュ、ワイドカラムストア、合意形成データベース、データウェアハウスは使えない',
    },
    'strict-slo': { name: '厳格なSLO', rule: 'SLOが1段階高くなる' },
    'shared-tenancy': {
      name: '共用テナント',
      rule: 'ノイジーネイバーが全インスタンスのCPUを奪う',
    },
  },
  perks: {
    'angel-network': { name: 'エンジェルネットワーク', effect: '開始時の資金 ×2' },
    'alumni-network': { name: '卒業生ネットワーク', effect: 'プレシードでエンジニア +1' },
    'institutional-knowledge': {
      name: '組織の知識',
      effect: 'エグジット後もリサーチを1つ保持',
    },
    'pattern-recognition': { name: 'パターン認識', effect: 'インサイト +20%' },
    'founders-reputation': { name: '創業者の評判', effect: 'ユーザー成長 +10%' },
    'better-terms': { name: '有利な条件', effect: 'ラウンドごとの希薄化 −2ポイント' },
    'night-shift': { name: '夜勤', effect: '開発工数 +10%' },
    'time-dilation': { name: '時間の歪み', effect: '20倍、続いて40倍の速度を解放' },
    playbooks: { name: 'プレイブック', effect: 'プレイブックスロット 2、5、10、25' },
    'war-stories': {
      name: '戦記',
      effect: '未完了のアクションアイテムが発生率を上げる幅が半分になる',
    },
    'head-start': {
      name: '先行スタート',
      effect: 'プレシード、続いてシード、シリーズAで開始',
    },
    autopilot: {
      name: 'オートパイロット',
      effect: 'ポリシー: 最も安い研究をキューに入れ、採用し、アプリサーバーの負荷を低く保つ',
    },
  },
  pmModes: {
    static: { label: '静的' },
    dynamic: { label: '動的' },
    ondemand: { label: 'オンデマンド' },
  },
  policies: {
    'move-fast': { label: '速度優先' },
    balanced: { label: 'バランス' },
    quality: { label: '品質優先' },
  },
  pricings: {
    'on-demand': {
      name: 'オンデマンド',
      blurb: '定価。ノードはいつでも外せます。',
    },
    reserved: {
      name: 'リザーブド',
      blurb: '0.6×、1週間のコミットメント。期間の途中で手放すと残りの支出を払うことになります。',
    },
    spot: {
      name: 'スポット',
      blurb: '0.3×。プロバイダは10秒の予告でノードを回収できます。',
    },
  },
  regionInfo: {
    na: { name: '北米', short: 'NA' },
    eu: { name: '欧州', short: 'EU' },
    apac: { name: 'アジア太平洋', short: 'APAC' },
    sa: { name: '南米', short: 'SA' },
  },
  shardKeys: {
    hash: { name: 'ユーザーIDのハッシュ' },
    range: { name: 'IDの範囲' },
    tenant: { name: 'テナント別' },
    region: { name: 'リージョン別' },
  },
  storageClasses: {
    standard: { name: '標準' },
    infrequent: { name: '低頻度アクセス' },
    archive: { name: 'アーカイブ' },
  },
  storageIops: {
    general: { name: '汎用' },
    provisioned: { name: 'プロビジョンドIOPS' },
  },
  tasks: {
    'add-index': {
      name: 'インデックスの追加',
      effect: 'スロークエリを終わらせ、クエリ形状を1つカバーする',
    },
    'eager-loading': {
      name: '一括読み込み',
      effect: 'ORMフレームワークがN+1クエリを送らなくなる',
    },
    'fix-leak': {
      name: 'メモリリークの修正',
      effect: '次の機能を出すまでリークしない',
    },
    'session-state': {
      name: 'セッション状態の廃止',
      effect: 'トランザクションプーリングでクエリが壊れなくなる',
    },
    refactor: { name: 'リファクタリング', effect: '技術的負債 −20ポイント' },
    'fix-bugs': {
      name: 'マイグレーションの不具合修正',
      effect: '新しいスタックでリクエストが失敗しなくなる',
    },
    'upgrade-cluster': {
      name: 'クラスターの更新',
      effect: 'すべてのKubernetesクラスターが四半期の間サポート対象のバージョンで動く',
    },
    runbook: {
      name: 'ランブックを書く',
      effect: '1種類のインシデントがプレイヤーの操作なしで自然に解決する',
    },
    'idempotency-keys': {
      name: '冪等キー',
      effect: 'リトライしたチェックアウトが二重に課金されない',
    },
    'off-loop': {
      name: 'イベントループ外へのCPU処理移動',
      effect: 'Node.jsとPython asyncがCPU負荷の高い種別をワーカースレッドへ回す',
    },
    'timeouts-retries': {
      name: 'タイムアウトとリトライの追加',
      effect:
        'アプリサーバーやワーカーから出るすべてのリンクに5秒のタイムアウトとバックオフ付きリトライが付く',
    },
    'graceful-shutdown': {
      name: 'グレースフルシャットダウン',
      effect: 'デプロイやスケールダウン時に、処理中のリクエストを失敗させずに完了させる',
    },
    'health-check': {
      name: 'ヘルスチェックエンドポイント',
      effect: 'ロードバランサーが詳細なヘルスチェックを実行できる',
    },
    'load-test': {
      name: '負荷試験',
      effect: 'すべてのノードを需要2倍の状態で1日表示する',
    },
  },
  vecIndexes: {
    exact: { name: '厳密' },
    hnsw: { name: 'HNSW' },
  },
  ventures: {
    'b2b-saas': { name: 'B2B SaaS', summary: '夕方のピーク。既定のミックス' },
    'consumer-social': {
      name: 'コンシューマーSNS',
      summary: 'フィードと動画が中心。ユーザー2倍、1人あたりの価値は半分',
    },
    fintech: {
      name: 'フィンテック',
      summary: '営業時間。チェックアウトと書き込みが中心。金銭を扱う読み取りが古いと罰金',
    },
    streaming: {
      name: '動画配信',
      summary: '深夜のピーク。動画が中心。エグレスは3倍の費用',
    },
    'game-backend': {
      name: 'ゲームバックエンド',
      summary: '夜のピーク。リアルタイムがトラフィックの大半',
    },
    'ai-startup': {
      name: 'AIスタートアップ',
      summary: '平坦な需要。プロンプトとアップロードが中心。GPUは希少',
    },
    'e-commerce': {
      name: 'EC',
      summary: 'ページと検索が中心。毎月決まった日にセール',
    },
    'developer-platform': {
      name: '開発者プラットフォーム',
      summary: '平坦だがバースト的。API読み取りとWebhookが中心。素朴なリトライは禁止',
    },
    healthcare: {
      name: 'ヘルスケア',
      summary: '営業時間。書き込みと検索が中心。データは地域内に留まる',
    },
    'ad-tech': {
      name: 'アドテク',
      summary: '平坦で巨大。入札が中心。100 msを超えると稼げない',
    },
    government: {
      name: '公共調達',
      summary: '営業時間。ページと記録。JavaかC#のみ。発注に1日',
    },
    bootstrapped: {
      name: '自己資金',
      summary: 'ラウンドなし。既定のミックス。株式は100%のまま',
    },
  },
  challenges: {
    'hello-world': {
      name: 'ハローワールド',
      brief: '1台で20 rpsを$0.05/s未満でさばく。',
      inspiredBy: 'すべての最初のデプロイ',
    },
    'split-the-box': {
      name: 'ボックスを分ける',
      brief:
        'アプリとデータベースが同じボックスに載っている。100 rpsをさばき、p99を300 ms未満に保つ。',
      inspiredBy: 'ほとんどの会社が最初に踏むスケーリングの一歩',
    },
    slashdotted: {
      name: 'スラッシュドット',
      brief: '固定予算で3分間、トラフィック×10。',
      inspiredBy: 'スラッシュドット効果',
    },
    c10k: {
      name: 'C10k',
      brief: '10,000本の接続を開く。リクエストごとにプロセスを立てるサーバーはこれを拒否する。',
      inspiredBy: 'Dan KegelのC10k問題 (1999)',
    },
    'event-loop': {
      name: 'イベントループ',
      brief: 'Node.jsのみ。ログイン5%。p99を300 ms未満に。',
      inspiredBy: 'Node.jsの「イベントループを塞ぐな」',
    },
    'too-many-connections': {
      name: '接続が多すぎる',
      brief: 'アプリサーバー40台にPostgres 1台。接続の拒否ゼロ。',
      inspiredBy: 'PostgreSQLの接続上限',
    },
    shoestring: {
      name: 'Stack Overflow流の低予算構成',
      brief: 'ノード12台以下で800 rpsをさばく。',
      inspiredBy: 'Stack Overflowは少数のサーバーで巨大なトラフィックをさばいていた',
    },
    'n-plus-one': {
      name: 'N+1',
      brief: 'N+1クエリの出るRails。修正に12 DH。',
      inspiredBy: 'ORMの遅延読み込み',
    },
    'thirteen-engineers': {
      name: '13人のエンジニア',
      brief: 'Railsで400 rps。エンジニア13人に1日、つまり104 DH。',
      inspiredBy: 'Facebookが買収したときのInstagramは従業員13人だった (2012)',
    },
    'credential-stuffing': {
      name: 'クレデンシャルスタッフィング',
      brief: 'ボットが漏えいしたパスワードでログインを試す。本物のユーザーをログインさせ続ける。',
      inspiredBy: 'ログインエンドポイントへの一般的な攻撃',
    },
    'black-friday': {
      name: 'ブラックフライデー',
      brief: '5分の時点で需要が3倍になり、それが5分続く。支出はできるだけ抑える。',
      inspiredBy: '小売のピーク日',
    },
    'us-east-1': {
      name: 'us-east-1',
      brief: '5分の時点でゾーンが1つ落ちる。リクエストの99.9%を守る。',
      inspiredBy: 'AWS us-east-1で起きた複数の障害',
    },
    'exactly-once': {
      name: 'ちょうど1回',
      brief: '決済プロバイダが2回、2秒まで遅くなる。各チェックアウトの課金は1回だけ。',
      inspiredBy: '決済の冪等性',
    },
    'two-million-sockets': {
      name: '200万ソケット',
      brief: '200万本のチャット接続を開いたまま、できるだけ少ない金額で維持する。',
      inspiredBy: 'Phoenixは1台のサーバーで200万のWebSocket接続に到達した (2015)',
    },
    'pokemon-go': {
      name: 'Pokémon GO',
      brief: 'ローンチ当日、10分で需要が予測の50倍に達する。',
      inspiredBy: 'Pokémon GOのローンチ時のトラフィックは想定の約50倍に達した (2016)',
    },
    'healthcare-launch': {
      name: 'ヘルスケアのローンチ',
      brief: '2分の時点でローンチ。この設計には欠陥が多い。見つける。',
      inspiredBy: 'healthcare.govのローンチ (2013)',
    },
    'thundering-herd': {
      name: 'サンダリングハード',
      brief:
        '2分の時点でチャットサーバーが再起動する。24万のクライアントが一斉に再接続してログインする。',
      inspiredBy: '再接続ストーム',
    },
    'read-states': {
      name: 'リードステート',
      brief: 'ヒープが2回満杯になる。p99を90 ms未満に保つ。ランタイムは自由。',
      inspiredBy: 'DiscordはGCスパイクをなくすため、あるサービスをGoからRustへ移した (2020)',
    },
    'fail-whale': {
      name: 'フェイルホエール',
      brief: 'フィードをさばき、p99を200 ms未満に保つ。フォロワー1,000万人のアカウントもある。',
      inspiredBy: 'Twitterのタイムラインのスケーリング問題',
    },
    'reports-at-noon': {
      name: '正午のレポート',
      brief:
        '2分と5分の時点で、経理がプライマリでレポートを回す。中止はできない。チェックアウトを速いまま保つ。',
      inspiredBy: 'トランザクション用データベースへの分析クエリ',
    },
    'gpu-economics': {
      name: 'GPUの経済性',
      brief: 'すべてのAIプロンプトをさばき、売上の15%を利益率として残す。',
      inspiredBy: '自前の推論とホスト型APIの戦い',
    },
    metastable: {
      name: 'メタステーブル',
      brief: 'リトライストームが進行中。最小限の変更で復旧する。',
      inspiredBy: '分散システムのメタステーブル障害',
    },
    'regex-of-doom': {
      name: '破滅の正規表現',
      brief:
        '2分の時点で新しいWAFルールがすべてのWAFをCPU 100%に張り付かせる。サービスを復旧する。',
      inspiredBy: 'Cloudflareの障害、2019年7月2日',
    },
    'forty-three-seconds': {
      name: '43秒',
      brief: '2分の時点でリージョン間のリンクが切れる。リーダーを1つに保つ。',
      inspiredBy: 'GitHubのネットワーク分断、2018年10月21日',
    },
    'follow-the-sun': {
      name: '太陽を追う',
      brief: '4つのリージョンがそれぞれの夕方ピークを迎える1日。支出は$700/s未満。',
      inspiredBy: '世界各地の日次ピーク',
    },
    celebrity: {
      name: 'セレブリティ',
      brief: '2分の時点で有名人が投稿する。読み取りの30%が1つのキーに集中する。',
      inspiredBy: 'バズったアカウントによるホットキー',
    },
    'gone-from-the-internet': {
      name: 'インターネットから消える',
      brief: '2分の時点でルーティングが変わり、全リージョンがインターネットから消える。元に戻す。',
      inspiredBy: 'Facebookの障害、2021年10月4日',
    },
    'the-typo': {
      name: '打ち間違い',
      brief: '2分の時点で、サーバー1台を外すはずのコマンドが検索層ごと外してしまう。',
      inspiredBy: 'Amazon S3の障害、2017年2月28日',
    },
    'leap-second': {
      name: 'うるう秒',
      brief:
        '2分の時点でアジア太平洋の時計が1秒を繰り返す。そこのアプリサーバーはすべてCPU 100%で回り続ける。p99を380 ms未満に保つ。',
      inspiredBy: '2012年のうるう秒',
    },
    'rule-of-40': {
      name: '40の法則',
      brief:
        'このチャレンジの間にユーザーが25%増える。成長率と利益率の合計40を目指し、利益率15%を確保する。',
      inspiredBy: 'SaaSの40の法則',
    },
    'postgres-for-everything': {
      name: '全部Postgres',
      brief: 'Postgresだけをデータストアとして全種別をさばき、p99を800 ms未満に保つ。',
      inspiredBy: '「とりあえずPostgresでいい」という主張',
    },
    'five-nines': {
      name: 'ファイブナイン',
      brief:
        '4週間で、サーバー2台とリージョン1つが落ち、トラフィックが一度3倍になる。99.999%を守る。',
      inspiredBy: '99.999%の可用性目標',
    },
  },

  components: {
    users: {
      name: 'ユーザー',
      product: 'インターネット',
      blurb:
        'トラフィックが始まる場所。ドメインは1つのホストに解決されるので、ユーザーが取るリンクは1本だけです。',
    },
    payments: {
      name: '決済',
      product: '請求書',
      blurb: '売上がここで待っています。引き出しに入っているのはおよそ1分分です。',
    },
    analytics: {
      name: 'アナリティクス',
      product: 'OpenTelemetry',
      blurb:
        'どのノードでもリンクできます。そのトラフィックをサンプリングし、インサイトに変えます。',
    },
    server: {
      name: 'アプリサーバー',
      product: '仮想マシン',
      blurb: 'コードを動かします。リクエストに応答し、データベースへクエリを投げます。',
    },
    database: {
      name: 'データベース',
      product: 'PostgreSQL or MySQL',
      blurb:
        '唯一の正となるデータ。Postgresは接続ごとにプロセスをforkし、MySQLは接続ごとにスレッドを与えます。',
    },
    dns: {
      name: 'DNS',
      product: 'Route 53',
      blurb:
        '最大8ホストへのラウンドロビン。ヘルスチェックはなく、死んだホストも取り分を保ちます。',
    },
    lb: {
      name: 'ロードバランサー',
      product: 'NGINX',
      blurb: 'トラフィックをアプリサーバーに振り分け、死んだホストを次のヘルスチェックで外します。',
    },
    pooler: {
      name: 'コネクションプーラー',
      product: 'PgBouncer',
      blurb: '多数のアプリ接続が、20本のデータベース接続を共有します。',
    },
    cache: {
      name: 'キャッシュ',
      product: 'Redis',
      blurb:
        'ホットなデータが載っている間は、読み取りクエリをメモリから返します。書き込みは素通りし、キャッシュを無効化します。',
    },
    replica: {
      name: 'リードレプリカ',
      product: 'PostgreSQLレプリカ',
      blurb: '読み取りに答えます。書き込みには遅れるので、一部のAPI読み取りは古い値を返します。',
    },
    auth: {
      name: '認証プロバイダ',
      product: 'Auth0',
      blurb: 'パスワードのハッシュ化を肩代わりします。課金はユーザー単位です。',
    },
    search: {
      name: '検索エンジン',
      product: 'Elasticsearch',
      blurb: '検索クエリに答えます。サイズ1段ごとに毎秒400件。',
    },
    storage: {
      name: 'オブジェクトストレージ',
      product: 'Amazon S3',
      blurb:
        'アップロードされたファイルを保持します。上限はありません。保存した分だけ課金されます。',
    },
    doc: {
      name: 'ドキュメントストア',
      product: 'MongoDB, Firestore',
      blurb:
        '行ではなくドキュメントを保持します。結合もプールすべき接続もなく、読み書きは一律のレートで、クエリごとに専用のインデックスが要ります。',
    },
    queue: {
      name: 'キュー',
      product: 'RabbitMQ',
      blurb: '仕事を今引き受け、ワーカーが後でやります。ユーザーが待つのはエンキューまでです。',
    },
    worker: {
      name: 'ワーカー',
      product: 'Sidekiq',
      blurb:
        'キューから来たタスクでコードを動かします。ユーザーが待つことはありません。エクスポートが読むデータにリンクさせてください。',
    },
    log: {
      name: 'イベントストリーム',
      product: 'Apache Kafka',
      blurb:
        'キューではなくログです。イベントは読まれた後も残るので、コンシューマーは再生できます。コンシューマーはそれぞれ1パーティションを読み、自分のペースで遅れます。',
    },
    fn: {
      name: 'サーバーレス関数',
      product: 'AWS Lambda',
      blurb:
        'リクエストごとにコードを動かし、持つべき箱がありません。待機中はゼロ、起きればコールドスタート、同時実行は1,000です。',
    },
    cdn: {
      name: 'CDN',
      product: 'Cloudflare',
      blurb:
        'キャッシュできるページをユーザーの近くから返します。エッジからのエグレスは安く済みます。',
    },
    waf: {
      name: 'WAF',
      product: 'ModSecurity',
      blurb: 'ボットがアプリに届く前に止めます。本物のユーザーもいくらか巻き込みます。',
    },
    gw: {
      name: 'APIゲートウェイ',
      product: 'Kong',
      blurb:
        'API呼び出しをレート制限し、ルーティングします。レート上限を超えたリクエストはthrottled扱いで失敗し、課金はリクエスト単位です。',
    },
    ws: {
      name: 'リアルタイムハブ',
      product: 'Socket.IO',
      blurb:
        'リアルタイムのメッセージごとに接続を開いたまま保ちます。何本入るかはランタイム次第です。',
    },
    psp: {
      name: '決済プロバイダ',
      product: 'Stripe',
      blurb: 'チェックアウトのカードを課金します。1件あたり2.9%＋$0.30。',
    },
    autoscaler: {
      name: 'オートスケーラー',
      product: 'Auto Scalingグループ',
      blurb:
        'アプリサーバーやワーカーをリンクします。高負荷になればコピーを増やし、暇になれば減らします。',
    },
    ci: {
      name: 'CI/CDパイプライン',
      product: 'GitHub Actions',
      blurb:
        '待っているものを出荷します。デプロイ戦略が、デプロイにかかる時間、燃やす支出、そして不正なデプロイの深刻さを決めます。',
    },
    cluster: {
      name: 'Kubernetesクラスター',
      product: 'Kubernetes',
      blurb:
        'アプリサーバーやワーカーをリンクします。共有ノードに詰め込まれ、支出が15%減り、コピーは30秒で立ちます。',
    },
    warehouse: {
      name: 'データウェアハウス',
      product: 'BigQuery',
      blurb:
        'レポートのスキャンをカラム指向で返します。1件1.5秒、上限なし、スキャン量に応じた課金です。',
    },
    vec: {
      name: 'ベクトルインデックス',
      product: 'pgvector, Pinecone, Qdrant',
      blurb:
        'エンベディングの近傍探索に答えます。インデックスはメモリに載り、ここに届いたプロンプトはより多く稼ぎます。',
    },
    gpu: {
      name: 'GPUノード',
      product: 'NVIDIA上のvLLM',
      blurb: 'AIプロンプトを毎秒トークン数で処理します。サイズ1段ごとにGPUが倍になります。',
    },
    edge: {
      name: 'エッジ関数',
      product: 'Cloudflare Workers',
      blurb:
        '小さなハンドラーをユーザーの隣で動かします。5 ms、コールドスタートなし、箱ではなくCPU上限で動きます。',
    },
    llm: {
      name: 'LLM API',
      product: 'ホスト型モデル',
      blurb: 'GPUなしでAIプロンプトを処理します。トークン単位の課金で、レート制限があります。',
    },
    msgp: {
      name: 'プッシュプロバイダ',
      product: 'Amazon SNS',
      blurb: 'プッシュ通知とメールを送ります。メッセージ単価の課金で、毎秒10,000件。',
    },
    wide: {
      name: 'ワイドカラムストア',
      product: 'Apache Cassandra',
      blurb: '各キーをN個のノードに複製します。読み取りはR個に問い、書き込みはW個を待ちます。',
    },
    dsql: {
      name: '分散SQL',
      product: 'CockroachDB',
      blurb: 'Raft上のSQLです。書き込みはレプリカの過半数を待ちます。',
    },
    cdc: {
      name: 'CDCコネクター',
      product: 'Debezium',
      blurb:
        'データベースをリンクします。書き込みログから変更をすべて読み、イベントストリームへ流すので、アプリが二度書くことはありません。',
    },
    mesh: {
      name: 'サービスメッシュ',
      product: 'Istio',
      blurb:
        'アプリサーバーとワーカーをリンクします。各ノードの隣のサイドカーが呼び出しをリトライし、遮断し、監視します。ホップごとに+1 ms、CPUの5%を使います。',
    },
    ff: {
      name: 'フィーチャーフラグ',
      product: 'LaunchDarkly',
      blurb:
        '機能を5%、25%、50%、または全ユーザーへ展開し、ワンクリックで切れます。不正なデプロイの影響は、その機能を持つ割合だけです。',
    },
    pki: {
      name: 'シークレットと証明書',
      product: "Let's Encrypt",
      blurb:
        '鍵を保管し、TLS証明書を期限切れ前に更新します。これが動いていないと、証明書はカレンダーどおりに切れ、サイトは落ちます。',
    },
  },
  features: {
    'landing-page': { name: 'ランディングページ', effect: '市場+20%、ページビュー+10%' },
    'signup-flow': {
      name: 'サインアップフロー',
      effect: '成長+15%、書き込みが早く届く',
    },
    pagination: {
      name: 'ページネーション',
      effect: 'API読み取りの転送バイトが半分になる',
      hidden: 'インデックスのないクエリ形状が増える',
    },
    'password-login': {
      name: 'パスワードログイン',
      effect: 'ログインが届く。1件あたり80 msのCPU',
    },
    'paid-plans': {
      name: '有料プラン',
      effect: '書き込みの稼ぎが30%増、さらにサブスクリプション',
    },
    'email-digests': {
      name: 'メールダイジェスト',
      effect:
        '離脱−10%。ダイジェストはジョブのバーストで送られ、エクスポートが2倍、1件あたり400 msのCPUと50回の読み取り',
      hidden: '送信はジョブのバースト',
    },
    'search-filters': {
      name: '検索フィルター',
      effect: '検索の稼ぎが25%増',
      hidden: '検索クエリのコストが40%増',
    },
    'profile-photos': {
      name: 'プロフィール写真',
      effect: '成長+10%、アップロードが届く。1件あたり120 msのCPU',
    },
    'public-api': {
      name: '公開API',
      effect: '市場+25%、API読み取り+30%',
      hidden: 'ボット+50%',
    },
    'infinite-scroll': {
      name: '無限スクロール',
      effect: 'API読み取りの稼ぎが10%増え、ユーザーの送信も40%増える',
    },
    video: { name: '動画', effect: '市場+40%、動画が届く。1件あたり5 MB' },
    chat: {
      name: 'チャット',
      effect: '離脱−20%、リアルタイムのメッセージが接続を開いたまま保つ',
    },
    checkout: {
      name: 'チェックアウト',
      effect: 'チェックアウトが届く。1件$25、決済プロバイダ経由',
    },
    'notifications-center': {
      name: '通知センター',
      effect: '成長+10%、リアルタイム+20%',
    },
    'mobile-app': { name: 'モバイルアプリ', effect: '市場+60%、API読み取り+50%' },
    'data-export': {
      name: 'データエクスポート',
      effect: '書き込みの稼ぎが20%増。エクスポートが届く。1件あたり400 msのCPUと50回の読み取り',
    },
    dashboards: {
      name: 'ダッシュボード',
      effect: '市場+10%。レポートが届く。1件あたりテーブルスキャン1回',
    },
    'ai-assistant': {
      name: 'AIアシスタント',
      effect: 'AIプロンプトが届く。1件$24、GPUノードかLLM APIが処理',
    },
    recommendations: {
      name: 'レコメンド',
      effect: '動画+30%',
      hidden: 'エクスポート+30%。モデルはバッチで学習する',
    },
    'audit-log': {
      name: '監査ログ',
      effect: '市場+10%。エンタープライズが買える',
      hidden: '書き込みクエリのコストが20%増',
    },
    'activity-feed': {
      name: 'アクティビティフィード',
      effect:
        '市場+50%。フィードが届く。1件あたり読み取り20回、または書き込み時ファンアウトのタイムライン1本',
    },
    webhooks: {
      name: 'Webhook',
      effect: '市場+20%。Webhookが届く。顧客サーバーへの800 msの呼び出し',
    },
    'push-notifications': {
      name: 'プッシュ通知',
      effect: '成長+15%。通知が届く。プッシュプロバイダ経由',
      hidden: '離脱+5%。ユーザーが飽きる',
    },
    localization: { name: 'ローカライズ', effect: '北米以外で市場+40%' },
    'offline-mode': {
      name: 'オフラインモード',
      effect: '離脱−10%',
      hidden: '書き込み+10%。再接続時にデバイスが一斉に同期する',
    },
    'single-sign-on': {
      name: 'シングルサインオン',
      effect: '市場+10%。エンタープライズがSAMLでサインインする',
    },
    'data-residency': {
      name: 'データレジデンシー',
      effect: 'EU市場に必須。EUのデータはEUのリージョンに留まる',
    },
    'status-page': {
      name: 'ステータスページ',
      effect: '離脱−10%。対応中だとユーザーに見える',
    },
    'usage-pricing': {
      name: '従量課金',
      effect: 'エクスポート、書き込み、プロンプト、Webhookの稼ぎが15%増',
    },
  },
  frameworks: {
    none: {
      name: 'フレームワークなし',
      blurb: '動かすのは速く、機能を作るのは遅いです。',
    },
    jetzig: {
      name: 'Jetzig',
      blurb:
        'ファイルベースのルーティング、テンプレート、データベース、バックグラウンドジョブを一つの箱に。機能を素早く出荷できます。CPU1.3×、プロセスあたり25 MB、若いツールチェーン上で動作します。',
    },
    tokamak: {
      name: 'Tokamak',
      blurb:
        'http.zig上の依存性注入コンテナ。明示的な配線が調整と技術的負債を減らします。CPU1.05×、プロセスあたり5 MB、エコシステムは小さめです。',
    },
    servant: {
      name: 'Servant',
      blurb:
        'APIの型が契約になります。ルーティング、クライアント、ドキュメントがそこから導かれ、チームの調整とドリフトが減ります。CPU1.0×、プロセスあたり2 MB、型レベルの学習曲線があります。',
    },
    ihp: {
      name: 'IHP',
      blurb:
        'バッテリー同梱。コード生成、型安全なクエリビルダー、組み込みのジョブキューを備えます。CPU1.3×、プロセスあたり40 MBで機能を素早く出荷できますが、Nixベースのツールチェーンです。',
    },
    laravel: {
      name: 'Laravel',
      blurb:
        '機能を速く出せて、バックグラウンド処理の開発工数が20%減ります。CPU1.8×（ワーカーモードでは1.1×）で、Eloquentは1回で足りる読み取りを3回投げます。',
    },
    rails: {
      name: 'Rails',
      blurb: '機能を速く出せて、ページビューの稼ぎが20%増えます。CPU1.5×で、N+1クエリが出ます。',
    },
    express: {
      name: 'Express',
      blurb:
        '最小限でどこにでもあります。CPU1.1×で、ミドルウェアの増殖により技術的負債が10%速く積み上がります。',
    },
    django: {
      name: 'Django',
      blurb:
        '機能を速く出せて、管理サイトのおかげで社内ツールの開発工数が30%減ります。CPU1.4×で、N+1クエリが出ます。',
    },
    symfony: {
      name: 'Symfony',
      blurb:
        '厳格な構造です。調整が30%減り、技術的負債の進行が30%遅くなります。CPU1.5×で、N+1クエリは出ません。',
    },
    sinatra: { name: 'Sinatra', blurb: '軽いです。CPU1.1×。' },
    flask: { name: 'Flask', blurb: '軽いです。CPU1.1×。' },
    gin: { name: 'Gin', blurb: '軽いルーターです。CPU1.05×。' },
    'spring-boot': {
      name: 'Spring Boot',
      blurb:
        '大人数のチーム向けの構造で、調整が30%減ります。CPU1.3×、メモリ200 MB増、起動は15秒遅くなります。',
    },
    aspnet: { name: 'ASP.NET Core', blurb: '速くて一通り揃っています。CPU1.05×。' },
    phoenix: { name: 'Phoenix', blurb: 'LiveViewのページの稼ぎが30%増えます。CPU1.1×。' },
    axum: { name: 'Axum', blurb: 'TokioとTowerの上に載っています。CPUの追加負荷はありません。' },
    actix: { name: 'Actix Web', blurb: 'ベンチマークでも最速級です。CPU0.95×。' },
    fastapi: {
      name: 'FastAPI',
      blurb:
        'Pydanticによる検証と、モデル連携に最も向いたエコシステム。`ai`リクエストの稼ぎが15%増えます。CPU1.15×で、ASGIサーバー上のみです。10 MB。',
    },
    fastify: {
      name: 'Fastify',
      blurb:
        'スキーマベースのシリアライズで、読み取りのCPUコストが20%減ります。自身のオーバーヘッドはありません。5 MB。',
    },
    nextjs: {
      name: 'Next.js',
      blurb:
        'サーバーサイドレンダリングとインクリメンタル静的再生成。ページの稼ぎが50%増える代わりにCPUは1.6×かかり、CDNがその40%を返せます。プロセスあたり30 MB。',
    },
    nestjs: {
      name: 'NestJS',
      blurb: '大人数のチーム向けの構造で、調整が30%減ります。CPU1.3×、プロセスあたり20 MB。',
    },
    fiber: {
      name: 'Fiber',
      blurb:
        'fasthttp上のExpress風API。CPUの追加負荷はなく、HTTP/2もありません。プロセスあたり5 MB。',
    },
    quarkus: {
      name: 'Quarkus',
      blurb:
        'ネイティブイメージ向けで、GraalVMビルドの所要時間が半分になります。CPU1.1×、プロセスあたり100 MB。',
    },
    hono: {
      name: 'Hono',
      blurb: 'Web標準の上の小さなルーター。CPUの追加負荷はありません。プロセスあたり2 MB。',
    },
    elysia: {
      name: 'Elysia',
      blurb:
        'Bun向けで、型がサーバーからクライアントまで検査されます。技術的負債の増加が15%遅くなります。CPUの追加負荷はありません。プロセスあたり5 MB。',
    },
    koa: {
      name: 'Koa',
      blurb: 'Expressの後継で、async関数の上に作られています。CPU1.05×、プロセスあたり5 MB。',
    },
    adonis: {
      name: 'AdonisJS',
      blurb:
        'Laravelの考え方をNode.jsに。機能を素早く出荷できます。CPU1.4×、プロセスあたり25 MB、Lucid ORMはN+1クエリを発生させます。',
    },
    codeigniter: {
      name: 'CodeIgniter',
      blurb: '邪魔をしない小さなPHPフレームワーク。CPU1.1×、プロセスあたり4 MB。',
    },
    sanic: {
      name: 'Sanic',
      blurb: '根本から非同期。CPU1.05×、プロセスあたり10 MB。',
    },
    rocket: {
      name: 'Rocket',
      blurb:
        '型安全なルーティングで定型コードが少なく、Rustで最も速く書けます。CPU1.05×、プロセスあたり3 MB。',
    },
  },
  incidents: {
    spike: {
      name: 'トラフィックスパイク',
      cause: '大手ニュースサイトにリンクされました。需要は3倍になりました。',
      prevention: '余剰キャパシティ、キャッシュ、アプリサーバーの増設です。',
    },
    instance: {
      name: 'インスタンス障害',
      cause: 'VMの下のホストが落ちました。',
      prevention:
        'ロードバランサーの後ろに2つ目のコピーを置きます。ロードバランサーは死んだホストを飛ばします。',
    },
    connections: {
      name: '接続枯渇',
      cause: 'デプロイで各コネクションプールが倍になり、Postgresが超過分を拒否しました。',
      prevention: 'コネクションプーラーを置くか、プールを小さくします。',
    },
    loop: {
      name: 'イベントループのブロック',
      cause:
        'パスワードハッシュのコストが10回から12回に上がりました。ログインあたりのCPUは4×です。',
      prevention:
        'libuvスレッドプール、認証プロバイダ、あるいはイベントループが1つだけではないランタイムです。',
    },
    leak: {
      name: 'メモリリーク',
      cause: '常駐プロセスがメモリを漏らし続け、カーネルに殺されました。',
      prevention:
        'サービスを再起動するか、PHPで動かします。PHPはリクエストごとにすべて解放します。',
    },
    'slow-query': {
      name: 'スロークエリ',
      cause:
        '新しい機能がインデックスのないクエリを出荷しました。読み取りのたびにテーブルを全走査します。',
      prevention:
        'クエリ分析が欠けているインデックスを見つけます。キャッシュが読み取りの大半をテーブルから遠ざけます。',
    },
    'bad-deploy': {
      name: '不正なデプロイ',
      cause: 'デプロイがバグを積みました。アプリサーバーへのリクエストが失敗します。',
      prevention: 'ロールバックできるパイプライン、自動テスト、そして小さめのデプロイです。',
    },
    'bot-surge': {
      name: 'ボット急増',
      cause: 'スクレイパーがサイトを見つけました。全トラフィックの半分がボットでした。',
      prevention: 'アプリサーバーの前にWAFを置きます。',
    },
    stuffing: {
      name: 'クレデンシャルスタッフィング',
      cause:
        'ボットが漏えいしたパスワードを試しました。ログインは20×になり、1件ごとにbcryptのハッシュです。',
      prevention: 'WAFがほとんどを止めます。残りは認証プロバイダがハッシュします。',
    },
    stampede: {
      name: 'キャッシュスタンピード',
      cause: 'キャッシュが空のまま再起動しました。すべてのミスが一斉にデータベースへ行きました。',
      prevention:
        'スタンピード対策がミスをまとめます。キャッシュウォーミングがトラフィックの前に埋めておきます。',
    },
    poison: {
      name: 'ポイズンメッセージ',
      cause:
        '必ず失敗するタスクが何度も戻ってきました。ワーカーがキューの代わりにリトライしました。',
      prevention: 'デッドレターキューが失敗するタスクを脇へどけます。',
    },
    ddos: {
      name: 'DDoS',
      cause: '攻撃者がエッジに通常の50倍のトラフィックを流しました。',
      prevention:
        'WAFを置き、始まったらUnder attackモードにします。キャッシュできる分はCDNが引き受けます。',
    },
    certificate: {
      name: '証明書の期限切れ',
      cause: 'TLS証明書が切れました。すべてのブラウザがサイトを拒否しました。',
      prevention: '証明書の自動化が期限前に更新します。',
    },
    'psp-outage': {
      name: '決済プロバイダ障害',
      cause: '決済プロバイダが落ちました。すべてのチェックアウトが失敗しました。',
      prevention:
        '手元でできることはありません。向こうの障害です。終わればチェックアウトは戻ります。',
    },
    zone: {
      name: 'ゾーン障害',
      cause: 'ゾーンが丸ごと落ちました。そこにあるノードはすべて灰色になりました。',
      prevention:
        '余剰キャパシティを持つ2つ目のゾーンにコピーを置き、データベースにはスタンバイを用意します。',
    },
    'disk-full': {
      name: 'ディスク満杯',
      cause: 'ログとWALがデータベースのディスクを埋めました。すべての書き込みが失敗しました。',
      prevention: 'ディスクのアラートで早く気づけます。ボリュームを拡張すれば終わります。',
    },
    'repl-lag': {
      name: 'レプリケーションラグ',
      cause:
        '書き込みのバーストでレプリカが数秒遅れました。書き込み直後の読み取りが古い値を返しました。',
      prevention: 'read-your-writesルーティングがその読み取りをプライマリへ送ります。',
    },
    'latency-regression': {
      name: 'レイテンシ悪化',
      cause:
        'デプロイが全リクエストに同期呼び出しを1つ足しました。応答は1回あたり150 ms遅くなります。',
      prevention: 'リクエスト経路のパーセンタイルとトレース、そしてp99を見張るカナリアです。',
    },
    'gc-storm': {
      name: 'GCポーズ連発',
      cause: 'ヒープが90%を超えました。コレクターが10リクエストに1つを止めました。',
      prevention: 'メモリを増やす、ZGC、またはGOGCのチューニングです。再起動すれば終わります。',
    },
    'retry-storm': {
      name: 'リトライストーム',
      cause:
        'データベースが20秒遅くなりました。呼び出し側が一斉にリトライし、そのリトライが過負荷を保ちました。',
      prevention: 'ジッター付きバックオフ、サーキットブレーカー、ロードシェディングです。',
    },
    'deadline-day': {
      name: '締め切り日',
      cause:
        '契約の締め切りが来ました。各代理店が一斉に成果物を送り、需要は通常の3倍になりました。',
      prevention: 'リザーブドキャパシティ、ロードシェディング、締め切り仕事用のキューです。',
    },
    'double-charge': {
      name: '二重課金',
      cause:
        '決済プロバイダが遅くなりました。課金がタイムアウトしてリトライされ、二重に請求された分が出ました。',
      prevention: '冪等キーです。終わらせるには課金リンクのリトライを止めます。',
    },
    'report-db': {
      name: 'レポートがデータベースを殺す',
      cause:
        '四半期末のレポートがプライマリの全テーブルをスキャンしました。あらゆる種類が遅くなりました。',
      prevention: 'データウェアハウスがスキャンをプライマリから引き取ります。',
    },
    'gpu-shortage': {
      name: 'GPU不足',
      cause: 'プロバイダがGPUノードを回収しました。今月はH100のキャパシティがありません。',
      prevention: 'GPUが足りないときはLLM APIがプロンプトを引き取ります。',
    },
    regex: {
      name: '正規表現バックトラッキング',
      cause:
        '新しいWAFルールが長い入力でバックトラックしました。すべてのWAFがCPU100%で回りました。',
      prevention: 'ルールはまずカナリアに出します。終わらせるにはルールを無効化します。',
    },
    region: {
      name: 'リージョン障害',
      cause: 'リージョンが丸ごと落ちました。そのボードが灰色になりました。',
      prevention: '2つ目のリージョン、そこへユーザーを送るGeoDNS、そして両方に住むデータです。',
    },
    partition: {
      name: 'ネットワーク分断',
      cause:
        'リージョン間の連絡が切れました。間の呼び出しはタイムアウトし、リーダー依存の書き込みが食い違いました。',
      prevention:
        '合意形成データベースがリーダーを1つに保ちます。終わらせるには古いリーダーをフェンスします。',
    },
    'hot-key': {
      name: 'ホットキー',
      cause: '有名人が投稿しました。読み取りの30%が1つのキーに集中し、そのシャードが飽和しました。',
      prevention: 'ホットキーをシャードに分散し、アプリサーバーでキャッシュします。',
    },
    bgp: {
      name: 'BGP設定ミス',
      cause:
        '経路変更が会社をインターネットから切り離しました。どのリージョンにも届きませんでした。',
      prevention: '経路変更をレビューします。終わらせるにはロールバックします。',
    },
    audit: {
      name: '監査指摘',
      cause: 'SOC 2の監査人が不足を見つけました。DR訓練がもう勘定に入りません。',
      prevention: 'セキュリティチームが、何かをリセットする前に指摘を直します。',
    },
    'dr-drill': {
      name: 'DR訓練',
      cause: '本番リージョンを計画的に落として、復旧を測ります。',
      prevention: '1時間以内に、書き込みを失わずに、あらゆる種類を別リージョンから提供します。',
    },
    breach: {
      name: '情報漏えい',
      cause: '公開された脆弱性が期限を過ぎても未修正のまま残り、誰かに使われました。',
      prevention: 'チケットが切れる前にパッチを当てます。チームのバックログに期限が出ます。',
    },
    'credential-leak': {
      name: '認証情報の漏えい',
      cause: 'フィッシングページが会社の認証情報を奪い、第三者に使われました。',
      prevention:
        'ロゴではなくドメインを読みます。メールをフィッシングとして報告すれば、そのボタンは消えます。',
    },
    'cluster-upgrade': {
      name: '強制クラスター更新',
      cause:
        'クラウドプロバイダがKubernetesクラスターをサポート終了のバージョンから更新しました。削除されたAPIを使うPodはクラッシュループしました。',
      prevention:
        '四半期に最低1回はクラスターを更新するか、プラットフォームチームに最新に保たせます。',
    },
    config: {
      name: '不正な設定投入',
      cause:
        '設定変更が全アプリサーバーとワーカーに一斉に届き、一緒に落ちました。GitOpsの一斉適用がすべてのミラーにも広がりました。',
      prevention: '終わらせるにはロールバックします。GitOpsの段階適用はまず1リージョンに留めます。',
    },
    'spot-reclaim': {
      name: 'スポット回収',
      cause:
        'プロバイダがキャパシティを必要としました。スポットノードを10秒の警告の後に回収しました。',
      prevention:
        '混成フリート、グレースフルシャットダウン、ロードバランサーの後ろのオンデマンドコピーです。',
    },
    'stale-read': {
      name: '古い読み取り',
      cause:
        'キャッシュがTTLを過ぎた値を返しました。書き込みの多いテーブルが無効化を追い越し、同じ行の読み取りが古いまま返りました。',
      prevention:
        'TTLを短くする、ライトスルーのキャッシュ、またはread-your-writesルーティングです。',
    },
    reconnect: {
      name: '再接続ストーム',
      cause: 'リアルタイムハブが再起動しました。全クライアントが同じ秒に再接続しました。',
      prevention: '再接続ジッターが波を散らし、クラスタリングが箱を1つ以上にしてくれます。',
    },
    'runaway-bill': {
      name: '請求の暴走',
      cause:
        'オートスケーラーが、さばくスパイクもないのに上限まで増えました。売上が増えないまま支出が上がりました。',
      prevention: 'オートスケーラーの上限を下げ、クラウドの請求を1行ずつ読みます。',
    },
    mtu: {
      name: 'MTU不一致',
      cause:
        '提携先のネットワークがより小さいパケットサイズを使っています。そのMTUより大きいアップロードは途中でタイムアウトします。',
      prevention:
        'パケットサイズをクランプするか、大きいアップロードを1つのネットワークに留めます。',
    },
    'hot-shard': {
      name: '大口テナントのホットシャード',
      cause:
        '最大のテナントのキーが1つのシャードに落ちました。その読み書きはCPUを3×食い、同じシャードの他のすべてがその後ろで待ちます。',
      prevention:
        'テナントをキーでシャードし、その読み取りをデータベース前段のキャッシュに置きます。',
    },
    'premiere-spike': {
      name: 'プレミア急増',
      cause: 'プレミアが公開されました。動画の需要は通常の4倍で、しかも同じ1分に集中しました。',
      prevention: 'CDNの階層キャッシュ、リザーブドキャパシティ、ロードシェディングです。',
    },
    'launch-day': {
      name: 'ローンチ当日',
      cause:
        'ゲームがローンチしました。リアルタイムメッセージは通常の6倍で、全クライアントが一斉に接続します。',
      prevention: 'ピークに合わせたリアルタイムハブ、再接続ジッター、ロードシェディングです。',
    },
    'flash-sale': {
      name: 'フラッシュセール',
      cause: 'フラッシュセールです。数分間、チェックアウトが通常の20倍になります。',
      prevention: 'チェックアウト処理用のキュー、オートスケーラー、ロードシェディングです。',
    },
    'jvm-warmup': {
      name: '高負荷下のJVMウォームアップ',
      cause:
        'オートスケーラーがスパイク中にJavaのアプリサーバーを足しましたが、新しいコピーは冷えたままで、最初の30秒は30%の速度しか出ませんでした。',
      prevention:
        'ロードバランサーのスロースタート、スケジュールスケーリング、そして温かい状態で起動するGraalVMネイティブイメージです。スロースタートなら新しいコピーは徐々にトラフィックを受けるので、冷えたまま応答することはありません。',
    },
    'migration-lock': {
      name: 'スキーママイグレーションのロック',
      cause:
        'マイグレーションが最大のテーブルにALTER TABLEを走らせました。コピーの間ずっとロックを握り、その間の書き込みはタイムアウトするまで後ろで待ちました。',
      prevention:
        'オンラインスキーママイグレーションなら、ロックを握らずに大きいテーブルを変更できます。',
    },
    'supply-chain': {
      name: 'サプライチェーン侵害',
      cause:
        '依存パッケージが悪意あるバージョンを公開し、デプロイがそれを入れました。パッケージはアプリサーバー内で動き、データを持ち出しました。',
      prevention:
        '依存関係スキャンが、ビルドが入れる前に公開されたバックドアを見つけます。Denoのパーミッションは、要らないものをパッケージに読ませません。',
    },
    'accidental-delete': {
      name: '誤削除',
      cause:
        'オペレーターがデータを消しました。テーブルが1つ消え、それを要るクエリはすべて失敗しました。',
      prevention:
        'ポイントインタイムリカバリで、削除の1分前までテーブルを戻せます。リストア訓練が、バックアップが戻ることを証明します。',
    },
    'operator-typo': {
      name: 'オペレーターの打ち間違い',
      cause:
        'ノードを1つ消すつもりのコマンドがコンポーネント全体に一致し、その大半のノードが巻き添えになりました。',
      prevention:
        '変更を適用する前のplanとレビューが、何が消えるかを見せます。打ち間違いはplanで止まります。',
    },
    'leap-second': {
      name: 'うるう秒と時刻ずれ',
      cause:
        'うるう秒が時計の1秒を繰り返しました。タイマーは二度発火し、リースは早く切れ、1リージョン内のリクエストとロックがタイムアウトしました。',
      prevention: 'リープスミアリングがその1秒を1日かけて配るので、どの時計も跳びません。',
    },
    'table-bloat': {
      name: 'テーブル肥大',
      cause:
        'PostgreSQLは更新された行の旧バージョンを、VACUUMが掃除するまで保持します。更新が掃除を追い越し、テーブルは死んだ行で埋まりました。読み書きのたびにCPUを余計に食います。',
      prevention:
        '保持ポリシーでテーブルを小さく保ちます。MySQLのエンジンには掃除すべき死んだ行がありません。',
    },
    'page-leak': {
      name: 'キャッシュページのリーク',
      cause:
        'CDNがログイン済みページを、Cookieを含めないキーでキャッシュし、あるユーザーのページを別のユーザーに返しました。',
      prevention:
        'Cookieを含むキャッシュキーにすれば、個人向けページが共有されることはありません。',
    },
    'stale-opcache': {
      name: 'OPcacheの陳腐化',
      cause:
        'OPcacheがvalidate_timestampsを切って動いており、デプロイがリセットしませんでした。PHPサーバーは新しいスキーマに対して古いコードを動かし続け、一部のリクエストが失敗しました。',
      prevention:
        'CI/CDパイプラインがデプロイごとにOPcacheをリセットします。手で消したいときは再起動します。',
    },
    'bun-compat': {
      name: 'ランタイム互換性',
      cause:
        'Node.jsで動くパッケージが、成熟度の低いBunでは動きません。それに触れたリクエストの一部が、パッケージを差し替えるまで失敗しました。',
      prevention:
        '自動テストがサービスを出荷先のランタイムで走らせ、デプロイより先にそのパッケージを見つけます。',
    },
    'gevent-compat': {
      name: 'ライブラリ非互換',
      cause:
        'geventが標準ライブラリをモンキーパッチし、1つのライブラリがそれに耐えられませんでした。その呼び出しがハブを塞ぎ、一部のリクエストが失敗しました。',
      prevention:
        '自動テストが出荷前にサービスをgevent上で動かし、どのライブラリが壊れるかを見せます。',
    },
    'split-brain': {
      name: 'スプリットブレイン',
      cause:
        'ネットワーク分断が分散Erlangクラスターを真っ二つにしました。両方の半分が自分のクライアントに応え続け、リアルタイムメッセージの半分はもう片方に届きませんでした。',
      prevention: 'カオス実験が、分断が起きる前に見つけます。再起動でクラスターは再び繋がります。',
    },
  },
  kinds: {
    page: { label: 'ページビュー' },
    read: { label: 'API読み取り' },
    write: { label: 'API書き込み' },
    login: { label: 'ログイン' },
    search: { label: '検索' },
    upload: { label: 'アップロード' },
    bot: { label: 'ボット' },
    media: { label: '動画' },
    rt: { label: 'リアルタイム' },
    buy: { label: 'チェックアウト' },
    job: { label: 'エクスポート' },
    report: { label: 'レポート' },
    ai: { label: 'AIプロンプト' },
    'q-read': { label: '読み取りクエリ' },
    'q-write': { label: '書き込みクエリ' },
    auth: { label: '認証呼び出し' },
    'q-search': { label: '検索クエリ' },
    'q-vector': { label: 'ベクトル検索' },
    'blob-put': { label: 'オブジェクト書き込み' },
    task: { label: 'タスク' },
    'blob-get': { label: 'オブジェクト読み取り' },
    'q-tx': { label: 'トランザクション' },
    charge: { label: '課金' },
    'q-scan': { label: 'スキャン' },
    infer: { label: '推論' },
    feed: { label: 'フィード' },
    hook: { label: 'Webhook' },
    push: { label: '通知送信' },
    bid: { label: '入札リクエスト' },
    notify: { label: 'プッシュ通知' },
    callout: { label: '顧客通話' },
    'k-write': { label: 'タイムライン書き込み' },
    change: { label: '変更' },
  },
  pools: {
    page: { label: 'ページビュー' },
    read: { label: 'API読み取り' },
    write: { label: 'API書き込み' },
    login: { label: 'ログイン' },
    search: { label: '検索' },
    upload: { label: 'アップロード' },
    bot: { label: 'ボット' },
    media: { label: '動画' },
    rt: { label: 'リアルタイム' },
    buy: { label: 'チェックアウト' },
    job: { label: 'エクスポート' },
    report: { label: 'レポート' },
    ai: { label: 'AIプロンプト' },
    feed: { label: 'フィード' },
    hook: { label: 'Webhook' },
    push: { label: '通知送信' },
    bid: { label: '入札リクエスト' },
    failure: { label: '失敗' },
  },
  runtimes: {
    mod_php: {
      name: 'Apache mod_php',
      blurb:
        'Apacheは処理中のリクエストごとにプロセスを立て、最大150まで。各プロセスがPHPを抱えるので、RAMは早く尽きます。',
    },
    php_fpm: {
      name: 'PHP-FPM',
      blurb:
        'NGINXの後ろに固定プールのPHPワーカー。待機中のリクエストはワーカーを1本占有します。シェアードナッシングなのでリークしません。',
    },
    php_worker: {
      name: 'PHPワーカーモード',
      blurb:
        'FrankenPHP、RoadRunner、Octaneなど。アプリは一度だけ起動するので、フレームワークのリクエストごとのオーバーヘッドが消えます。シェアードナッシングを失い、メモリリークと状態の混線が起きる可能性があります。',
    },
    swoole: {
      name: 'Swoole',
      blurb:
        'イベントループ上のコルーチン。Node.jsのような非同期I/Oで、リクエストごとのフレームワーク負荷もありません。ブロッキングする拡張はループを止めます。リアルタイム接続は1本20 KB。',
    },
    puma: {
      name: 'Puma',
      blurb:
        'コアごとに1プロセス、各5スレッド。スレッドは待ち時間を重ねられますが、GVLがCPUを1コアに縛ります。',
    },
    unicorn: {
      name: 'Unicorn',
      blurb:
        'スロットごとにRailsプロセス。単純で堅牢ですがメモリを食います。待機中のリクエストがプロセスを1つ丸ごと占有するので、リアルタイム接続は受け付けません。',
    },
    falcon: {
      name: 'Falcon',
      blurb:
        'ファイバーで、プロセスあたり多数のアイドル接続を保持します。ブロッキングするgemはループを止めます。接続あたり100 KB。',
    },
    node: {
      name: 'Node.js',
      blurb:
        'イベントループは1つ。待つのはタダですが、使うコアも1つで、遅いリクエスト1本が他をすべて止めます。',
    },
    node_cluster: {
      name: 'Node.jsクラスター',
      blurb:
        'コアごとにイベントループを1つ。全コアを使いますが、メモリと接続はコア数に比例して増えます。',
    },
    bun: {
      name: 'Bun',
      blurb:
        'より速いイベントループと即時起動。そのぶんNode.jsよりオートスケールもデプロイも得意です。60 MB、起動時間ゼロ。成熟度は低く、Node.jsで動くパッケージが壊れることもあります。',
    },
    deno: {
      name: 'Deno',
      blurb:
        'パーミッションがサプライチェーン攻撃の大半を止めます。代わりに機能開発は10%遅く、互換のあるパッケージも少なくなります。イベントループはNode.jsと同じです。',
    },
    gunicorn: {
      name: 'Gunicorn',
      blurb:
        '同期ワーカーのプールで、1本1リクエスト。PHP-FPMに似ていますが、ワーカーあたりのメモリが多くかかります。',
    },
    gevent: {
      name: 'Gunicorn + gevent',
      blurb:
        'グリーンスレッドでプロセスあたり多くのI/O待ちを抱えるので、遅いデータベースがワーカーを占有し続けません。モンキーパッチでライブラリが壊れることがあります。接続あたり30 KB。',
    },
    uvicorn: {
      name: 'Uvicorn ASGI',
      blurb:
        'Node.jsのように非同期ですが、CPUは遅いです。ブロッキング呼び出しがループを止めます。リアルタイム接続は設計どおり1本30 KB。',
    },
    python_ft: {
      name: 'フリースレッドCPython',
      blurb:
        '全コアで本当に並列なスレッド。スレッドあたり10%遅く、接続ごとにスレッドを立てるのは安くありません。対応が済んでいないC拡張は開発工数を食います。8スレッド、接続あたり100 KB。',
    },
    pypy: {
      name: 'PyPy',
      blurb:
        'JITウォームアップの後、純PythonのCPU性能はGunicornの3倍です。C拡張の対応が貧弱なのでMLエコシステムの恩恵はありません。ワーカーあたり200 MB。',
    },
    go: {
      name: 'Go net/http',
      blurb:
        '全コアでゴルーチン。待ちのコストはワーカーではなく数KB。ヒープが埋まるとGCがCPUを食います。',
    },
    fasthttp: {
      name: 'fasthttp',
      blurb:
        'net/httpより4分の1速く、機能開発は10%遅い。APIが標準でなく、動かないミドルウェアもあり、HTTP/2もありません。',
    },
    tomcat: {
      name: 'Tomcat',
      blurb:
        'JVM1つ、全コアで200スレッド。起動は30%の速度からで、30秒かけて温まります。待機中のリクエストはスレッドを1本占有します。',
    },
    java_virtual: {
      name: 'Java仮想スレッド',
      blurb:
        '待機がプラットフォームスレッドを占有しなくなったので、遅いデータベースはレイテンシを足すだけです。ネイティブ（JNI）呼び出しは今もキャリアをピン留めし、JVMは30秒かけて温まります。リアルタイム接続は1本10 KB。',
    },
    webflux: {
      name: 'Spring WebFlux',
      blurb:
        'プロセスごとに1つのループで非常に高い並行性です。ただし作るのもデバッグするのも20%遅い。ブロッキング呼び出しはループを止め、JVMはやはり温まる必要があります。400 MB。',
    },
    graal: {
      name: 'GraalVMネイティブイメージ',
      blurb:
        '100 ms未満で起動し、ウォームアップはありません。メモリはJVMの60%、速度は0.80×で、ビルドは3倍長くかかります。接続ごとにスレッドを立てるのはTomcatと同じ。サーバーレス関数に向きます。',
    },
    kestrel: {
      name: 'Kestrel',
      blurb:
        '全コアで.NETの非同期。待機がスレッドを占有しません。JITウォームアップはJVMより短くなります。',
    },
    native_aot: {
      name: 'Native AOT',
      blurb:
        'JITがないので最初から全速で起動し、さらに小さい。100 MB。速度は0.90×で、リフレクションを多用するライブラリには開発工数がかかります。',
    },
    beam: {
      name: 'BEAM',
      blurb:
        '全コアでプリエンプティブなプロセス。あるリクエストが別を止めることはなく、各プロセスが自分のGCをします。CPUは遅いです。',
    },
    tokio: {
      name: 'Tokio',
      blurb:
        '全コアで非同期タスク、GCなし、メモリも少ない。CPUを食うタスクはワーカースレッド1本を塞ぎます。',
    },
    zig: {
      name: 'Zigスレッドサーバー',
      blurb:
        '明示的なアロケーターを使うネイティブコードで、GCなし。64スレッドのサーバーは全コアを使いますが、待機中のリクエストがスレッドを1本占有します。永続状態はリークする可能性があります。',
    },
    warp: {
      name: 'Haskell（GHC + Warp）',
      blurb:
        'Warpが軽量なGHCスレッドをコアにまたがって回します。専門人材は生産的ですが、ビルドと採用は遅い。I/O待ちはOSスレッドを占有せず、共有ヒープのGCがポーズとCPUコストを足します。',
    },
  },

  glossary: {
    annotation: {
      term: 'アノテーション',
      definition:
        '時系列グラフの上で、デプロイ、設定変更、インシデントといったイベントを示す目印です。グラフの変化に目に見える原因を与えます。',
      inGame:
        'ダッシュボードの各時系列は、5 種類のイベントにラベルの付いた縦線を引きます。設計の変更（青、まだ取り消せる変更ごとに 1 本）、デプロイ（紫）、インシデント（赤）、リサーチ（緑）、会社のイベント（ピンク）です。変数バーのグループごとのスイッチで、そのグループの線を隠せます。線を使って、グラフが動いたのが修正の後であり、その前ではないことを確かめます。',
    },
    anycast: {
      term: 'エニーキャスト',
      definition:
        '各地の多くのサーバーが同じ IP アドレスを告知し、インターネットのルーティング（BGP）が各ユーザーを最も近いサーバーへ送るルーティング方式です。ユーザーは近いサーバーに接続し、押し寄せたトラフィックはそれら全体に分散します。',
      inGame:
        'エニーキャストは、どのリージョンでもユーザーまでのホップを 20 ms 短くします。シリーズCのリサーチで、先に GeoDNS が必要です。GeoDNS は各リージョンのユーザーを自分のリージョンへ、それが落ちていれば稼働している最も近いリージョンへ送ります。',
    },
    apdex: {
      term: 'Apdex',
      definition:
        'Application Performance Index：応答時間にユーザーがどれだけ満足しているかを 0 から 1 で表すスコアです。目標値 T より速いリクエストは満足で、丸ごと数えます。4T までのリクエストは許容で半分、それより遅いリクエストと失敗したリクエストは 0 です。',
      inGame:
        'リクエスト種別ごとに T が決まっています。ページビューは 400 ms、API 読み取りは 200 ms、ログインは 800 ms です。リクエストは自分の価値に Apdex を掛けた分を稼ぐので、許容のリクエストは半分だけ稼ぎます。Apdex が時代の目標を上回っている間はユーザーが増え、下回ると離れていきます。目標はガレージの 0.85 から上場の 0.94 まで上がります。',
    },
    'async-io': {
      term: '非同期I/O',
      definition:
        'ネットワークやディスクの操作を開始し、終わるまで別の作業を進める方式です。待っている間スレッドを塞ぎません。1 つのスレッドが多数のリクエストを同時に処理できます。Node.js、.NET の async、Rust の Tokio はこれで動いています。',
      inGame:
        'Node.js、Kestrel（C#）、Tokio（Rust）は、リクエストがデータベースを待つ間もワーカーの枠を占有しないので、遅いクエリで容量を使い切ることがありません。PHP-FPM や Gunicorn のワーカーは待ち時間の間ずっと拘束されます。非同期ランタイムはリアルタイム接続も 1 本あたり数 KB で保持します（Tokio 5 KB、Node.js 20 KB）が、PHP と Gunicorn はそれを受け付けません。',
    },
    'at-least-once-delivery': {
      term: '少なくとも1回の配信',
      definition:
        'システムが確認応答を得るまで、メッセージや呼び出しを再送する配信保証です。何も失われませんが、一部のメッセージは 2 回以上届くので、コンシューマーは冪等でなければなりません。',
      inGame:
        'リトライした呼び出しは 2 回届くことがあります。二重課金のインシデントでは、課金がタイムアウトしてリトライされるため、冪等キーを研究するか課金のリンクでリトライを止めるまで、一部の顧客が 2 回支払います。ポイズンメッセージのインシデントでは、必ず失敗するタスクが戻り続け、ワーカーは時間の 90% をそのタスクに費やします。キューのデッドレターキューを有効にすれば防げます。メッセージを削除すれば終わります。',
    },
    autoscaling: {
      term: 'オートスケーリング',
      definition:
        '機械を自動で増減し、容量を需要に追従させる仕組みです。コントローラーが CPU 使用率などの信号を見て目標と比べ、コピー数を変えます。新しい容量は起動に時間がかかるので、オートスケーリングは緩やかな負荷の変化には対応できますが、突然のスパイクには対応できません。',
      inGame:
        'オートスケーラー（オートスケーリングのリサーチで解放）は、リンクでつないだアプリサーバーとワーカーのコピーを増減します。目標（CPU または負荷全体の 40%、60%、80%）を超えて動くノードにはコピーが増え、上限は 4、8、16、または無制限です。新しいコピーはコールドスタートで、VM では 180 秒後、Kubernetesクラスターでは 30 秒後に応答を始めます。負荷が目標の 60% を下回るとコピーを 1 つ減らし、動作は最大でも 30 秒に 1 回なので、突然のトラフィックスパイクに備えて余力を残します。スケジュールスケーリングのリサーチを使うと、既知のピークに備えられます。事業のピーク時刻の 2 時間前からピークの負荷に合わせて規模を決めるので、ピークが来たときにはコピーが温まっています。',
    },
    'availability-zone': {
      term: 'アベイラビリティゾーン',
      definition:
        'クラウドのリージョンの中にある、独立したデータセンター、またはデータセンターの集まりです。独自の電力、冷却、ネットワークを持ちます。同じリージョンのゾーンは速いリンクを引けるほど近く、1 つの障害で 2 つが落ちることはまれなほど離れています。',
      inGame:
        'ゲームではゾーンと呼びます。マルチゾーンのリサーチの後、ゾーンを持つ各ノードをゾーン a、b、c のいずれかに置けます。データベース、コネクションプーラー、キャッシュ、検索エンジン、キューには、支出 2 倍で別ゾーンにスタンバイを置けます。ゾーンをまたぐ呼び出しは 1 ms を加え、エグレスが 1 GB あたり片道 $0.01 かかります。ゾーン障害はそのゾーンのすべてのノードを落としますが、スタンバイが約 20 秒で引き継ぎ、別ゾーンのコピーは応答を続けます。',
    },
    backpressure: {
      term: 'バックプレッシャー',
      definition:
        '遅いコンシューマーが生産側に速度を落とすか止めるよう伝える信号です。バッファやキューが無制限に育たないようにします。これがないと、バックログはメモリかレイテンシが尽きるまで増え続けます。',
      inGame:
        'キューの最大長がバックプレッシャーに最も近い仕組みです。超えるとキューは新しいタスクを断り、それを送ったアップロードやエクスポートは失敗します。上限がないと、ワーカーがタスクを到着より遅く処理するたびにキューの深さが増えます。新しいタスクはバックログの後ろで待ち、ユーザーはアップロードやエクスポートを結果が出るまでの時間で判断するので、アップロードで 40 秒、エクスポートで 4 分を超えると不満を持ちます。ワーカーを増やすか大きくして、深さを下げます。',
    },
    bcrypt: {
      term: 'Bcrypt',
      definition:
        '1999 年のパスワードハッシュ関数で、Blowfish 暗号を基にし、ソルトを内蔵し、コストを調整できます。コストを 1 段上げるたびに計算量が 2 倍になるので、ハードウェアが速くなっても保存したハッシュは解析に時間がかかり続けます。その遅さはログインのたびにサーバーの CPU を食います。',
      inGame:
        'ログイン 1 回でハッシュに 80 ms の CPU がかかり、ランタイムを速くしても短くなりません。イベントループのブロックのインシデントではコストが 10 から 12 ラウンドになり、ログイン 1 回あたりの CPU が 4 倍になります。クレデンシャルスタッフィングでは、ボットがログインを 20 倍送ります。認証プロバイダ（マネージドID）は、ユーザーごとの料金でハッシュをアプリサーバーから外します。',
    },
    'binary-rpc': {
      term: 'バイナリRPC',
      definition:
        'メッセージを JSON のようなテキストではなく、gRPC 上の Protocol Buffers のようなバイナリ形式で符号化するリモートプロシージャコールです。ペイロードは小さく、解析も安く済みますが、両側が同じスキーマに合意している必要があります。',
      inGame:
        'サービス間バイナリRPCのリサーチは、アプリサーバーやワーカーがバックエンド呼び出し 1 回のシリアライズに使う CPU を半分にします。0.02 基準 ms から 0.01 になります。呼び出しを行うノードの CPU ゲージに出るので、CPU が足りなくなっていた設計でも同じ台数で多くさばけます。',
    },
    'bgp-border-gateway-protocol': {
      term: 'BGP（ボーダーゲートウェイプロトコル）',
      definition:
        'インターネット上のネットワークどうしが、どの IP アドレスに到達できるかを伝え合うためのプロトコルです。あるネットワークが誤って経路を撤回すると、サーバーが動いていても、他のインターネットからは見つけられなくなります。',
      inGame:
        'BGP設定ミスのインシデントはシリーズCで始まります。経路の変更で会社がインターネットから消えるので、全リージョンでユーザーからのリクエストがことごとくダウンとして失敗し、それが最大 60 秒続きます。防げるリサーチはなく、ディレクターが選ぶ頻度も低いです。インシデントのロールバックを押せばすぐに終わります。',
    },
    'blast-radius': {
      term: 'ブラストラディウス',
      definition:
        '1 つの障害が影響する、システム、ユーザー、トラフィックの割合です。ゾーン、セル、小さなデプロイといった障害の隔離が、ブラストラディウスを小さく保ちます。',
      inGame:
        'ゾーン障害はそのゾーンのすべてのノードを落とします。マルチゾーンならコピーを 3 つのゾーンに分散し、データ系のノードに数秒で引き継ぐスタンバイを置けます。不正なデプロイは、届けた項目 1 つにつきアプリサーバーのリクエストの 8% を失敗させ、最大 40% に達します。小さくデプロイするほど壊れる範囲が小さくなります。失敗するのはそれを出したサービスのトラフィックだけです。Node.js では 1 つの遅いリクエストがイベントループ上のすべてのリクエストを止めますが、BEAM はリクエスト同士を隔てます。',
    },
    'blue-green-deployment': {
      term: 'ブルーグリーンデプロイ',
      definition:
        '同一の本番環境を 2 つ用意するリリース方法です。新しいバージョンを待機側へデプロイし、トラフィックを一度にすべて切り替え、失敗すれば戻します。ロールバックが速いのが利点です。',
      inGame:
        'CI/CDパイプラインはデプロイ戦略としてブルーグリーンを選べます。新しい群が立ち上がって確認される間も古い群が応答を続けるので、不正なデプロイで失敗するアプリサーバーのリクエストは最大 10% です。デプロイには 7 分かかり、パイプラインの支出の 2 倍を請求します。',
    },
    'bot-management': {
      term: 'ボット管理',
      definition:
        '自動化されたトラフィックと人を見分け、ルールに合致したものを一律に失敗させるのではなく、疑わしいクライアントにチャレンジを出したり、レート制限したり、ブロックしたりと、独自のやり方で扱うことです。',
      inGame:
        'ボット管理のリサーチは WAF の誤検知を半分にし、ブロック率は保ちます。疑わしいクライアントにはチャレンジが出るので、誤って検知された実際のユーザーもページを読み込めます。通り抜けたボットは何も稼がず容量だけ食うので、WAF が依然として最初の阻止点です。',
    },
    'brookss-law': {
      term: 'ブルックスの法則',
      definition:
        '「遅れているソフトウェアプロジェクトに人員を追加すると、さらに遅れる」。Fred Brooks が 1975 年の著書 The Mythical Man-Month で示した法則です。新しい人は慣れるのに時間がかかり、コミュニケーションの経路は人数より速く増えます。',
      inGame:
        'チームは大きくなるほど成果が減ります。実効サイズは n / (1 + 0.08(n − 1) + 0.0004·n(n − 1)) で、8 人は約 5 人分の働きをし、約 48 人を超えると遅くなります。新入社員は最初の 1 週間は 30% で働きます。ペナルティはチームごとに数えるので、最大 4 つのチームに分けると効果があり、Symfony はそれを 30% 下げます。',
    },
    bulkhead: {
      term: 'バルクヘッド',
      definition:
        'ある依存先が使える呼び出し元の容量（スレッド、接続、スロットなど）の上限です。その依存先が遅くなっても、使うのは自分の取り分だけなので、他の依存先への呼び出しは動き続けます。名前は、船の船体を区画に分ける隔壁に由来します。',
      inGame:
        'バルクヘッドのリサーチは各リンクにスイッチを追加します。バルクヘッドを有効にしたリンクでは呼び出しを 1,000 ms まで実行し、それを超えると呼び出し元は諦めてスロットを解放し、リクエストは `timeout` として失敗します。遅い依存先がすべてのスロットを埋めることはありません。制限するのは同時呼び出し数ではなく時間ですが、負荷が一定なら同じことになります（リトルの法則）。ない場合、呼び出しは応答するかリンクのタイムアウト（既定で 30 秒）まで呼び出し元のスロットを占有します。',
    },
    'burn-rate': {
      term: 'バーンレート',
      definition:
        'サービスがエラーバジェットを SLO に対してどれだけ速く使うかです。バーンレート 1 は SLO の期間でバジェットをちょうど使い切り、10 はその 10 分の 1 の期間で使い切ります。チームは個々のエラーではなく高いバーンレートでページを鳴らします。',
      inGame:
        'SLOダッシュボードを研究すると、ダッシュボード（D）がエラーバジェットのバーンレートを時系列で描きます。失敗率を SLO が許す失敗の割合で割った値です。1 倍と 10 倍の線が引かれます。10 倍を超えると週の終わりを待たずにバジェットが尽きるので、原因を直すか、線が 1 倍を下回るまでデプロイを遅くします。',
    },
    'bytecode-cache': {
      term: 'バイトコードキャッシュ',
      definition:
        'スクリプトのコンパイル済みの形を保つキャッシュです。実行のたびにインタプリタがソースを解析してコンパイルするのを避けます。PHP の OPcache はプリコンパイル済みのバイトコードを共有メモリに保ち、Python も同じ理由で .pyc ファイルを書きます。',
      inGame:
        'OPcache（PHP-FPM の後）を研究するまで、PHP はリクエストのたびにすべてのスクリプトをコンパイルします。研究すると PHP のアプリサーバーの CPU 速度が 2.5 倍になります。PHP のマシンは再起動すると最初は OPcache なしで動き、ウォームアップしながら 2.5 倍に達します。',
    },
    'cache-hit-rate': {
      term: 'キャッシュヒット率',
      definition:
        'キャッシュが、後ろの遅いシステムに問い合わせずに自分のコピーで答える検索の割合です。ミスはオリジンかデータベースへ行きます。ヒット率が少し変わるとオリジンの負荷は大きく変わり、90% から 80% に下がるとミスは 2 倍になります。',
      inGame:
        'キャッシュや CDN のノードはカードにヒット率を表示します。キャッシュのヒット率は、メモリをホットデータ（ユーザー 1 人あたり約 200 KB）で割った値の平方根です。それに TTL 係数（10 秒で 60%、60 秒で 85%、1 時間で 97%）、最大 50% の書き込みペナルティ、キャッシュの温まり具合を掛けます。CDN は 300 秒の TTL でページの 70%、メディアの 75% に答え、60 秒で 0.8 倍、1 時間で 1.2 倍、最大 95% です。キャッシュのメモリを増やすか TTL を長くすると率は上がりますが、TTL を長くするほど古い読み取りが増えます。',
    },
    'cache-stampede': {
      term: 'キャッシュスタンピード',
      definition:
        'キャッシュの再起動や期限切れの後など、多くのリクエストが同じ瞬間に同じキャッシュデータを外し、そろってデータベースへ行くことです。余分な負荷でデータベースが非常に遅くなり、キャッシュが二度と埋まらないことがあります。',
      inGame:
        'スタンピードのインシデントでは、キャッシュが空で再起動し、すべてのミスが一度にデータベースへ行きます。データベースの使用率が 90% 以上だと再充填がタイムアウトし、キャッシュは冷えたままです。スタンピード対策は冷えたキャッシュの余分なミスのうち 25% だけを通し、キャッシュウォーミングは再起動後に 80% 温まった状態で戻します。',
    },
    'cache-warming': {
      term: 'キャッシュウォーミング',
      definition:
        'トラフィックを受ける前にキャッシュをありそうなデータで満たし、最初のリクエストがそろってミスしないようにします。チームは再起動やデプロイの後、新しいキャッシュノードを足したときに、スナップショットを読み込んだり直近のキーを流したりしてキャッシュを温めます。',
      inGame:
        '再起動したキャッシュは冷えた状態で戻るので、すべてのミスがデータベースへ行きます。Redis はデータの半分を自分で読み直し、Memcached は何も読み直しません。キャッシュウォーミングのリサーチの後は、キャッシュのカードでウォーミングを有効にでき、再起動やスタンピードの後も 80% 温まった状態で戻ります。先に研究するスタンピード対策が、残ったミスを扱います。',
    },
    'cache-aside': {
      term: 'キャッシュアサイド',
      definition:
        'アプリケーションがまずキャッシュを見るキャッシュのパターンです。ミスのときはデータベースを読んで結果をキャッシュに入れ、書き込みのときはデータベースを更新してキャッシュの項目を無効にします。',
      inGame:
        'キャッシュは自分が持つ読み取りクエリに答え、ミスはデータベースへ送ります。ヒット率は √(メモリ / ホットデータ) × TTL 係数 × 温まり具合で、ユーザー 1 人あたり約 200 KB のホットデータがあります。書き込みは通過して無効化するので、書き込みの多い構成ではヒット率が下がります。TTL を長くする（10 秒、60 秒、1 時間）ほどヒットは増えますが、古い読み取りも増えます。',
    },
    'canary-deployment': {
      term: 'カナリアデプロイ',
      definition:
        '最初に少数のトラフィックを新しいバージョンへ送り、そのエラーとレイテンシを旧バージョンと比べるリリース方法です。カナリアが健全ならロールアウトを続け、そうでなければほとんどのユーザーが触れる前にロールバックします。',
      inGame:
        'CI/CDパイプラインはデプロイ戦略としてカナリアを選べます。デプロイはまずトラフィックの 5% を新しいバージョンへ送るので、ロールバックするまで不正なデプロイでアプリサーバーのリクエストの最大 5% が失敗します。最も遅い戦略で、デプロイに 10 分かかり、パイプラインの支出の 1.5 倍を請求します。',
    },
    'cascading-failure': {
      term: 'カスケード障害',
      definition:
        'システムのある部分から別の部分へ飛び移る障害です。遅くなったか壊れたコンポーネントが呼び出し元を過負荷にし、そのリトライとキューが今度は呼び出し元の呼び出し元を過負荷にします。最初の障害が引き金で、後の障害が小さなインシデントを長いインシデントに変えます。',
      inGame:
        'シリーズAから、誰も対応しないインシデントは終わるときに別のインシデントを始めることがあり、2 つ目は 1 つ目を原因として記録します。放置したスロークエリはリトライストームを始め、リトライストームは接続枯渇を始め、メモリリークは GC ポーズ連発を始めます。2 つ目のインシデントは、設計がそれに弱い場合にだけ始まります。ページャーは連鎖を名指しし、ポストモーテムのカードは何に続いたかを書きます。確認するだけでも、どんな応答でも連鎖は止まり、連鎖は 1 ホップで終わります。',
    },
    'cdc-change-data-capture': {
      term: 'CDC（変更データキャプチャ）',
      definition:
        'PostgreSQL の書き込み前ログのようなデータベースの変更ログを読み、各 insert、update、delete をイベントとして発行することです。データウェアハウスや検索インデックスなどの他のシステムは、ソースに問い合わせずに同期を保てます。',
      inGame:
        'CDCコネクターは、シリーズBの Change data capture のリサーチで解放され、データベースの変更をイベントストリームへ写します。データベースをこれに、これをストリームにリンクします。書き込みログからすべての書き込みを読み、各変更を毎秒 20,000 件のイベントとして発行するので、検索エンジンやデータウェアハウスはアプリが 2 回書かなくてもデータベースに追従します。書き込みはコピーを待たないので、レイテンシではなくラグが増えます。',
    },
    'cdn-content-delivery-network': {
      term: 'CDN（コンテンツ配信ネットワーク）',
      definition:
        '多くの地点にあるキャッシュサーバーの網で、コンテンツのコピーをユーザーの近くに保ちます。最寄りのエッジが答えられるリクエストはオリジンに届かないので、速く、オリジンのコストもかかりません。',
      inGame:
        'CDNコンポーネントは、Content delivery のリサーチで解放され、リクエストがアプリサーバーに届く前にエッジで答えます。既定の 300 秒の TTL ではページの 70%、メディアの 75% に答えます。TTL を 60 秒にすると 20% 下がり、3,600 秒にすると 20% 上がって最大 95% です。エッジのエグレスは 1 GB あたり $0.02 で、アプリサーバーからの 1 GB あたり $0.09 より安く、階層キャッシュはメディアのヒット率を 92% に上げます。',
    },
    'chaos-engineering': {
      term: 'カオスエンジニアリング',
      definition:
        '制御された方法で意図的に障害を注入し、システムが実際にどう振る舞うかを見つけることです。ノードを落とす、レイテンシを足す、依存先を落とす、などです。弱点についての推測が、測定済みの事実になります。',
      inGame:
        'カオスエンジニアリングのリサーチはチームパネルにカオスのスイッチを追加します。オンの間、設計の最も弱いノードが 120 秒ごとに 10 秒間、呼び出しの 20% を失敗させ、会社は実験から毎秒 1 つの失敗インサイトを得ます。スイッチには次の実験が当たるノードの名前が出ます。注入された `refused` エラーは、本物の失敗と並んでダッシュボードのエラー行に表示されます。',
    },
    'circuit-breaker': {
      term: 'サーキットブレーカー',
      definition:
        '呼び出しの経路で失敗を見張るスイッチです。失敗する呼び出しが多すぎると開き、しばらく新しい呼び出しを即座に失敗させるので、呼び出し元は待つのをやめ、苦しんでいるサービスは回復できます。その後、少数の呼び出しを通してサービスが戻ったか試します。',
      inGame:
        'サーキットブレーカーのリサーチの後は、リンクごとにブレーカーを有効にできます。リンクの呼び出しの半分以上が失敗すると、5 秒間開いて何も送らないので、その呼び出しは refused として即座に失敗します。その後閉じて再び試します。ブレーカーはリトライストームに対する 3 つの予防の 1 つです。',
    },
    'code-review': {
      term: 'コードレビュー',
      definition:
        'マージの前に別のエンジニアが変更を読み、欠陥を見つけ、コードの一貫性を保ち、知識を共有する習慣です。現代のコードレビューはふつう軽量で、小さな変更に対してツール上で行います。',
      inGame:
        'コードレビューのリサーチは、デプロイがバグを出す確率を 20% 下げ、自動テスト（30%）と重なります。また、各機能が出荷前にそのタイルに隠れたコストを表示します。たとえば「書き込みクエリごとにコストが 20% 増える」などです。技術的負債は不正なデプロイの確率を上げるので、負債が増えるほどレビューが重要になります。',
    },
    'cold-start': {
      term: 'コールドスタート',
      definition:
        '新しいプロセス、コンテナ、関数インスタンスが起動するときの遅れと遅い最初のリクエストです。全速になる前に、起動し、コードとデータを読み込み、キャッシュを満たすかホットなコードを JIT コンパイルする必要があります。',
      inGame:
        '新しい、または再起動したアプリサーバーは起動してからウォームアップします。Java（Tomcat）のコピーは 30% の速度で始まり全速まで 30 秒かかりますが、Go は全速で始まります。オートスケーラーが作る新しいコピーは、VM では 180 秒後、Kubernetesクラスターでは 30 秒後に応答します。再起動したキャッシュは Memcached なら空で、Redis なら半分温まって戻り、冷えたデータベースはクエリを最大 2 倍の CPU で実行します。サーバーレス関数は待機中は環境を保たないので、間が空いた後のリクエストはコールドスタートになり、Rust や Go で 50 ms、JVM では最大 2,000 ms かかります。',
    },
    compression: {
      term: '圧縮',
      definition:
        '応答をネットワークに出る前に少ないバイト数へ符号化することです。gzip や Brotli などを使い、クライアントが復号します。帯域と転送時間を節約し、両端で CPU を食います。',
      inGame:
        '圧縮のリサーチでは、アプリサーバーごとに gzip を有効にできます。ページ、読み取り、検索、レポート、フィード、ボットの応答はサイズが 30% になりますが、それらのリクエストは CPU を 10% 多く食います。応答が小さくなるとユーザーに早く届き、マシンのネットワークカードをあまり使わず、オリジンのエグレスも減ります。アップロードやメディアなど他の種別はサイズが変わりません。',
    },
    'connection-pooling': {
      term: 'コネクションプーリング',
      definition:
        '開いたデータベース接続の組を保ち、クライアントやリクエストごとに 1 本開くのではなく、多数のクライアントで共有することです。接続の確立時間を省き、データベースを接続数の上限内に保ちます。',
      inGame:
        'データベースは 100 本の接続を受け付け、残りは断ります。アプリサーバーのプロセスはそれぞれ自分のプールを持ち、PHP や Gunicorn のワーカーは 1 本、Puma のプロセスは 5 本、Node.js や Go は 10 本です。トランザクションモードのコネクションプーラーは 20 本のサーバー接続をそれらで共有しますが、コードのセッション状態を直すまでプールしたクエリの 5% を失敗させます。接続枯渇のインシデントはすべてのプールを 2 倍にします。',
    },
    'consistent-hashing': {
      term: 'コンシステントハッシュ',
      definition:
        'キーをハッシュリングの上でサーバーに対応づける方法で、サーバーを 1 台足すか外すとキーの約 1/n だけが移動します。Karger らが 1997 年にウェブキャッシュ向けに述べ、Amazon の Dynamo と Apache Cassandra がデータの配置に使っています。',
      inGame:
        'ロードバランシングアルゴリズムを研究すると、ロードバランサーはコンシステントハッシュで振り分けられます。各ターゲットは負荷にかかわらずキーを等分に受け持ち、抜けたターゲットは自分のキーだけを移します。ワイドカラムストアは各キーを N 個のレプリカに置き、ホットキーのインシデントでは 1 つのキーのシャードが飽和します。',
    },
    'container-orchestration': {
      term: 'コンテナオーケストレーション',
      definition:
        'コンテナを共有のマシン群に配置し、失敗したら再起動し、増減させるソフトウェアです。Kubernetes が代表例です。多くのワークロードを共有ノードに詰めるとマシンを有効に使えますが、隣り合うワークロードが互いを遅くすることがあります。',
      inGame:
        'コンテナオーケストレーションのリサーチは Kubernetesクラスターを解放します。リンクでつないだアプリサーバーとワーカーはポッドとして動きます。支出が 15% 減り、オートスケーラーはコピーを 180 秒ではなく 30 秒で足し、不正なデプロイは最初の 4 分の 1 のポッドで止まり、ホストが落ちたポッドは 30 秒で戻ります。プラットフォームチームが運用しない限り、各クラスターは開発時間をエンジニア半分分使います。サポート外になって四半期が過ぎたバージョンは、ポッドのリクエストの 30% を落とす強制更新の危険があります。ポッドが混むにつれて、ノイジーネイバーがリクエストの 0.5% から 2% に 10 ms を加えます。',
    },
    'continuous-batching': {
      term: 'continuous batching',
      definition:
        '言語モデルのサービング手法で、バッチ全体が終わるのを待たず、空きが出た瞬間に新しいリクエストを実行中のバッチへ加えます。スループットが上がり、最初のトークンまでの待ちは短いままです。',
      inGame:
        'continuous batching のリサーチは GPUノードにバッチ 8 とバッチ 32 を追加します。毎秒のプロンプト数が 1.6 倍と 2.2 倍になり、最初のトークンまでの時間は変わりません。これがないと、大きいバッチでもスループットは上がりますが、その待ち時間に 150 ms または 500 ms が加わります。',
    },
    'continuous-delivery': {
      term: '継続的デリバリー',
      definition:
        'ビルドし、テストし、デプロイする自動パイプラインを通じて、いつでもどの変更も安全にリリースできる状態を保つ習慣です。リリースが小さく、頻繁で、ロールバックしやすくなります。',
      inGame:
        'CI/CDパイプラインのリサーチの前は、デプロイに手作業で 30 分かかります。後はパイプラインが 5 分でデプロイするので、ビルドと 15 分の確認を含む 8 時間の勤務日に多くのデプロイが収まります。不正なデプロイをロールバックしてインシデントを終わらせ、その機能を次のデプロイの順番に戻すこともでき、CI/CDパイプラインのコンポーネントを解放します。1 つ置くと、そのデプロイ戦略がデプロイ時間と、不正なデプロイが壊す量の上限を決めます。',
    },
    'conways-law': {
      term: 'コンウェイの法則',
      definition:
        '「システムを設計する組織は、その組織のコミュニケーション構造の写しである設計しか生み出せない」。Melvin Conway が 1968 年の論文で述べた法則です。ほとんど話さないチームは、間に狭いインターフェースを持つ部品を作りがちです。',
      inGame:
        'プレシードから最大 4 つのチームを作れ、それぞれに独自のポリシーと調整コストがあるので、大きな集団を分けるほど開発時間の合計が増えます。チーム数より多くのサービスを作るのが、Conway の法則の実績が示す不一致です。各サービスに自分のチームを持たせます。サービスの持ち主がバックログを組み、壊れたときにページを受けます。',
    },
    'credential-stuffing': {
      term: 'クレデンシャルスタッフィング',
      definition:
        'ボットが他のサイトから漏れたユーザー名とパスワードの組をログインフォームに試す攻撃です。多くの人がパスワードを使い回すので効きます。試行のたびにサイトは遅いパスワードハッシュのコストも払います。',
      inGame:
        'クレデンシャルスタッフィングのインシデントは、会社がログインを提供するとシードから始まります。ボットは通常の 19 倍のログインを送り、1 回ごとにアプリサーバーが bcrypt のハッシュを丸ごと計算するので CPU が飽和します。WAF がほとんどをブロックし、既定のパラノイアレベル 2 で 80% です。認証プロバイダは通ったログインをハッシュするので、ログイン 1 回のアプリサーバーの CPU は約 2 ms になります。',
    },
    'data-residency': {
      term: 'データレジデンシー',
      definition:
        '法律や契約による規則で、一部のデータは特定の国やリージョンの中で保存し処理しなければなりません。たとえば EU の GDPR は、個人データを EU の外へ移すことを制限します。',
      inGame:
        'データレジデンシーはプレIPOの IPO チェックリストの項目です。データレジデンシー管理と GeoDNS を持ち、稼働中の EU ユーザーノードがあると、チェックが付きます。そのノードが届くすべてのデータ系ノードは、EU リージョンに置くか、分散のワイドカラムストアか分散SQLのノードでなければなりません。EU の経路を丸ごと作り、そのデータを域内に保ちます。',
    },
    'ddos-distributed-denial-of-service': {
      term: 'DDoS（分散型サービス拒否攻撃）',
      definition:
        '多くのマシンから一度にサービスへトラフィックを流し、実際のユーザーを通れなくする攻撃です。多くの場合ボットネットを使います。防御はエッジで不要なものをふるい落とし、負荷を多くの地点に分散します。',
      inGame:
        'DDoS のインシデントはシードから始まります。通常の需要の 50 倍をボットのトラフィックとして最大 60 秒加えます。WAF はパラノイアレベルに応じてボットをふるい落とします。攻撃下モードを有効にすると 99% をブロックできますが、実際のユーザーの 1% と 40 ms のレイテンシを犠牲にします。WAF を動かしていると、ディレクターが DDoS を選ぶ頻度は下がります。',
    },
    'dead-letter-queue': {
      term: 'デッドレターキュー',
      definition:
        '決まった回数失敗した後、コンシューマーが処理できないメッセージを置く別のキューです。1 つの悪いメッセージがキューを詰まらせないようにし、人が調べたり再実行したりできるようメッセージを保ちます。',
      inGame:
        'キューのカードには失敗タスクの設定があり、永久にリトライするか、1、3、10、25 回試してデッドレターキューへ送るかを選べます。失敗した試行は 30 秒後に戻ってワーカーで再び実行され、すべての試行に失敗したタスクは失われます。ポイズンメッセージのインシデントは永久にリトライするキューにだけ起きるので、必ず失敗するタスクが戻り続け、ワーカーは時間の 90% をそれに費やします。デッドレターキューを有効にすればキューは免疫になり、メッセージを削除すればインシデントは終わります。',
    },
    denormalization: {
      term: '非正規化',
      definition:
        '同じ事実を複数の場所に持つか、結合済みのコピーを保ち、読み取りで結合や計算をしなくて済むようにすることです。読み取りは安くなり、書き込みはすべてのコピーを更新しなければなりません。',
      inGame:
        '非正規化のリサーチは、データベースの読み取り 1 回の CPU を 30% 下げ、書き込み 1 回を 20% 増やします（10）。読み取りの多い設計では得で、書き込みの多い設計では損になります。これはトレードオフのカードのプレビューが、プレイヤーが取る前に示す取引です。',
    },
    'dependency-scanning': {
      term: '依存関係スキャン',
      definition:
        'プロジェクトが使うサードパーティライブラリを、既知の脆弱性のデータベースと突き合わせる自動チェックです。ふつうビルドパイプラインで走り、更新が必要なバージョンを示します。',
      inGame:
        '依存関係スキャンはシリーズAのセキュリティのリサーチで、CI/CDパイプラインのリサーチが必要です。公開されたバックドアをビルドが取り込む前に捕まえ、サプライチェーン侵害のインシデントが見つける弱点を減らします。また SOC 2プログラムの 3 つの前提条件の 1 つで、全通信のTLS化と保存データの暗号化が並び、IPO チェックリストは SOC 2 を必要とします。',
    },
    'distributed-tracing': {
      term: '分散トレーシング',
      definition:
        '1 つのリクエストが触れるすべてのサービスを通して追いかけることです。各ホップが開始と終了の時刻を持つスパンを記録し、同じトレース ID を共有するスパンが 1 つのトレースにまとまります。トレースは時間がどこへ行くか、どの依存先が遅いかを示します。',
      inGame:
        '分散トレーシングのリサーチ（パーセンタイルの後）は、各リクエスト種別の時間をノードごとに、ダッシュボードのサービス表とそのウォーターフォールとして示します。アナリティクスのノードは、リンクでつないだノードのトラフィックを標本化し、インサイトに変えます。パーセンタイルは p50、p95、p99 を示し、ボードが制限を印します。',
    },
    'diurnal-traffic': {
      term: '日周トラフィック',
      definition:
        '人が起きて活動しているかに従う、需要の 1 日の上下です。消費者向けサービスは夕方にピークになり、早朝に最も静かなことが多いです。容量計画は 1 日のピークを賄う必要があり、谷は保守の安全な時間です。',
      inGame:
        '需要はカレンダーの上で 1 日の周期に従います。既定では 20:00 に平均の 1.45 倍でピークになり、08:00 に 0.55 倍まで下がります。事業ごとに独自の曲線があり、フィンテックは 14:00 にピークになり ±60% で振れます。リージョンを増やすと、各リージョンは現地の 20:00 にピークになります。シミュレーションの 1 秒はカレンダーの 1 分なので、1 日は 1 倍速で 24 分かかります。夕方のピークに合わせて大きさを決めるか、オートスケーラーに曲線を追わせます。',
    },
    'dns-round-robin': {
      term: 'DNSラウンドロビン',
      definition:
        'DNS による負荷分散です。名前が複数の IP アドレスを返し、サーバーがその順番を回すので、クライアントがホストに分散します。DNS はホストが生きているかを知らず、クライアントはレコードの TTL の間だけ応答をキャッシュします。',
      inGame:
        'DNSラウンドロビンのリサーチは DNS コンポーネントを解放し、ユーザーを最大 8 台のホストへ均等に振り分けます。ヘルスチェックがないと、死んだホストも取り分を保ち、そのリクエストは失敗します。ヘルスチェックのリサーチの後は、TTL（30、300、3,600 秒）が切れた時点で DNS が死んだホストを外します。ロードバランサーは次のヘルスチェックでより早く気づきます。',
    },
    'dora-metrics': {
      term: 'DORAメトリクス',
      definition:
        'DORA の調査プログラムによるソフトウェアデリバリーの 5 つの指標です。変更のリードタイム、デプロイ頻度、失敗したデプロイの復旧時間、変更の失敗率、手戻り率です。最初の 3 つがスループットを、後の 2 つが不安定さを示します。',
      inGame:
        'そのうち 2 つがプレイを左右します。デプロイ頻度は 1 日あたり最大 480 勤務分 / (ビルド + デプロイ + 15 分の確認) で、チームのポリシーにより 16、8、4 が上限です。CI/CDパイプラインのリサーチはデプロイを 30 分から 5 分に短縮します。各デプロイは 10% の基礎確率でバグを出します。速く動くことと技術的負債がそれを上げ、自動テスト（−30%）とコードレビュー（−20%）が下げます。デプロイのカードが結果を示します。',
    },
    downsampling: {
      term: 'ダウンサンプリング',
      definition:
        '古いメトリクスを粗い解像度で保存することです。1 秒ごとではなく 5 分ごとや 1 時間ごとに 1 点、などです。長い範囲を安く保て、速く描けます。粗い各点は、置き換える点の最小、最大、合計、件数を保ちます。',
      inGame:
        'ダッシュボードは 1 時間と 6 時間の範囲では 1 分の標本を、1 日と 7 日では 15 分のブロック（7 日間保持）を、30 日では 1 時間のブロック（30 日間保持）を読みます。各グラフはブロックをその平均として描きます。p99 の線だけはブロック内で最悪の分を描きます。平均ではスパイクが隠れるからです。',
    },
    drift: {
      term: '構成ドリフト',
      definition:
        'Terraform や Pulumi のようなツールが最後にデプロイしたインフラと、いま動いているものとの差です。ドリフトは、クラウドのコンソールでのサイズ変更などツールの外で加えた変更と、まだ適用していないコードの変更から生まれます。',
      inGame:
        'ミラーは 2 通りのドリフトを起こします。ミラー元のリージョンが変わったときの遅れと、ミラーを直接変えたときの手動変更です。適用はミラーをミラー元に戻し、計画が見ている手動変更を取り消します。Terraform の計画はすべての手動変更を一度に見ます。Pulumi と Alchemy は記録した状態に対して計画するので、手動変更は更新かドリフトを確認の後にだけ現れます。正しいリージョン間の差は例外として保持します。',
    },
    egress: {
      term: 'エグレス',
      definition:
        'クラウドプロバイダのネットワークから外へ出るデータです。インターネットへ、または別のゾーンやリージョンへ出るものを指します。プロバイダは GB 単位で課金し、入ってくるデータはふつう無料です。',
      inGame:
        'シードから、支出にはエグレスが含まれます。アプリサーバーがユーザーへ送る分が 1 GB あたり $0.09、CDN がエッジで答えるページが 1 GB あたり $0.02 です。ゾーン間の呼び出しは片道 1 GB あたり $0.01、リージョン間の呼び出しは 1 GB あたり $0.02 です。時代のコスト指数がこれらすべてを倍率で変えます。圧縮はページと読み取りの応答を 70% 小さくし、CPU が 10% 増えます。',
    },
    'edge-side-includes': {
      term: 'Edge Side Includes（ESI）',
      definition:
        'エッジがページの共通部分を保存し、各ユーザー向けの個人的な断片だけを組み立てるキャッシュ手法です。ログイン後のページもほとんどキャッシュから返せます。',
      inGame:
        'Edge Side Includes のリサーチは CDN の `page` ヒット率に 20 ポイントを加え、70% から 90% にします（10）。エッジがログイン後ページの外枠をキャッシュするからです。TTL はやはり掛かり、ヒット率は 95% が上限のままです。',
    },
    'encryption-at-rest': {
      term: '保存データの暗号化',
      definition:
        'ディスク、データベースファイル、バックアップなどの保存データを暗号化し、記憶媒体を手に入れた人が鍵なしで読めないようにすることです。盗まれたディスクや漏れたバックアップには効きますが、稼働中のシステムに問い合わせできる攻撃者には効きません。',
      inGame:
        '保存データの暗号化はシリーズBのセキュリティのリサーチです。トラフィック、コスト、インシデントに直接の効果はありません。SOC 2プログラムの 3 つの前提条件の 1 つで、全通信のTLS化と依存関係スキャンが並び、IPO チェックリストが SOC 2 を必要とします。',
    },
    'error-budget': {
      term: 'エラーバジェット',
      definition:
        'SLO が期間内に許す失敗の量です。99.9% の SLO なら、リクエストの 0.1% が失敗してかまいません。チームは速いリリースなどのリスクにそれを使い、尽きたら速度を落として信頼性を直します。',
      inGame:
        'シリーズAから、ゲームは直近のカレンダー週の失敗リクエストを時代の SLO と比べます。シリーズAでは 99.9%、上場では 99.99% までです。ボットと WAF のブロックは数えません。エラーバジェットのリサーチの後は、バジェットが半分より多く残っているとチームの速度が 10% 上がり、使い切ると速度が半分になります。SLOダッシュボードはバジェットを HUD に出し、そのバーンレートをダッシュボードに描きます。',
    },
    'event-loop': {
      term: 'イベントループ',
      definition:
        'I/O イベントを待ち、そのコールバックを 1 つずつ実行する単一のスレッドです。待っている多数の接続を安くさばけますが、長く CPU を使うコールバックはそのループ上のほかのすべてのリクエストを止めます。',
      inGame:
        'Node.js は 1 つのイベントループを動かして 1 コアを使い、Node.jsクラスターモードはコアごとに 1 つのループを動かします。ログイン時の 80 ms のパスワードハッシュなど CPU を重く使うリクエストは、後ろのリクエストを止め、その停止は p99 に出ます。イベントループのブロックのインシデントでは、ログイン 1 回の CPU が 4 倍になります。libuvスレッドプールのリサーチか認証プロバイダがハッシュをループから外します。',
    },
    'eventual-consistency': {
      term: '結果整合性',
      definition:
        '書き込みの後しばらくはレプリカが古いデータを返してよい整合性モデルです。新しい書き込みが来なければ、すべてのレプリカが同じ最新の値に収束します。',
      inGame:
        'リードレプリカは書き込みに遅れるので、読み取りの最大 15% が古い値を返し、レプリケーションラグのインシデントでは最大 50% になります。R + W が N より大きくないワイドカラムストアも古い読み取りを返します。古い読み取りは API 読み取りと、自分の書き込みを読むチェックアウトを失敗させます。read-your-writesルーティングはそれらの読み取りをプライマリへ送ります。',
    },
    'expand-and-contract': {
      term: 'Expand/Contractパターン',
      definition:
        'テーブルをロックせずにスキーマを変える方法です。新しい列やテーブルを足し、両方に書き、埋め戻し、読み取りを切り替えてから古いものを落とします。どの段階も後方互換なので、古いコードと新しいコードが並んで動きます。',
      inGame:
        'Expand/Contract のリサーチはスキーママイグレーションのロックのインシデントを完全になくします。オンラインスキーママイグレーションだけだとそのインシデントは約 8 分の 1 の頻度になり、Expand/Contract なら起こりません。どちらも開発時間を使います。リレーショナルなデータベースでは、クエリ形状を足す機能がオンラインマイグレーションで 10%、Expand/Contract で 25% 多くかかります。',
    },
    'fallacies-of-distributed-computing': {
      term: '分散コンピューティングの誤謬',
      definition:
        '分散システムに慣れていないプログラマがよくする 8 つの誤った前提です。Sun Microsystems の L. Peter Deutsch らがまとめました。ネットワークは信頼できる、レイテンシは 0、帯域は無限、ネットワークは安全、トポロジーは変わらない、管理者は 1 人、転送コストは 0、ネットワークは均質、の 8 つです。',
      inGame:
        'いくつかのインシデントとコストがこれらの前提を崩します。ネットワーク分断のインシデントでは、分断が直るか古いリーダーを隔離するまでリージョン間の呼び出しがタイムアウトします。別ゾーンへの呼び出しは 1 ms を加え、往復でエグレスがかかり、別リージョンへの呼び出しは往復分を払います。タイムアウトとリトライのリサーチまでは、どのリンクも答えを 30 秒待ちます。',
    },
    'fan-out': {
      term: 'ファンアウト',
      definition:
        '1 つのリクエストが、他のサービスやデータストアへの多くの呼び出しになることです。リクエストが待つ呼び出しが多いほど、どれかが遅い確率が上がるので、広いファンアウトはテールレイテンシと負荷を上げます。',
      inGame:
        'ページビューは読み取りクエリを 2 回行い、ORMフレームワーク（Laravel、Rails、Django）は一括読み込みまで 1 回で済むところを 3 回読みます。アクティビティフィードの機能はフィードを足し、プルのフィードは 20 回の読み取りを行います。書き込み時のファンアウトならフィードの読み取りは 1 回ですが、書き込みのたびにフォロワー 20 人のタイムラインを埋めます。ハイブリッドファンアウトはそれを 2 回の読み取りと 10 回のタイムライン書き込みに減らします。',
    },
    'fan-out-on-write': {
      term: '書き込み時のファンアウト',
      definition:
        '投稿が書かれたときに各ユーザーのフィードを組み立てることです。投稿はフォロワー全員のタイムラインにコピーされるので、フィードの読み取りは 1 回の安い検索で済みます。仕事を読み取りから書き込みへ移し、フォロワーの多いアカウントでは高くつきます。多くのシステムはハイブリッドを使い、ふつうのアカウントにはプッシュし、有名人には読み取り時にプルします。',
      inGame:
        'シリーズCから、アクティビティフィードの機能がフィードの種別を足し、各アプリサーバーのカードでフィードをプルかプッシュに選べます。プルでは、フィードは 20 件の投稿を読みます。プッシュでは、フィードはあらかじめ計算したタイムラインを 1 つ読みますが、書き込みのたびに 20 回のタイムライン書き込みが起きます。ハイブリッドファンアウトのリサーチはそれをフィード 1 回あたり 10 回の書き込みと 2 回の読み取りに減らし、キャッシュやワイドカラムストアがホットキーをシャードに分けることを可能にします。',
    },
    'feature-flag': {
      term: 'フィーチャーフラグ',
      definition:
        'コードの中にあり、実行時に制御して新しいデプロイなしに機能をオン・オフできるスイッチです。チームはフラグを使って、機能をユーザーの一部に出したり、試したり、壊れたときにすぐ切ったりします。',
      inGame:
        'フィーチャーフラグのリサーチはフィーチャーフラグのコンポーネントを解放します。デプロイのバッチにある各機能にはロールアウトがあり、オフ、5%、25%、50%、全ユーザーのいずれかです。不正なデプロイはバッチの機能 1 つにつきアプリサーバーのリクエストの 8% を失敗させ、フラグはその機能の割合をロールアウトまで削るので、5% の機能はデプロイ戦略が何であれ本来の最大 5% しか壊しません。オフにすることが、被害を止める 1 クリックです。機能の効果と加える負荷は露出に従い、ロールアウトにそのユーザーのうち採用した割合を掛けたものです。オフの機能は何も稼がず、50% の機能はユーザーが採用すると半分に届きます。A/Bテストはロールアウトが除外したユーザーに対して効果を測ります。',
    },
    'four-golden-signals': {
      term: '4つのゴールデンシグナル',
      definition:
        'レイテンシ、トラフィック、エラー、飽和。Google SRE の本が、ユーザー向けシステムで最初に見るべきとする 4 つの指標です。4 つしか測れないなら、これを測ります。',
      inGame:
        'ダッシュボード（D）はメトリクスのリサーチの後に開きます。そのゴールデンシグナルの行は、トラフィック（需要に対する処理量）、レイテンシ（平均と、パーセンタイルで p99）、エラー（構造化ログとともに）を描きます。下の飽和の行は各ノードがどれだけ埋まっているかを示し、上部の統計が最も熱いノードを名指しします。',
    },
    'gc-pause': {
      term: 'GCポーズ',
      definition:
        'ガベージコレクタが、もう使われていないメモリを見つけて解放するためにアプリケーションを止めるか遅くする時間です。停止はふつう一部のリクエストにしか当たらないので、平均より p99 などのテールレイテンシに出ます。',
      inGame:
        'アプリサーバーのヒープが 70% を超えて埋まると、コレクターは最大 2% のリクエストを止めます。Java は G1 で 30 ms、Parallel で 150 ms、ZGC で 1 ms 止まり、ZGC はスループットを 10%、メモリを 15% 多く使います。Go は 1 ms しか止まりませんが CPU を最大 25% 多く使い、Go GCチューニングがそれをメモリと引き換えにします。GC ポーズ連発のインシデントではヒープがさらに埋まり、5 倍のリクエストが止まります。',
    },
    geodns: {
      term: 'GeoDNS',
      definition:
        'ユーザーがどこにいるかで違う答えを返す DNS で、各ユーザーが近くのデータセンターやリージョンに解決されます。多くのプロバイダは、ヘルスチェックに失敗したリージョンを飛ばすこともできます。',
      inGame:
        'GeoDNS はマルチリージョンが必要なシリーズCのリサーチです。これがないと、どの大陸のユーザーも本拠のリージョンから入り、往復を 2 回払います。たとえばヨーロッパから北アメリカへは 150 ms です。これがあると、各リージョンのユーザーは自分のリージョンのユーザーノードから入り、リージョン障害の間は稼働している最も近いリージョンから入ります。データレジデンシーのチェックリスト項目も GeoDNS を必要とします。',
    },
    'gil-global-interpreter-lock': {
      term: 'GIL（グローバルインタプリタロック）',
      definition:
        'CPython の既定のビルドにあるロックで、CRuby では GVL と呼ばれ、一度に 1 つのスレッドだけがインタプリタのコードを実行できます。I/O 待ちの間はスレッドが重なりますが、1 つのプロセス内の CPU 作業は並列に走りません。CPython 3.13 は GIL のない自由スレッドビルドを任意で追加しました（PEP 703）。',
      inGame:
        'Ruby の Puma はすべてのコアを使うためにコアごとに 1 プロセスを動かす必要があり、各 5 スレッド、プロセスあたり 180 MB です。Python の Gunicorn は同期ワーカーのプールを動かし、ワーカー 1 つにつき 1 リクエスト、120 MB で、プールサイズは自分で決めます。GIL のない Go や Java などのランタイムは、1 つのプロセスをすべてのコアで動かします。',
    },
    gitops: {
      term: 'GitOps',
      definition:
        '望ましい状態を宣言的なコードとして Git に置き、Argo CD や Flux のようなエージェントがそれを取得して、稼働中のシステムを合わせ続けるインフラの動かし方です。OpenGitOps は 4 つの原則を挙げています。宣言的であること、バージョン管理され不変であること、自動で取得されること、継続的に収束することです。',
      inGame:
        'GitOps は Infrastructure as Code の後のシリーズCのリサーチです。ミラーごとにソースの変更を自分で適用するので、ミラーが遅れなくなります。また、どの IaC ツールでも次の同期で手動変更を取り消します。自己修復を有効にした Argo CD と同じです。そのためリージョンを調整するには例外だけが手段になります。一括は Argo CD の既定のポーリングのように 3 カレンダー分以内に同期します。段階的は変更をソースに 60 分留めてから進めます。一括はドリフトと引き換えに被害範囲を広げ、不正な設定投入がすべてのミラーに同時に届きます。',
    },
    'graceful-degradation': {
      term: 'グレースフルデグラデーション',
      definition:
        '容量を超えたときに、すべてを失敗させるのではなく、高くつく任意の部分を切ってサービスの重要な部分を動かし続けることです。ページは読み込まれ、レポートは後回しになります。',
      inGame:
        'グレースフルデグラデーションのリサーチはアプリサーバーにスイッチを追加します。飽和したノードは最も高くつくリクエスト種別から先に落とし、読み取りよりエクスポートとアップロードを先に落とすので、安い種別はレイテンシを保ちます（10）。ロードシェディングは逆の順で、最も価値の低い種別から落とし、ページよりボットと入札を先に落とします。',
    },
    'green-threads': {
      term: 'グリーンスレッド',
      definition:
        '言語のランタイムがオペレーティングシステムの代わりにスケジュールする軽量なスレッドです。Goroutine、Java仮想スレッド、Erlang のプロセスが例です。1 つあたり数 KB なので、1 台のサーバーが何千もの待機を同時に保てます。',
      inGame:
        'Go と Elixir の BEAM はすべてのコアでグリーンスレッドを動かし、待っているリクエストはワーカーの枠を占有しません。開いているリアルタイム接続 1 本は Go で 10 KB、BEAM で 5 KB かかり、Tomcat の Java スレッドは 1 MB です。BEAM はプリエンプティブなので、どのリクエストも他のリクエストを止めませんが、CPU は Go の半分未満の速さです。',
    },
    'health-check': {
      term: 'ヘルスチェック',
      definition:
        'サーバーがトラフィックを受けるべきかを決める定期的な確認です。ステータス用のエンドポイントへの HTTP リクエストなどです。浅いチェックはサーバーだけを試し、深いチェックはデータベースなど依存先も試します。',
      inGame:
        'ロードバランサーはアプリサーバーを 10 秒ごとに試し、死んだサーバーへは次のチェックで送るのをやめます。ヘルスチェックのリサーチは 2 秒と 30 秒の間隔と、データベースが落ちているか過負荷のアプリサーバーも外す深いチェックを追加します。また、TTL が切れた時点で DNS が死んだホストを外せるようになり、これがないと DNS はそのホストへ取り分を送り続けます。チェックはヘルスチェックエンドポイントのタスクが終わってから効きます。',
    },
    'hedged-request': {
      term: 'ヘッジリクエスト',
      definition:
        '最初の呼び出しが期待より遅いとき、たとえば p95 のレイテンシを超えたときに、リクエストの 2 つ目のコピーを別のレプリカへ送り、先に届いた答えを使うことです。わずかな余分な負荷でテールレイテンシを下げます。',
      inGame:
        'ヘッジリクエストのリサーチは各リンクにヘッジのスイッチを追加します。ヘッジを有効にしたリンクはすべての呼び出しのコピーを 2 つ送り、ユーザーは速いほうの答えを待つので、平均が半分になり p99 が下がります。呼ばれる側は 10% 多く呼び出しを受け、それはリンクのレートに出ます。パーセンタイルのリサーチはテールの前後を示します。ワイドカラムストアのクォーラム読み取りも同じで、N 個のレプリカのうち速い R 個だけを待ちます。',
    },
    'hot-key': {
      term: 'ホットキー',
      definition:
        '読み取りや書き込みの非常に大きな割合を 1 つのキーが受けることです。有名人のプロフィールなどです。そのキーを持つ 1 つのシャードやサーバーが飽和し、他は遊ぶので、サーバーを足しても効きません。',
      inGame:
        'ホットキーのインシデント（シリーズC）では、混んでいるキャッシュやワイドカラムストアの読み取りの 30% が 1 つのキーを求めます。そのノードの容量は 0.3 × サイズ段数 + 0.7 で割られるので、サイズ 4 のノードは約半分を保ちます。ハイブリッドファンアウトのリサーチでは、キャッシュやワイドカラムストアでキーの分割を有効にできます。分割はホットキーを散らし、損失を終わらせます。',
    },
    'http-keep-alive': {
      term: 'HTTPキープアライブ',
      definition:
        '1 本の TCP 接続を多くの HTTP リクエストで再利用し、毎回新しい接続を開かないことです。最初のリクエスト以降は、接続のハンドシェイク、HTTPS なら TLS のハンドシェイクも省けます。',
      inGame:
        'ノード間の内部呼び出しはどれも 0.5 ms のホップと 1 ms の TCP ハンドシェイクがかかります。接続の再利用のリサーチはハンドシェイクをなくし、内部呼び出しは 1 回 0.5 ms になります。複数のノードをまたぐリクエストはホップごとに 1 ms を節約します。',
    },
    'http2-and-http3': {
      term: 'HTTP/2とHTTP/3',
      definition:
        'HTTP の新しいバージョンです。HTTP/2 は 1 本の TCP 接続で多くのリクエストを同時に送ります。HTTP/3 は UDP 上の QUIC で動き、トランスポートと TLS のハンドシェイクをまとめ、パケットが 1 つ失われてもすべてのストリームが止まらないようにします。',
      inGame:
        'HTTP/3 のリサーチは、別の大陸のリージョンへ届くまでにユーザーが払う往復を 20% 減らします。北アメリカから配信されるヨーロッパのユーザーは 150 ms ではなく 120 ms 待ちます。先に HTTP/2 のリサーチが必要なシリーズCのリサーチ項目です。HTTP/2 のリサーチはページビューのユーザーホップを 15% 減らします。',
    },
    'iac-tool': {
      term: 'IaCツール',
      definition:
        'インフラをコードとして記述して適用するツールです。コードを記録した状態と比べ、計画を示し、変更を行います。Terraform は HCL を使い、Pulumi と Alchemy は TypeScript などの汎用言語を使います。どれもデプロイした内容の状態ファイルを保ちます。',
      inGame:
        'Infrastructure as Code のリサーチは Terraform、Pulumi、Alchemy のどれかを選ばせます。3 つともすべてのコンポーネントを組み、リージョンごとに任意の値を設定できます。違いは、各ツールの既定の流れに従って計画が手動変更をどう見つけるかです。Terraform は計画のたびに稼働中の状態を読み直すので計画は完全ですが、適用のたびにその読み直しを待ちます。Pulumi は更新するまで記録した状態に対して計画します。Alchemy も記録した状態に対して計画しますが、ドリフトを確認が稼働中の状態を読み、修復がソースの変更を取らずに手動変更を戻します。別のツールへ移すと、1 カレンダー日の間すべての同期が止まります。',
    },
    idempotency: {
      term: '冪等性',
      definition:
        '2 回行っても 1 回行ったのと同じ効果になる操作を冪等といいます。読み取りはもともと冪等ですが、カードの課金や注文はそうではありません。冪等キーはクライアントがリクエストとともに送る一意の ID で、サーバーがリトライを見分け、もう一度実行せずに最初の結果を返せます。',
      inGame:
        'チェックアウトは決済プロバイダへ課金を送ります。二重課金のインシデントではプロバイダが約 1.5 秒遅くなり、課金のリンクがタイムアウトします。そのリトライは最初の試行がすでに課金したカードに課金するので、それらのチェックアウトは重複として失敗します。冪等キーを研究し（チェックアウトが必要です）、冪等キーのタスクを行えば、リトライした課金が 2 回課金されることはありません。それがない場合は、課金のリンクのリトライをなしにしてインシデントを終わらせます。',
    },
    'inverted-index': {
      term: '転置インデックス',
      definition:
        '各単語を、それを含む文書の一覧に対応づける索引です。本の巻末の索引のようなものです。Lucene や Elasticsearch のような全文検索エンジンが使い、PostgreSQL では GIN インデックスとして提供します。検索はすべての行を走査せず、短いいくつかの一覧を読みます。',
      inGame:
        '検索エンジンがないと、データベースが q-search を自分でさばき、検索 1 回に 80 ms の CPU がかかります。通常の読み取りの 10 倍です。全文検索のリサーチは検索エンジンを解放し、サイズ段数 1 つあたり毎秒 400 件の検索を約 15 ms でさばきます。アプリサーバーにリンクすれば、検索がデータベースに負荷をかけなくなります。',
    },
    'jit-warmup': {
      term: 'JITウォームアップ',
      definition:
        'ジャストインタイム（JIT）コンパイラは、プログラムの実行中に頻繁に走るコードを最適化した機械語に変えます。ホットな経路を計測してコンパイルし終えるまで、新しいプロセスは最高速度を下回るので、最初の数秒か数分は遅いです。JVM と .NET はこの方式でウォームアップし、階層コンパイルと事前プロファイルがウォームアップを短くします。',
      inGame:
        'ランタイムごとに開始時の速度とウォームアップ時間があり、冷えたアプリサーバーは最初の数秒間遅く動きます。Tomcat（Java）のアプリサーバーは 30% の CPU 速度で始まり、30 秒後に全速になります。Kestrel（C#）は 60%、Node.js は 80% で始まり 15 秒続き、Go、BEAM、Tokio は全速で始まります。再起動、サイズ変更、スタックの変更、オートスケーラーの新しいコピーはどれも冷えた状態で始まるので、容量はピークの前に足し、ピーク中には足しません。PHP は代わりに OPcache を温め、キャッシュが埋まるにつれて CPU 速度が 1 倍から 2.5 倍になります。',
    },
    'leaderless-replication': {
      term: 'リーダーレスレプリケーション',
      definition:
        '単一のリーダーを持たないレプリケーションです。クライアントは各書き込みを複数のレプリカへ送り、複数から読み、クォーラムが決めます。Amazon の Dynamo がこの設計を広め、Cassandra が使っています。一部のレプリカが落ちても書き込みを続けますが、R + W > N でないと読み取りが古いことがあります。',
      inGame:
        'リーダーレスレプリケーションのリサーチ（シャーディングの後）はワイドカラムストアを解放します。各キーは N 個（1 から 5、既定 3）のレプリカに置かれ、読み取りはそのうち R 個に問い合わせ、書き込みは W 個を待ちます（R と W の既定はどちらも 1）。R + W > N ならすべての読み取りが最新の書き込みを見ますが、それ未満だと古い読み取りが返ることがあります。書き込みは N 回のレプリカ操作、読み取りは R 回を消費し、サイズ段数 1 つあたり毎秒 30,000 回のうちから使います。インスタンス障害で 1 つのレプリカが落ちると、すべてのレプリカを必要とするクォーラムは失敗します。',
    },
    'leap-smearing': {
      term: 'リープスミアリング',
      definition:
        'うるう秒への時刻合わせの修正です。サーバーが余分な 1 秒を長い期間、多くは丸 1 日に散らすので、時計はごくわずかに遅れて進み、決して跳びません。Google と Amazon は自社の時計でこれを行っています。痛いのは跳ぶことで、1 秒が繰り返されるとタイマーが 2 回発火し、リースが早く切れます。',
      inGame:
        'うるう秒のインシデントは、1 つのリージョンのすべてのノードの応答を 1,000 ms 遅らせ、応答の 10% をタイムアウトさせます。ノードを再起動するか、60 秒たって終わるまで続きます。リープスミアリング（シリーズC）は、その跳びを起こさないリサーチです。うるう秒チャレンジは同じ出来事をリージョンのアプリサーバー障害として仕込みます。',
    },
    'littles-law': {
      term: 'リトルの法則',
      definition:
        '安定した系では、中の件数の平均（L）は平均到着率（λ）に各件が中で過ごす平均時間（W）を掛けたものに等しくなります。L = λW です。John Little が 1961 年に証明し、到着の仕方や処理の順番によらず成り立ちます。サーバーでは、処理中のリクエスト数 = 毎秒のリクエスト数 × リクエスト 1 件の所要時間です。',
      inGame:
        'リクエストごとにワーカーかスレッドを保つアプリサーバーは、枠の数が固定です。各リクエストは CPU 時間と、待つデータベース呼び出しすべての間その枠を保ちます。使用中の枠 = 到着率 × その時間なので、各リクエストがデータベースを 10 倍長く待つと、ワーカー 5 つの PHP-FPM プールがさばけるリクエストは最大 10 分の 1 になります。遅い呼び出しを直すか、ワーカーやスレッドを足すか、枠を持たずに待つランタイム（Node.js、Go、Kestrel、BEAM、Tokio）へ移します。',
    },
    'load-balancer': {
      term: 'ロードバランサー',
      definition:
        '受け取ったリクエストをバックエンドのサーバー群へ分散し、ヘルスチェックに失敗したバックエンドへは送るのをやめるサーバーです。1 つのアドレスの後ろにサーバーを足せ、どのサーバーが各リクエストを受けるかを決めます。',
      inGame:
        'ロードバランシングのリサーチはロードバランサーを解放し、サイズ段数 1 つあたり毎秒 2,000 件のリクエストを 1 ms の追加でさばきます。既定では各アプリサーバーの容量で振り分けます。死んだホストは次のヘルスチェックで外れ、既定では 10 秒ごとです。DNSラウンドロビンは死んだホストへ送り続けます。ロードバランシングアルゴリズムのリサーチは最小接続数と 2 択を追加し、ヘルスチェックのリサーチは 2 秒または 30 秒ごとのチェックを可能にします。L4ロードバランシングのリサーチはノードをレイヤー4に切り替えます。毎秒 20,000 件、ホップ 0.2 ms、支出は 0.6 倍です。HTTP を読まないのでリトライはできません。',
    },
    'load-shedding': {
      term: 'ロードシェディング',
      definition:
        'サーバーが過負荷のときに一部のリクエストを意図的に断り、すべてがタイムアウトする代わりに残したリクエストが間に合うようにすることです。よいシェディングは作業が資源を使う前に早く断り、最も重要でないか最も安い作業から先に落とします。',
      inGame:
        '優先度付きロードシェディングのリサーチでは、アプリサーバーでロードシェディングを有効にできます。負荷が 90% を超えるとリクエスト種別を丸ごと落とし、価値の低い順（ボット、次にリアルタイム、次にページビュー以降）に落として負荷が 90% に戻るまで続けるので、$25 のチェックアウトは過負荷を生き延びます。落としたリクエストはエラーとして数えられエラーバジェットを使いますが、残したリクエストは速いままです。',
    },
    'memory-leak': {
      term: 'メモリリーク',
      definition:
        '長時間動くプロセスが確保したまま使わなくなったメモリで、稼働時間とともに使用量が増えます。ガベージコレクションのある言語では、漏れはたいてい誤って到達可能なまま残ったオブジェクトです。育つ一方のキャッシュや、誰も外さないリスナーなどです。プロセスはスワップやガベージコレクションで遅くなり、メモリが尽きるとオペレーティングシステムに殺されます。',
      inGame:
        'メモリリークのインシデントは、リクエストの間もプロセスを保つランタイム（Apache mod_php と PHP-FPM 以外のすべて）のアプリサーバーに起きます。毎秒 RAM の 2.5% を増やします。RAM の 100% を超えるとスワップして遅くなり、125% でカーネルが殺して冷えた状態で再起動します。サーバーを再起動してメモリを解放するか、メモリリークを直すタスク（15 開発時間）を出荷します。次の機能を出すまで漏れが止まります。',
    },
    'materialized-view': {
      term: 'マテリアライズドビュー',
      definition:
        'クエリの結果を保存し、ディスクに保って予定どおりに更新するので、レポートはテーブルを走査せずに答えを読みます。速く、鮮度は最後の更新の時点までです。',
      inGame:
        'マテリアライズドビューのリサーチはデータベースのカードにビューを追加します。レポートは保存したビューを走査し、CPU は半分で済みます（10）。ただしレポートの答えの 5% は最後の更新より前の古いものです。データウェアハウスのデータベース側の双子で、走査が同じだけ安く、2 つ目のシステムが要りません。',
    },
    'metastable-failure': {
      term: 'メタステーブル障害',
      definition:
        '引き金が消えた後も自分自身を続かせる障害です。短い遅れがシステムを悪い状態へ押し込み、フィードバックループ、多くの場合リトライが負荷を容量より上に保つので、誰かが負荷を断つまでシステムは落ちたままです。Bronson らが 2021 年にこの種の障害を名づけました。',
      inGame:
        'リトライストームのインシデントは、データベースを 20 秒間、容量の 30% まで遅くします。すぐにリトライするリンクは、割合 f が失敗するとき呼び出し 1 回あたり最大 1 + f + f² + f³ 回の呼び出しを送ります。その失敗の割合を次のステップへ持ち越し、データベースは受けきれないものをキューに並べるので、インシデントはそのバックログがはけるまで終わりません。バックオフとジッター、サーキットブレーカー、優先度付きロードシェディングがそれぞれループを断ちます。データベースへの素朴なリトライは、バックオフよりこのインシデントを 6 倍起こしやすくします。',
    },
    mirror: {
      term: 'ミラー',
      definition:
        '同じインフラのコードを別のリージョンで動かすことです。Terraform のモジュールをリージョンごとに 1 回適用する、CloudFormation の StackSet などです。サーバーは簡単に写せます。データはそうはいかず、各コピーが書き込み先を決めなければなりません。',
      inGame:
        'Infrastructure as Code のリサーチの後、リージョンのタブの隣のミラーボタンが、1 つのリージョンのノードとリンクを別のリージョンへ写します。データベースごとに、リードレプリカ、独自のプライマリ、ミラー元への呼び出しのどれかを選びます。オブジェクトストレージは複製かミラー元への呼び出しかを選びます。適用はすぐに支払い、新しいノードはビルド時間の後に冷えた状態で届き、そのリージョンのユーザーは計画が着地したときにだけリンクを得ます。ミラーはミラー元とつながったままなのでドリフトしえますが、GitOps はそれを自分で同期し続けます。',
    },
    'model-inference': {
      term: 'モデル推論',
      definition:
        '学習済みの機械学習モデルを実行して答えを出すことで、学習とは対照的です。大規模言語モデルでは GPU がトークンごとに答えを生成するので、コストと速さは毎秒のトークン数と最初のトークンまでの時間で測ります。GPU を借りて自分でモデルを提供するか、ホスト型の API にトークン単位で払います。',
      inGame:
        'ai リクエストは 400 トークンのプロンプトを推論ノードへ送ります。LLM API（ホスト型モデルのリサーチ）は GPU が要りません。1,000 トークンあたり $2.50 で、最初のトークンまで 600 ms かかり、利用段階ごとに毎秒 100 件を超えるプロンプトを絞ります。GPUノード（モデルサービングのリサーチ）は最初のトークンまで 300 ms で、T4 で毎秒 200 トークン、A100 で 900、H100 で 2,000 を生成します。支出は暇でも忙しくても同じなので、H100 が LLM API より安いのは約 3 分の 2 稼働している間だけです。',
    },
    'mttd-and-mtta': {
      term: 'MTTDとMTTA',
      definition:
        '平均検知時間は、障害が始まってから信号がそれを示すまでの平均時間です。平均確認時間は、その信号から誰かがインシデントを引き受けるまでの平均時間です。Google の SRE の本はどちらも MTTR と並べて数えます。速く直しても気づくのが遅いチームはやはり遅いからです。',
      inGame:
        'すべてのインシデントは最初の信号が届いたシミュレーション秒と、プレイヤーが最初に動いた秒を記録し、ポストモーテムが MTTR と並べて MTTD と MTTA を示します。アラートがあれば信号はページャーで、ルールのしきい値を超えたステップで鳴ります。アラートがなければ信号はボードで、リクエストの 1% 超が失敗した最初の秒です。オンコールはページが届いてから 5 カレンダー分後に答えるので、それがローテーションの保つ MTTA です。オンコールがなければ、プレイヤーの最初の行動が確認になります。',
    },
    mttr: {
      term: 'MTTR',
      definition:
        '平均復旧時間は、障害が始まってからサービスが再び動くまでの平均時間です。チームがどれだけ速く問題を見つけ、診断し、直すかを測ります。DORA はより狭い版である失敗したデプロイの復旧時間を測ります。',
      inGame:
        'すべてのインシデントは、MTTR を示すポストモーテムで終わります。リクエストの 1% 超が失敗したカレンダー分です。ポストモーテムはその前に来た MTTD と MTTA も示します。エンジニアを 1 人置いた SRE チームはその期間を、つまり MTTR を 40% 短くします。半分の時点でユーザーに被害が出ていた時間が半分を超えたインシデントは、深刻度が 1 つ上がり 1.5 倍長く続きます。MTTR を低く保つには速く動きます。当たったノードを再起動、交換、ドレイン、フェイルオーバーし、ポストモーテムのアクションアイテムを研究します。',
    },
    'n1-query': {
      term: 'N+1クエリ',
      definition:
        '一覧を 1 回のクエリで読み込み、その後に関連データを読むため項目ごとに 1 回ずつクエリを実行することで、N 個の項目に N + 1 回のクエリがかかります。ORM は遅延読み込みでこれを起こし、余分なクエリをふつうに見えるコードの裏に隠します。一括読み込みなら関連する行を 1 回か 2 回のクエリで取ります。',
      inGame:
        'Laravel、Rails、Django は、1 回で済むところを 3 回の読み取りクエリを送る ORM を使い、それがページビューと API 読み取りで起きます。するとページビュー 1 回でデータベースは 2 回ではなく 6 回の読み取りを行い、そこに CPU が、アプリサーバーに待ち時間が加わります。一括読み込みを研究し、一括読み込みのタスク（10 開発時間）を出荷して余分なクエリを取り除きます。Symfony と軽量なフレームワークは決して起こしません。',
    },
    'network-partition': {
      term: 'ネットワーク分断',
      definition:
        'システムを互いに届かないノードの集まりに分け、それぞれは動き続けるネットワーク障害です。分断の間、分散システムは可用性を取るか整合性を取るかを選ばなければなりません（CAP 定理）。',
      inGame:
        'ネットワーク分断のインシデントは、リンクがリージョンをまたぐとシリーズCで始まります。最大 45 秒、リージョン間のすべての呼び出しがタイムアウトします。ただしユーザーからの呼び出しと、CDN などグローバルなコンポーネントへの呼び出しは除きます。リーダーに基づく書き込みも分かれます。リーダーを隔離を押すと終わります。分散SQLのノードは Raft のリーダーを 1 つ保つので、このインシデントは起こりにくくなります。',
    },
    'node-drain': {
      term: 'ノードドレイン',
      definition:
        'サーバーを意図的にローテーションから外すことです。新しい仕事を送るのをやめ、すでに抱えているリクエストやジョブを終わらせてから、止めるか更新します。ロードバランサーの接続ドレインと Kubernetes の `kubectl drain` はどちらもこの方式です。代わりに忙しいサーバーを殺すと、それがやっていたことは失われます。',
      inGame:
        'ヘルスチェックのリサーチはノードのカードにドレインのボタンを追加します。ノードはすぐに新しいトラフィックを受けず、取り分は経路上の他のノードへ行きます。抱えているものを終わらせ、キューの場合はバックログをワーカーへ渡します。10 シミュレーション秒後に空になってローテーションへ戻ります。インシデントが当たっているノードをドレインすると、そのインシデントは 10 秒のドレインの間に収まります。負荷を引き受けるコピーが他にないノードは、そこへ送られたすべてのリクエストを立ち往生させます。',
    },
    'object-storage': {
      term: 'オブジェクトストレージ',
      definition:
        'ファイルをフラットな名前空間のオブジェクトとして保つストレージです。各オブジェクトはキー、データ、メタデータを持ち、HTTP の API で届きます。Amazon S3 などのサービスはほとんど制限なく拡張でき、保存したバイト数と転送したバイト数で課金します。データベースが苦手とするアップロード、画像、動画、バックアップに向きます。',
      inGame:
        'オブジェクトストレージがないと、データベースがアップロードを行として保存し、2 MB の blob-put 1 回に 60 ms の CPU がかかります。オブジェクトストレージのリサーチはオブジェクトストレージを解放し、容量の制限なく 40 ms のレイテンシでアップロードとファイル読み取りをさばきます。支出は保存した GB ごとに S3 Standard の価格で増えるので、ユーザーがアップロードするほど請求が上がり続けます。',
    },
    observability: {
      term: '可観測性',
      definition:
        'システムが発するデータ、ふつうはログ、メトリクス、トレースから、システムが何をしているかをどれだけ理解できるかです。可観測性が高いと、新しいコードを出さずに障害について新しい問いに答えられます。',
      inGame:
        '可観測性のリサーチは台帳の多くを見せます。構造化ログはエラーを原因別に分け、メトリクスはすべてのノードに履歴グラフを足し、パーセンタイルは p50、p95、p99 を示し、アラートはエラー、p99、飽和がしきい値を超えたときにページャーを鳴らします。アナリティクスのノードはリンクでつないだノードのトラフィックを 1% から 100% まで標本化し、インサイトに変えます。各標本は Apdex が下がるほど多くを教え、最大 2 倍になります。標本化率を上げると CPU と支出が増えます。メトリクスはダッシュボード（D）も開き、設計を時系列で描きます。',
    },
    'oltp-and-olap': {
      term: 'OLTPとOLAP',
      definition:
        'オンライントランザクション処理（OLTP）は、注文やログインなど現在の行に対して多数の小さく速い読み書きを行います。オンライン分析処理（OLAP）は、レポートなど履歴に対して少数の大きな走査と集計を行います。OLTP のデータベースは各行をまとめて保存し、OLAP のエンジンはふつう各列をまとめて保存するので、走査は必要な列だけを読みます。',
      inGame:
        'レポートのリクエストは q-scan クエリを送ります。データベースでは走査が大量の CPU を使いバッファキャッシュを追い出すので、他の読み取りはディスクへ行き書き込みは待ちます。レポートがデータベースを殺すのインシデントの間は、走査 1 回のコストが 10 倍になります。データウェアハウス（データウェアハウジングのリサーチ）は走査をプライマリから引き取ります。走査 1 回に 1.5 秒かかり、データウェアハウスに容量の制限はなく、走査 1 回は $0.02 に時代のコスト指数を掛けた額です。',
    },
    'on-call': {
      term: 'オンコール',
      definition:
        '勤務時間外にページャーを持ちアラートに答えるエンジニアのローテーションで、ダッシュボードをたまたま見ている人ではなく人にページが届きます。よいローテーションは静かで、範囲が限られ、睡眠で支払われます。',
      inGame:
        'オンコールローテーションのリサーチ（シリーズA、アラートの後）はチームをページャーに就けます。ローテーションは最初の信号から 5 カレンダー分後にインシデントを確認するので、プレイヤーが離れていても MTTA は短く保たれ、ポストモーテムにそれが示されます。これがないとページはプレイヤーの最初のクリックを待ちます。ページはどれも、当たったサービスの持ち主のチームのエンジニアに数えられ、ページのたびに彼らの気分を少しずつ削ります。長い四半期のオンコールは、エンジニアが休暇や昇給、退職届を求める理由の 1 つです。',
    },
    'operating-margin': {
      term: '営業利益率',
      definition:
        '営業利益を売上の割合で表したものです。(売上 − 営業費用) / 売上 です。営業費用にはホスティング、給与、手数料が含まれます。売上 1 ドルあたり、事業を回すために払った後にどれだけ残るかを示します。',
      inGame:
        'マージンは (売上 − 支出) / 売上 で、支出はクラウドの請求に給与、エグレス、サードパーティの手数料を足したものです。売上がなければ −100% になります。マージンに年間のユーザー成長を足したものが 40の法則で、評価倍率を決めます。4 + 0.15 × 40の法則 で、2 から 30 の範囲です。上場の時代には四半期ごとに 10%、20%、30% のマージンのガイダンスを設定します。上回れば倍率が上がり、下回れば下がります。',
    },
    'percentile-p50-p95-p99': {
      term: 'パーセンタイル（p50、p95、p99）',
      definition:
        '測定値のうち、ある割合がその下に収まる値です。p50（中央値）のレイテンシは典型的なリクエストが見る値で、p99 は 99% のリクエストが上回る、つまり 100 件に 1 件がそれより遅いレイテンシです。平均は遅い外れ値を隠すので、SLO とアラートはふつう高いパーセンタイルを使います。',
      inGame:
        'パーセンタイルのリサーチの前は、HUD が平均レイテンシを示します。後は HUD が p99 を示し、各リクエスト種別が p50、p95、p99 を示します。イベントループの停止と GC ポーズはリクエストの約 2% に当たるので、平均と p95 がほとんど動かないまま p99 を上げます。アラートがあれば、レイテンシのルールは種別の p99 が Apdex の目標の 4 倍を 30 秒超え続けたときにページを送ります（既定のしきい値）。ダッシュボードのレイテンシのグラフは p99 を平均の隣に描くので、平均がどれだけ隠しているかが見えます。',
    },
    'point-in-time-recovery': {
      term: 'ポイントインタイムリカバリ',
      definition:
        'データベースを選んだ時点の正確な状態に戻すことです。基底のバックアップを読み込み、書き込み前ログをその時刻まで再生します。ログを継続的に保管するので、失うのは最後の数分の書き込みだけで、丸 1 日ではありません。',
      inGame:
        'ポイントインタイムリカバリのリサーチはデータベースのカードにバックアップの設定を足します。なし、毎晩、PITR です。毎晩のスナップショットはカレンダー 1 日分の書き込みを失うことがあり、データベースの支出が 5% 増えます。PITR は約 2 カレンダー分を失い、15% 増えます。IPO チェックリストの DR訓練はこの RPO を読み、別リージョンのレプリカがすでにデータを覆っていない限り 5 分未満でなければ合格しません。',
    },
    'power-of-two-choices': {
      term: 'Power of two choices',
      definition:
        '負荷分散の方法です。2 台のサーバーを無作為に選び、負荷の低いほうへリクエストを送ります。Mitzenmacher は、無作為な 2 つの選択が 1 つより指数関数的によく負荷を分散することを示し、バランサーはサーバーごとの負荷の正確で共有された見方を持たなくて済みます。NGINX は random two least_conn として提供しています。',
      inGame:
        'ロードバランシングアルゴリズムのリサーチはロードバランサーで二択を使えるようにします。グローバルな状態を持たないので、ロードバランサー自体が 1.5 倍のトラフィックをさばきます。代わりに、各サーバーの負荷にかかわらずトラフィックの 10% は均等に分かれます。最小接続数は現在の容量で完全に振り分けますが、容量のボーナスはありません。',
    },
    'pre-fork-worker-model': {
      term: 'プリフォークワーカーモデル',
      definition:
        'マスタープロセスがあらかじめ固定のワーカープロセスのプールを起動し、各ワーカーが 1 度に 1 つのリクエストを扱うサーバーの設計です。Apache prefork、PHP-FPM、Gunicorn がこの方式です。リクエストをよく隔離しますが、ワーカーごとにメモリが要り、待つリクエストはワーカーを占有します。',
      inGame:
        'PHP-FPM と Python の Gunicorn は、アプリサーバーのカードで 1 から 400 まで大きさを決めるワーカーのプールを動かします。PHP-FPM は 5 つで始まります。各ワーカーは 1 つのリクエストを取るので、遅いデータベース呼び出しがプールを埋めます。ワーカーごとに RAM（Gunicorn で 120 MB）もかかるので、大きなプールはスワップします。PHP-FPM の Static モードはプール全体を常駐させます。Dynamic と On demand モードはメモリを節約しますが、リクエストの 2% か 10% が fork に 20 ms か 50 ms 待ちます。',
    },
    'process-per-request': {
      term: 'リクエストごとのプロセス',
      definition:
        '処理中の各リクエストが終わるまでワーカープロセスを丸ごと占有するサーバーの方式です。mod_php の Apache prefork、PHP-FPM、Gunicorn の同期ワーカーなどです。リクエストをよく隔離しますが、待つリクエストはプロセスとそのメモリを占有するので、プールの大きさと RAM が同時に動くリクエスト数を決めます。',
      inGame:
        '最初のランタイムである Apache mod_php は、処理中のリクエストごとにプロセスを動かし、最大 150 までです。各プロセスは PHP を組み込むので 60 MB かかり、RAM が早く尽きます。PHP-FPM と Gunicorn は自分で大きさを決める固定のプールを動かし、PHP-FPM は 5 つのワーカーで始まります。リクエストはデータベースを待つ間ワーカーを占有し、マシンに対して大きすぎるプールはカーネルに殺されるまでスワップします。各プロセスは自分のデータベース接続も持つので、大きなプールは Postgres の 100 接続の上限に当たります。',
    },
    quantization: {
      term: '量子化',
      definition:
        'モデルの重みをより低い精度で保存することです。16 ビットの浮動小数ではなく 8 ビットや 4 ビットの整数などで、メモリを減らして計算を速くしますが、答えの質はいくらか落ちます。',
      inGame:
        '量子化のリサーチは GPUノードに FP16、INT8、INT4 を足します。INT8 は 2 倍、INT4 は 3 倍のトークンをさばき、答えの価値はそれぞれ 5% か 15% 低くなります。GPU がボトルネックで、答えが少し悪くてもよいときに得です。',
    },
    quorum: {
      term: 'クォーラム',
      definition:
        '読み取りや書き込みが済んだとみなされる前に答えなければならないレプリカの数です。N 個のレプリカ、読み取りクォーラム R、書き込みクォーラム W で、R + W > N ならすべての読み取りが最新の書き込みを持つレプリカを少なくとも 1 つ問い合わせます。これは線形化可能ではありません。同時書き込み、失敗した書き込み、ずさんなクォーラムは古い値を返しうるからです。',
      inGame:
        'ワイドカラムストアは各キーを N 個（1 から 5）のレプリカに保ち、読み取りが問い合わせるレプリカ R と、書き込みが待つレプリカ W を設定します。R + W > N なら読み取りが最新の書き込みを外すことはありません。弱いクォーラムはレプリカ操作が少なく、より早い応答を待つだけで済みますが、古い読み取りが返ります。すべてのレプリカを必要とするクォーラムは、1 つ失われると失敗します。強いクォーラムでも 2% の古い読み取りと 1% の重複チェックアウトが出ます。',
    },
    raft: {
      term: 'Raft',
      definition:
        'サーバー群の上で複製したログを同一に保つ合意アルゴリズムです。選ばれたリーダーが各項目を追記し、過半数が保存した時点でコミットします。これにより少数が落ちても群は動き続け、2 つの異なる値をコミットすることはありません。Ongaro と Ousterhout が Paxos より分かりやすくするために 2014 年に設計し、etcd と CockroachDB が使っています。',
      inGame:
        '分散SQL は Raft の上で SQL を動かし、同期レプリケーションが必要な合意形成データベースのリサーチで解放されます。書き込みはすべて、広がっているリージョンの過半数への往復を待ち、読み取りはリースホルダーに問い合わせて書き込みの 4 分の 1 のコストです。サイズ 1 で毎秒 6,000 のトランザクションをさばきます。またネットワーク分断の間もリーダーを 1 つ保つので、そのインシデントは 4 分の 1 の頻度になります。',
    },
    'rate-limiting': {
      term: 'レート制限',
      definition:
        '期間内にクライアントが送れるリクエスト数を上限で抑え、残りを断つことです。多くの場合 HTTP 429 Too Many Requests を返します。サービスを濫用、スクレイパー、1 つの騒がしいクライアントから守り、プロバイダが容量を公平に分けられます。よくあるアルゴリズムはトークンバケット、リーキーバケット、固定またはスライディングウィンドウです。',
      inGame:
        'LLM API はクライアント側で制限します。利用段階ごとに毎秒 100 件のプロンプトを受け付け、それを超えるとプロンプトは throttled として即座に失敗します。APIゲートウェイは同じ考えを自分のサービスに適用します。毎秒のリクエスト数で上限を選び、超えたリクエストは throttled として失敗します。上限はノード全体で 1 つで、ユーザーや API キーごとのバケットではありません。レート制限のリサーチは上限をトークンバケットにし、ステップごとに補充して 200 件多く保つので、収まるバーストは丸ごと通ります。濫用のトラフィックを止めるには、WAF がルールでボットをブロックします。パラノイア 2 でボットの 80% をブロックし、実際のユーザーも 0.5% ブロックします。',
    },
    'read-replica': {
      term: 'リードレプリカ',
      definition:
        'プライマリの書き込みに追従し、読み取り専用のクエリに答えるデータベースのコピーで、プライマリの読み取り負荷を下げます。レプリケーションはふつう非同期なので、レプリカは遅れて少し古いデータを返すことがあります。',
      inGame:
        'リードレプリカのリサーチはリードレプリカを解放し、データベースのように動きますが q-read と q-scan にだけ答えます。データベースとレプリカの両方に届くレポートはレプリカへ行くので、走査がプライマリのバッファキャッシュを追い出さなくなります。1 つ足してもプライマリは再起動せず、そのマシンの請求は同じ大きさのデータベースより 30% 安いです。ラグは 20 ms に毎秒の書き込み 1 件あたり 2 ms を足したもので、そのラグの窓の読み取り 4 件に 1 件が古く、読み取りの最大 15% になります。レプリケーションラグのインシデントはラグを 10 倍にします。read-your-writesルーティングは書き込みに続く読み取りをプライマリへ送ります。別リージョンのレプリカは、本拠のリージョンが落ちたときに失うデータの量も抑えます。',
    },
    'read-your-writes-consistency': {
      term: 'read-your-writes整合性',
      definition:
        'セッションの保証です。クライアントが書き込んだ後、そのクライアント自身の読み取りはその書き込みかより新しいものを見ます。他のクライアントがまだ古いデータを見ていてもかまいません。読み取りがプライマリに遅れるレプリカへ行くときに重要です。よくある対策は、書き込みの後の短い間そのユーザーの読み取りをプライマリへ送ります。Terry らが 1994 年に定義しました。',
      inGame:
        'read-your-writesルーティングを研究した後、アプリサーバーで有効にすると、チェックアウトの読み取りがプライマリへ行き、古い値を返しません。他の古い読み取りは 80% 減ります。これがないとリードレプリカがプライマリに遅れ、古い読み取りが API 読み取りか自分の書き込みを読むチェックアウトを失敗させます。この設定はレプリケーションラグのインシデントもずっとまれにします（重み 0.3、通常は 2）。',
    },
    'red-method': {
      term: 'REDメソッド',
      definition:
        '各サービスのレート、エラー、期間です。リクエストをどれだけ受け、どれだけ失敗し、どれだけ時間がかかるかです。ユーザーが感じるものを測るので、アラートが見張ります。Tom Wilkie が Google のゴールデンシグナルのサービス単位版として名づけました。',
      inGame:
        'ダッシュボード（D）のサービスの行は、各サービスのレート、エラー、期間を示します。ダッシュボードはメトリクスのリサーチの後に開きます。そのゴールデンシグナルの行は、システム全体のトラフィック、レイテンシ、そして構造化ログがあればエラーを時系列で描くので、ユーザーがいつ苦しみ始めたかを見るのにその行を使います。',
    },
    'redos-regular-expression-denial-of-service': {
      term: 'ReDoS（正規表現によるサービス拒否）',
      definition:
        '細工した入力でバックトラックする正規表現エンジンに指数関数的な、または非常に長い時間をかけさせるサービス拒否攻撃です。1 つの悪いパターンがリクエストごとに CPU コアを 1 つ占有します。',
      inGame:
        '正規表現バックトラッキングのインシデントは、WAF を動かすとシリーズBから始まります。新しい WAF のルールが長い入力でバックトラックするので、どの WAF も容量の 10% しか保てず、そこを通るトラフィックは失敗するかキューに並びます。WAF のルールを無効化を押すとすぐに終わります。実際のシステムでは、ルールのカナリアロールアウトがすべてのサーバーへ届く前にこれを捕まえます。',
    },
    'replication-lag': {
      term: 'レプリケーションラグ',
      definition:
        '書き込みがプライマリのデータベースでコミットしてから、その書き込みがレプリカに現れるまでの遅れです。非同期のレプリカはプライマリのログを後から適用するので、ラグは書き込み量、レプリカ上の長いクエリ、ネットワークの遅れで増えます。遅れたレプリカからの読み取りは古いデータを返します。',
      inGame:
        'リードレプリカのラグは 20 ms に毎秒の書き込み 1 件あたり 2 ms を足したもので、その窓の読み取りの 4 分の 1 が、書き込みが変えたばかりの行を求めるので、古く返る割合はラグの秒数の 4 分の 1、最大 15% です。レプリケーションラグのインシデントはラグを 10 倍にし、古い読み取りは最大 50% になります。古い読み取りは API 読み取りとチェックアウトを失敗させますが、ページビューは受け入れます。read-your-writesルーティングは気にする読み取りをプライマリへ送ります。',
    },
    'retry-with-backoff-and-jitter': {
      term: 'バックオフとジッターを伴うリトライ',
      definition:
        '失敗した呼び出しを、試行ごとに伸びる待ち（指数バックオフ）と無作為なばらつき（ジッター）を付けてリトライし、一緒に失敗したクライアントが一緒にリトライしないようにすることです。リトライ予算や上限が、リトライが足せる余分な呼び出しを制限するので、すでに苦しんでいるサービスにリトライが負荷を掛け算しません。',
      inGame:
        'タイムアウトとリトライを研究すると、各リンクのタイムアウトを 1、5、30 秒に設定し、リトライを有効にできます。素朴なリトライはすぐに最大 3 回発火するので、割合 f が失敗する呼ばれる側は呼び出し 1 回あたり 1 + f + f² + f³ 回の呼び出しを受けます。バックオフとジッターはリトライごとに約 200 ms 待ち、余分な呼び出しを最大 10% に抑えるので、リトライストームが小さく収まります。研究がなければどのリンクも 30 秒待ち、リトライはしません。',
    },
    'rpo-and-rto': {
      term: 'RPOとRTO',
      definition:
        '目標復旧時点（RPO）は、災害で失ってよい最も新しいデータを、障害の何分前かで測ったものです。目標復旧時間（RTO）は、サービスが再び動くまでに落ちていてよい最長の時間です。両方が、システムに必要なバックアップ、レプリケーション、スタンバイの容量を決めます。',
      inGame:
        'データベースのバックアップが RPO を決めます。なしはすべてを失い、毎晩は最大 1,440 カレンダー分を失い、PITR（ポイントインタイムリカバリのリサーチ）は 2 分です。別リージョンのリードレプリカはそれをそのレプリカのラグまで下げ、分散のワイドカラムストアか分散SQLは何も失いません。IPO チェックリストの DR訓練は本拠のリージョンを落とします。エラーが 60 カレンダー分以内に 1% を下回り（RTO）、RPO が 5 分未満のときにだけ合格します。',
    },
    'rule-of-40': {
      term: '40の法則',
      definition:
        'サービスとしてのソフトウェアの会社向けの目安です。年間の売上成長率と利益率をどちらも百分率で足すと、少なくとも 40 になるべきです。急成長して赤字の会社と、低速で利益のある会社を 1 つの数で比べられます。投資家は 40 を超える会社によく高い評価倍率を払います。',
      inGame:
        '評価額は年間の売上に、40の法則のスコアから来る倍率を掛けたものです。4 + 0.15 × スコア で、2 から 30 の間に保ち、負のスコアは 0 として数えます。スコアは直近のカレンダー週のユーザー成長を年率換算したものにマージンを足したもので、マージンは (売上 − 支出) / 売上 です。40 以上のスコアは IPO チェックリストの項目なので、上場の前に支出を削るか速く成長します。',
    },
    runbook: {
      term: 'ランブック',
      definition:
        '特定のアラートが鳴ったときに何をするかを書いた、短く試された文書です。どの確認を走らせ、どのコマンドを実行し、いつエスカレーションするかです。システムが自分で実行できるランブックは自動化で、人が午前 3 時に読むランブックも書く価値があります。',
      inGame:
        'ランブックのリサーチ（シリーズA、オンコールの後）と、エンジニアを置いた SRE チームが、チームがすでに手作業で終わらせたインシデント 1 種別についてランブックを書く（10 開発時間）を解放します。書いてしまえば、その種別は最初のステップで自分から解決します。ポストモーテムはそれを自動として記録します。クラスターがポッドを再スケジュールしたときやスタンバイが引き継いだときと同じで、ランブックの実績がその記録を読みます。',
    },
    service: {
      term: 'サービス',
      definition:
        '独自のデプロイパイプラインを持ち、1 つのチームが所有するコードベースです。モノリスをサービスに分けると、各チームが自分で出荷し拡張できますが、サービス間のネットワークホップと、サービスをまたいで移動しうる障害が代償です。',
      inGame:
        '会社は 1 つのサービス、モノリスで始まり、他のどのサービスも名指さない機能はすべてそこに残ります。サービスの境界のリサーチ（シリーズB）は、稼働中の機能を名前と所有チームを持つ新しいサービスへ分け、開発時間は動かすコードベースの 0.3 倍です。持ち主がそのサービスのバックログを組み、壊れたときにページを受け、不正なデプロイはそれを出したサービスだけを失敗させます。1 つのデータベースに 2 つのサービスが乗ると調整のペナルティが 1.5 倍分増えるので、サービスが自分のデータベースノードを名指すまで k は 1.5 倍されます。',
    },
    sharding: {
      term: 'シャーディング',
      definition:
        '1 つのデータセットをキー（ユーザー ID のハッシュなど）で複数のデータベース（シャード）に分け、各シャードがデータの一部だけを保存してさばくことです。書き込みと保存を 1 台のマシン以上に広げますが、シャードをまたぐクエリはすべてのシャードに問い合わせる必要があり、ホットなキー 1 つが他のシャードが遊んでいる間に自分のシャードを過負荷にできます。',
      inGame:
        'シャーディングのリサーチはデータベースをキーで 1、2、4、8 のシャードに分け、リーダーレスレプリケーションを解放します。各シャードはもう 1 台のマシンで、同じように請求され、書き込みが分かれるので、2 つのシャードは 2 倍の書き込みをさばきます。読み取りはキーを持つシャード 1 つにだけ問い合わせるので、プライマリから読み取りを外すのはリードレプリカの役目です。シャードをまたぐトランザクションはレイテンシが 3 倍かかります。シャードキー（ハッシュ、範囲、テナント、リージョン）はカードで選びます。シャード数を変えるのは再シャーディングで、データベースが持つ GB ごとに開発時間とカレンダー時間がかかります。ホットキーのインシデントはキャッシュかワイドカラムストアに起き、読み取りの 30% が 1 つのキーを求めるので、ノードの容量は約 1 / (0.3 × サイズ段数 + 0.7) に落ちます。ハイブリッドファンアウトならそれらのキーを分けられます。',
    },
    'shared-nothing': {
      term: 'シェアードナッシング',
      definition:
        'ノードやリクエストがメモリもディスクも共有せず、ネットワーク越しにだけ協調する構成です。それぞれが自分で落ち、再起動し、拡張できます。Michael Stonebraker が 1986 年にデータベース向けに主張しました。PHP はこの考えをリクエストごとに適用し、すべてのリクエストがきれいなプロセスの状態で始まり、終わるとすべてを解放します。',
      inGame:
        'Apache mod_php と PHP-FPM はシェアードナッシングで、リクエストのたびにすべてのメモリを解放するので、メモリリークのインシデントが当たることはありません。他のすべてのランタイムはリクエストをまたいでプロセスを保ち、リクエストごとの準備を省けますが、漏れえます。代償は速さで、PHP は Go の CPU 速度の 0.15 倍、OPcache ありで 0.375 倍です。',
    },
    'slo-sla-sli': {
      term: 'SLO・SLA・SLI',
      definition:
        'サービスレベル指標（SLI）は、成功したリクエストの割合など、サービスの振る舞いの測定値です。サービスレベル目標（SLO）は、期間内の SLI の目標で、30 日で 99.9% などです。サービスレベル契約（SLA）は顧客との契約で、約束した水準を外したときの SLAクレジットなどの結果を定めます。ふつう内部の SLO より緩いです。',
      inGame:
        'SLI は可用性で、直近のカレンダー週に答えたユーザーリクエストの割合です。ボットと WAF のブロックは数えません。時代ごとに SLO が決まり、ガレージの 99% から上場の 99.99% までです。シリーズAからは、それが許す失敗がエラーバジェットになります。SLOダッシュボードはそのバジェットを HUD に出し、IPO チェックリストは 99.95% を必要とします。B2B SaaS はシリーズBから SLA を結び、時代の目標より 1 段上にします。週がそれを下回っている間、エンタープライズ営業が顧客にクレジットを返します。サブスクリプション売上の 10% です。',
    },
    'soc-2': {
      term: 'SOC 2',
      definition:
        'AICPA の監査の枠組みです。独立した監査人が、サービス組織のセキュリティ、可用性、処理の完全性、機密性、プライバシーの統制について報告します。エンタープライズの顧客はよく SOC 2 の報告書を求めます。',
      inGame:
        'SOC 2 はプレIPOの IPO チェックリストの項目です。SOC 2プログラムのリサーチが必要で、それには全通信のTLS化、保存データの暗号化、依存関係スキャンが必要です。エンジニアを置いたセキュリティチームも必要です。そのチームがないと、監査指摘のインシデントが合格した DR訓練を振り出しに戻すことがあります。',
    },
    'spot-instance': {
      term: 'スポットインスタンス',
      definition:
        '大きな割引で売られるクラウドの余剰容量で、オンデマンド価格から最大 90% 引かれ、プロバイダが必要になったらいつでも取り戻せます。AWS は 2 分前に中断を通知します。スポットは状態を持たず障害に強い作業、たとえばバッチジョブや、余力のあるロードバランサーの後ろのサーバーに向き、単一のデータベースには向きません。',
      inGame:
        'スポット価格ではノードがオンデマンド価格の 0.3 倍で動きますが、プロバイダが取り戻せます。スポット回収のインシデントは 10 シミュレーション秒警告してからノードを落とし、警告の間にノードをオンデマンドに切り替えると取り消せます。リザーブドのノードは 0.6 倍で 1 カレンダー週保ちます。GPU不足のインシデントは別で、プロバイダが GPUノードを、H100 から先に取り戻し、フォールバックの LLM API があると頻度が 4 分の 1 になります。',
    },
    'strangler-pattern': {
      term: 'ストラングラーパターン',
      definition:
        'レガシーのシステムを少しずつ置き換えることです。前にルーティング層を置き、増えていく割合のトラフィックや機能を新しいシステムへ送り、何も使わなくなったら古いものを引退させます。Martin Fowler が、木に巻きついて取って代わるつる植物の絞め殺しのイチジクにちなんで名づけました。危険な一括の書き直しを避けられます。',
      inGame:
        '会社でサービスのスタックを変えると、両方のバージョンを動かすマイグレーションが始まり、アプリサーバーを 4 段階で移します。トラフィックの 5%、25%、50%、そして 100% です。各段階がマイグレーションの開発時間のその割合（10%、20%、30%、40%）を使います。新しいスタックのリクエストは、マイグレーションのバグを直すを出荷するまで 3% 失敗し、移行中のサービスの機能は半分の速度で進みます。',
    },
    'synchronous-replication': {
      term: '同期レプリケーション',
      definition:
        'プライマリが書き込みを確定する前に、少なくとも 1 つのレプリカもそれを保存したことを確かめるレプリケーションです。プライマリが落ちても確定した書き込みは失われませんが、書き込みはすべてレプリカへの往復を待ちます。',
      inGame:
        '同期レプリケーションのリサーチは各リードレプリカにスイッチを足します。オンにすると書き込みがすべてそのレプリカを待つので、レプリカが遅れることはなく、書き込みはそれぞれ往復分を払います。このリサーチは合意形成データベースも解放し、分散SQLは書き込みのたびにレプリカの過半数を待つので、リージョンをまたぐ書き込みは往復分を払います。スタンバイを持つデータベースも、ゾーンが落ちると数秒で引き継ぎます。',
    },
    'tail-at-scale': {
      term: 'The Tail at Scale',
      definition:
        '1 つのリクエストが多くのサーバーへ広がり、多くの応答を待つとき、最も遅い応答がそのレイテンシを決めるので、各サーバーではまれな遅れがリクエスト全体ではよく起きます。100 台のサーバーがそれぞれ 1% の確率で遅いと、63% のリクエストが少なくとも 1 つの遅い応答に当たります。Dean と Barroso が 2013 年に述べ、ヘッジリクエストなどの対策を示しました。',
      inGame:
        'リクエストは経路上のすべてのノードのテール事象を集めます。独立した 2 つの確率 a と b は 1 − (1 − a)(1 − b) に合成されるので、ときどき止まるノードが長く連なると、どれか 1 つより p99 が悪くなります。ワイドカラムストアの読み取りは N 個のレプリカのうち R 番目に速いものを待ち、R = N では最も遅いものを待ちます。パーセンタイルのリサーチは、これが現れる p99 を示します。',
    },
    'tech-debt': {
      term: '技術的負債',
      definition:
        'コードの中の近道と古くなった設計で、その後の変更を遅く、危険にします。ローンの利子のように、チームがリファクタリングで負債を返すまで続きます。Ward Cunningham が 1992 年にこの比喩を作りました。負債の一部は早く出すための意図的な取引で、そのコストはその後のすべての変更に加わる余分な手間です。',
      inGame:
        '各サービスには技術的負債の割合があります。出荷した機能は、速度優先で 6 ポイント、バランスで 3、品質優先で 1 加わります。フレームワークがないとさらに 1 加わり、インシデントの間に出荷したタスクは 2 加わります。急いだ項目は、プールが払った項目のコスト 1 つ分ごとに 2 ポイント加わります。負債は速度を最大半分まで落とし、不正なデプロイの確率を最大 3 倍にし、すべてのインシデントを起こりやすくします。リファクタリングのタスク（10 開発時間）は 20 ポイント減らし、品質優先のポリシーは一部を自分で返済します。',
    },
    'thread-pool': {
      term: 'スレッドプール',
      definition:
        '共有のキューから仕事を取る固定のスレッド群で、タスクごとにスレッドを作るコストを払わずに済みます。リクエストごとにスレッドを使うサーバーでは、プールの大きさが同時に動くリクエスト数を決め、I/O を待つリクエストもスレッドを占有します。',
      inGame:
        'Java の Tomcat は 1 つの JVM で 200 スレッドを動かし、Ruby の Puma はプロセスあたり 5 スレッドを動かします。待つリクエストはスレッドを占有するので、遅いデータベース呼び出しがプールを埋めます。Node.js では libuvスレッドプールのリサーチがパスワードのハッシュをイベントループから外すので、ログインが他のリクエストを止めなくなります。Rust の Tokio はワーカースレッドのプールで非同期タスクを動かすので、CPU を重く使うタスクはそのうち 1 つだけを止めます。',
    },
    'thundering-herd': {
      term: 'サンダリングハード',
      definition:
        '多くのクライアントやプロセスが同じ瞬間に目を覚まして動くことです。再起動、キャッシュの期限切れ、共有のタイマーの後などで、合わせた負荷が共有の資源を圧倒します。対策は群れを散らすことで、ジッター、リクエストのまとめ、ずらした再起動などです。',
      inGame:
        'スタンピードのインシデントはキャッシュを空で再起動し、すべてのミスが一度にデータベースへ行きます。データベースが 90% 以上で動いている間は再充填がタイムアウトし、キャッシュは冷えたままです。スタンピード対策は冷えたキャッシュの余分なミスの 25% だけを通し、残りは 1 回の取得を待ち、キャッシュウォーミングはキャッシュを 80% 温まった状態で戻します。素朴なリトライも群れで、すべての呼び出し元が一度にリトライします。バックオフとジッターがそれを散らします。',
    },
    'tiered-caching': {
      term: '階層キャッシュ',
      definition:
        'エッジの地点がオリジンの前に、より少ない地域別または上位のキャッシュへ問い合わせる CDN の構成です。エッジが上位層の持つものを共有するのでヒット率が上がり、オリジンに届くリクエストが減ります。',
      inGame:
        '階層キャッシュのリサーチ（Content delivery の後）は、CDN のエッジがオリジンの前に地域の層へ問い合わせるようにし、既定の TTL で CDN が答えるメディアのリクエストの割合を 75% から 92% に上げます。CDN が答える動画はアプリサーバーを動かさず、安いエッジのエグレス価格で請求されます。',
    },
    timeout: {
      term: 'タイムアウト',
      definition:
        '呼び出し元が諦めるまでに応答を待つ最長の時間です。タイムアウトは呼び出し元のスレッドや接続を解放するので、遅い依存先が永遠に占有することはありませんが、短くしすぎたタイムアウトは成功したはずの呼び出しを失敗させます。',
      inGame:
        'リンクは答えを 30 秒待ち、タイムアウトとリトライのリサーチで各リンクのタイムアウトを 1、5、30 秒に設定できます。呼び出し元はタイムアウトまでしか枠を占有しないので、短いタイムアウトは遅いデータベースがアプリサーバーのすべての枠を埋めるのを防ぎ、それを超えた呼び出しはタイムアウトとして失敗します。タイムアウトしてリトライされる課金は、冪等キーを持つまで 2 回課金することがあります。',
    },
    'tls-certificate': {
      term: 'TLS証明書',
      definition:
        "ドメイン名を公開鍵に結びつける、認証局が発行した署名付きのファイルです。ブラウザは HTTPS の接続を開く前にこれを確認し、期限が切れるとサイトを拒否します。証明書は寿命が短いので、チームは ACME や Let's Encrypt などで自動更新します。",
      inGame:
        '証明書の自動化のリサーチはシークレットと証明書を解放します。TLS を終端する各ノード（ロードバランサー、CDN、WAF、APIゲートウェイ、リアルタイムハブ、エッジ関数）は自分の証明書を持ち、有効期間は 90 カレンダー日、シリーズCからは 45 日です。マネージャーが動いている間は、最初のステップで各証明書を発行し、寿命の 3 分の 2 の時点で更新します。動くマネージャーがないと証明書は 1 つずつ切れます。証明書が切れたノードを通るリクエストはすべてダウンとして失敗し、証明書の期限切れのインシデントが始まります。マネージャーが再び動くか、更新を押すまで続きます。',
    },
    'token-bucket': {
      term: 'トークンバケット',
      definition:
        'レート制限のアルゴリズムです。バケットは最大 B 個のトークンを保ち、一定の速度 r で補充します。各リクエストがトークンを 1 つ取り、空のバケットに当たったリクエストは待つか断られます。長期的な平均を r に保ちながら、最大 B までの短いバーストを許します。',
      inGame:
        'バースト可能なノードは CPU クレジットのトークンバケットで動きます。vCPU の 20% 未満しか使っていない間にクレジットを稼ぎ、vCPU あたり 100 コア秒まで貯め、その基準を超えて動くために使います。バケットが空になると CPU 20% まで落ちるので、一日中熱いバースト可能なマシンは止まります。代わりに汎用の 0.4 倍の費用です。APIゲートウェイのレート制限のリサーチは同じバケットを与え、上限に加えて 200 リクエストのバーストを許します。',
    },
    'transactional-outbox': {
      term: 'トランザクショナルアウトボックス',
      definition:
        'データベースの更新とイベントの発行を、どちらも失わずに行う方法です。サービスは同じデータベースのトランザクションで変更とアウトボックスの行を書き、別のリレーがアウトボックスを読んで各イベントをメッセージブローカーへ少なくとも 1 回発行します。データベースのコミットが成功して発行が失敗する、またはその逆という二重書き込みの問題を避けます。',
      inGame:
        'シリーズBから、アプリの二重書き込みはときどき発行を取りこぼすので、検索エンジンの答えの 0.5% が古くなります。トランザクショナルアウトボックスのリサーチはその割合を 0 にし、データベースのログから変更を読む CDCコネクターも同じです。どちらもキューは変えません。キューにリンクしたアプリサーバーは遅いリクエストの非同期部分をワーカーへ渡し、ユーザーはキューに入るまでしか待ちません。',
    },
    'use-method': {
      term: 'USEメソッド',
      definition:
        '各資源の使用率、飽和、エラーです。CPU、メモリ、コネクションプールなどです。症状ではなく原因を測り、100% で仕事が待っている資源がボトルネックの候補です。Brendan Gregg が性能分析のチェックリストとして述べました。',
      inGame:
        'ダッシュボードの飽和の行は、各ノードの使用率をバーゲージ、状態のタイムライン、表で示すので、どのノードが最初に埋まったかが見えます。リソースの行は、プロファイリングがあれば制限している資源を名指しします。ボードでは各ノードのカードの負荷バーが同じ使用率をライブで示します。',
    },
    utilization: {
      term: '使用率',
      definition:
        'ある期間に資源の容量のうち使われた割合です。提供された仕事を容量で割ったものです。使用率が 100% に近づくほど待ち行列の遅れは急に伸びます。単純な M/M/1 の待ち行列では待ちは ρ / (1 − ρ) に比例するので、50% から 90% に上がると待ちは 9 倍になります。',
      inGame:
        '各ノードは使用率を示します。提供された仕事を、CPU、枠、メモリ、接続、ネットワークのうち最も厳しい上限の容量で割ったものです。待ち行列の遅れは ρ / (1 − ρ) で伸びます。ノードは 70% で警告し、90% で危険を示し、100% を超えた分を落とします。制限の探索は 60% を超えるノードだけを見積もり、オートスケーラーは 40%、60%、80% を目標にします。ダッシュボードの飽和の行は各ノードをゲージと 24 時間のタイムラインで示し、同じ 70% と 90% の線が引かれます。',
    },
    'vertical-and-horizontal-scaling': {
      term: '垂直スケーリングと水平スケーリング',
      definition:
        '垂直スケーリング（スケールアップ）は、より多くの CPU とメモリを持つ大きなマシンへワークロードを移します。水平スケーリング（スケールアウト）はマシンを増やして仕事を分けます。スケールアップは単純ですが上限があり、ふつう再起動が要ります。スケールアウトはロードバランサーと状態を持たないサーバーが必要ですが、固い上限がなく、1 台を失っても生き残ります。',
      inGame:
        'サイズ付きのノードの大きさを変えると、nano（0.5 vCPU）から metal（96 vCPU）まで 1 段ずつ動きます。各段で vCPU と RAM が 2 倍になりますが、ノードは再起動して冷えた状態で戻ります。余分なコアを使えないソフトウェアもあります。Node.js は 1 コアで 1 つのイベントループを動かし、Redis は 1 スレッドで答えます。スケールアウトするには、DNS やロードバランサーの後ろにアプリサーバーを増やし、コピー 1 つにつき配置費用が 25% 多くかかります。オートスケーラーにコピーを足させてもよく、VM では 180 秒、Kubernetesクラスターでは 30 秒かかります。インスタンスファミリーも重要です。ARMインスタンスのリサーチは、汎用の vCPU と RAM を 0.8 倍の価格で持つファミリーを足し、CPU 速度は 0.95 倍です。',
    },
    'waf-web-application-firewall': {
      term: 'WAF（Webアプリケーションファイアウォール）',
      definition:
        'ウェブアプリケーションの前で HTTP リクエストを検査し、攻撃やボットのルールに合うものをブロックするフィルターです。厳しいルールほど多くの攻撃を捕まえ、誤って多くの実際のユーザーもブロックします（誤検知）。',
      inGame:
        'Webアプリケーションファイアウォールのリサーチは WAF コンポーネントを解放します。パラノイアレベルが、ブロックするボットの割合と誤ってブロックする実際のユーザーの割合を決めます。レベル 1 はボットの 60% とユーザーの 0.1%、レベル 2（既定）は 80% と 0.5%、レベル 3 は 92% と 2%、レベル 4 は 98% と 6% です。高いレベルほどリクエストあたりの CPU が増え、レベル 1 の最大 4 倍です。ボット管理のリサーチは疑わしいクライアントをブロックせずチャレンジを出し、誤検知を半分にしてブロック率を保ちます。攻撃下モードでは WAF がボットの 99% とユーザーの 1% をブロックし、40 ms を加えます。',
    },
    'write-through-cache': {
      term: 'ライトスルーキャッシュ',
      definition:
        '書き込みがすべてキャッシュとデータベースへ一緒に行くキャッシュの方針で、書き込んだキーについてはキャッシュが常に最新の値を持ちます。読み取りは当たりやすく、それらのキーで古い値を返すことはありませんが、書き込みは遅くなり、読まれないかもしれないデータでキャッシュが埋まります。キャッシュアサイドとライトビハインドがよくある代替です。',
      inGame:
        'ライトスルーはキャッシュ戦略を研究した後のキャッシュの戦略の 1 つです。書き込みがキャッシュとデータベースへ一緒に行くので、キャッシュは書き込んだキーで古いヒットを返さず、書き込みはそれぞれ 0.5 ms 多く払います。キャッシュアサイドのキャッシュは書き込みでキーを無効にするので、ヒット率は書き込みの割合の 2 倍だけ、最大で半分下がります。無効化の合間には古いヒットがあり、TTL が 10 秒から 1 時間に伸びるにつれて書き込みの割合 1 単位あたり 0.5% から 10% です。',
    },
  },
  eras: [
    {
      name: 'ガレージ',
      question: '箱1つでどこまで行けるか。',
      arrivals: 'ページビューとAPI読み取り。',
    },
    {
      name: 'プレシード',
      question: 'データベースがボトルネックになると何が起きるか。',
      arrivals: '書き込みがデータベースを奪い合う。採用が始まる。インシデントが始まる。',
    },
    {
      name: 'シード',
      question: 'アプリサーバー1種類ですべての種別をさばけなくなると何が起きるか。',
      arrivals: '検索、アップロード、ボット。キュー、ワーカー、CDN、WAF。',
    },
    {
      name: 'シリーズA',
      question: 'ゾーンがまるごと落ちると何が起きるか。',
      arrivals:
        '動画、チャット、チェックアウト、入札。ゾーン、オートスケーリング、エラーバジェット。',
    },
    {
      name: 'シリーズB',
      question:
        'アナリティクスとAIが、チェックアウト向けに作られたデータベースを共有すると何が起きるか。',
      arrivals:
        'エクスポート、レポート、AIプロンプト。ウェアハウス、GPU、リトライ、サーキットブレーカー。',
    },
    {
      name: 'シリーズC',
      question: 'ユーザーが4つの大陸に住んでいると何が起きるか。',
      arrivals: 'フィード、Webhook、プッシュ通知。リージョン、GeoDNS、クォーラム、合意形成。',
    },
    {
      name: 'プレIPO',
      question: '会社が上場の準備を終えたと証明できるか。',
      arrivals: 'IPOチェックリスト。信頼性、SOC 2、DR訓練、データレジデンシー、40の法則。',
    },
    {
      name: '上場',
      question: '四半期ごとにガイダンスを上回れるか。',
      arrivals: '四半期、ガイダンス、市場の倍数。ゲームは終わらない。',
    },
  ],
  research: {
    stripe: {
      name: 'Stripe Billing',
      blurb: '決済は勝手に集まる。',
    },
    'dns-rr': {
      name: 'DNSラウンドロビン',
      blurb: 'DNSを解放。ユーザーを最大8台のホストに分散する。',
    },
    'load-balancing': {
      name: 'ロードバランシング',
      blurb: 'ロードバランサーを解放。容量で振り分け、死んだホストは飛ばす。',
    },
    'health-checks': {
      name: 'ヘルスチェック',
      blurb: 'DNSが死んだホストにユーザーを送らなくなる。',
    },
    'auth-provider': {
      name: 'マネージドID',
      blurb: '認証プロバイダを解放。ログインがCPUを食わなくなる。',
    },
    caching: {
      name: 'キャッシュ',
      blurb: 'Redisを解放。ほとんどの読み取りクエリがデータベースに届かない。',
    },
    pooling: {
      name: 'コネクションプーリング',
      blurb: 'PgBouncerを解放。アプリの接続が少数のデータベース接続を共有する。',
    },
    replication: {
      name: 'リードレプリカ',
      blurb: 'リードレプリカを解放。',
    },
    'eager-loading': {
      name: 'Eager loading',
      blurb: 'N+1クエリを修正。ORMフレームワークの読み取りクエリが3回ではなく1回になる。',
    },
    'query-analysis': {
      name: 'クエリ分析',
      blurb:
        'EXPLAINがインデックスのないクエリを見つける。インデックスはデータベースのカードから追加する。',
    },
    logs: {
      name: '構造化ログ',
      blurb: 'エラーを原因別に分ける。stranded、dropped、refused、down、stale、oom。',
    },
    metrics: {
      name: 'メトリクス',
      blurb: 'すべてのノードの履歴グラフ。',
    },
    percentiles: {
      name: 'パーセンタイル',
      blurb: '平均の隣にp50、p95、p99。平均がどれだけ隠しているかが見える。',
    },
    alerting: {
      name: 'アラート',
      blurb: 'エラー、p99、飽和がしきい値を超えたらページャーのバナー。',
    },
    funnels: {
      name: 'ファネル分析',
      blurb: 'サインアップの離脱箇所が見えて、直せる。ユーザー成長 +10%。',
    },
    'php-fpm': {
      name: 'PHP-FPM',
      blurb: 'Apacheのプロセスではなくワーカープール。プールサイズは自分で決める。',
    },
    opcache: {
      name: 'OPcache',
      blurb: 'PHPがリクエストごとにスクリプトをコンパイルしなくなる。CPU速度2.5×。',
    },
    'lang-ruby': {
      name: 'Ruby',
      blurb:
        'コアごとに1プロセス、それぞれ5スレッド。スレッドが待ちを重ね、GVLがCPUを1コアに留める。',
    },
    'lang-node': {
      name: 'Node.js',
      blurb:
        'イベントループは1つ。待ちは無料だが、使うコアも1つ。遅いリクエスト1つで他がすべて止まる。',
    },
    'lang-python': {
      name: 'Python',
      blurb:
        '同期ワーカーのプール。1ワーカーが1リクエスト。ワーカーあたりのメモリが増えたPHP-FPM。',
    },
    'node-cluster': {
      name: 'Node.jsクラスターモード',
      blurb: 'コアごとに1つのイベントループ。全コアを使うが、メモリと接続はコア数だけ増える。',
    },
    'libuv-pool': {
      name: 'libuvスレッドプール',
      blurb:
        'パスワードハッシュがイベントループの外に出て、ログインが他のリクエストを止めなくなる。',
    },
    'fw-laravel': {
      name: 'Laravel',
      blurb:
        '機能を速く出せる。バックグラウンド処理の開発工数 −20%。CPU 1.8×（ワーカーモードでは1.1×）で、Eloquentは1回で済む読み取りクエリを3回出す。',
    },
    'fw-rails': {
      name: 'Rails',
      blurb: '機能を速く出せる。ページビューの売上 +20%。CPU 1.5×とN+1クエリ。',
    },
    'fw-express': {
      name: 'Express',
      blurb: '最小限でどこにでもある。CPU 1.1×、ミドルウェアの乱立で技術的負債が10%速く増える。',
    },
    'fw-django': {
      name: 'Django',
      blurb:
        '機能を速く出せる。管理サイトがあるので社内ツールの開発工数 −30%。CPU 1.4×とN+1クエリ。',
    },
    'fw-symfony': {
      name: 'Symfony',
      blurb: '厳格な構造。調整 −30%、技術的負債の増え方は30%遅い。CPU 1.5×、N+1クエリなし。',
    },
    'fw-sinatra': {
      name: 'Sinatra',
      blurb: '軽い。CPU 1.1×。',
    },
    'fw-flask': {
      name: 'Flask',
      blurb: '軽い。CPU 1.1×。',
    },
    keepalive: {
      name: '接続の再利用',
      blurb: 'キープアライブ。内部呼び出しがTCPハンドシェイクを省き、1回あたり1 ms。',
    },
    gzip: {
      name: '圧縮',
      blurb: 'Gzip。ページビューとAPI読み取りの応答が70%小さくなり、CPUは10%増える。',
    },
    timeouts: {
      name: 'タイムアウトとリトライ',
      blurb: '各呼び出しのタイムアウトを1秒、5秒、30秒に設定し、失敗した呼び出しをリトライする。',
    },
    'lb-algorithms': {
      name: 'ロードバランシングアルゴリズム',
      blurb: '最小接続数とPower of two choices。',
    },
    ci: {
      name: '継続的デリバリー',
      blurb:
        'パイプラインのデプロイが30分ではなく5分になり、失敗したデプロイをロールバックできる。再作成とローリングも付いてくる。',
    },
    'blue-green': {
      name: 'ブルーグリーンデプロイ',
      blurb:
        'ブルーグリーン。新しいバージョンが古い隣に立ち上がるので、失敗したデプロイで壊れるのはリクエストの10%。',
    },
    canary: {
      name: 'カナリアデプロイ',
      blurb:
        'カナリア。トラフィックの5%が先に新バージョンに当たる。ブラストラディウスは最小、デプロイは最遅。',
    },
    'code-review': {
      name: 'コードレビュー',
      blurb: '機能の隠れたコストを出荷前に示す。デプロイ失敗 −20%。',
    },
    'testing-culture': {
      name: '自動テスト',
      blurb: 'パイプラインがデプロイ前にテストを回す。デプロイ失敗 −30%。',
    },
    'full-text-search': {
      name: '全文検索',
      blurb: '検索エンジンを解放。Postgresが検索を答えなくなる。',
    },
    'object-storage': {
      name: 'オブジェクトストレージ',
      blurb: 'オブジェクトストレージを解放。アップロードがPostgresに溜まらなくなる。',
    },
    'cache-strategies': {
      name: 'キャッシュ戦略',
      blurb: 'リードスルー、ライトスルー、ライトビハインド。負荷も書き込みもキャッシュが持つ。',
    },
    'lifecycle-rules': {
      name: 'ストレージライフサイクルルール',
      blurb: '古いオブジェクトは勝手に安いストレージクラスへ移る。',
    },
    retention: {
      name: '保持ポリシー',
      blurb:
        'データベースが古い行をアーカイブするか削除する。ストレージは安く、レポートは遅くなる。',
    },
    cdn: {
      name: 'コンテンツ配信',
      blurb: 'CDNを解放。ページがエッジで返り、エグレスが安くなる。',
    },
    waf: {
      name: 'Webアプリケーションファイアウォール',
      blurb: 'WAFを解放。ボットを止める。ついでに本物のユーザーも少し止める。',
    },
    'api-gateway': {
      name: 'APIゲートウェイ',
      blurb: 'APIゲートウェイを解放。すべてのAPI呼び出しをレート制限する1つの入口。',
    },
    websockets: {
      name: 'WebSocket',
      blurb: 'リアルタイムハブを解放。リアルタイムのメッセージに必要な接続を保持し続ける。',
    },
    'background-jobs': {
      name: 'バックグラウンドジョブ',
      blurb: 'ワーカーを解放。リクエストの経路から外れて自分のコードが動く。',
    },
    queues: {
      name: 'メッセージキュー',
      blurb: 'キューを解放。アプリサーバーが遅い処理をワーカーに渡す。',
    },
    'stampede-protection': {
      name: 'スタンピード対策',
      blurb: '空のキャッシュがミスをまとめるので、温まる間もデータベースが持ちこたえる。',
    },
    'cache-warming': {
      name: 'キャッシュウォーミング',
      blurb: '再起動から戻ったキャッシュはほぼ温まっている。',
    },
    'lang-go': {
      name: 'Go',
      blurb:
        '全コアでゴルーチン。待つコストはワーカー1本ではなく数KB。ヒープが埋まるとGCがCPUを取る。',
    },
    'lang-java': {
      name: 'Java',
      blurb:
        'JVMは1つ、全コアで200スレッド。速度30%で起動し、30秒かけて温まる。待つリクエストはそれぞれスレッドを占有する。',
    },
    'lang-csharp': {
      name: 'C#',
      blurb: '全コアで.NETのasync。待ちはスレッドを占有しない。JITのウォームアップはJVMより短い。',
    },
    'fw-gin': {
      name: 'Gin',
      blurb: '軽いルーター。CPU 1.05×。',
    },
    'fw-spring-boot': {
      name: 'Spring Boot',
      blurb: '大きなチーム向けの構造。調整 −30%。CPU 1.3×、メモリ +200 MB、起動は15秒遅い。',
    },
    'fw-aspnet': {
      name: 'ASP.NET Core',
      blurb: '速くて完備。CPU 1.05×。',
    },
    tracing: {
      name: '分散トレーシング',
      blurb: 'リクエスト種別ごとの時間をノード単位で。各種別の一番遅いホップを名指しする。',
    },
    'trace-search': {
      name: 'トレース検索',
      blurb: '研究が25%速くなる。',
    },
    notebooks: {
      name: 'ノートブック',
      blurb: '研究が25%速くなる。',
    },
    'cert-automation': {
      name: '証明書の自動化',
      blurb: '証明書が期限切れの前に自ら更新される。',
    },
    'lang-elixir': {
      name: 'Elixir',
      blurb:
        '全コアでプリエンプティブなプロセス。リクエストが他のリクエストを止めず、プロセスごとにGCが動く。CPUは遅い。',
    },
    'lang-rust': {
      name: 'Rust',
      blurb:
        '全コアでasyncタスク、GCなし、メモリはわずか。CPU負荷の高いタスクはワーカースレッドを1つ塞ぐ。',
    },
    'lang-zig': {
      name: 'Zig',
      blurb:
        '明示的なアロケータとGCなしのネイティブコード。64スレッドのサーバーは全コアを使うが、待つリクエストはそれぞれスレッドを占有する。永続状態はリークしうる。',
    },
    'lang-haskell': {
      name: 'Haskell',
      blurb:
        'Warpが軽量なGHCスレッドを全コアで回す。生産性の高い専門家が採れるが、ビルドと採用は遅い。I/Oの待ちはOSスレッドを占有せず、共有ヒープのGCがポーズとCPUコストを足す。',
    },
    'fw-phoenix': {
      name: 'Phoenix',
      blurb: 'LiveViewのページは売上 +30%。CPU 1.1×。',
    },
    checkout: {
      name: 'チェックアウト',
      blurb: '決済プロバイダとチェックアウト機能を解放。',
    },
    'tiered-caching': {
      name: '階層キャッシュ',
      blurb: 'CDNのエッジがオリジンより先にリージョンの階層に聞く。動画の92%がエッジから出る。',
    },
    'multi-az': {
      name: 'マルチゾーン',
      blurb: 'ノードを3つのゾーンに置き、データ系のノードには別ゾーンの待機系を持たせる。',
    },
    autoscaling: {
      name: 'オートスケーリング',
      blurb: 'オートスケーラーを解放。アプリサーバーやワーカーのコピーが負荷に追従する。',
    },
    containers: {
      name: 'コンテナオーケストレーション',
      blurb: 'Kubernetesクラスターを解放。支出 −15%、スケールは30秒。',
    },
    serverless: {
      name: 'サーバーレス',
      blurb: 'サーバーレス関数を解放。リクエストごとに自分のコードが動き、箱代はかからない。',
    },
    'reserved-instances': {
      name: 'リザーブドインスタンス',
      blurb: 'リザーブド料金。カレンダー1週間のコミットで0.6×。',
    },
    'spot-instances': {
      name: 'スポットインスタンス',
      blurb: 'スポット料金。プロバイダがノードを回収するまで0.3×。',
    },
    'slo-dashboards': {
      name: 'SLOダッシュボード',
      blurb: 'エラーバジェットをHUDに。',
    },
    'error-budgets': {
      name: 'エラーバジェット',
      blurb: '予算が残っていればチームが10%速くなる。使い切ると機能の出荷が半分の速度になる。',
    },
    'backoff-jitter': {
      name: 'バックオフとジッター',
      blurb: 'リトライが待って散らばる。増える呼び出しは10%まで。',
    },
    'circuit-breakers': {
      name: 'サーキットブレーカー',
      blurb: '呼び出しの半分が失敗すると、リンクは5秒間呼び出しを止めてから試し直す。',
    },
    'load-shedding': {
      name: '優先度付きロードシェディング',
      blurb: '飽和したアプリサーバーは価値の低い種別から落とす。',
    },
    'idempotency-keys': {
      name: '冪等キー',
      blurb: 'リトライした課金が二重に課金されることはない。',
    },
    'ryw-routing': {
      name: 'read-your-writesルーティング',
      blurb: '書き込み直後の読み取りをアプリサーバーがプライマリへ送れる。',
    },
    'gogc-tuning': {
      name: 'Go GCチューニング',
      blurb: 'GOGC 50、100、200。メモリを減らしてGCのCPUを増やすか、その逆か。',
    },
    'fw-axum': {
      name: 'Axum',
      blurb: 'TokioとTowerの上に載っている。CPUの上乗せなし。',
    },
    'fw-actix': {
      name: 'Actix Web',
      blurb: 'ベンチマークで最速級。CPU 0.95×。',
    },
    zgc: {
      name: 'ZGC',
      blurb:
        'Javaのポーズが30 msではなく1 ms。代わりにスループットを10%手放し、メモリを15%多く使う。',
    },
    'data-warehouse': {
      name: 'データウェアハウス',
      blurb: 'データウェアハウスを解放。レポートがプライマリをスキャンしなくなる。',
    },
    'event-streaming': {
      name: 'イベントストリーミング',
      blurb:
        'イベントストリームを解放。メッセージを保持するログなので、コンシューマーが再生できる。',
    },
    embeddings: {
      name: 'エンベディング',
      blurb:
        'ベクトルインデックスを解放。AIの回答は自分のドキュメントを使い、Pythonのボーナスも残る。',
    },
    'hosted-models': {
      name: 'ホスト型モデル',
      blurb: 'LLM APIを解放。GPUなしでAIプロンプトを処理し、トークン単位で払う。',
    },
    'model-serving': {
      name: 'モデルサービング',
      blurb: 'GPUノードを解放。回り続けていれば、AIプロンプトのトークン単価が下がる。',
    },
    pitr: {
      name: 'ポイントインタイムリカバリ',
      blurb: 'データベースのバックアップ。夜間スナップショット、またはRPO数分のWALアーカイブ。',
    },
    'tls-everywhere': {
      name: '全通信のTLS化',
      blurb: '内部のリンクをすべて暗号化する。SOC 2に必須。',
    },
    http2: {
      name: 'HTTP/2',
      blurb: '1つの接続が多数のリクエストを運ぶ。ページビューのユーザーホップ −15%。',
    },
    'sync-replication': {
      name: '同期レプリケーション',
      blurb: '書き込みがレプリカを待つ。合意形成に必須。',
    },
    'restore-drills': {
      name: 'リストア訓練',
      blurb: 'バックアップが試されるので、いざという時にリストアが効く。',
    },
    'dependency-scanning': {
      name: '依存関係スキャン',
      blurb: 'ビルドのたびにライブラリの既知の穴を調べる。SOC 2に必須。',
    },
    sharding: {
      name: 'シャーディング',
      blurb: 'データをキーでノードに振り分ける。',
    },
    'encryption-at-rest': {
      name: '保存データの暗号化',
      blurb: 'ディスクとバックアップが暗号化される。SOC 2に必須。',
    },
    'multi-region': {
      name: 'マルチリージョン',
      blurb: '別の大陸にリージョンを開く。リージョンごとにタブが1つ。',
    },
    'geo-dns': {
      name: 'GeoDNS',
      blurb: 'ユーザーは自分のリージョンへ、なければ生きている最寄りへ。',
    },
    'infra-as-code': {
      name: 'Infrastructure as Code',
      blurb: 'IaCツールを選ぶ。リージョンを別リージョンにミラーし、プランを適用して同期を保つ。',
    },
    gitops: {
      name: 'GitOps',
      blurb: 'ミラーが自分で同期する。一括でも段階的でも。',
    },
    anycast: {
      name: 'エニーキャスト',
      blurb: 'どこでもユーザーホップ −20 ms。',
    },
    'document-db': {
      name: 'ドキュメントデータベース',
      blurb: 'ドキュメントストアを解放。スキーママイグレーションはなく、joinもない。',
    },
    'edge-compute': {
      name: 'エッジコンピューティング',
      blurb: 'エッジ関数を解放。ユーザーの隣で動く小さなハンドラー。',
    },
    http3: {
      name: 'HTTP/3',
      blurb: '遠いユーザーのユーザーホップ −20%。',
    },
    notifications: {
      name: '通知',
      blurb: 'プッシュプロバイダを解放。',
    },
    'hybrid-fanout': {
      name: 'ハイブリッドファンアウト',
      blurb: '普通のアカウントにはプッシュ、有名人にはプル。キャッシュがホットキーを分割する。',
    },
    leaderless: {
      name: 'リーダーレスレプリケーション',
      blurb: 'クォーラムを調整できるワイドカラムストアを解放。',
    },
    consensus: {
      name: '合意形成データベース',
      blurb: '分散SQLを解放。',
    },
    'dr-drills': {
      name: '災害復旧訓練',
      blurb: 'IPOチェックリスト用のDR訓練を回す。',
    },
    soc2: {
      name: 'SOC 2プログラム',
      blurb: 'IPOチェックリストの項目。',
    },
    'gdpr-residency': {
      name: 'データレジデンシー管理',
      blurb: 'IPOチェックリストの項目。EUのユーザーはEUのリージョンから配信する。',
    },
    'security-team': {
      name: 'セキュリティチーム',
      blurb: 'IPOチェックリストの項目。監査の指摘は、何かがリセットされる前に直る。',
    },
    'investor-relations': {
      name: '投資家対応',
      blurb: '評価額の倍数 +2。',
    },
    'guidance-modeling': {
      name: 'ガイダンスモデリング',
      blurb: '各ガイダンス水準を上回る確率が見える。',
    },
    'php-jit': {
      name: 'PHP JIT',
      blurb:
        'PHP 8のJIT。Web系の種別でCPU 1.05×、CPU負荷の高い種別で1.6×。ページビューとAPI読み取りにはほとんど効かない。',
    },
    'worker-threads': {
      name: 'Node.jsワーカースレッド',
      blurb:
        '4つのワーカースレッド（40 MB）のプールが、CPU負荷の高い種別をイベントループから外す。',
    },
    yjit: {
      name: 'YJIT',
      blurb: 'RubyのJIT。CPU仕事1.3×、メモリは20%増。',
    },
    gevent: {
      name: 'gevent',
      blurb:
        'グリーンスレッドがプロセスあたり多くのI/O待ちを抱えるので、遅いデータベースがワーカーを占有しなくなる。モンキーパッチはライブラリを壊しうる。接続1本あたり30 KB。',
    },
    asgi: {
      name: 'ASGI + Uvicorn',
      blurb:
        'Node.jsと同じasyncで、CPUは遅い。ブロッキング呼び出しがループを止める。リアルタイム接続は設計どおり1本30 KBで保持できる。',
    },
    'php-worker-mode': {
      name: 'PHPワーカーモード',
      blurb:
        'FrankenPHP、RoadRunner、Octane。アプリは1回だけ起動するので、フレームワークのリクエストごとのオーバーヘッドが消える。シェアードナッシングを失い、メモリリークと状態の混線が起こりうる。',
    },
    swoole: {
      name: 'Swoole',
      blurb:
        'イベントループ上のコルーチン、Node.jsのような非同期I/O、リクエストごとのフレームワークのオーバーヘッドなし。ブロッキング拡張がループを止める。リアルタイム接続は1本20 KBで保持できる。',
    },
    bun: {
      name: 'Bun',
      blurb:
        'より速いイベントループと即時起動。だからNode.jsよりオートスケールもデプロイも上手い。60 MBで起動時間なし。成熟度は低く、Node.jsで動くパッケージが壊れることもある。',
    },
    deno: {
      name: 'Deno',
      blurb:
        'パーミッションがサプライチェーン攻撃のほとんどを防ぐ。代わりに機能開発は10%遅く、互換パッケージは少ない。イベントループはNode.jsと同じ。',
    },
    falcon: {
      name: 'Falcon',
      blurb:
        'ファイバーがプロセスあたり多くのアイドル接続を抱える。ブロックするgemはループを止める。接続1本あたり100 KB。',
    },
    pypy: {
      name: 'PyPy',
      blurb:
        'JITウォームアップ後、純PythonのCPUはGunicornの3倍。C拡張の対応が弱く、MLエコシステムのボーナスは得られない。ワーカーあたり200 MB。',
    },
    'virtual-threads': {
      name: 'Java仮想スレッド',
      blurb:
        '待ちがプラットフォームスレッドを占有しなくなり、遅いデータベースはレイテンシを足すだけになる。ネイティブ（JNI）呼び出しはキャリアを固定したままで、JVMは相変わらず30秒かけて温まる。リアルタイム接続は1本10 KB。',
    },
    webflux: {
      name: 'Spring WebFlux',
      blurb:
        'プロセスあたり1つのループで非常に高い並行性。ただし開発とデバッグは20%遅い。ブロッキング呼び出しがループを止め、JVMは相変わらずウォームアップする。400 MB。',
    },
    fasthttp: {
      name: 'fasthttp',
      blurb:
        'net/httpより25%速いが、機能開発は10%遅い。APIは標準ではなく、一部のミドルウェアは動かず、HTTP/2もない。',
    },
    'spawn-blocking': {
      name: 'Tokioブロッキングプール',
      blurb:
        'CPU負荷の高い種別がブロッキングプールに移り、Tokioのタスクがワーカースレッドを止めなくなる。',
    },
    'graal-native': {
      name: 'GraalVMネイティブイメージ',
      blurb:
        '100 ms未満で、ウォームアップなしに起動する。メモリはJVMの60%、速度は0.80×、ビルドは3倍長い。Tomcatのように接続ごとに1スレッド。サーバーレス関数に向く。',
    },
    'native-aot': {
      name: '.NET Native AOT',
      blurb:
        'JITがないので最初から全速で起動し、より小さい。100 MB。速度は0.90×で、リフレクションの多いライブラリには開発工数がかかる。',
    },
    'distributed-erlang': {
      name: '分散Erlang',
      blurb:
        'BEAMのリアルタイムハブが標準のpub/subだけでクラスタを組む。別のバックボーンは要らない。分断が起きると脳が割れる。',
    },
    nifs: {
      name: 'NIF',
      blurb:
        'ネイティブコードでElixirのCPU負荷の高い種別が3×速くなる。NIFはプリエンプトされず、1つのクラッシュがVMごと持っていく。',
    },
    jemalloc: {
      name: 'jemalloc',
      blurb: '長時間動くRustサービスで断片化が減る。CPU 1.05×、起動時のメモリは5%増。',
    },
    'free-threading': {
      name: 'フリースレッドPython',
      blurb:
        '全コアで本当に並列なスレッド。スレッドあたり10%遅く、接続ごとにスレッドを立てるのは安くない。対応していないC拡張は開発工数がかかる。8スレッド、接続1本あたり100 KB。',
    },
    'fw-fastapi': {
      name: 'FastAPI',
      blurb:
        'Pydanticによる検証と、モデルをつなぐのに最良のエコシステム。AIプロンプトの売上 +15%。CPU 1.15×、ASGIサーバーでしか動かない。10 MB。',
    },
    'fw-fastify': {
      name: 'Fastify',
      blurb: 'スキーマベースのシリアライズ。読み取りのCPU −20%。自身のオーバーヘッドはなし。5 MB。',
    },
    'fw-nextjs': {
      name: 'Next.js',
      blurb:
        'サーバーレンダリングとインクリメンタル静的再生成。ページの売上 +50%、CPUはその1.6×、そのうち40%はCDNが返せる。プロセスあたり30 MB。',
    },
    'fw-nestjs': {
      name: 'NestJS',
      blurb: '大きなチーム向けの構造。調整 −30%。CPU 1.3×、プロセスあたり20 MB。',
    },
    'fw-fiber': {
      name: 'Fiber',
      blurb: 'fasthttpの上のExpress風API。CPUの上乗せはなく、HTTP/2もない。5 MB。',
    },
    'fw-quarkus': {
      name: 'Quarkus',
      blurb:
        'ネイティブイメージ向けに作られている。GraalVMのビルドが半分の時間で済む。CPU 1.1×、プロセスあたり100 MB。',
    },
    'fw-hono': {
      name: 'Hono',
      blurb: 'Web標準の上の小さなルーター。CPUの追加負荷はありません。プロセスあたり2 MB。',
    },
    'fw-elysia': {
      name: 'Elysia',
      blurb:
        'Bun向けで、型がサーバーからクライアントまで検査されます。技術的負債の増加が15%遅くなります。CPUの追加負荷はありません。プロセスあたり5 MB。',
    },
    'fw-koa': {
      name: 'Koa',
      blurb: 'Expressの後継で、async関数の上に作られています。CPU1.05×、プロセスあたり5 MB。',
    },
    'fw-adonis': {
      name: 'AdonisJS',
      blurb:
        'Laravelの考え方をNode.jsに。機能を素早く出荷できます。CPU1.4×、プロセスあたり25 MB、Lucid ORMはN+1クエリを発生させます。',
    },
    'fw-codeigniter': {
      name: 'CodeIgniter',
      blurb: '邪魔をしない小さなPHPフレームワーク。CPU1.1×、プロセスあたり4 MB。',
    },
    'fw-sanic': {
      name: 'Sanic',
      blurb: '根本から非同期。CPU1.05×、プロセスあたり10 MB。',
    },
    'fw-rocket': {
      name: 'Rocket',
      blurb:
        '型安全なルーティングで定型コードが少なく、Rustで最も速く書けます。CPU1.05×、プロセスあたり3 MB。',
    },
    'fw-jetzig': {
      name: 'Jetzig',
      blurb:
        'ファイルベースのルーティング、テンプレート、データベース、バックグラウンドジョブを一つの箱に。機能を素早く出荷できます。CPU1.3×、プロセスあたり25 MB、若いツールチェーン上で動作します。',
    },
    'fw-tokamak': {
      name: 'Tokamak',
      blurb:
        'http.zig上の依存性注入コンテナ。明示的な配線が調整と技術的負債を減らします。CPU1.05×、プロセスあたり5 MB、エコシステムは小さめです。',
    },
    'fw-servant': {
      name: 'Servant',
      blurb:
        'APIの型が契約になります。ルーティング、クライアント、ドキュメントがそこから導かれ、チームの調整とドリフトが減ります。CPU1.0×、プロセスあたり2 MB、型レベルの学習曲線があります。',
    },
    'fw-ihp': {
      name: 'IHP',
      blurb:
        'バッテリー同梱。コード生成、型安全なクエリビルダー、組み込みのジョブキューを備えます。CPU1.3×、プロセスあたり40 MBで機能を素早く出荷できますが、Nixベースのツールチェーンです。',
    },
    'build-cache': {
      name: 'ビルドキャッシュ',
      blurb: 'ビルド成果物と依存関係の共有キャッシュ。すべてのStackのビルドが25%速くなります。',
    },
    'dev-environment': {
      name: '再現可能な開発環境',
      blurb:
        '一つのコンテナがすべてのコンパイラとツールを固定します。新入社員は半分の立ち上がり時間で全力になります。',
    },
    'static-analysis': {
      name: '静的解析',
      blurb:
        'リンターと型チェッカーがすべての変更を出荷前に検査します。悪いデプロイが20%減ります。',
    },
    'formal-verification': {
      name: '形式検証',
      blurb:
        '証明とプロパティベーステストがテストの届かないバグを捕まえます。悪いデプロイが50%減る代わりに、機能ごとの開発時間が15%増えます。',
    },
    cdc: {
      name: '変更データキャプチャ',
      blurb: 'CDCコネクターを解放。コピーが書き込みログを追い、二度目の書き込みなしで済む。',
    },
    'service-boundaries': {
      name: 'サービスの境界',
      blurb:
        'サービスを分割する。自前のチーム、自前のデプロイ、自前のブラストラディウスを持つ新しいコードベースになる。',
    },
    'service-mesh': {
      name: 'サービスメッシュ',
      blurb:
        'サービスメッシュを解放。すべてのリンクにリトライ、サーキットブレーカー、メトリクスが付く。',
    },
    'feature-flags': {
      name: 'フィーチャーフラグ',
      blurb:
        'フィーチャーフラグを解放。機能が一部のユーザーだけに届き、失敗したデプロイも一緒に届く。',
    },
    'secrets-management': {
      name: 'シークレット管理',
      blurb: '鍵は保管庫に置かれ、フィッシングページが盗むものはなくなる。',
    },
    'spam-filter': {
      name: 'スパムフィルター',
      blurb:
        '受信箱にフィルターが付き、スパムを専用フォルダに分ける。たまに本物の手紙も一緒に分ける。',
    },
    'on-call': {
      name: 'オンコールローテーション',
      blurb: 'ローテーションがページに応答するので、インシデントは数分で認知される。',
    },
    runbooks: {
      name: 'ランブック',
      blurb: 'チームが経験したインシデント種別のランブックを書くと、その種別は自然に解決する。',
    },
    'sre-team': {
      name: 'SREチーム',
      blurb: 'SREチームを解放。MTTR −40%、未完了のアクションアイテムの重みが半分になる。',
    },
    'enterprise-sales': {
      name: 'エンタープライズ営業',
      blurb: 'SLAを結ぶ。可用性を1週間守れなければ顧客にクレジットを返す。',
    },
    'online-migrations': {
      name: 'オンラインスキーママイグレーション',
      blurb: '大きなテーブルをロックせずに変更するので、マイグレーション中も書き込みが流れ続ける。',
    },
    'leap-smearing': {
      name: 'リープスミアリング',
      blurb: 'うるう秒を1日じゅうに薄く広げ、時計が飛ばず、リースが早く切れることもない。',
    },
    'ab-testing': {
      name: 'A/Bテスト',
      blurb: 'フラグで除外したユーザーと比べて機能のリフトを信頼区間つきで測る。',
    },
    'hiring-pipeline': {
      name: '採用パイプライン',
      blurb: 'リクルーターがパイプラインを温めておくので、採用にかかる期間が30%短くなる。',
    },
    'trunk-based': {
      name: 'トランクベース開発',
      blurb: '小さな変更が1日に何度も1本のブランチに入り、チームの出荷回数が50%増える。',
    },
    'platform-team': {
      name: 'プラットフォームチーム',
      blurb:
        'プラットフォームチームを解放。クラスターとパイプラインを回し、デプロイ時間を半減させる。',
    },
    'data-team': {
      name: 'データチーム',
      blurb:
        'データチームを解放。レポートとAI機能のコストが30%減り、パイプラインの遅れも半分になる。',
    },
    'l4-lb': {
      name: 'L4ロードバランシング',
      blurb:
        'ロードバランサーがHTTPを読まずにTCPを転送する。スループットは10倍、ホップは5分の1、しかも安い。ただし種別ごとのルーティングもリトライもない。',
    },
    'rate-limiting': {
      name: 'レート制限',
      blurb:
        'ゲートウェイのトークンバケット。バケット分のバーストは丸ごと通り、長期的な平均は制限に収まる。',
    },
    esi: {
      name: 'Edge Side Includes',
      blurb:
        'CDNがログイン後のページの共通部分をキャッシュし、個人向けの部分はエッジで埋める。ページビューのヒットが20%増える。',
    },
    'bot-management': {
      name: 'ボット管理',
      blurb:
        '怪しいクライアントを問答無用で止めず、チャレンジを出すWAF。同じだけボットを止め、本物のユーザーをボットと間違えにくい。',
    },
    'scheduled-scaling': {
      name: 'スケジュールスケーリング',
      blurb:
        'オートスケーラーが毎日の既知のピークの前にコピーを増やすので、ピークが来た時には温まっている。',
    },
    'arm-instances': {
      name: 'ARMインスタンス',
      blurb: 'ARMインスタンスファミリーを解放。汎用と同じvCPUとRAMが0.8×の価格で。',
    },
    quantization: {
      name: '量子化',
      blurb: 'GPUノードがINT8かINT4の重みで動く。速くて小さく、答えの価値は5%か15%下がる。',
    },
    'continuous-batching': {
      name: 'continuous batching',
      blurb:
        'GPUノードが届いた順にプロンプトをバッチにまとめるので、バッチを大きくしても最初のトークンまでの時間は増えずにスループットが上がる。',
    },
    bulkheads: {
      name: 'バルクヘッド',
      blurb:
        'リンクが、1つの依存先に渡す呼び出し元の枠に上限をかける。遅い依存先は自分の呼び出しを落とし、残りは動き続ける。',
    },
    'graceful-degradation': {
      name: 'グレースフルデグラデーション',
      blurb:
        '飽和したアプリサーバーが高コストな種別から順に切るので、安い種別はレイテンシを保ち、高い種別は早く失敗する。',
    },
    'hedged-requests': {
      name: 'ヘッジリクエスト',
      blurb:
        'リンクがp95を超えた呼び出しの2通目を送り、速い方の答えを残す。テールが縮み、呼ばれる側は呼び出しが10%増える。',
    },
    'chaos-engineering': {
      name: 'カオスエンジニアリング',
      blurb:
        '定期的な実験が一番弱いノードを数秒落とし、そのノードを名指しする。失敗インサイトが手に入り、設計が生き延びることが示せる。',
    },
    denormalization: {
      name: '非正規化',
      blurb: 'データベースが結合済みのコピーを持つ。読み取りのCPU −30%、書き込みは1回ごとに+20%。',
    },
    precompute: {
      name: 'マテリアライズドビュー',
      blurb:
        'データベースが保存したビューからレポートを返す。スキャンのCPUは半分、数字はリフレッシュした時点のもの。',
    },
    'binary-rpc': {
      name: 'サービス間バイナリRPC',
      blurb:
        'サービスが呼び出しをテキストではなくバイナリでシリアライズする。バックエンド呼び出しのシリアライズCPUが半分になる。',
    },
    outbox: {
      name: 'トランザクショナルアウトボックス',
      blurb:
        '書き込みとそのイベントが同じトランザクションに収まり、リレーが配信する。配信に失敗してもコピーがずれない。',
    },
    'expand-contract': {
      name: 'Expand/Contract',
      blurb:
        'スキーマ変更が新しい形を足し、バックフィルし、古い形を落とす。テーブルロックを取らないので、マイグレーションが書き込みを止めることはない。',
    },
    profiling: {
      name: '継続的プロファイリング',
      blurb: '各ノードを制限しているリソースを名指しする。CPU、ワーカー、メモリ、接続、ディスク。',
    },
    'tail-sampling': {
      name: 'テールベースサンプリング',
      blurb: '遅いトレースと失敗したトレースを残す。失敗インサイトが2倍。',
    },
    rum: {
      name: 'リアルユーザーモニタリング',
      blurb: 'ユーザー側から見たレイテンシをデバイス別に。デスクトップ、モバイル、タブレット。',
    },
    'anomaly-detection': {
      name: '異常検知',
      blurb: '明日のピークトラフィックを予測し、インシデントがピークになる前に警告する。',
    },
    'credential-protection': {
      name: 'クレデンシャルスタッフィング対策',
      blurb: 'クレデンシャルスタッフィングのボットの波を、ログインに届く前にほとんど止める。',
    },
    'pen-testing': {
      name: 'ペネトレーションテスト',
      blurb: 'カレンダーで1週間ごとに、設計の一番弱いインシデント種別を明かす。',
    },
    rightsizing: {
      name: 'ライトサイジングレポート',
      blurb: 'ピーク時に使用率30%未満のノードに印を付けるので、大きすぎる箱が見つけやすい。',
    },
    'egress-optimization': {
      name: 'エグレス最適化',
      blurb: 'R2の価格設定のオブジェクトストレージ。インターネットへのエグレスはかからない。',
    },
    'unit-economics': {
      name: 'ユニットエコノミクス',
      blurb: '処理したリクエスト1件あたりのコストを、リクエスト種別ごとに。',
    },
    'cost-allocation': {
      name: 'コスト配賦',
      blurb: 'サービスごと、チームごとのコスト。各サービスが持つノードから算出する。',
    },
    'savings-plans': {
      name: 'Savings Plans',
      blurb:
        'すべてのコンピュートノードの支出が20%引き。オンデマンドでも対象で、ノードごとのコミットは不要。',
    },
  },
  researchTracks: {
    infrastructure: { label: 'インフラ' },
    data: { label: 'データ' },
    reliability: { label: '信頼性' },
    observability: { label: '可観測性' },
    performance: { label: 'パフォーマンス' },
    runtimes: { label: 'ランタイム' },
    frameworks: { label: 'フレームワーク' },
    security: { label: 'セキュリティ' },
    product: { label: 'プロダクト' },
    cost: { label: 'コスト' },
  },
}
