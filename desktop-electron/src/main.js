// Lynx AI 超级助理 - Electron 主进程（新主架构）
// 完整本地能力：HermesAgent管理 + WS网关 + 系统托盘 + 全局快捷键 + 自动更新检查
const { app, BrowserWindow, shell, Menu, Tray, globalShortcut, ipcMain, nativeImage, dialog, session } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const os = require('os');
const hermes = require('./hermes');
const wsGateway = require('./ws-gateway');
const store = require('./store');

let mainWindow = null;
let tray = null;
let isQuiting = false;
let downloadedUpdatePath = null;

// P1-3: GPU 加速配置
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.on('gpu-process-crashed', () => {
  console.warn('[gpu] GPU 进程崩溃，回退到软件渲染');
  app.disableHardwareAcceleration();
});

// P0 修复：CORS 绕过——Electron renderer 加载 file:// 本地文件，fetch 到 ai.lynxdo.com 会被 CORS 阻止
// 通过 onHeadersReceived 为云端 API 响应添加 CORS 头，让 renderer 的 fetch 正常工作
// 仅对 ai.lynxdo.com 域名的响应生效，不影响其他网站
app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url || '';
    if (url.includes('ai.lynxdo.com') || url.includes('127.0.0.1:5177') || url.includes('localhost:5177')) {
      const headers = { ...details.responseHeaders };
      headers['access-control-allow-origin'] = ['*'];
      headers['access-control-allow-headers'] = ['Content-Type, Authorization'];
      headers['access-control-allow-methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS'];
      callback({ responseHeaders: headers });
    } else {
      callback({});
    }
  });
});

// ============ 窗口创建 ============

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: '奇思 - AI超级助理',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    // 去掉默认外框，全自定义标题栏（用户需求：不需要默认外框）
    frame: false,
    titleBarStyle: 'hidden',
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

// 动态更新托盘菜单（根据 WS 连接状态显示开启/停止）
function updateTrayMenu() {
  if (!tray) return;
  const wsConnected = global.wsConnected || false;
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    {
      label: wsConnected ? '停止 Lynx Agent 本地操控能力' : '开启 Lynx Agent 本地操控能力',
      click: async () => {
        if (wsConnected) {
          try { await hermes.stopDashboard(9119); } catch (e) { console.error(e); }
          await wsGateway.stopWSGateway();
        } else {
          const endpoint = store.get('cloudEndpoint', 'https://ai.lynxdo.com');
          const token = store.get('userToken', '');
          if (!token) {
            if (mainWindow) {
              mainWindow.show();
              dialog.showMessageBox(mainWindow, { type: 'warning', message: '请先登录后再开启 Lynx Agent 本地操控能力' });
            }
            return;
          }
          try { await hermes.startDashboard(9119); } catch (e) { console.error(e); }
          await wsGateway.startWSGateway(endpoint, token);
        }
        setTimeout(updateTrayMenu, 500);
      },
    },
    { type: 'separator' },
    { label: '检查更新', click: () => checkAppUpdate() },
    { label: '退出', click: () => { isQuiting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip(`奇思 - AI超级助理${wsConnected ? '（运行中）' : ''}`);
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  // P0 修复：resize 返回新对象，必须赋值给新变量（原变量不变）
  const smallIcon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(smallIcon);
  updateTrayMenu();
  tray.setToolTip('奇思 - AI超级助理');
  tray.on('click', () => { if (mainWindow) { mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); } });
  // 每 3 秒刷新托盘菜单，同步 WS 连接状态
  setInterval(updateTrayMenu, 3000);
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

// ============ 自动更新检查 + 下载 + 安装（P1-1，不依赖 electron-updater） ============

// 获取最新版本信息
async function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    https.get('https://ai.lynxdo.com/api/hermes/app-version', { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

// 下载安装包到临时目录，返回本地路径
async function downloadInstaller(url, onProgress) {
  return new Promise((resolve, reject) => {
    const tmpDir = path.join(os.tmpdir(), 'lynx-update');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const fileName = url.split('/').pop() || `Lynx-Setup-${Date.now()}.exe`;
    const savePath = path.join(tmpDir, fileName);

    const file = fs.createWriteStream(savePath);
    https.get(url, { timeout: 60000 }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(savePath);
        downloadInstaller(res.headers.location, onProgress).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(savePath);
        reject(new Error(`下载失败: HTTP ${res.statusCode}`));
        return;
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      res.on('data', (chunk) => {
        received += chunk.length;
        if (onProgress && total > 0) {
          onProgress({ percent: Math.round((received / total) * 100), received, total });
        }
      });
      res.pipe(file);
      file.on('finish', () => { file.close(() => resolve(savePath)); });
    }).on('error', (e) => {
      file.close();
      try { fs.unlinkSync(savePath); } catch {}
      reject(e);
    });
  });
}

async function checkAppUpdate() {
  try {
    const currentVersion = app.getVersion();
    const data = await fetchLatestVersion();

    if (!data || !data.version) {
      console.log('[update] 无法获取版本信息，跳过');
      return;
    }

    if (compareAppVersions(currentVersion, data.version) < 0) {
      console.log(`[update] 发现新版本: ${data.version}（当前 ${currentVersion}）`);
      if (mainWindow) {
        mainWindow.webContents.send('app-update-available', {
          current: currentVersion,
          latest: data.version,
          downloadUrl: data.downloadUrl || 'https://www.lynxdo.com/download/Lynx-windows-setup.exe',
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

// 手动触发：下载并安装更新（通过 IPC 调用）
async function downloadAndInstallUpdate(downloadUrl) {
  const url = downloadUrl || 'https://www.lynxdo.com/download/Lynx-windows-setup.exe';
  console.log(`[update] 开始下载: ${url}`);

  // 通知前端下载进度
  const notifyProgress = (p) => {
    if (mainWindow) mainWindow.webContents.send('app-update-progress', p);
  };

  const savePath = await downloadInstaller(url, notifyProgress);
  downloadedUpdatePath = savePath;
  console.log(`[update] 下载完成: ${savePath}`);

  // 询问用户是否立即安装
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['立即安装', '稍后'],
    defaultId: 0,
    title: '更新下载完成',
    message: '新版本已下载完成，是否立即安装？',
    detail: `安装包已保存到: ${savePath}\n点击"立即安装"将关闭应用并启动安装程序。`,
  });

  if (result.response === 0) {
    // 使用 shell 启动安装程序并退出当前应用
    shell.openPath(savePath);
    isQuiting = true;
    app.quit();
  }

  return { success: true, path: savePath, willInstall: result.response === 0 };
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

// 统一错误包装：handler 抛错时返回 { success: false, error } 而非裸异常（P0-1）
function safeHandle(cmd, handler) {
  ipcMain.handle(cmd, async (event, args) => {
    try {
      return await handler(event, args);
    } catch (e) {
      console.error(`[IPC:${cmd}] error:`, e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

function registerIPC() {
  // --- 窗口控制 ---
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-toggle-maximize', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on('window-close', () => { isQuiting = true; mainWindow?.close(); });
  safeHandle('window-is-maximized', () => mainWindow?.isMaximized() || false);

  // --- HermesAgent 管理 ---
  safeHandle('detect_ai_env', () => hermes.detectAIEnv());

  safeHandle('install_ai_env', (event) => {
    return hermes.installAIEnv((progress) => {
      event.sender.send('install-progress', progress);
    });
  });

  safeHandle('start_hermes_dashboard', (_e, args) => {
    return hermes.startDashboard(args?.port || 9119);
  });

  safeHandle('stop_hermes_dashboard', (_e, args) => {
    return hermes.stopDashboard(args?.port || 9119);
  });

  safeHandle('check_hermes_update', () => hermes.checkUpdate());

  safeHandle('update_hermes_agent', (event) => {
    return hermes.updateAgent((progress) => {
      event.sender.send('install-progress', progress);
    });
  });

  safeHandle('get_agent_status', () => hermes.getAgentStatus());

  // --- 配置管理 ---
  safeHandle('set_user_token', (_e, args) => {
    store.set('userToken', args?.token);
    return { success: true };
  });

  safeHandle('set_cloud_endpoint', (_e, args) => {
    store.set('cloudEndpoint', args?.endpoint);
    return { success: true };
  });

  // P0 修复：async/await WS 连接结果，返回真实连接状态给前端
  // 修复前：同步返回 {success:true}，WS 尚未连接就告诉前端"已启动"，导致对话页报"WS未连接"
  safeHandle('start_hermes_agent', async () => {
    const endpoint = store.get('cloudEndpoint', 'https://ai.lynxdo.com');
    const token = store.get('userToken', '');
    if (!token) return { success: false, error: '未设置用户 token' };
    const wsOk = await wsGateway.startWSGateway(endpoint, token);
    return {
      success: wsOk,
      wsConnected: wsOk,
      error: wsOk ? undefined : 'WS 连接失败，请检查网络或重新登录',
    };
  });

  safeHandle('set_auth_mode', (_e, args) => {
    store.set('authMode', args?.mode || 'approve');
    return { success: true };
  });

  safeHandle('add_authorized_dir', (_e, args) => {
    const dirs = store.get('authorizedDirs', ['D:\\LynnHub\\user-data']);
    if (!dirs.includes(args.dir)) dirs.push(args.dir);
    store.set('authorizedDirs', dirs);
    return { success: true };
  });

  safeHandle('remove_authorized_dir', (_e, args) => {
    const dirs = store.get('authorizedDirs', ['D:\\LynnHub\\user-data']).filter((d) => d !== args.dir);
    store.set('authorizedDirs', dirs);
    return { success: true };
  });

  // --- 外部链接 ---
  safeHandle('open_external', (_e, args) => {
    if (args?.url) shell.openExternal(args.url);
    return { success: true };
  });

  // --- 应用自动更新（P1-1）---
  safeHandle('check_app_update', async () => {
    const data = await fetchLatestVersion();
    if (!data || !data.version) return { success: false, error: '无法获取版本信息' };
    const currentVersion = app.getVersion();
    const hasUpdate = compareAppVersions(currentVersion, data.version) < 0;
    return {
      success: true,
      hasUpdate,
      current: currentVersion,
      latest: data.version,
      downloadUrl: data.downloadUrl || 'https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub-release/releases/download/v1.0.2/Lynx_1.0.2_x64-setup.exe',
      releaseNotes: data.releaseNotes || '',
    };
  });

  safeHandle('download_and_install_update', (_e, args) => {
    return downloadAndInstallUpdate(args?.downloadUrl);
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

app.on('before-quit', async (event) => {
  if (!isQuiting) {
    isQuiting = true;
    // 等待 WS 连接优雅关闭和 Dashboard 进程停止（P0-3）
    event.preventDefault();
    try {
      await Promise.race([
        Promise.all([wsGateway.stopWSGateway(), hermes.stopDashboard(9119).catch(() => {})]),
        new Promise((resolve) => setTimeout(resolve, 3000)), // 最多等 3 秒
      ]);
    } catch (e) {
      console.warn('[quit] 清理失败:', e.message);
    }
    store.flush(); // 强制落盘配置（P0-2）
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
