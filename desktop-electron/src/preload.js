// Lynx AI 超级助理 - Electron preload
// 通过 contextBridge 安全暴露 IPC 能力给渲染层
// 兼容 native-ui 的 invoke/listen 接口（与 Tauri 接口同构）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // IPC 调用（与 Tauri invoke 同构）
  invoke: (cmd, args) => ipcRenderer.invoke(cmd, args),

  // 事件监听（与 Tauri listen 同构，返回取消监听函数）
  on: (event, handler) => {
    const listener = (_e, payload) => handler(payload);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },

  // 窗口控制（供 TitleBar 组件使用）
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    toggleMaximize: () => ipcRenderer.send('window-toggle-maximize'),
    close: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    onMaximizeChange: (cb) => {
      const listener = (_e, maximized) => cb(maximized);
      ipcRenderer.on('window-maximize-changed', listener);
      return () => ipcRenderer.removeListener('window-maximize-changed', listener);
    },
  },

  // 平台标识
  platform: 'electron',
  isDesktop: true,
  isTauri: false,
  version: process.env.npm_package_version || '1.0.1',
});
