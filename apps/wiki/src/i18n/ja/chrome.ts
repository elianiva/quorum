import type { Messages } from '../messages.ts'

/* The wiki's interface copy in Japanese. Game nouns follow `apps/web/src/i18n/ja` and the
   Japanese catalog: 設計, ボード, ノード, リンク, コンポーネント, 会社, 資金, 売上, 支出,
   ユーザー, 時代, リサーチ, 研究, インサイト, インシデント, サンドボックス, ガレージ,
   プレシード, シード, 事業, レガシー, ミューテーター, エグジット, 実績, 練習, チーム. */

type Chrome = Omit<Messages, 'islands' | 'options' | 'reference'>

export const chrome: Chrome = {
  site: {
    name: 'Quorum Wiki',
    title: (page) => `${page} · Quorum Wiki`,
    notFoundTitle: '見つかりません · Quorum Wiki',
    description: 'Quorum の仕組み。',
    ogImageAlt: 'Quorum Wiki のカード。すべてのコンポーネントの仕組みと、設計が壊れる理由。',
  },
  header: {
    openMenu: 'メニューを開く',
    closeMenu: 'メニューを閉じる',
    github: 'GitHub の Quorum',
    play: 'プレイ',
    sections: 'セクション',
    wordmarkWiki: 'Wiki',
    language: '言語',
    theme: 'ライトモードとダークモードを切り替える',
    switchTo: (name) => `「${name}」でこのページを読みます`,
  },
  quadrants: {
    play: { label: 'ゲームをプレイ', purpose: '操作を覚える' },
    tutorials: { label: 'チュートリアル', purpose: '遊びながら覚える' },
    guides: { label: 'ハウツーガイド', purpose: '問題を解決する' },
    explanation: { label: '解説', purpose: '理由を理解する' },
    patterns: { label: 'パターン', purpose: '設計パターンを覚える' },
    reference: { label: 'リファレンス', purpose: '事実を調べる' },
    design: { label: '設計', purpose: '設計ドキュメントを読む' },
    about: { label: 'この Wiki について', purpose: 'Wiki そのもの' },
  },
  sidebar: {
    collapse: (name) => `${name}を折りたたむ`,
    expand: (name) => `${name}を展開する`,
  },
  toc: { onThisPage: 'このページの内容' },
  prose: { linkToSection: 'このセクションへのリンク' },
  article: {
    seeAlso: '関連項目',
    editOnGitHub: 'GitHub でこのページを編集',
    designNotes: '設計ノート',
    support: 'Ko-fi で Quorum を支援',
    disclaimerLead: 'Quorum はゲームであり、実際のシステムを意図的に単純化しています。決める前に',
    disclaimerLink: '本物を確かめます',
    disclaimerMid: '。これは毎週変わるので、このページはゲームより遅れることがあります。',
    changelogLink: '変更履歴を見る',
    era: (index, name) => `時代 ${index} · ${name}`,
    spoilerAbout: (era) => `このページは${era}時代についてです。`,
    spoilerHidden: '後の時代を隠す設定です。それでも表示します。',
    untranslated: 'このページはまだ日本語に翻訳されていません。',
    notFound: {
      heading: 'ここにページはありません',
      body: (path) => `${path} には何もありません。検索するか、ホームページから始めます。`,
      home: 'ホームページへ',
    },
  },
  home: {
    heroTitle: 'Quorum Wiki',
    start: '最初の会社を始める',
    browse: 'コンポーネントを見る',
    openSource: 'GitHub でオープンソース',
    counts: {
      components: 'コンポーネント',
      research: 'リサーチ項目',
      eras: '時代',
      incidents: 'インシデント',
      sandboxes: 'サンドボックス',
      terms: 'エンジニアリング用語',
    },
    trouble: {
      title: '何かがうまくいっていないとき',
      lead: 'ゲームで目にする症状から始めます。',
    },
    guided: {
      title: 'ガイド付きの道筋',
      lead: 'レッスンからアイデアへ、アイデアからレシピへと進む読み方の順番。',
    },
    kinds: {
      title: '種類から探す',
      lead: '6 種類のページがあり、それぞれ別の用途に応えます。',
    },
    open: {
      title: 'オープンソース',
      lead: 'ゲーム、シミュレーション、この Wiki は 1 つのリポジトリを共有しています。',
    },
    footer: {
      before: 'ゲームの裏にあるルール、数式、未解決の問いを知りたいときは、',
      design: '設計',
      afterDesign: 'ドキュメントを読むか、',
      changelog: '今週の変更点',
      afterChangelog:
        'を確認します。Quorum はゲームであり、実際のシステムを意図的に単純化しています。',
      disclaimer: 'それが何を意味するのか',
      afterDisclaimer: 'を確かめてから行動します。ゲームが役に立ったら、',
      kofi: 'Ko-fi で支援します',
      end: '。',
    },
  },
  paths: {
    play: {
      title: 'ゲームをプレイ',
      summary: 'Quorum の操作と画面を、最初の会社から最初の数分まで学びます。',
    },
    'scaling-steps': {
      title: 'システムを段階的にスケールする',
      summary:
        '1 台の箱から複数リージョンまで、システムを 1 ステップずつ組み立て、各設定を説明します。',
    },
    'first-steps': {
      title: '最初の一歩',
      summary: '最初の会社を、ガレージから最初のインシデントと最初の研究までプレイします。',
    },
    'read-the-numbers': {
      title: '数字を読む',
      summary: 'レイテンシ、キュー、Apdex、インサイトが何を語るか、それにどう動くか。',
    },
    'scale-up': {
      title: 'スケールアップ',
      summary:
        '1 台の箱を超えて広げます。データ層、スパイク、リトライ、そしてより多くのリージョン。',
    },
    'run-the-company': {
      title: '会社を経営する',
      summary: 'お金、チーム、時代、そして会社を気持ちよく終える方法。',
    },
  },
  pathNav: {
    stepTitle: (step, title) => `${step}. ${title}`,
    stepLabel: (step, title) => `ステップ ${step}：${title}`,
    guidedPath: (title) => `ガイド付きの道筋：${title}`,
    path: (title) => `道筋：${title}`,
    place: (index, count) => `${index} / ${count}`,
    next: '次へ',
    nextPath: (title) => `次の道筋：${title}`,
    start: '始める',
    continue: '続ける',
    again: 'もう一度読む',
  },
  groups: {
    Cost: { name: 'コスト', blurb: '使った分だけ払い、ユーザー 1 人あたりのコストを知ります。' },
    'Deploys and change': {
      name: 'デプロイと変更',
      blurb: 'システムを止めずにリリースし、移行します。',
    },
    Foundations: {
      name: '基礎',
      blurb: 'ほかのすべてが寄りかかる語彙。レイテンシ、可用性、CAP、テール。',
    },
    'Messaging and async': {
      name: 'メッセージングと非同期',
      blurb: 'キュー、ストリーム、そして両者の間の保証。',
    },
    'Operate and observe': {
      name: '運用と可観測性',
      blurb: 'システムを見て、目標を定め、壊れる日に備えます。',
    },
    'Outside the game': {
      name: 'ゲームの外',
      blurb: 'Quorum では組めないパターンと、読む価値のある参考文献。',
    },
    'Ran in production': {
      name: '実運用で動いた形',
      blurb: '実際のシステムが大規模に担った形と、その理由を示すボード。',
    },
    Resilience: {
      name: '耐障害性',
      blurb: 'タイムアウト、リトライ、サーキットブレーカー、そして小さく失敗するほかの方法。',
    },
    'Scaling data': {
      name: 'データのスケーリング',
      blurb: 'シャーディング、レプリケーション、クォーラム、そして形に合うストア。',
    },
    'Scaling reads and compute': {
      name: '読み取りとコンピュートのスケーリング',
      blurb: 'キャッシュ、レプリカ、ロードバランサー、オートスケーリング。',
    },
    'Scaling steps': {
      name: 'スケーリングのステップ',
      blurb: '1 台の箱から複数リージョンまで、1 ステップずつシステムを組み立てます。',
    },
    'Security and edge': {
      name: 'セキュリティとエッジ',
      blurb: '玄関、暗号化、シークレット、データを置ける場所。',
    },
    'When it broke': {
      name: '壊れたとき',
      blurb: '設計を変えた障害と、依存関係を示すボード。',
    },
  },
  search: {
    placeholder: '検索',
    label: 'Wiki を検索',
    results: '検索結果',
    searching: '検索中…',
    unavailable: '検索は利用できません。',
    none: '一致するページはありません。',
    kinds: {
      tutorials: 'チュートリアル',
      guides: 'ガイド',
      patterns: 'パターン',
      explanation: '解説',
    },
  },
  spoilers: {
    title: 'スポイラー',
    all: 'すべて',
    allShow: 'すべての時代を表示',
    hidingAfter: (era) => `${era}以降を非表示`,
    groupLabel: '到達した時代より後の内容を隠す',
    showEvery: 'すべての時代を表示する',
    hideAfter: (era) => `${era}以降を隠す`,
    upTo: (era) => `${era}まで`,
  },
  quiz: {
    title: '理解度チェック',
    right: '正解。',
    wrong: '惜しい。',
    retry: 'もう一度',
  },
  project: {
    stars: 'スター',
    forks: 'フォーク',
    contributors: 'コントリビューター',
    issues: '未解決の Issue',
    blurb: 'コードを読み、バグを報告し、修正を送ります。',
    star: 'GitHub でスターを付ける',
    contribute: 'コントリビュートの方法',
    source: (language) => `${language} のソース`,
  },
}
