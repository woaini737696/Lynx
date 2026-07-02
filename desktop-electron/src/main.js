// Lynx AI 超级助理 - Electron 主进程
// 桌面端壳：加载线上 Web 应用 https://ai.lynxdo.com/
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

// 线上 Web 应用地址
const WEB_APP_URL = 'https://ai.lynxdo.com/';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Lynx - AI超级助理',
    backgroundColor: '#030816',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 加载线上 Web 应用
  mainWindow.loadURL(WEB_APP_URL);

  // 窗口准备好再显示，避免白屏
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 外部链接用系统浏览器打开（避免在应用内跳转到非业务页面）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://ai.lynxdo.com/') || url.startsWith('http://localhost:')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 处理页面内导航到非业务域时也拦截到外部浏览器
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(WEB_APP_URL) || url.startsWith('http://localhost:')) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 单实例锁，避免多开
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// macOS 之外的窗口全部关闭时退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 简化菜单（仅保留必要项）
if (process.platform === 'darwin') {
  const template = [
    { label: app.name, submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ]},
    { label: '编辑', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
      { role: 'selectAll' },
    ]},
    { label: '视图', submenu: [
      { role: 'reload' }, { role: 'forceReload' },
      { role: 'toggleDevTools' }, { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
} else {
  // Windows/Linux 默认菜单足够
}
