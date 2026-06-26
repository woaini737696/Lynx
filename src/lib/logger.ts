import pino from "pino";
import pretty from "pino-pretty";

// 开发环境使用 pino-pretty 作为同步 stream（不走 transport/worker thread）
// 避免 .next 缓存损坏时 thread-stream 的 worker.js 模块找不到导致 uncaughtException
// 生产环境使用原生 pino（JSON 输出，性能更好）
const isDev = process.env.NODE_ENV === "development";

export const logger = isDev
  ? pino(
      { level: process.env.LOG_LEVEL || "info" },
      pretty({ colorize: true, sync: true, translateTime: "SYS:HH:MM:ss" })
    )
  : pino({ level: process.env.LOG_LEVEL || "info" });

export function getLogger(name: string) {
  return logger.child({ module: name });
}
