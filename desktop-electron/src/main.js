// Lynx AI 超级助理 - Electron 主进程（新主架构）
// 完整本地能力：HermesAgent管理 + WS网关 + 系统托盘 + 全局快捷键 + 自动更新检查
const { app, BrowserWindow, shell, Menu, Tray, globalShortcut, ipcMain, nativeImage } = require('electron');
const path = require('path');
const https = require('https');
const hermes = require('./hermes');
const wsGateway = require('./ws-gateway');
const store = require('./store');

let mainWindow = null;
let tray = null;
let isQuiting = false;

// ============ 窗口创建 ============

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Lynx - AI超级助理',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 开发模式加载本地 dev server，生产模式加载打包的 renderer
  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5177');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://ai.lynxdo.com/') || url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')) return;
    if (url.startsWith('https://ai.lynxdo.com/')) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  // 窗口状态变化通知前端
  mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximize-changed', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximize-changed', false));

  // 关闭时最小化到托盘（不退出）
  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ============ 系统托盘 ============

function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  // 缩小图标用于托盘（16x16）
  icon.resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: '启动 HermesAgent Dashboard', click: async () => { try { await hermes.startDashboard(9119); } catch (e) { console.error(e); } } },
    { label: '停止 HermesAgent Dashboard', click: async () => { try { await hermes.stopDashboard(9119); } catch (e) { console.error(e); } } },
    { type: 'separator' },
    { label: '检查更新', click: () => checkAppUpdate() },
    { label: '退出', click: () => { isQuiting = true; app.quit(); } },
  ]);

  tray.setToolTip('Lynx - AI超级助理');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => { if (mainWindow) { mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); } });
}

// ============ 全局快捷键 ============

function registerShortcuts() {
  // Ctrl+Shift+L 切换窗口显示/隐藏
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ============ 自动更新检查（简化版，不依赖 electron-updater） ============

async function checkAppUpdate() {
  try {
    const currentVersion = app.getVersion();
    const data = await new Promise((resolve, reject) => {
      https.get('https://ai.lynxdo.com/api/hermes/app-version', { timeout: 10000 }, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
      }).on('error', reject);
    });

    if (!data || !data.version) {
      console.log('[update] 无法获取版本信息，跳过');
      return;
    }

    if (compareAppVersions(currentVersion, data.version) < 0) {
      console.log(`[update] 发现新版本: ${data.version}（当前 ${currentVersion}）`);
      // 通过前端事件通知
      if (mainWindow) {
        mainWindow.webContents.send('app-update-available', {
          current: currentVersion,
          latest: data.version,
          downloadUrl: data.downloadUrl || 'https://ai.lynxdo.com/downloads',
          releaseNotes: data.releaseNotes || '',
        });
      }
    } else {
      console.log(`[update] 已是最新版本（${currentVersion}）`);
    }
  } catch (e) {
    console.warn('[update] 检查更新失败:', e.message);
  }
}

function compareAppVersions(a, b) {
  const pa = a.split('.').map((s) => parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => parseInt(s, 10) || 0);
  const maxLen = Math.max(pa.length, pb.length);
  for (let i = 0; i < maxLen; i++) {
    const va = pa[i] || 0, vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

// ============ IPC 处理器注册 ============

function registerIPC() {
  // --- 窗口控制 ---
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-toggle-maximize', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on('window-close', () => { isQuiting = true; mainWindow?.close(); });
  ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() || false);

  // --- HermesAgent 管理 ---
  ipcMain.handle('detect_ai_env', () => hermes.detectAIEnv());

  ipcMain.handle('install_ai_env', async (event) => {
    return hermes.installAIEnv((progress) => {
      event.sender.send('install-progress', progress);
    });
  });

  ipcMain.handle('start_hermes_dashboard', (_e, args) => {
    return hermes.startDashboard(args?.port || 9119);
  });

  ipcMain.handle('stop_hermes_dashboard', (_e, args) => {
    return hermes.stopDashboard(args?.port || 9119);
  });

  ipcMain.handle('check_hermes_update', () => hermes.checkUpdate());

  ipcMain.handle('update_hermes_agent', async (event) => {
    return hermes.updateAgent((progress) => {
      event.sender.send('install-progress', progress);
    });
  });

  ipcMain.handle('get_agent_status', () => hermes.getAgentStatus());

  // --- 配置管理 ---
  ipcMain.handle('set_user_token', (_e, args) => {
    store.set('userToken', args?.token);
    return { success: true };
  });

  ipcMain.handle('set_cloud_endpoint', (_e, args) => {
    store.set('cloudEndpoint', args?.endpoint);
    return { success: true };
  });

  ipcMain.handle('start_hermes_agent', () => {
    const endpoint = store.get('cloudEndpoint', 'https://ai.lynxdo.com');
    const token = store.get('userToken', '');
    if (!token) return { success: false, error: '未设置用户 token' };
    wsGateway.startWSGateway(endpoint, token);
    return { success: true };
  });

  ipcMain.handle('set_auth_mode', (_e, args) => {
    store.set('authMode', args?.mode || 'approve');
    return { success: true };
  });

  ipcMain.handle('add_authorized_dir', (_e, args) => {
    const dirs = store.get('authorizedDirs', ['D:\\LynnHub\\user-data']);
    if (!dirs.includes(args.dir)) dirs.push(args.dir);
    store.set('authorizedDirs', dirs);
    return { success: true };
  });

  ipcMain.handle('remove_authorized_dir', (_e, args) => {
    const dirs = store.get('authorizedDirs', ['D:\\LynnHub\\user-data']).filter((d) => d !== args.dir);
    store.set('authorizedDirs', dirs);
    return { success: true };
  });

  // --- 外部链接 ---
  ipcMain.handle('open_external', (_e, args) => {
    if (args?.url) shell.openExternal(args.url);
    return { success: true };
  });
}

// ============ 应用生命周期 ============

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
    registerShortcuts();
    registerIPC();

    // 启动后 5 秒检查应用更新
    setTimeout(checkAppUpdate, 5000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 不退出，保持托盘运行
  }
});

app.on('before-quit', () => {
  isQuiting = true;
  // 清理 WS 连接和 Dashboard 进程
  wsGateway.stopWSGateway();
  hermes.stopDashboard(9119).catch(() => {});
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
