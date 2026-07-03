// WebSocket 网关客户端：连接云端状态中心，接收远程指令
// 复刻 Tauri ws_client.rs 的完整功能，用 ws 包实现
const WebSocket = require('ws');
const os = require('os');
const store = require('./store');
const hermes = require('./hermes');

let wsClient = null;
let heartbeatTimer = null;
let reconnectTimer = null;
let isStarted = false;
let statusChangeCallback = null;

global.wsConnected = false;

// 注册 WS 状态变化回调（main.js 注册，状态变化时转发事件到 renderer）
function onStatusChange(cb) {
  statusChangeCallback = cb;
}

function notifyStatusChange(connected) {
  global.wsConnected = connected;
  if (statusChangeCallback) {
    try { statusChangeCallback(connected); } catch (e) { console.warn('[ws-gateway] 状态回调异常:', e); }
  }
}

function buildWsUrl(cloudEndpoint) {
  const wsScheme = cloudEndpoint.startsWith('https') ? 'wss' : 'ws';
  const host = cloudEndpoint.replace(/^https?:\/\//, '');
  return `${wsScheme}://${host}/api/ws/agent`;
}

function getDeviceName() {
  const user = os.userInfo().username || 'unknown';
  const hostname = os.hostname() || 'unknown';
  return `${user}-${hostname}`;
}

function getAgentVersion() {
  try {
    // 从打包后的 package.json 读取版本号
    const pkg = require('../package.json');
    return pkg.version || '1.0.9';
  } catch {
    return '1.0.9';
  }
}

// 处理云端下发的消息
async function handleCloudMessage(data, send) {
  const msg = JSON.parse(data);
  const msgType = msg.type || '';

  if (msgType === 'remote-command') {
    const { commandId, command } = msg;
    console.log(`[ws-gateway] 收到远程指令: ${command} (id=${commandId})`);

    // 回传：开始执行
    send({ type: 'command-update', commandId, status: 'executing', step: '开始执行', percent: 0 });

    let result;
    if (command.startsWith('__LYNN_CMD__:')) {
      // 特殊系统命令
      result = await handleSpecialCommand(command);
    } else {
      // 统一走 Dashboard HTTP API
      try {
        const r = await hermes.executeViaDashboard(command);
        result = {
          success: r.success !== false,
          output: r.output || r.result || r.message || '',
          route: 'dashboard',
          steps: [],
          error: r.error,
          duration_ms: 0,
        };
      } catch (e) {
        result = { success: false, output: '', route: 'dashboard', steps: [], error: `Dashboard 不可用: ${e.message}`, duration_ms: 0 };
      }
    }

    // 回传最终结果
    send({
      type: 'command-update',
      commandId,
      status: result.success ? 'completed' : 'failed',
      result: {
        success: result.success,
        output: result.output,
        route: result.route,
        steps: result.steps || [],
        durationMs: result.duration_ms || 0,
      },
      error: result.error,
    });
  }
}

// 处理 __LYNN_CMD__ 特殊命令
async function handleSpecialCommand(command) {
  const action = command.replace('__LYNN_CMD__:', '');
  const start = Date.now();
  console.log(`[ws-gateway] 系统命令: ${action}`);

  try {
    let success = false, output = '', error = null;
    switch (action) {
      case 'start_dashboard':
        await hermes.startDashboard(9119);
        success = true; output = 'HermesAgent Dashboard 已启动（端口 9119）';
        break;
      case 'stop_dashboard':
        await hermes.stopDashboard(9119);
        success = true; output = 'HermesAgent Dashboard 已停止';
        break;
      case 'install_hermes':
        const installResult = await hermes.installAIEnv();
        success = installResult.success; output = installResult.message;
        break;
      case 'update_hermes':
        const updateResult = await hermes.updateAgent();
        success = updateResult.success; output = updateResult.message;
        break;
      case 'check_update':
        const updateInfo = await hermes.checkUpdate();
        success = true;
        output = updateInfo.hasUpdate
          ? `发现新版本：v${updateInfo.latestVersion}（当前 v${updateInfo.currentVersion || '未知'}）`
          : `已是最新版本（v${updateInfo.currentVersion || updateInfo.latestVersion}）`;
        break;
      default:
        success = false; error = `未知的系统命令: ${action}`;
    }
    return { success, output, route: `special:${action}`, steps: [], error, duration_ms: Date.now() - start };
  } catch (e) {
    return { success: false, output: '', route: `special:${action}`, steps: [], error: e.message, duration_ms: Date.now() - start };
  }
}

// 启动 WS 网关客户端（P0 修复：返回 Promise，等待首次连接成功/失败）
// 修复前：startWSGateway 是同步的，不等待 WS 实际连接就返回，导致"已启动"但 WS 未连接
function startWSGateway(cloudEndpoint, userToken) {
  if (isStarted) {
    console.log('[ws-gateway] 已启动，返回当前状态:', global.wsConnected);
    return Promise.resolve(global.wsConnected);
  }
  isStarted = true;

  const wsUrl = buildWsUrl(cloudEndpoint);
  console.log(`[ws-gateway] 连接: ${wsUrl.replace(/token=[^&]+/, 'token=***')}`);

  return new Promise((resolve) => {
    let settled = false;
    const done = (success) => { if (!settled) { settled = true; resolve(success); } };
    // 首次连接超时：8 秒（超时后仍后台重连，但告知前端"未连接"）
    const firstConnTimeout = setTimeout(() => {
      console.warn('[ws-gateway] 首次连接超时（8秒），将后台重连');
      done(false);
    }, 8000);

    function connect() {
      if (!isStarted) { clearTimeout(firstConnTimeout); done(false); return; }

      wsClient = new WebSocket(wsUrl);

      wsClient.on('open', () => {
        clearTimeout(firstConnTimeout);
        console.log('[ws-gateway] 已连接，发送注册消息');
        notifyStatusChange(true);

        wsClient.send(JSON.stringify({
          type: 'register',
          token: userToken,
          agentVersion: getAgentVersion(),
          deviceName: getDeviceName(),
          capabilities: ['browser', 'desktop', 'file', 'shell'],
          authMode: store.get('authMode', 'approve'),
          deviceType: 'desktop',
        }));

        heartbeatTimer = setInterval(() => {
          if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, 30000);

        done(true);
      });

      wsClient.on('message', (data) => {
        handleCloudMessage(data.toString(), (msg) => {
          if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(JSON.stringify(msg));
          }
        }).catch((e) => console.warn('[ws-gateway] 处理消息失败:', e));
      });

      wsClient.on('close', () => {
        console.log('[ws-gateway] 连接关闭');
        notifyStatusChange(false);
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        if (isStarted) {
          reconnectTimer = setTimeout(connect, 5000);
        }
        done(false);
      });

      wsClient.on('error', (e) => {
        console.warn(`[ws-gateway] 连接错误: ${e.message}`);
        // error 后会触发 close，done(false) 在 close 中调用
      });
    }

    connect();
  });
}

// 停止 WS 网关客户端（异步，等待 close 完成 - P0-3 优雅关闭）
function stopWSGateway() {
  isStarted = false;
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  global.wsConnected = false;

  if (!wsClient) {
    console.log('[ws-gateway] 已停止（无连接）');
    return Promise.resolve();
  }

  const client = wsClient;
  wsClient = null;
  // 等待 close 事件完成，最多 2 秒（避免退出时卡住）
  return new Promise((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; console.log('[ws-gateway] 已停止'); resolve(); } };
    client.once('close', done);
    try { client.close(); } catch { done(); }
    setTimeout(done, 2000);
  });
}

module.exports = { startWSGateway, stopWSGateway, onStatusChange };
