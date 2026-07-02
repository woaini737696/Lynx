// WebSocket 消息协议 - 三端共享
// 从 src/lib/ws-gateway.ts + src/hooks/use-device-ws.ts 抽离
// 所有 WS 消息类型集中定义，避免三端各写一遍导致协议漂移

// ============ 客户端 → 服务端 ============

/** 设备注册消息 */
export interface WSRegisterMessage {
  type: "register";
  /** JWT token（三段式）或 "user:<userId>" 临时 token */
  token: string;
  /** Agent 版本号 */
  agentVersion: string;
  /** 设备名称（如 "Web-Chrome-ai.lynxdo.com"、"Desktop-WIN-PC"） */
  deviceName: string;
  /** 设备能力列表 */
  capabilities: string[];
  /** 授权模式 */
  authMode: "approve" | "once" | "free";
  /** 设备类型（网关据此分发系统命令） */
  deviceType: "web" | "desktop" | "mobile";
}

/** 心跳消息 */
export interface WSHeartbeatMessage {
  type: "heartbeat";
}

/** 指令状态更新消息（执行端 → 网关 → 发起方） */
export interface WSCommandUpdateMessage {
  type: "command-update";
  commandId: string;
  status: "executing" | "completed" | "failed";
  /** 进度百分比（0-100，status=executing 时） */
  percent?: number;
  /** 错误信息（status=failed 时） */
  error?: string;
  /** 执行结果（status=completed/failed 时） */
  result?: {
    success: boolean;
    output: string;
    error?: string;
    /** 执行路由（dashboard / local / web-rejected 等） */
    route?: string;
    /** 执行耗时（毫秒） */
    durationMs?: number;
  };
}

/** 客户端发出的所有消息类型 */
export type WSClientMessage =
  | WSRegisterMessage
  | WSHeartbeatMessage
  | WSCommandUpdateMessage;

// ============ 服务端 → 客户端 ============

/** 注册成功响应 */
export interface WSRegisteredMessage {
  type: "registered";
  /** 服务端分配的设备 ID */
  deviceId: string;
  /** 当前在线设备列表 */
  devices?: WSDeviceInfo[];
}

/** 远程指令下发消息（网关 → 执行端） */
export interface WSRemoteCommandMessage {
  type: "remote-command";
  commandId: string;
  /** 指令内容（自然语言 prompt 或 "__LYNN_CMD__:" 前缀的系统命令） */
  command: string;
  /** 下发时间戳 */
  timestamp: number;
}

/** 设备列表变更通知 */
export interface WSDevicesChangedMessage {
  type: "devices-changed";
  devices: WSDeviceInfo[];
}

/** 服务端发出的所有消息类型 */
export type WSServerMessage =
  | WSRegisteredMessage
  | WSRemoteCommandMessage
  | WSDevicesChangedMessage;

// ============ 共享数据结构 ============

/** 在线设备信息 */
export interface WSDeviceInfo {
  deviceId: string;
  userId: string;
  deviceName: string;
  deviceType: "web" | "desktop" | "mobile";
  capabilities: string[];
  authMode: "approve" | "once" | "free";
  agentVersion: string;
  /** 最后心跳时间（ISO 字符串） */
  lastSeen: string;
}

// ============ 协议常量 ============

/** 心跳间隔（毫秒） */
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;

/** 心跳超时阈值（毫秒），超过此时间未收到心跳则认为离线 */
export const WS_HEARTBEAT_TIMEOUT_MS = 90_000;

/** 断线重连延迟（毫秒） */
export const WS_RECONNECT_DELAY_MS = 10_000;

/** 注册认证超时（毫秒），未在此时间内完成认证则断开 */
export const WS_AUTH_TIMEOUT_MS = 10_000;

/** 系统命令前缀（只有桌面端可执行） */
export const SYSTEM_COMMAND_PREFIX = "__LYNN_CMD__:";

/** 判断命令是否为系统命令 */
export function isSystemCommand(command: string): boolean {
  return command.startsWith(SYSTEM_COMMAND_PREFIX);
}
