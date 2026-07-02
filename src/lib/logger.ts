import pino from "pino";

// 统一日志器：生产环境 JSON 输出，开发环境同样使用 JSON（避免 pino-pretty 的 node:worker_threads 依赖不兼容 Webpack 打包）
// 如需开发环境彩色输出，可设置 LOG_LEVEL=debug 并使用 pino 的 transport 机制（仅在 Node.js 运行时加载，不经过 Webpack）
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

export function getLogger(name: string) {
  return logger.child({ module: name });
}
