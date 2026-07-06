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

        // P0 修复：Web 端用 JWT token 注册 WS（ws-gateway 仅接受 JWT 三段式）
        // 原先用 `user:<id>` 会被 ws-gateway 拒绝并 close(4001)
        const tokenRes = await fetch("/api/auth/ws-token");
        if (!tokenRes.ok) return;
        const { token: wsToken } = await tokenRes.json();
        if (!wsToken) return;

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
              // 标记为 Web 端：网关据此把 __LYNN_CMD__: 系统命令只派给桌面端
              deviceType: "web",
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

  // 系统命令（__LYNN_CMD__:）只能由桌面端执行（安装/启动/停止 HermesAgent 等）
  // Web 端即使被误派也不应去 fetch 127.0.0.1:9119（跨机器场景必然失败），
  // 直接回传清晰错误，避免误导性的"无法连接 Dashboard"
  if (command.startsWith("__LYNN_CMD__:")) {
    sendJson(ws, {
      type: "command-update",
      commandId,
      status: "failed",
      error: "Web 端无法执行系统命令（安装/启动/停止），请在桌面端操作",
      result: {
        success: false,
        output: "",
        route: "web-rejected",
        durationMs: 0,
      },
    });
    return;
  }

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
      const output: string = data.output || data.result || "";
      const executed = data.executed;
      const actionsExecuted = data.actions_executed;
      const hasExecutedFlag = executed === true;
      const hasActions = Array.isArray(actionsExecuted) && actionsExecuted.length > 0;

      // 真实性校验：与 ws_client.rs / hermes-client.ts 保持一致
      const fakeSuccessKeywords = [
        "无法直接控制", "无法控制你的设备", "你可以按以下步骤",
        "请手动", "手动打开", "手动操作", "请按以下步骤",
        "你可以通过以下方式", "步骤如下",
      ];
      const isFakeSuccess = !hasExecutedFlag && !hasActions &&
        typeof output === "string" &&
        fakeSuccessKeywords.some(kw => output.includes(kw));

      if (isFakeSuccess) {
        result = {
          success: false,
          output: "",
          error: "HermesAgent 未能真正执行操作（LLM 返回了教程式文本而非实际执行动作）。请确保 HermesAgent 已更新到最新版本。",
          route: "dashboard-fake-detected",
        };
      } else {
        result = {
          success: data.success !== false,
          output,
          error: data.error,
          route: "dashboard",
          durationMs: data.durationMs,
        };
      }
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
          ? "无法连接本地 HermesAgent Dashboard（127.0.0.1:9119）。请在「设置 → 奇思 Agent」中点击「一键启动」启动 Dashboard，或点击「检查更新」确保已安装最新版本。"
          : "此设备未安装 HermesAgent 或 Dashboard 未启动。请在「设置 → 奇思 Agent」中点击「一键安装」和「一键启动」。",
      route: "no-agent",
    };
  }

  // 回传最终结果（error 提升到顶层，与桌面端 ws_client.rs 和 WS 网关一致）
  sendJson(ws, {
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
  });
}

function sendJson(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
