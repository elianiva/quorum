import type { Messages } from '../messages.ts'

/* The chrome of the live views behind each Markdown directive. */

export const islands: Messages['islands'] = {
  note: { tip: 'ヒント', warn: '注意', real: 'どこまで本物か' },
  options: { control: '設定項目', settings: '設定値', when: '表示条件' },
  mix: (era) => `${era}のリクエスト内訳`,
  sandbox: 'サンドボックス',
  lever: {
    title: (kind) => `${kind}レバー`,
    default: (share, era) => `既定の事業: ${share}（${era}から）`,
    step: 'ステップ',
    share: 'トラフィックの割合',
    devHours: '開発時間',
    growth: '成長',
    note: 'ほかの種別が差分を譲るので、合計のトラフィックは保たれます。',
  },
  nodeCard: (name) => `${name}のノードカード`,
  design: {
    aria: (names) => `設計: ${names}`,
    hint: 'ドラッグで移動します。Ctrl か Cmd を押しながらスクロールでズームします。',
    link: (from, to) => `リンク: ${from} → ${to}`,
    caption: (users, incident, apdex, p99, errors, burn, egress, note) =>
      `${users} ユーザーのとき${incident ? `、${incident}インシデントの最中` : ''}、シミュレーションはこの設計を Apdex ${apdex}、p99 ${p99}、エラー ${errors}%、支出 ${burn}/s と解きます${egress ? `（うち ${egress}/s がエグレス）` : ''}。${note ? ` ${note}` : ''}`,
    where: '場所',
    setting: '設定',
    value: '値',
    why: '理由',
    on: 'オン',
    off: 'オフ',
    needs: 'この設計に必要なリサーチ：',
  },
  practice: {
    boardLabel: (title) => `練習ボード: ${title}`,
    area: (title) => `${title}: 練習ボードです。目標はボードの下に並んでいます。`,
    titles: {
      place: 'コンポーネントを置く',
      wire: 'リンクでノードを配線する',
      rearrange: '選択、移動、切断',
    },
    intro: {
      place: 'アプリサーバーとデータベースを置きます。ドックで部品を選び、ボードをクリックします。',
      wire: 'ユーザーをアプリサーバーに、アプリサーバーをデータベースに、アプリサーバーをアナリティクスにリンクします。カード右端の出力ポートから別のカードへドラッグします。次に、一方のロードバランサーをもう一方にリンクし、2 つ目を 1 つ目へリンクしてループ拒否を読みます。',
      rearrange:
        'Shift を押しながら空きスペースをドラッグしてノードを矩形選択し、そのうち 1 つをドラッグしてグループごと動かします。次にリンクをクリックして Delete を押すか、x バッジをクリックして切断します。',
    },
    goals: {
      placeServer: 'アプリサーバーを置く',
      placeDatabase: 'データベースを置く',
      linkUsersServer: 'ユーザーをアプリサーバーにリンクする',
      linkServerDatabase: 'アプリサーバーをデータベースにリンクする',
      linkServerAnalytics: 'アプリサーバーをアナリティクスにリンクする',
      linkLoadBalancers: '1 つ目のロードバランサーを 2 つ目にリンクする',
      readLoop: 'ループ拒否を読む',
      boxSelect: '矩形で 2 つ以上のノードを選択する',
      moveGroup: '選択したグループを移動する',
      cutLink: 'リンクを 1 本切断する',
    },
    reset: 'リセット',
    goalsLabel: '目標',
    build: 'ビルド',
    done: '（完了）',
    notYet: '（未完了）',
    cash: (amount) => `資金 ${amount}`,
    stopPlacing: (name) => `${name}の設置をやめる（Esc）`,
    clickToPlace: (name) => `ボードをクリックして${name}を置きます。Enter でも置けます。`,
    allDone: 'すべての目標を達成しました。リセットしてもう一度練習します。',
    databaseMoved: 'Postgres はアプリサーバーから独立したデータベースへ移りました。',
  },
}
