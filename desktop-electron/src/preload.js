// Lynx AI 超级助理 - Electron preload
// 通过 contextBridge 安全地暴露少量能力给页面
// 兼容原 Tauri 的 isTauri() 判断（返回 false，让前端走 Web 模式）
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('lynxDesktop', {
  // 平台标识，前端可据此判断是否运行在桌面端
  platform: 'electron',
  isDesktop: true,
  // 兼容 native-ui 的 isTauri() 判断：桌面端不是 Tauri 环境
  isTauri: false,
  // 版本信息
  version: process.env.npm_package_version || '1.0.0',
});
