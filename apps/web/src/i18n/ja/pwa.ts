import type { Messages } from '../messages.ts'

export const pwa: Messages['pwa'] = {
  app: 'アプリ',
  installQuorum: 'Quorum をインストール',
  installDetail: 'ホーム画面またはデスクトップから、専用のウィンドウで遊べます。',
  installPrompt: 'Quorum をインストールして、専用のウィンドウで遊びましょう。',
  notNow: 'あとで',
  updateReady: '更新の準備完了',
  updateReadyDetail: 'Quorum を再起動すると新しいバージョンが読み込まれます。',
  offline: 'オフライン',
  offlineStatus: 'オフラインです。ゲームはこのブラウザで続けられます。',
  offlineNote: 'ルームと機能キーには接続が必要です。',
  moveNote:
    'iPhone と iPad では、インストールしたアプリに別のストレージが使われます。会社を開いて設定 › セーブ でファイルをコピーし、インストール後に貼り付けてください。',
  installHelp: {
    iosSafari: '共有をタップし、ホーム画面に追加を選びます。',
    iosOther: 'このページを Safari で開き、共有をタップしてホーム画面に追加を選びます。',
    android: 'ブラウザのメニューを開き、アプリをインストールをタップします。',
    chromium: 'アドレスバーのインストールアイコンをクリックします。',
    safariMac: 'ファイル > Dockに追加を選びます。',
    other: 'このブラウザでは Quorum をインストールできません。このタブで続けてください。',
  },
}
