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

global.wsConnected = false;

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
  return process.env.npm_package_version || '1.0.1';
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

// 启动 WS 网关客户端
function startWSGateway(cloudEndpoint, userToken) {
  if (isStarted) { console.log('[ws-gateway] 已启动，跳过'); return; }
  isStarted = true;

  const wsUrl = buildWsUrl(cloudEndpoint);
  console.log(`[ws-gateway] 连接: ${wsUrl.replace(/token=[^&]+/, 'token=***')}`);

  function connect() {
    if (!isStarted) return;

    wsClient = new WebSocket(wsUrl);

    wsClient.on('open', () => {
      console.log('[ws-gateway] 已连接，发送注册消息');
      global.wsConnected = true;

      // 发送注册消息
      wsClient.send(JSON.stringify({
        type: 'register',
        token: userToken,
        agentVersion: getAgentVersion(),
        deviceName: getDeviceName(),
        capabilities: ['browser', 'desktop', 'file', 'shell'],
        authMode: store.get('authMode', 'approve'),
        deviceType: 'desktop',
      }));

      // 心跳：每 30 秒
      heartbeatTimer = setInterval(() => {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 30000);
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
      global.wsConnected = false;
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      // 5 秒后重连
      if (isStarted) {
        reconnectTimer = setTimeout(connect, 5000);
      }
    });

    wsClient.on('error', (e) => {
      console.warn(`[ws-gateway] 连接错误: ${e.message}`);
    });
  }

  connect();
}

// 停止 WS 网关客户端
function stopWSGateway() {
  isStarted = false;
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (wsClient) { wsClient.close(); wsClient = null; }
  global.wsConnected = false;
  console.log('[ws-gateway] 已停止');
}

module.exports = { startWSGateway, stopWSGateway };
