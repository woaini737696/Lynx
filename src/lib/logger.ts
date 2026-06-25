import pino from "pino";

// 开发环境使用同步日志（不使用 transport/worker thread），避免 .next 缓存损坏时 thread-stream 崩溃导致 404
// 生产环境也使用同步模式，通过 pino-pretty 的同步管道输出
const isDev = process.env.NODE_ENV === "development";

export const logger = pino(
  isDev
    ? {
        level: process.env.LOG_LEVEL || "info",
        transport: {
          target: "pino-pretty",
          options: { colorize: true, sync: true },
        },
      }
    : {
        level: process.env.LOG_LEVEL || "info",
      }
);

export function getLogger(name: string) {
  return logger.child({ module: name });
}
