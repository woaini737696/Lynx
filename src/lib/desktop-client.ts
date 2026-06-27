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
    };
  }
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

/** 是否运行在浏览器（Web端）环境 */
export function isWeb(): boolean {
  return !isDesktop();
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

// ============ 桌面端能力封装 ============

export interface AgentStatus {
  version: string;
  wsConnected: boolean;
  cloudEndpoint: string;
  authMode: "approve" | "once" | "free";
  authorizedDirs: string[];
  capabilities: string[];
  hasToken: boolean;
}

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

/** 获取授权目录列表 */
export async function getAuthorizedDirs(): Promise<string[] | null> {
  if (!isDesktop()) return null;
  return invoke<string[]>("get_authorized_dirs");
}

/** 移除授权目录 */
export async function removeAuthorizedDir(dir: string): Promise<string[]> {
  return invoke<string[]>("remove_authorized_dir", { dir });
}

/** 触发紧急停止 */
export async function emergencyStop(): Promise<string> {
  return invoke<string>("emergency_stop");
}

/** 检查紧急停止状态 */
export async function isEmergencyStop(): Promise<boolean> {
  return invoke<boolean>("is_emergency_stop");
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

/** 执行 AI 助理指令（核心入口） */
export async function executeAssistantCommand(
  command: string,
  targetDevice?: string
): Promise<unknown> {
  return invoke("execute_assistant_command", { command, targetDevice });
}

/** 一键安装 AI 环境 */
export async function installAiEnv(): Promise<{
  success: boolean;
  message: string;
  status: Record<string, unknown>;
}> {
  return invoke("install_ai_env");
}

/** 检测 AI 环境 */
export async function detectAiEnv(): Promise<Record<string, unknown> | null> {
  if (!isDesktop()) return null;
  return invoke<Record<string, unknown>>("detect_ai_env");
}

/** 启动 HermesAgent 本地进程 */
export async function startHermesAgent(): Promise<void> {
  return invoke<void>("start_hermes_agent");
}

/** 打开外部链接 */
export async function openExternal(url: string): Promise<void> {
  if (isDesktop()) {
    await invoke<void>("open_external", { url });
  } else {
    window.open(url, "_blank");
  }
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

export async function onRemoteCommand(
  handler: (r: { commandId: string; command: string }) => void
): Promise<(() => void) | null> {
  return listen("remote-command-received", handler);
}

export async function onCommandProgress(
  handler: (r: { commandId: string; step: string; percent: number }) => void
): Promise<(() => void) | null> {
  return listen("command-progress", handler);
}

export async function onCommandComplete(
  handler: (r: { commandId: string; result: unknown }) => void
): Promise<(() => void) | null> {
  return listen("command-complete", handler);
}

export async function onEmergencyStop(handler: () => void): Promise<(() => void) | null> {
  return listen("emergency-stop", handler);
}

export async function onEmergencyReset(handler: () => void): Promise<(() => void) | null> {
  return listen("emergency-reset", handler);
}

export {};
