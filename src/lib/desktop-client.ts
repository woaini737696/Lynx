// 桌面端桥接客户端
// 在 Tauri 环境中调用本地 Rust 命令；在 Web 环境中走云端 API
//
// 检测逻辑：window.__TAURI__ 存在则视为桌面端
// Tauri 2.x API 结构：window.__TAURI__.core.invoke（主路径）
// Tauri 1.x 兼容路径：window.__TAURI__.invoke

declare global {
  interface Window {
    __TAURI__?: {
      // Tauri 1.x 兼容路径
      invoke?: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      event?: {
        listen?: <T = unknown>(event: string, handler: (e: { payload: T }) => void) => Promise<() => void>;
        emit?: (event: string, payload?: unknown) => Promise<void>;
      };
      // Tauri 2.x 标准路径
      core?: {
        invoke?: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      };
      // Tauri 2.x window 模块（withGlobalTauri 注入）
      window?: {
        getCurrentWindow?: () => TauriWindow;
      };
    };
  }
}

/** Tauri 2.x 窗口实例（仅声明用到的子集） */
export interface TauriWindow {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  hide(): Promise<void>;
  show(): Promise<void>;
  setFocus(): Promise<void>;
  isMaximized(): Promise<boolean>;
  isVisible(): Promise<boolean>;
  onResized(handler: () => void): Promise<() => void>;
}

/** 获取 invoke 函数（兼容 Tauri 1.x/2.x） */
function getInvokeFn(): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null {
  const t = window.__TAURI__;
  if (!t) return null;
  // Tauri 2.x 标准路径
  if (t.core?.invoke) return t.core.invoke;
  // Tauri 1.x 兼容路径
  if (t.invoke) return t.invoke;
  return null;
}

/** 是否运行在 Tauri 桌面端环境 */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI__;
}

/** 调用 Tauri 命令（仅桌面端可用） */
export async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const fn = getInvokeFn();
  if (!fn) {
    throw new Error(`invoke('${cmd}') 仅在桌面端可用，当前为 Web 环境`);
  }
  return fn(cmd, args) as Promise<T>;
}

/** 监听 Tauri 事件 */
export async function listen<T = unknown>(
  event: string,
  handler: (payload: T) => void
): Promise<(() => void) | null> {
  const t = window.__TAURI__;
  if (!t?.event?.listen) {
    return null;
  }
  return t.event.listen<T>(event, (e) => handler(e.payload));
}

/** 触发 Tauri 事件 */
export async function emit(event: string, payload?: unknown): Promise<void> {
  const t = window.__TAURI__;
  if (!t?.event?.emit) return;
  await t.event.emit(event, payload);
}

// ============ 窗口控制（无边框自定义标题栏用） ============

/** 获取当前 Tauri 窗口实例（仅桌面端） */
export function getCurrentWindow(): TauriWindow | null {
  if (!isDesktop()) return null;
  try {
    return window.__TAURI__?.window?.getCurrentWindow?.() ?? null;
  } catch {
    return null;
  }
}

/** 最小化窗口 */
export async function windowMinimize(): Promise<void> {
  await getCurrentWindow()?.minimize();
}

/** 切换最大化/还原 */
export async function windowToggleMaximize(): Promise<void> {
  await getCurrentWindow()?.toggleMaximize();
}

/** 关闭窗口（实际最小化到托盘，由 Rust 端 CloseRequested 拦截） */
export async function windowClose(): Promise<void> {
  await getCurrentWindow()?.close();
}

/** 查询当前是否最大化 */
export async function windowIsMaximized(): Promise<boolean> {
  try {
    return (await getCurrentWindow()?.isMaximized()) ?? false;
  } catch {
    return false;
  }
}

/** 监听窗口尺寸变化（最大化/还原时更新 UI） */
export async function onWindowResized(handler: () => void): Promise<(() => void) | null> {
  const win = getCurrentWindow();
  if (!win?.onResized) return null;
  try {
    return await win.onResized(handler);
  } catch {
    return null;
  }
}

// ============ 桌面端能力封装 ============

import type { AgentStatus } from "@lynnhub/shared-types";
export type { AgentStatus };

/** 获取 HermesAgent 本地状态 */
export async function getAgentStatus(): Promise<AgentStatus | null> {
  if (!isDesktop()) return null;
  return invoke<AgentStatus>("get_agent_status");
}

/** 设置授权模式 */
export async function setAuthMode(mode: "approve" | "once" | "free"): Promise<string> {
  return invoke<string>("set_auth_mode", { payload: { mode } });
}

/** 获取当前授权模式 */
export async function getAuthMode(): Promise<string | null> {
  if (!isDesktop()) return null;
  return invoke<string>("get_auth_mode");
}

/** 添加授权目录 */
export async function addAuthorizedDir(dir: string): Promise<string[]> {
  return invoke<string[]>("add_authorized_dir", { dir });
}

/** 移除授权目录 */
export async function removeAuthorizedDir(dir: string): Promise<string[]> {
  return invoke<string[]>("remove_authorized_dir", { dir });
}

/** 触发紧急停止 */
export async function emergencyStop(): Promise<string> {
  return invoke<string>("emergency_stop");
}

/** 设置用户 Token（登录后调用） */
export async function setUserToken(token: string): Promise<void> {
  if (isDesktop()) {
    await invoke<void>("set_user_token", { token });
  }
}

/** 设置云端 endpoint */
export async function setCloudEndpoint(endpoint: string): Promise<void> {
  if (isDesktop()) {
    await invoke<void>("set_cloud_endpoint", { endpoint });
  }
}

/** 一键安装 AI 环境（仅桌面端可用） */
export async function installAiEnv(): Promise<{
  success: boolean;
  message: string;
  status: Record<string, unknown>;
}> {
  if (!isDesktop()) {
    return {
      success: false,
      message: "浏览器无法直接安装 HermesAgent。请在命令行运行 `pip install hermes-agent` 安装，或使用桌面端一键安装。",
      status: {},
    };
  }
  return invoke("install_ai_env");
}

/** 检测 AI 环境 */
export async function detectAiEnv(): Promise<Record<string, unknown> | null> {
  if (!isDesktop()) return null;
  return invoke<Record<string, unknown>>("detect_ai_env");
}

/** 启动 HermesAgent 本地进程（仅桌面端可用） */
export async function startHermesAgent(): Promise<void> {
  if (!isDesktop()) {
    throw new Error("浏览器无法直接启动 HermesAgent。请在命令行运行 `hermes dashboard --port 9119` 启动 Dashboard。");
  }
  return invoke<void>("start_hermes_agent");
}

// ============ 审批事件监听 ============

export interface ApprovalRequest {
  requestId: string;
  level: "L2" | "L3";
  action: string;
  command: string;
  timestamp: number;
}

/** 监听审批请求（桌面端弹出确认框） */
export async function onApprovalRequest(
  handler: (req: ApprovalRequest) => void
): Promise<(() => void) | null> {
  return listen<ApprovalRequest>("approval-request", handler);
}

/** 响应审批请求 */
export async function respondApproval(requestId: string, approved: boolean): Promise<void> {
  await emit("approval-response", { requestId, approved });
}

// ============ 安装进度监听 ============

export interface InstallProgress {
  step: number;
  total: number;
  message: string;
  percent: number;
}

export async function onInstallProgress(
  handler: (p: InstallProgress) => void
): Promise<(() => void) | null> {
  return listen<InstallProgress>("install-progress", handler);
}

export async function onInstallComplete(
  handler: (r: { success: boolean; status: Record<string, unknown> }) => void
): Promise<(() => void) | null> {
  return listen("install-complete", handler);
}

// ============ WS 状态监听 ============

export async function onWsConnected(handler: () => void): Promise<(() => void) | null> {
  return listen("ws-connected", handler);
}

export async function onWsDisconnected(handler: () => void): Promise<(() => void) | null> {
  return listen("ws-disconnected", handler);
}

export async function onEmergencyStop(handler: () => void): Promise<(() => void) | null> {
  return listen("emergency-stop", handler);
}

export async function onEmergencyReset(handler: () => void): Promise<(() => void) | null> {
  return listen("emergency-reset", handler);
}

export {};
