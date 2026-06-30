"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Web 端设备 WS 注册 Hook
 *
 * 让 Web 端也作为"在线设备"注册到 WS 网关，与桌面端走完全相同的流程。
 * 这样 AI 助理 / 其他端就能远程下发指令到这台电脑。
 *
 * 注册流程（与桌面端 DesktopBridge.tsx 完全一致）：
 *   1. fetch /api/auth/session 获取 userId
 *   2. 用 `user:<userId>` 作为 token 注册 WS
 *
 * 收到 remote-command 时：
 *   1. 调用本地 HermesAgent Dashboard (127.0.0.1:9119/api/execute)
 *   2. 有则执行，没有则回传错误
 *   3. 通过 WS 回传执行结果
 *
 * 多设备互相操控：
 *   - 电脑 A（桌面端）和电脑 B（Web 端）都注册为在线设备
 *   - AI 助理可以指定下发到任意设备
 */
export function useDeviceWs() {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    let closed = false;

    const connect = async () => {
      if (!mounted || closed) return;

      try {
        // 1. 获取 session（与桌面端 DesktopBridge 相同的方式）
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const session = await res.json();
        if (!session?.user?.id) return;

        if (!mounted || closed) return;

        const wsToken = `user:${session.user.id}`;

        // 2. 从当前页面 origin 推导 WS URL
        const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws/agent`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          // 发送 register 消息（与桌面端相同的协议）
          ws.send(
            JSON.stringify({
              type: "register",
              token: wsToken,
              agentVersion: "web-1.0.0",
              deviceName: getWebDeviceName(),
              capabilities: ["browser", "desktop", "file", "shell"],
              authMode: "approve",
            })
          );
          setConnected(true);

          // 30 秒心跳
          heartbeatRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "heartbeat" }));
            }
          }, 30_000);
        };

        ws.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data);
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
          // 断线重连（10 秒后，避免频繁重连）
          if (mounted && !closed) {
            reconnectRef.current = setTimeout(connect, 10_000);
          }
        };

        ws.onerror = () => {
          // 错误由 onclose 处理重连
        };
      } catch {
        // session 获取失败，10 秒后重试
        if (mounted && !closed) {
          reconnectRef.current = setTimeout(connect, 10_000);
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
  }, []);

  return { wsRef, connected };
}

/**
 * 生成 Web 端设备名
 * 格式：Web-{browser}-{hostname}
 */
function getWebDeviceName(): string {
  const browser = detectBrowser();
  const hostname = window.location.hostname;
  return `Web-${browser}-${hostname}`;
}

function detectBrowser(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/")) return "Safari";
  return "Browser";
}

/**
 * 处理远程指令：
 * 1. 先回传 executing 状态
 * 2. 调用本地 HermesAgent Dashboard
 * 3. 回传 completed/failed 结果
 */
async function handleRemoteCommand(
  ws: WebSocket,
  msg: { commandId: string; command: string; timestamp: number }
) {
  const { commandId, command } = msg;

  // 回传 executing
  sendJson(ws, {
    type: "command-update",
    commandId,
    status: "executing",
    percent: 0,
  });

  let result: { success: boolean; output: string; error?: string; route?: string; durationMs?: number };

  try {
    // 调用本地 HermesAgent Dashboard HTTP API
    // 注意：浏览器 fetch localhost 需要 Dashboard 支持 CORS（Access-Control-Allow-Origin: *）
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    const res = await fetch("http://127.0.0.1:9119/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: command,
        timeout: 120,
        mode: "auto",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      result = {
        success: false,
        output: "",
        error: `HermesAgent Dashboard 返回 ${res.status}`,
        route: "dashboard-error",
      };
    } else {
      const data = await res.json();
      result = {
        success: data.success !== false,
        output: data.output || data.result || "",
        error: data.error,
        route: "dashboard",
        durationMs: data.durationMs,
      };
    }
  } catch (err) {
    // CORS 或连接失败的细分处理
    const isCorsError = err instanceof TypeError && err.message.includes("Failed to fetch");
    const isAbort = err instanceof Error && err.name === "AbortError";
    result = {
      success: false,
      output: "",
      error: isAbort
        ? "本地执行超时（120秒）"
        : isCorsError
          ? "无法连接本地 HermesAgent Dashboard（127.0.0.1:9119）。可能原因：1) 未安装 HermesAgent；2) Dashboard 未启动；3) CORS 限制。请在桌面端安装 HermesAgent，或确保 Dashboard 在 127.0.0.1:9119 运行并允许跨域。"
          : "此设备未安装 HermesAgent 或 Dashboard 未启动。请在桌面端安装 HermesAgent，或确保 Dashboard 在 127.0.0.1:9119 运行。",
      route: "no-agent",
    };
  }

  // 回传最终结果
  sendJson(ws, {
    type: "command-update",
    commandId,
    status: result.success ? "completed" : "failed",
    result: {
      success: result.success,
      output: result.output,
      route: result.route,
      error: result.error,
      durationMs: result.durationMs || 0,
    },
  });
}

function sendJson(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
