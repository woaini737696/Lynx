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

import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

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

/** 验证 token 并返回 userId（简化版：直接用 token 查 PcSession，或扩展为查 User） */
async function authenticate(token: string): Promise<string | null> {
  if (!token) return null;
  // 简化实现：token 格式为 "user:<userId>"，由桌面端登录后生成
  // 生产环境应查 JWT
  if (token.startsWith("user:")) {
    return token.slice(5);
  }
  // 兼容：直接视为 userId（开发期）
  return token;
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

  console.log(`[ws-gateway] PC 上线: user=${userId} device=${data.deviceName} channel=${channelId}`);

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
      console.log(`[ws-gateway] PC 离线: user=${userId} channel=${channelId}`);
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
  if (targetDeviceId) {
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

  console.log(`[ws-gateway] 指令已下发: cmd=${commandId} target=${targetChannel}`);
  return { dispatched: true };
}

/** 处理 PC 回传的进度/结果 */
async function handleCommandUpdate(
  data: { commandId: string; type: string; step?: string; percent?: number; result?: unknown; error?: string }
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
    if (data.type === "complete") {
      await prisma.remoteCommand.updateMany({
        where: { commandId: data.commandId },
        data: {
          status: data.error ? "failed" : "completed",
          result: data.result as never,
          error: data.error,
          completedAt: new Date(),
        },
      });
      commandWatchers.delete(data.commandId);
    } else if (data.type === "progress") {
      await prisma.remoteCommand.updateMany({
        where: { commandId: data.commandId },
        data: { status: "executing" },
      });
    }
  } catch (e) {
    console.error("[ws-gateway] 指令状态更新失败:", e);
  }
}

// ============ HTTP 端点（用于安卓端/Web端发起指令） ============

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  // POST /dispatch - 发起远程指令
  if (req.method === "POST" && req.url === "/dispatch") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { userId, command, commandId, targetDeviceId } = JSON.parse(body);
      if (!userId || !command || !commandId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "缺少 userId/command/commandId" }));
        return;
      }
      const result = await dispatchRemoteCommand(userId, commandId, command, targetDeviceId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
    return;
  }

  // GET /devices?userId=xxx - 查询用户在线设备
  if (req.method === "GET" && req.url?.startsWith("/devices")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "缺少 userId" }));
      return;
    }
    const channels = userDevices.get(userId) || new Set<string>();
    const devices: Array<{ channelId: string; deviceName?: string }> = [];
    for (const channelId of channels) {
      const ws = connections.get(channelId) as (WebSocket & { deviceName?: string }) | undefined;
      devices.push({
        channelId,
        deviceName: ws?.deviceName,
      });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ devices }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// ============ WebSocket 服务 ============

const wss = new WebSocketServer({ server, path: "/api/ws/agent" });

wss.on("connection", async (ws: WebSocket, req: import("http").IncomingMessage) => {
  const url = new URL(req.url || "", `http://localhost:${PORT}`);
  const token = url.searchParams.get("token") || "";

  const userId = await authenticate(token);
  if (!userId) {
    sendJson(ws, { type: "error", message: "认证失败：无效的 token" });
    ws.close(4001, "认证失败");
    return;
  }

  console.log(`[ws-gateway] 新 WS 连接: user=${userId}`);

  ws.on("message", async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      const msgType = msg.type;

      if (msgType === "register") {
        const channelId = await registerDevice(ws, userId, {
          deviceName: msg.deviceName,
          agentVersion: msg.agentVersion,
          capabilities: msg.capabilities,
          authMode: msg.authMode,
        });
        (ws as WebSocket & { deviceName?: string }).deviceName = msg.deviceName;
        // 推送现有指令订阅
      } else if (msgType === "heartbeat") {
        const channelId = (ws as WebSocket & { channelId?: string }).channelId;
        if (channelId) await heartbeat(channelId);
      } else if (msgType === "command-update") {
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
  console.log(`[ws-gateway] WebSocket 状态中心已启动，端口 ${PORT}`);
  console.log(`[ws-gateway] WS 端点: ws://localhost:${PORT}/api/ws/agent`);
  console.log(`[ws-gateway] HTTP 端点: http://localhost:${PORT}/dispatch, /devices`);
});

// 优雅关闭
process.on("SIGINT", async () => {
  console.log("[ws-gateway] 正在关闭...");
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
