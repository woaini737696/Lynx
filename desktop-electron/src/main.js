// 奇思 AI 超级助理 - Electron 主进程（新主架构）
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

// P0 修复：设置 AppUserModelID，让 Windows 任务栏正确显示应用图标（而非默认图标）
// 必须在 app.whenReady() 之前调用，与 package.json 的 appId 一致
app.setAppUserModelId('com.lynnhub.desktop');

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
      label: wsConnected ? '停止奇思 Agent 本地操控能力' : '开启奇思 Agent 本地操控能力',
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
              dialog.showMessageBox(mainWindow, { type: 'warning', message: '请先登录后再开启奇思 Agent 本地操控能力' });
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
  let icon = nativeImage.createFromPath(iconPath);
  // P0 修复：icon.ico 已包含 16/32/48/64/128/256 多尺寸，Windows 会自动选择最佳尺寸
  // 不再 resize，避免 resize 丢失 alpha 通道导致托盘图标变黑/不显示
  if (icon.isEmpty()) {
    console.error('[tray] 图标加载失败，文件不存在或无效:', iconPath);
    // 回退：用 32x32 纯色占位图标，确保托盘至少有图标
    icon = nativeImage.createFromBuffer(
      Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x20, 0x20, 0x00, 0x00, 0x01, 0x00, 0x20, 0x00,
        ...Array(40 - 14).fill(0),
        ...Array(32 * 32 * 4).fill(0xff)
      ])
    );
  }
  tray = new Tray(icon);
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

// 单次请求（P1 修复：User-Agent 用 app.getVersion() 统一，避免版本号不一致）
async function _fetchVersionOnce() {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: 15000,
      family: 4,
      headers: {
        'User-Agent': `QisiDesktop/${app.getVersion()}`,
        'Accept': 'application/json',
      },
    };
    https.get('https://ai.lynxdo.com/api/hermes/app-version', options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 跟随重定向
        _fetchVersionRedirect(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

// 带重试的版本获取（P1：ECONNRESET 等网络错误重试 3 次，间隔递增 1s/2s）
async function fetchLatestVersion() {
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      return await _fetchVersionOnce();
    } catch (e) {
      lastErr = e;
      console.warn(`[update] 第 ${i + 1}/3 次获取版本失败: ${e.message}`);
      if (i < 2) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

// 重定向后的请求（P1 修复：User-Agent 统一用 app.getVersion()，原 fetchLatestVersionRedirect 改为私有 _fetchVersionRedirect）
function _fetchVersionRedirect(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, {
      timeout: 15000,
      family: 4,
      headers: { 'User-Agent': `QisiDesktop/${app.getVersion()}`, 'Accept': 'application/json' }
    }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
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
    const fileName = url.split('/').pop() || `QisiSetup-${Date.now()}.exe`;
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
          downloadUrl: data.downloadUrl || 'https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub-release/releases/download/v1.0.11/QisiSetup-1.0.11.exe',
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
  const url = downloadUrl || 'https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub-release/releases/download/v1.0.11/QisiSetup-1.0.11.exe';
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

// ============ WS Token 刷新（P0 修复：避免 userToken 过期导致 WS 连接失败） ============

// 用存储的 userToken 作为 Bearer，调用 /api/auth/ws-token 获取新鲜短期 JWT
// requireAuth() 支持 Bearer JWT（见 src/lib/auth-utils.ts:26-44），所以桌面端可用此端点
// 返回新鲜 JWT 字符串；失败时抛错（错误信息含状态码，调用方可判断 401 = 过期）
function fetchFreshWsToken(cloudEndpoint, bearerToken) {
  return new Promise((resolve, reject) => {
    const url = `${cloudEndpoint.replace(/\/$/, '')}/api/auth/ws-token`;
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : require('http');
    const req = mod.get(url, {
      timeout: 10000,
      family: 4,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Accept': 'application/json',
        'User-Agent': `QisiDesktop/${app.getVersion()}`,
      },
    }, (res) => {
      if (res.statusCode === 401) {
        reject(new Error('HTTP 401 - userToken 已过期'));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.token) resolve(data.token);
          else reject(new Error('响应缺少 token 字段'));
        } catch (e) {
          reject(new Error(`JSON 解析失败: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

// ============ IPC 处理器注册 ============

// 统一错误包装：handler 抛错时返回 { success: false, message, error } 而非裸异常（P0-1）
// P0 修复：同时返回 message 和 error 字段，前端读 data.message 或 data.error 都能拿到错误信息
function safeHandle(cmd, handler) {
  ipcMain.handle(cmd, async (event, args) => {
    try {
      return await handler(event, args);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[IPC:${cmd}] error:`, e);
      return { success: false, error: errMsg, message: errMsg };
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

  // P0 修复：统一 token 同步入口 - renderer 登录后主动调用，同步到主进程 store.js
  // 解决双重存储问题：renderer localStorage 与 main.js store.js 隔离导致 WS 连接时 token 为空
  // P0 修复2：支持空 token（登出时清空），避免主进程残留旧 token
  safeHandle('sync_auth', (_e, args) => {
    const token = args?.token;
    if (typeof token === 'string') {
      if (token) {
        store.set('userToken', token);
        console.log('[main] token 已同步到主进程 (len=' + token.length + ')');
      } else {
        store.delete('userToken');
        console.log('[main] token 已清空（登出）');
      }
    }
    if (args?.endpoint) {
      store.set('cloudEndpoint', args.endpoint);
      console.log('[main] cloudEndpoint 已同步:', args.endpoint);
    }
    return { success: true };
  });

  // P0 修复：async/await WS 连接结果，返回真实连接状态给前端
  // 修复前：同步返回 {success:true}，WS 尚未连接就告诉前端"已启动"，导致对话页报"WS未连接"
  // P0 修复2：桌面端存储的 userToken 是登录时签发的 JWT，有 TTL，过期后 WS 会被服务端拒绝
  //   → 连接前先用 Bearer 调用 /api/auth/ws-token 获取新鲜短期 JWT（与 Web 端一致）
  //   → 若 401（userToken 已过期）则提示用户重新登录；若网络错误则回退到原 token 尝试
  safeHandle('start_hermes_agent', async () => {
    const endpoint = store.get('cloudEndpoint', 'https://ai.lynxdo.com');
    const storedToken = store.get('userToken', '');
    if (!storedToken) return { success: false, error: '未设置用户 token，请先登录' };

    console.log('[main] start_hermes_agent: endpoint=' + endpoint + ', tokenLen=' + storedToken.length + ', tokenPrefix=' + storedToken.slice(0, 20));

    let wsToken = storedToken;
    try {
      const fresh = await fetchFreshWsToken(endpoint, storedToken);
      if (fresh) {
        wsToken = fresh;
        console.log('[main] 已获取新鲜 WS JWT (len=' + fresh.length + ')');
      }
    } catch (e) {
      const msg = String(e.message || e);
      console.warn('[main] 获取新鲜 WS token 失败:', msg);
      if (msg.includes('401')) {
        return { success: false, error: '登录已过期，请重新登录后再启动 Agent' };
      }
      // 网络错误时回退到原 token 尝试
      console.warn('[main] 回退到原 storedToken 尝试 WS 连接');
    }

    const wsOk = await wsGateway.startWSGateway(endpoint, wsToken);
    console.log('[main] WS 连接结果:', wsOk);
    return {
      success: wsOk,
      wsConnected: wsOk,
      error: wsOk ? undefined : 'WS 连接失败，请检查网络或重新登录（详见主进程日志）',
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
    try {
      const currentVersion = app.getVersion();
      const data = await fetchLatestVersion();

      if (!data || !data.version) {
        return { success: true, hasUpdate: false, current: currentVersion, latest: currentVersion, message: '无法获取版本信息，请稍后重试' };
      }

      if (compareAppVersions(currentVersion, data.version) < 0) {
        console.log(`[update] 发现新版本: ${data.version}（当前 ${currentVersion}）`);
        return {
          success: true,
          hasUpdate: true,
          current: currentVersion,
          latest: data.version,
          downloadUrl: data.downloadUrl || 'https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub-release/releases/download/v1.0.11/QisiSetup-1.0.11.exe',
          releaseNotes: data.releaseNotes || '',
        };
      }
      return { success: true, hasUpdate: false, current: currentVersion, latest: data.version, message: '当前已是最新版本' };
    } catch (e) {
      console.warn('[update] 检查更新失败:', e.message);
      // P1：网络错误友好化，避免透传裸错误码"read ECONNRESET"
      const msg = e.message || '';
      let friendly = '检查更新失败';
      if (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
        friendly = '网络连接失败，请检查网络后重试';
      } else if (msg.includes('HTTP 5')) {
        friendly = '服务器暂时不可用，请稍后重试';
      } else {
        friendly = `检查更新失败：${msg}`;
      }
      return { success: false, error: friendly };
    }
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

    // P0 修复：注册 WS 状态变化回调，转发事件到 renderer（事件驱动，消除 15 秒轮询窗口期）
    wsGateway.onStatusChange((connected) => {
      if (mainWindow) {
        mainWindow.webContents.send('ws-status-changed', { connected });
      }
      // 同步更新托盘菜单
      updateTrayMenu();
    });

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
