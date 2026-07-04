"use client";

// ============ 客户端日志（浏览器） ============
// 浏览器端不使用 pino（避免打包体积），仅做 console 前缀化
// 同时维护一个 100 条环形缓冲区，便于诊断面板导出 / 上报
//
// 注意：此文件必须保持零 Node.js 依赖，禁止 import 任何服务端模块（如 pino / prisma / db），
// 否则会被 Webpack 打包到客户端 chunk 中导致体积膨胀或构建失败。
// 服务端日志请使用 src/lib/logger.ts 的 serverLog / getLogger。

type ClientLogLevel = "info" | "warn" | "error" | "debug";

interface ClientLogContext {
  [key: string]: unknown;
}

const clientLogBuffer: Array<{
  level: ClientLogLevel;
  module: string;
  event: string;
  context?: ClientLogContext;
  ts: string;
}> = [];
const CLIENT_LOG_BUFFER_MAX = 100;

function writeClientLog(
  level: ClientLogLevel,
  module: string,
  event: string,
  context?: ClientLogContext,
  error?: unknown
) {
  const ts = new Date().toISOString();
  const entry = { level, module, event, context, ts };
  clientLogBuffer.push(entry);
  if (clientLogBuffer.length > CLIENT_LOG_BUFFER_MAX) clientLogBuffer.shift();

  const prefix = `[${ts}] [${module}]`;
  const ctxStr = context ? ` ${JSON.stringify(context)}` : "";
  const errStr =
    error instanceof Error
      ? ` error=${error.message}`
      : error
        ? ` error=${String(error)}`
        : "";

  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "debug"
          ? console.debug
          : console.log;
  fn.call(console, `${prefix} ${event}${ctxStr}${errStr}`);
}

/** 客户端日志助手：与 serverLog 模块名保持一致，便于前后端日志检索 */
export const clientLog = {
  /** AI 对话相关日志 */
  ai: (event: string, context?: ClientLogContext, error?: unknown) =>
    writeClientLog("info", "ai-chat", event, context, error),
  aiWarn: (event: string, context?: ClientLogContext, error?: unknown) =>
    writeClientLog("warn", "ai-chat", event, context, error),
  aiError: (event: string, context?: ClientLogContext, error?: unknown) =>
    writeClientLog("error", "ai-chat", event, context, error),

  /** TTS / ASR / 语音通话相关日志 */
  voice: (event: string, context?: ClientLogContext, error?: unknown) =>
    writeClientLog("info", "voice", event, context, error),
  voiceWarn: (event: string, context?: ClientLogContext, error?: unknown) =>
    writeClientLog("warn", "voice", event, context, error),
  voiceError: (event: string, context?: ClientLogContext, error?: unknown) =>
    writeClientLog("error", "voice", event, context, error),

  /** 飞书 OAuth / 任务同步相关日志 */
  feishu: (event: string, context?: ClientLogContext, error?: unknown) =>
    writeClientLog("info", "feishu", event, context, error),
  feishuError: (event: string, context?: ClientLogContext, error?: unknown) =>
    writeClientLog("error", "feishu", event, context, error),

  /** WebSocket 连接 / 远程操控相关日志 */
  ws: (event: string, context?: ClientLogContext, error?: unknown) =>
    writeClientLog("info", "ws-gateway", event, context, error),
  wsError: (event: string, context?: ClientLogContext, error?: unknown) =>
    writeClientLog("error", "ws-gateway", event, context, error),

  /** 获取日志缓冲区（用于诊断面板导出 / 上报） */
  getBuffer: () => [...clientLogBuffer],

  /** 清空日志缓冲区 */
  clearBuffer: () => {
    clientLogBuffer.length = 0;
  },
};
