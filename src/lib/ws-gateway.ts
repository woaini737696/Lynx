// WebSocket 状态中心网关
//
// 部署：作为独立进程运行（PM2 托管），监听端口 3001
// 启动：node scripts/start-ws-gateway.js
//
// 职责：
// 1. 接收桌面端 HermesAgent 的 WS 注册（PC 上线）
// 2. 维护 PC 在线状态（按 userId 分组）
// 3. 接收安卓端/Web端的远程指令，转发给目标 PC
// 4. PC 执行完成后流式回传进度到安卓端/Web端
// 5. 定时清理超时离线的 PC

// 加载 .env 环境变量（独立进程需要自己加载，不依赖 Next.js）
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });

import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

// 内联 logger（避免依赖 @/lib/logger 和 pino-pretty，便于 esbuild 预编译为纯 JS 在服务器零依赖运行）
const logger = {
  info: (...args: unknown[]) => console.log("[ws-gateway]", ...args),
  error: (obj: unknown, msg?: string) => console.error("[ws-gateway]", msg ?? "", obj),
  warn: (...args: unknown[]) => console.warn("[ws-gateway]", ...args),
  debug: (...args: unknown[]) => {
    if (process.env.LOG_LEVEL === "debug") console.log("[ws-gateway]", ...args);
  },
  child: () => logger,
};
const prisma = new PrismaClient();
const PORT = Number(process.env.WS_PORT || 3001);

// ============ 内存状态 ============

/** WS 连接池：channelId → WebSocket */
const connections = new Map<string, WebSocket>();

/** 用户→在线 PC 列表：userId → Set<channelId> */
const userDevices = new Map<string, Set<string>>();

/** 指令→订阅者（等待结果的安卓端/Web端 WS）：commandId → Set<WebSocket> */
const commandWatchers = new Map<string, Set<WebSocket>>();

// ============ 工具函数 ============

function sendJson(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastToUser(userId: string, message: unknown) {
  const channels = userDevices.get(userId);
  if (!channels) return;
  for (const channelId of channels) {
    const ws = connections.get(channelId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendJson(ws, message);
    }
  }
}

/** 验证 JWT token 并返回 userId
 *
 * 仅接受 JWT（三段式，由 /api/auth/token 签发），用 verifyToken 解析拿到 payload.id
 * 不再接受裸 userId / "user:<id>" 等简易格式（安全风险）
 */
async function authenticate(token: string): Promise<string | null> {
  if (!token) return null;
  if (token.split(".").length !== 3) return null;
  try {
    const { verifyToken } = await import("./jwt");
    const payload = await verifyToken(token);
    return payload?.id ?? null;
  } catch (e) {
    console.warn("[ws-gateway] JWT 验证失败:", (e as Error).message);
    return null;
  }
}

/** 从 HTTP 请求头提取并验证 Bearer token，返回 userId 或 null */
async function authenticateHttpRequest(req: import("http").IncomingMessage): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authenticate(authHeader.slice(7));
  }
  return null;
}

/** 验证内部服务间调用（Next.js API → WS 网关），使用 X-Internal-Key */
function authenticateInternal(req: import("http").IncomingMessage): boolean {
  const key = req.headers["x-internal-key"];
  const expected = process.env.INTERNAL_API_KEY;
  return !!(key && expected && key === expected);
}

/** CORS 白名单：仅允许配置的域名 + Tauri 桌面端 */
const ALLOWED_ORIGINS = (process.env.WS_CORS_ORIGINS || "https://ai.lynxdo.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith("tauri://"))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** 注册 PC 上线 */
async function registerDevice(
  ws: WebSocket,
  userId: string,
  data: {
    deviceName: string;
    agentVersion: string;
    capabilities: string[];
    authMode: string;
    deviceType?: string;
  }
) {
  const channelId = randomUUID();

  // 关闭该 WS 之前的会话（同 WS 重连）
  // 实际场景：每个 WS 是新连接，无需处理

  connections.set(channelId, ws);

  // 加入用户设备组
  if (!userDevices.has(userId)) {
    userDevices.set(userId, new Set());
  }
  userDevices.get(userId)!.add(channelId);

  // 在 ws 上记录设备类型（desktop | web），dispatch 时按设备类型路由
  // 默认 web：保持向后兼容（旧桌面端未传 deviceType 时不应被当作 web，
  // 但桌面端 ws_client.rs 已同步增加该字段，新版本会显式传 "desktop"）
  const deviceType = data.deviceType === "desktop" ? "desktop" : "web";
  (ws as WebSocket & { deviceType?: string }).deviceType = deviceType;

  // 写入数据库
  try {
    await prisma.pcSession.create({
      data: {
        userId,
        deviceName: data.deviceName || "未命名设备",
        agentVersion: data.agentVersion || "1.0.0",
        capabilities: data.capabilities || [],
        wsChannelId: channelId,
        status: "online",
        authMode: data.authMode || "approve",
        lastHeartbeat: new Date(),
      },
    }).catch(async () => {
      // channelId 冲突时更新
      await prisma.pcSession.updateMany({
        where: { wsChannelId: channelId },
        data: {
          status: "online",
          lastHeartbeat: new Date(),
        },
      });
    });
  } catch (e) {
    console.error("[ws-gateway] 写入 PcSession 失败:", e);
  }

  // 关联 channelId 到 ws（用于后续消息路由）
  (ws as WebSocket & { channelId?: string }).channelId = channelId;
  (ws as WebSocket & { userId?: string }).userId = userId;

  logger.info(`[ws-gateway] 设备上线: user=${userId} type=${deviceType} device=${data.deviceName} channel=${channelId}`);

  // 回复注册成功
  sendJson(ws, {
    type: "registered",
    channelId,
    message: "已注册到云端状态中心",
  });

  return channelId;
}

/** 心跳更新 */
async function heartbeat(channelId: string) {
  try {
    await prisma.pcSession.updateMany({
      where: { wsChannelId: channelId },
      data: { lastHeartbeat: new Date(), status: "online" },
    });
  } catch (e) {
    console.error("[ws-gateway] 心跳更新失败:", e);
  }
}

/** PC 离线 */
async function deviceOffline(channelId: string) {
  connections.delete(channelId);

  // 从用户设备组移除
  for (const [userId, channels] of userDevices.entries()) {
    if (channels.has(channelId)) {
      channels.delete(channelId);
      if (channels.size === 0) {
        userDevices.delete(userId);
      }
      // 更新数据库状态
      try {
        await prisma.pcSession.updateMany({
          where: { wsChannelId: channelId },
          data: { status: "offline" },
        });
      } catch (e) {
        console.error("[ws-gateway] 离线状态更新失败:", e);
      }
      logger.info(`[ws-gateway] PC 离线: user=${userId} channel=${channelId}`);
      break;
    }
  }
}

/** 下发远程指令到目标 PC */
async function dispatchRemoteCommand(
  userId: string,
  commandId: string,
  command: string,
  targetDeviceId?: string
): Promise<{ dispatched: boolean; reason?: string }> {
  const channels = userDevices.get(userId);
  if (!channels || channels.size === 0) {
    return { dispatched: false, reason: "没有在线的 PC，请先在电脑上启动桌面端" };
  }

  // 选择目标设备
  let targetChannel: string | undefined;

  // 系统命令（__LYNN_CMD__:）只派给 desktop 类型设备，避免误派回 Web 端
  // Web 端无法执行安装/启动/停止等本地系统操作
  if (command.startsWith("__LYNN_CMD__:")) {
    for (const channelId of channels) {
      const ws = connections.get(channelId) as (WebSocket & { deviceType?: string }) | undefined;
      if (ws && ws.deviceType === "desktop" && ws.readyState === WebSocket.OPEN) {
        targetChannel = channelId;
        break;
      }
    }
    if (!targetChannel) {
      return { dispatched: false, reason: "需要桌面端在线才能执行系统命令" };
    }
  } else if (targetDeviceId) {
    // 指定设备：targetDeviceId 可以是 channelId 或 deviceName
    if (channels.has(targetDeviceId)) {
      targetChannel = targetDeviceId;
    } else {
      // 按 deviceName 查找
      try {
        const session = await prisma.pcSession.findFirst({
          where: { userId, deviceName: targetDeviceId, status: "online" },
        });
        if (session && channels.has(session.wsChannelId)) {
          targetChannel = session.wsChannelId;
        }
      } catch {}
    }
    if (!targetChannel) {
      return { dispatched: false, reason: `未找到目标设备: ${targetDeviceId}` };
    }
  } else {
    // 默认：取第一个在线设备
    targetChannel = channels.values().next().value;
  }

  const ws = targetChannel ? connections.get(targetChannel) : undefined;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return { dispatched: false, reason: "目标设备连接已断开" };
  }

  // 下发指令
  sendJson(ws, {
    type: "remote-command",
    commandId,
    command,
    timestamp: Date.now(),
  });

  logger.info(`[ws-gateway] 指令已下发: cmd=${commandId} target=${targetChannel}`);
  return { dispatched: true };
}

/** 处理 PC 回传的进度/结果
 *
 * 消息格式（来自桌面端 ws_client.rs）：
 * {
 *   type: "command-update",       // 外层 type，用于消息路由
 *   commandId: string,
 *   status: "executing" | "completed" | "failed",
 *   step?: string,                // 进度描述
 *   percent?: number,             // 0-100
 *   result?: unknown,             // 执行结果（completed 时有值）
 *   error?: string                // 错误信息（failed 时有值）
 * }
 */
async function handleCommandUpdate(
  data: { commandId: string; status: string; step?: string; percent?: number; result?: unknown; error?: string }
) {
  // 转发给所有订阅该指令的 WS（安卓端/Web端）
  const watchers = commandWatchers.get(data.commandId);
  if (watchers) {
    for (const ws of watchers) {
      sendJson(ws, data);
    }
  }

  // 更新数据库
  try {
    if (data.status === "completed" || data.status === "failed") {
      // 提取桌面端回传的 route 和 durationMs（如有）
      const updateData: Record<string, unknown> = {
        status: data.status,
        result: data.result as never,
        error: data.error,
        completedAt: new Date(),
      };
      if (data.result && typeof data.result === "object") {
        const r = data.result as Record<string, unknown>;
        if (typeof r.route === "string") updateData.route = r.route;
        if (typeof r.durationMs === "number") updateData.durationMs = r.durationMs;
      }
      await prisma.remoteCommand.updateMany({
        where: { commandId: data.commandId },
        data: updateData as never,
      });
      commandWatchers.delete(data.commandId);
      logger.info(`[ws-gateway] 指令完成: cmd=${data.commandId} status=${data.status}`);
    } else if (data.status === "executing") {
      // executing 阶段也更新 route（如已确定路由类型）
      const updateData: Record<string, unknown> = { status: "executing" };
      if (data.result && typeof data.result === "object") {
        const r = data.result as Record<string, unknown>;
        if (typeof r.route === "string") updateData.route = r.route;
      }
      await prisma.remoteCommand.updateMany({
        where: { commandId: data.commandId },
        data: updateData as never,
      });
    }
  } catch (e) {
    logger.error({ err: e }, `[ws-gateway] 指令状态更新失败: cmd=${data.commandId}`);
  }
}

// ============ HTTP 端点（用于安卓端/Web端发起指令） ============

const server = createServer(async (req, res) => {
  const corsHeaders = getCorsHeaders(req.headers.origin ?? null);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // POST /dispatch - 发起远程指令（JWT 或内部 Key 认证）
  if (req.method === "POST" && req.url === "/dispatch") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const parsed = JSON.parse(body);
      // 认证：优先 JWT，其次内部服务间调用
      let authUserId = await authenticateHttpRequest(req);
      if (!authUserId && authenticateInternal(req) && parsed.userId) {
        authUserId = parsed.userId;
      }
      if (!authUserId) {
        res.writeHead(401, { "Content-Type": "application/json", ...corsHeaders });
        res.end(JSON.stringify({ error: "未认证或 token 无效" }));
        return;
      }
      const { command, commandId, targetDeviceId } = parsed;
      if (!command || !commandId) {
        res.writeHead(400, { "Content-Type": "application/json", ...corsHeaders });
        res.end(JSON.stringify({ error: "缺少 command/commandId" }));
        return;
      }
      const result = await dispatchRemoteCommand(authUserId, commandId, command, targetDeviceId);
      res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json", ...corsHeaders });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
    return;
  }

  // GET /devices - 查询当前认证用户的在线设备（JWT 或内部 Key 认证）
  if (req.method === "GET" && req.url?.startsWith("/devices")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let authUserId = await authenticateHttpRequest(req);
    if (!authUserId && authenticateInternal(req)) {
      authUserId = url.searchParams.get("userId");
    }
    if (!authUserId) {
      res.writeHead(401, { "Content-Type": "application/json", ...corsHeaders });
      res.end(JSON.stringify({ error: "未认证或 token 无效" }));
      return;
    }
    // 仅返回当前认证用户的设备（防止越权查询他人设备）
    const channels = userDevices.get(authUserId) || new Set<string>();
    const devices: Array<{ channelId: string; deviceName?: string; deviceType?: string }> = [];
    for (const channelId of channels) {
      const ws = connections.get(channelId) as (WebSocket & { deviceName?: string; deviceType?: string }) | undefined;
      devices.push({
        channelId,
        deviceName: ws?.deviceName,
        deviceType: ws?.deviceType,
      });
    }
    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ devices }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json", ...corsHeaders });
  res.end(JSON.stringify({ error: "Not found" }));
});

// ============ WebSocket 服务 ============

const wss = new WebSocketServer({ server, path: "/api/ws/agent" });

wss.on("connection", async (ws: WebSocket, req: import("http").IncomingMessage) => {
  // 认证改为在收到 register 消息时进行（token 在消息体内，不在 URL 中）
  // 这样 token 不会暴露在 Nginx access log 中，更安全
  let authenticatedUserId: string | null = null;
  let authDeadline = setTimeout(() => {
    if (!authenticatedUserId) {
      sendJson(ws, { type: "error", message: "认证超时：未在 10 秒内发送 register 消息" });
      ws.close(4002, "认证超时");
    }
  }, 10000);

  logger.info(`[ws-gateway] 新 WS 连接，等待 register 消息`);

  ws.on("message", async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      const msgType = msg.type;

      if (msgType === "register") {
        // 首条消息：从消息体读 token 鉴权
        const token = msg.token || "";
        const userId = await authenticate(token);
        if (!userId) {
          sendJson(ws, { type: "error", message: "认证失败：无效的 token" });
          ws.close(4001, "认证失败");
          return;
        }
        authenticatedUserId = userId;
        clearTimeout(authDeadline);
        logger.info(`[ws-gateway] PC 认证成功: user=${userId}`);

        const channelId = await registerDevice(ws, userId, {
          deviceName: msg.deviceName,
          agentVersion: msg.agentVersion,
          capabilities: msg.capabilities,
          authMode: msg.authMode,
          deviceType: msg.deviceType,
        });
        (ws as WebSocket & { deviceName?: string }).deviceName = msg.deviceName;
        // 推送现有指令订阅
      } else if (msgType === "heartbeat") {
        // 心跳必须在认证后
        if (!authenticatedUserId) return;
        const channelId = (ws as WebSocket & { channelId?: string }).channelId;
        if (channelId) await heartbeat(channelId);
      } else if (msgType === "command-update") {
        if (!authenticatedUserId) return;
        await handleCommandUpdate(msg);
      } else if (msgType === "watch-command") {
        // 安卓端/Web端订阅指令进度
        const commandId = msg.commandId;
        if (!commandWatchers.has(commandId)) {
          commandWatchers.set(commandId, new Set());
        }
        commandWatchers.get(commandId)!.add(ws);
        sendJson(ws, { type: "watching", commandId });
      } else if (msgType === "unwatch-command") {
        const commandId = msg.commandId;
        commandWatchers.get(commandId)?.delete(ws);
      } else {
        sendJson(ws, { type: "error", message: `未知消息类型: ${msgType}` });
      }
    } catch (e) {
      console.error("[ws-gateway] 消息处理失败:", e);
      sendJson(ws, { type: "error", message: (e as Error).message });
    }
  });

  ws.on("close", async () => {
    clearTimeout(authDeadline);
    const channelId = (ws as WebSocket & { channelId?: string }).channelId;
    if (channelId) {
      await deviceOffline(channelId);
    }
    // 从所有 commandWatchers 中移除该 ws
    for (const [cmdId, watchers] of commandWatchers.entries()) {
      watchers.delete(ws);
      if (watchers.size === 0) commandWatchers.delete(cmdId);
    }
  });

  ws.on("error", (err: Error) => {
    console.error("[ws-gateway] WS 错误:", err);
  });
});

// ============ 定时清理超时离线 PC ============

setInterval(async () => {
  const threshold = new Date(Date.now() - 90 * 1000); // 90秒未心跳视为离线
  try {
    await prisma.pcSession.updateMany({
      where: {
        status: "online",
        lastHeartbeat: { lt: threshold },
      },
      data: { status: "offline" },
    });
  } catch (e) {
    console.error("[ws-gateway] 清理超时 PC 失败:", e);
  }
}, 30 * 1000);

// ============ 启动 ============

server.listen(PORT, () => {
  logger.info(`[ws-gateway] WebSocket 状态中心已启动，端口 ${PORT}`);
  logger.info(`[ws-gateway] WS 端点: ws://localhost:${PORT}/api/ws/agent`);
  logger.info(`[ws-gateway] HTTP 端点: http://localhost:${PORT}/dispatch, /devices`);
});

// 优雅关闭
process.on("SIGINT", async () => {
  logger.info("[ws-gateway] 正在关闭...");
  for (const [channelId, ws] of connections) {
    try { ws.close(1001, "服务关闭"); } catch {}
    await deviceOffline(channelId);
  }
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
