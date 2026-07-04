"use client";

import { useEffect, useRef, useState } from "react";
import {
  type WSClientMessage,
  type WSServerMessage,
  type WSRemoteCommandMessage,
  type WSCommandUpdateMessage,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_RECONNECT_DELAY_MS,
} from "@lynnhub/shared";

// ============ 依赖注入接口 ============

/** 获取当前用户 ID（注入，替代 fetch /api/auth/session） */
export type GetUserId = () => Promise<string | null>;

/** 本地命令执行结果 */
export interface LocalCommandResult {
  success: boolean;
  output: string;
  error?: string;
  /** 执行路由（dashboard / local / web-rejected 等） */
  route?: string;
  /** 执行耗时（毫秒） */
  durationMs?: number;
}

/** 执行本地命令（注入，替代 fetch 127.0.0.1:9119/api/execute）
 *
 * 各端实现：
 * - Web 端：fetch 本地 HermesAgent Dashboard（127.0.0.1:9119）
 * - 桌面端：调用本地进程 / IPC
 * - RN 端：调用原生模块
 *
 * 注意：系统命令（__LYNN_CMD__:）的处理由各端实现决定，
 * Web 端应返回 web-rejected 错误，桌面端应实际执行。
 */
export type ExecuteLocalCommand = (
  command: string,
  options?: { timeout?: number }
) => Promise<LocalCommandResult>;

/** useDeviceWs 参数（全部通过依赖注入接收平台特定能力） */
export interface UseDeviceWsParams {
  /** 获取当前用户 ID（替代 fetch /api/auth/session） */
  getUserId: GetUserId;
  /** WS 网关完整 URL（如 "wss://ai.lynxdo.com/api/ws/agent"） */
  wsBaseUrl: string;
  /** 设备名称（如 "Web-Chrome-ai.lynxdo.com"、"Desktop-WIN-PC"） */
  deviceName: string;
  /** 执行本地命令（替代 fetch 127.0.0.1:9119） */
  executeLocalCommand: ExecuteLocalCommand;
  /** 设备能力列表（默认 ["browser", "desktop", "file", "shell"]） */
  capabilities?: string[];
  /** 授权模式（默认 "approve"） */
  authMode?: "approve" | "once" | "free";
  /** 设备类型（默认 "web"，网关据此分发系统命令） */
  deviceType?: "web" | "desktop" | "mobile";
  /** Agent 版本号（默认 "shared-1.0.0"） */
  agentVersion?: string;
}

// ============ Hook 返回值 ============

export interface UseDeviceWsReturn {
  /** WebSocket 实例引用（各端可直接访问） */
  wsRef: React.MutableRefObject<WebSocket | null>;
  /** 是否已连接 */
  connected: boolean;
}

// ============ Hook 实现 ============

/**
 * 设备 WS 客户端 hook（跨端共享版本）
 *
 * 从 src/hooks/use-device-ws.ts 抽离：
 * - 注册 / 心跳 / 断线重连 / remote-command 处理
 * - 使用 @lynnhub/shared 的 WSClientMessage/WSServerMessage 类型
 *
 * 平台特定能力全部通过依赖注入接收：
 * - getUserId → 替代 fetch /api/auth/session
 * - wsBaseUrl → 替代 window.location 推导
 * - deviceName → 替代 navigator.userAgent 检测
 * - executeLocalCommand → 替代 fetch 127.0.0.1:9119
 *
 * 不依赖 window.location / navigator.userAgent。
 * WebSocket 构造函数直接使用（Web/RN 均原生支持）。
 */
export function useDeviceWs(params: UseDeviceWsParams): UseDeviceWsReturn {
  const {
    getUserId,
    wsBaseUrl,
    deviceName,
    executeLocalCommand,
    capabilities = ["browser", "desktop", "file", "shell"],
    authMode = "approve",
    deviceType = "web",
    agentVersion = "shared-1.0.0",
  } = params;

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    let closed = false;

    const sendJson = (ws: WebSocket, data: WSClientMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    /**
     * 处理远程指令：
     * 1. 系统命令（__LYNN_CMD__:）由注入的 executeLocalCommand 决定是否执行
     * 2. 先回传 executing 状态
     * 3. 调用注入的 executeLocalCommand
     * 4. 回传 completed/failed 结果
     */
    const handleRemoteCommand = async (
      ws: WebSocket,
      msg: WSRemoteCommandMessage
    ) => {
      const { commandId, command } = msg;

      // 回传 executing
      const executingMsg: WSCommandUpdateMessage = {
        type: "command-update",
        commandId,
        status: "executing",
        percent: 0,
      };
      sendJson(ws, executingMsg);

      let result: LocalCommandResult;
      try {
        result = await executeLocalCommand(command, { timeout: 120 });
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        result = {
          success: false,
          output: "",
          error: isAbort ? "本地执行超时（120秒）" : "本地执行异常",
          route: "execute-error",
        };
      }

      // 回传最终结果（error 提升到顶层，与 WS 网关协议一致）
      const resultMsg: WSCommandUpdateMessage = {
        type: "command-update",
        commandId,
        status: result.success ? "completed" : "failed",
        error: result.error,
        result: {
          success: result.success,
          output: result.output,
          route: result.route,
          durationMs: result.durationMs || 0,
        },
      };
      sendJson(ws, resultMsg);
    };

    const connect = async () => {
      if (!mounted || closed) return;

      try {
        // 1. 获取用户 ID（通过注入，替代 fetch /api/auth/session）
        const userId = await getUserId();
        if (!userId) return;

        if (!mounted || closed) return;

        // P0 修复：ws-gateway 仅接受 JWT 三段式 token，拒绝 `user:<id>` 旧格式
        // 调用 /api/auth/ws-token（Web 端用 session cookie 自动认证，桌面端用 Bearer JWT）
        // 获取新鲜短期 JWT 用于 WS 注册
        let wsToken: string;
        try {
          const resp = await fetch("/api/auth/ws-token", { credentials: "include" });
          if (!resp.ok) {
            console.warn(`[useDeviceWs] 获取 WS token 失败: HTTP ${resp.status}`);
            return;
          }
          const data = await resp.json();
          wsToken = data.token;
        } catch (e) {
          console.warn("[useDeviceWs] 获取 WS token 异常:", e);
          return;
        }

        // 2. 使用注入的 wsBaseUrl（替代 window.location 推导）
        const ws = new WebSocket(wsBaseUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          // 发送 register 消息（使用 @lynnhub/shared 的 WSRegisterMessage 类型）
          const registerMsg: WSClientMessage = {
            type: "register",
            token: wsToken,
            agentVersion,
            deviceName,
            capabilities,
            authMode,
            deviceType,
          };
          ws.send(JSON.stringify(registerMsg));
          setConnected(true);

          // 心跳（间隔来自 @lynnhub/shared 常量）
          heartbeatRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              const heartbeatMsg: WSClientMessage = { type: "heartbeat" };
              ws.send(JSON.stringify(heartbeatMsg));
            }
          }, WS_HEARTBEAT_INTERVAL_MS);
        };

        ws.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data) as WSServerMessage;
            if (msg.type === "remote-command") {
              await handleRemoteCommand(ws, msg);
            }
          } catch {
            // 忽略解析错误
          }
        };

        ws.onclose = () => {
          setConnected(false);
          if (heartbeatRef.current) clearInterval(heartbeatRef.current);
          // 断线重连（延迟来自 @lynnhub/shared 常量）
          if (mounted && !closed) {
            reconnectRef.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
          }
        };

        ws.onerror = () => {
          // 错误由 onclose 处理重连
        };
      } catch {
        // getUserId 失败，延迟后重试
        if (mounted && !closed) {
          reconnectRef.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      closed = true;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [
    getUserId,
    wsBaseUrl,
    deviceName,
    executeLocalCommand,
    capabilities,
    authMode,
    deviceType,
    agentVersion,
  ]);

  return { wsRef, connected };
}
