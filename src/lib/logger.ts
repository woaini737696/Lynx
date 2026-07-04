import pino from "pino";

// 统一日志器：生产环境 JSON 输出，开发环境同样使用 JSON（避免 pino-pretty 的 node:worker_threads 依赖不兼容 Webpack 打包）
// 如需开发环境彩色输出，可设置 LOG_LEVEL=debug 并使用 pino 的 transport 机制（仅在 Node.js 运行时加载，不经过 Webpack）
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // 统一时间戳格式：ISO 字符串便于日志聚合工具解析
  timestamp: pino.stdTimeFunctions.isoTime,
});

/** 获取模块级子日志器，自动附加 module 字段 */
export function getLogger(name: string) {
  return logger.child({ module: name });
}

// ============ 服务端结构化日志辅助函数 ============
// 统一关键字段：module / event / userId / sessionId / requestId / error / durationMs
// 便于后续接入 ELK / Loki 等日志聚合系统进行检索

type LogLevel = "info" | "warn" | "error" | "debug" | "fatal";

interface LogContext {
  [key: string]: unknown;
}

/** 通用结构化日志函数 */
function logAt(level: LogLevel, module: string, event: string, context?: LogContext, error?: unknown) {
  const child = logger.child({ module });
  const payload: LogContext = { event, ...context };
  if (error instanceof Error) {
    payload.error = error.message;
    payload.stack = error.stack;
  } else if (error !== undefined) {
    payload.error = String(error);
  }
  child[level](payload);
}

/** 模块化日志助手：每个业务模块独立 namespace，避免日志互相干扰 */
export const serverLog = {
  /** AI 对话相关日志（流式响应、消息持久化、工具调用） */
  ai: (event: string, context?: LogContext, error?: unknown) =>
    logAt("info", "ai-chat", event, context, error),
  aiWarn: (event: string, context?: LogContext, error?: unknown) =>
    logAt("warn", "ai-chat", event, context, error),
  aiError: (event: string, context?: LogContext, error?: unknown) =>
    logAt("error", "ai-chat", event, context, error),

  /** TTS / ASR / 语音通话相关日志 */
  voice: (event: string, context?: LogContext, error?: unknown) =>
    logAt("info", "voice", event, context, error),
  voiceWarn: (event: string, context?: LogContext, error?: unknown) =>
    logAt("warn", "voice", event, context, error),
  voiceError: (event: string, context?: LogContext, error?: unknown) =>
    logAt("error", "voice", event, context, error),

  /** 飞书 OAuth / 任务同步相关日志 */
  feishu: (event: string, context?: LogContext, error?: unknown) =>
    logAt("info", "feishu", event, context, error),
  feishuWarn: (event: string, context?: LogContext, error?: unknown) =>
    logAt("warn", "feishu", event, context, error),
  feishuError: (event: string, context?: LogContext, error?: unknown) =>
    logAt("error", "feishu", event, context, error),

  /** WebSocket 连接 / 远程操控相关日志 */
  ws: (event: string, context?: LogContext, error?: unknown) =>
    logAt("info", "ws-gateway", event, context, error),
  wsWarn: (event: string, context?: LogContext, error?: unknown) =>
    logAt("warn", "ws-gateway", event, context, error),
  wsError: (event: string, context?: LogContext, error?: unknown) =>
    logAt("error", "ws-gateway", event, context, error),

  /** 用户认证 / Credits 扣费相关日志 */
  auth: (event: string, context?: LogContext, error?: unknown) =>
    logAt("info", "auth", event, context, error),
  authWarn: (event: string, context?: LogContext, error?: unknown) =>
    logAt("warn", "auth", event, context, error),
  authError: (event: string, context?: LogContext, error?: unknown) =>
    logAt("error", "auth", event, context, error),

  /** 通用日志（未归类的模块） */
  generic: (module: string, event: string, context?: LogContext, error?: unknown) =>
    logAt("info", module, event, context, error),
  genericWarn: (module: string, event: string, context?: LogContext, error?: unknown) =>
    logAt("warn", module, event, context, error),
  genericError: (module: string, event: string, context?: LogContext, error?: unknown) =>
    logAt("error", module, event, context, error),
};

// ============ 客户端日志（浏览器） ============
// 已抽离到 src/lib/client-logger.ts，避免 pino 被打包到客户端
// 客户端代码请 import { clientLog } from "@/lib/client-logger"
// 此文件（logger.ts）仅供服务端使用，禁止在 "use client" 文件中 import
