import type { Messages } from '../messages.ts'

export const pwa: Messages['pwa'] = {
  app: '应用',
  installQuorum: '安装 Quorum',
  installDetail: '从主屏幕或桌面打开，在独立窗口中游玩。',
  installPrompt: '安装 Quorum，在独立窗口中游玩。',
  notNow: '稍后',
  updateReady: '更新已就绪',
  updateReadyDetail: '重启 Quorum 以加载新版本。',
  offline: '离线',
  offlineStatus: '离线。游戏会继续在这个浏览器中运行。',
  offlineNote: '房间和功能密钥需要网络连接。',
  moveNote:
    'iPhone 和 iPad 为安装后的应用使用单独的存储空间。打开一个公司，在设置 › 存档中复制它的文件，安装后再粘贴进去。',
  installHelp: {
    iosSafari: '点按“分享”，然后选择“添加到主屏幕”。',
    iosOther: '在 Safari 中打开此页面，点按“分享”，然后选择“添加到主屏幕”。',
    android: '打开浏览器菜单，点按“安装应用”。',
    chromium: '点按地址栏中的安装图标。',
    safariMac: '选择“文件”>“添加到程序坞”。',
    other: '此浏览器无法安装 Quorum。请继续在此标签页中游玩。',
  },
}
