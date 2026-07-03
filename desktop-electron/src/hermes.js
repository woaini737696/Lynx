// HermesAgent 管理：检测/安装/启动/停止/更新
// 复刻 Tauri installer.rs 的完整功能，用 Node.js child_process + https 实现
const { execSync, spawn } = require('child_process');
const httpsOrig = require('https');
const httpOrig = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const store = require('./store');

const DASHBOARD_PORT = 9119;
const LATEST_JSON_URL = 'https://ai.lynxdo.com/api/hermes/latest-json';
const WHEEL_DOWNLOAD_URL = 'https://ai.lynxdo.com/api/hermes/download-wheel';

// Windows 下隐藏子进程控制台窗口
function noWindow(cmd) {
  if (process.platform === 'win32') {
    cmd.windowsHide = true;
  }
  return cmd;
}

// ============ 环境检测 ============

function findHermesExe() {
  try { const p = execSync('where hermes 2>nul', { encoding: 'utf-8', windowsHide: true }).trim().split('\n')[0]; if (p) return p; } catch {}
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA;
    if (appdata) {
      for (const py of ['Python313', 'Python312', 'Python311']) {
        const p = path.join(appdata, 'Python', py, 'Scripts', 'hermes.exe');
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

function findPipExe() {
  try { const p = execSync('where pip 2>nul', { encoding: 'utf-8', windowsHide: true }).trim().split('\n')[0]; if (p) return p; } catch {}
  if (process.platform === 'win32' && process.env.APPDATA) {
    const p = path.join(process.env.APPDATA, 'Python', 'Python313', 'Scripts', 'pip.exe');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findPythonExe() {
  try { execSync('python --version 2>nul', { encoding: 'utf-8', windowsHide: true }); return 'python'; } catch {}
  try { execSync('python3 --version 2>nul', { encoding: 'utf-8', windowsHide: true }); return 'python3'; } catch {}
  return null;
}

async function detectAIEnv() {
  const status = {
    tauri: false, // Electron 端标记为 false
    python: false, pythonVersion: undefined,
    pip: false, pipPath: undefined,
    node: false, nodeVersion: undefined,
    agentBrowser: false,
    hermesAgent: false, hermesVersion: undefined, hermesPath: undefined,
    authorizedDir: false,
    ready: false,
  };

  // Python
  const pyPath = findPythonExe();
  if (pyPath) {
    status.python = true;
    try { status.pythonVersion = execSync(`${pyPath} --version`, { encoding: 'utf-8', windowsHide: true }).trim(); } catch {}
  }

  // pip
  const pipPath = findPipExe();
  if (pipPath) { status.pip = true; status.pipPath = pipPath; }

  // Node
  try {
    const nodeVer = execSync('node --version', { encoding: 'utf-8', windowsHide: true }).trim();
    status.node = true; status.nodeVersion = nodeVer;
  } catch {}

  // agent-browser
  const abPath = process.platform === 'win32' ? 'D:\\LynnHub\\npm-global\\agent-browser.cmd' : 'agent-browser';
  if (fs.existsSync(abPath)) status.agentBrowser = true;

  // hermes-agent
  const hermesPath = findHermesExe();
  if (hermesPath) {
    status.hermesAgent = true;
    status.hermesPath = hermesPath;
    try {
      const ver = execSync(`"${hermesPath}" --version`, { encoding: 'utf-8', windowsHide: true, timeout: 3000 }).trim();
      status.hermesVersion = ver;
    } catch {
      status.hermesVersion = 'unknown (file exists)';
    }
  }

  // 授权目录
  const authDir = process.platform === 'win32' ? 'D:\\LynnHub\\user-data' : './user-data';
  if (fs.existsSync(authDir)) status.authorizedDir = true;

  // 综合判断
  status.ready = status.python && status.pip && status.hermesAgent && status.authorizedDir;
  return status;
}

// ============ HTTP 工具（避免引入额外依赖） ============

function httpGet(url, { timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? httpsOrig : httpOrig;
    const req = mod.get(url, {
      timeout,
      headers: { 'User-Agent': 'QisiDesktop/1.0.8', 'Accept': 'application/json' },
      family: 4,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, { timeout }).then(resolve, reject);
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

function httpGetJSON(url, opts) {
  return httpGet(url, opts).then((text) => JSON.parse(text));
}

function httpPostJSON(url, body, { timeout = 130000 } = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? httpsOrig : httpOrig;
    const postData = JSON.stringify(body);
    const req = mod.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ success: false, error: '响应解析失败', raw: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.write(postData);
    req.end();
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const mod = url.startsWith('https') ? httpsOrig : httpOrig;
    mod.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) { file.close(); fs.unlinkSync(dest); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(fs.statSync(dest).size)));
    }).on('error', (e) => { file.close(); try { fs.unlinkSync(dest); } catch {} reject(e); });
  });
}

// ============ 一键安装 ============

async function installAIEnv(progressCallback) {
  const total = 6;
  const emit = (step, message, percent) => progressCallback?.({ step, total, message, percent });

  emit(1, '正在检测系统环境...', 5);
  const detection = await detectAIEnv();

  emit(2, '检测 Python 和 pip...', 15);
  if (!detection.python) throw new Error('未检测到 Python，请先安装 Python 3.9+');
  if (!detection.pip) throw new Error('未检测到 pip，请运行 python -m ensurepip --upgrade');
  emit(2, 'Python 和 pip 已就绪', 25);

  emit(3, '创建授权目录...', 30);
  const authDir = process.platform === 'win32' ? 'D:\\LynnHub\\user-data' : './user-data';
  fs.mkdirSync(authDir, { recursive: true });
  fs.mkdirSync(path.join(authDir, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.join(authDir, 'downloads'), { recursive: true });
  fs.mkdirSync(path.join(authDir, 'reports'), { recursive: true });

  if (!detection.hermesAgent) {
    emit(4, '正在从服务器下载 HermesAgent...', 40);
    const pipPath = findPipExe();
    if (!pipPath) throw new Error('未找到 pip 可执行文件');

    // 先获取 latest.json 得到 wheel 文件名
    const latest = await httpGetJSON(LATEST_JSON_URL);
    const wheelFilename = latest.wheel || 'hermes_agent-0.18.0-py3-none-any.whl';
    const downloadUrl = `${WHEEL_DOWNLOAD_URL}?file=${wheelFilename}`;

    const tmpDir = path.join(os.tmpdir(), 'lynnhub-hermes-install');
    fs.mkdirSync(tmpDir, { recursive: true });
    const localWhl = path.join(tmpDir, wheelFilename);

    const size = await downloadFile(downloadUrl, localWhl);
    console.log(`[hermes] wheel 下载成功: ${size} 字节`);

    emit(4, '正在安装 HermesAgent（本地 pip install）...', 65);
    const result = execSync(`"${pipPath}" install --disable-pip-version-check --upgrade --no-deps "${localWhl}"`, {
      encoding: 'utf-8', windowsHide: true, timeout: 120000,
    });
    fs.unlinkSync(localWhl);
    emit(4, 'HermesAgent 安装完成', 80);
  } else {
    emit(4, 'HermesAgent 已安装，跳过', 80);
  }

  emit(5, 'agent-browser 已就绪', 90);
  emit(6, '验证安装结果...', 95);
  const finalCheck = await detectAIEnv();
  const ready = finalCheck.hermesAgent && finalCheck.authorizedDir;
  emit(6, ready ? '安装完成！' : '部分组件未就绪', 100);

  return { success: ready, message: ready ? 'HermesAgent 安装完成' : '部分组件未就绪', status: finalCheck };
}

// ============ Dashboard 启动/停止 ============

let dashboardProcess = null;

async function startDashboard(port = DASHBOARD_PORT) {
  const hermesPath = findHermesExe();
  if (!hermesPath) throw new Error('未找到 hermes 可执行文件，请先点击一键安装');

  // 如果已经在运行，直接返回
  try {
    await httpGetJSON(`http://127.0.0.1:${port}/api/status`, { timeout: 3000 });
    return { success: true, port, endpoint: `http://localhost:${port}` };
  } catch { /* 未运行，继续启动 */ }

  dashboardProcess = spawn(hermesPath, ['dashboard', '--port', String(port), '--no-open'], {
    stdio: ['ignore', 'ignore', 'ignore'],
    windowsHide: true,
    detached: false,
  });
  dashboardProcess.on('error', (e) => console.error('[hermes] Dashboard 启动失败:', e));

  // 等待 Dashboard 启动（最多 5 秒）
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      await httpGetJSON(`http://127.0.0.1:${port}/api/status`, { timeout: 2000 });
      return { success: true, pid: dashboardProcess.pid, port, endpoint: `http://localhost:${port}` };
    } catch {}
  }
  return { success: false, port, error: 'Dashboard 启动超时' };
}

async function stopDashboard(port = DASHBOARD_PORT) {
  let killed = 0;
  if (process.platform === 'win32') {
    try {
      const netstat = execSync('netstat -ano', { encoding: 'utf-8', windowsHide: true });
      for (const line of netstat.split('\n')) {
        if (line.includes(`:${port}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) {
            try { execSync(`taskkill /F /PID ${pid}`, { windowsHide: true }); killed++; } catch {}
          }
        }
      }
    } catch {}
  } else {
    try { execSync(`pkill -f "hermes dashboard"`, { stdio: 'ignore' }); killed = 1; } catch {}
  }
  if (dashboardProcess) { try { dashboardProcess.kill(); } catch {} dashboardProcess = null; }
  return { success: true, killed };
}

// ============ 检查更新 ============

function compareVersions(a, b) {
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

async function getLocalVersion() {
  // 1. 优先通过 Dashboard API
  try {
    const status = await httpGetJSON('http://127.0.0.1:9119/api/status', { timeout: 3000 });
    if (status.version) return status.version;
  } catch {}
  // 2. 回退到 hermes --version
  const hermesPath = findHermesExe();
  if (hermesPath) {
    try {
      const ver = execSync(`"${hermesPath}" --version`, { encoding: 'utf-8', windowsHide: true, timeout: 3000 }).trim();
      return ver.split(/\s+/).pop();
    } catch {}
  }
  return null;
}

async function checkUpdate() {
  const localVersion = await getLocalVersion();
  let latest;
  try {
    latest = await httpGetJSON(LATEST_JSON_URL);
  } catch (e) {
    // P0 修复：网络请求失败时返回明确错误
    // 修复前：异常被 safeHandle 吞掉，返回 {success:false}，前端误判"已是最新版本"
    return {
      success: false,
      error: `无法获取服务器版本信息: ${e.message}`,
      currentVersion: localVersion,
      latestVersion: 'unknown',
      hasUpdate: false,
    };
  }
  const latestVersion = latest.version || '';
  const hasUpdate = localVersion ? compareVersions(localVersion, latestVersion) < 0 : true;
  return {
    success: true,
    hasUpdate,
    currentVersion: localVersion,
    latestVersion,
    wheel: latest.wheel || '',
    releaseNotes: latest.releaseNotes || '',
    publishedAt: latest.publishedAt || '',
  };
}

// ============ 强制升级 ============

async function updateAgent(progressCallback) {
  const total = 3;
  const emit = (step, message, percent) => progressCallback?.({ step, total, message, percent });

  emit(1, '正在获取最新版本信息...', 10);
  const latest = await httpGetJSON(LATEST_JSON_URL);
  const wheelFilename = latest.wheel;
  if (!wheelFilename) throw new Error('latest.json 缺少 wheel 字段');
  const latestVersion = latest.version || '';

  emit(2, `正在下载 HermesAgent v${latestVersion}...`, 40);
  const pipPath = findPipExe();
  if (!pipPath) throw new Error('未找到 pip 可执行文件');

  const tmpDir = path.join(os.tmpdir(), 'lynnhub-hermes-install');
  fs.mkdirSync(tmpDir, { recursive: true });
  const localWhl = path.join(tmpDir, wheelFilename);
  if (fs.existsSync(localWhl)) fs.unlinkSync(localWhl);

  await downloadFile(`${WHEEL_DOWNLOAD_URL}?file=${wheelFilename}`, localWhl);

  emit(3, '正在安装（强制升级）...', 70);
  execSync(`"${pipPath}" install --disable-pip-version-check --force-reinstall --no-deps "${localWhl}"`, {
    encoding: 'utf-8', windowsHide: true, timeout: 120000,
  });
  fs.unlinkSync(localWhl);
  emit(3, '升级完成', 100);

  return { success: true, message: `HermesAgent 已升级到 v${latestVersion}`, version: latestVersion };
}

// ============ Agent 状态 ============

async function getAgentStatus() {
  const config = store.getAll();
  let version = 'unknown';
  let wsConnected = false;
  try {
    const status = await httpGetJSON('http://127.0.0.1:9119/api/status', { timeout: 3000 });
    version = status.version || 'unknown';
  } catch {}

  return {
    version,
    wsConnected: global.wsConnected || false,
    cloudEndpoint: config.cloudEndpoint || 'https://ai.lynxdo.com',
    authMode: config.authMode || 'approve',
    authorizedDirs: config.authorizedDirs || ['D:\\LynnHub\\user-data'],
    capabilities: ['browser', 'desktop', 'file', 'shell'],
    hasToken: !!config.userToken,
  };
}

module.exports = {
  detectAIEnv,
  installAIEnv,
  startDashboard,
  stopDashboard,
  checkUpdate,
  updateAgent,
  getAgentStatus,
  // Dashboard HTTP API 调用（供 ws-gateway 使用）
  executeViaDashboard: (prompt, timeout = 120) => httpPostJSON('http://127.0.0.1:9119/api/execute', { prompt, timeout, mode: 'auto' }),
  getDashboardStatus: () => httpGetJSON('http://127.0.0.1:9119/api/status', { timeout: 5000 }).catch(() => null),
};
