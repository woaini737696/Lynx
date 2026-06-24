// Sentry 配置模板（部署阶段启用）
// 安装：npm install @sentry/nextjs
// 配置：sentry.client.config.ts / sentry.server.config.ts / sentry.edge.config.ts
// 文档：https://docs.sentry.io/platforms/javascript/guides/nextjs/

export const SENTRY_DSN = process.env.SENTRY_DSN || "";
export const isSentryEnabled = Boolean(SENTRY_DSN);

// 示例：手动上报错误
export async function reportError(error: Error, context?: Record<string, unknown>) {
  if (!isSentryEnabled) {
    console.error("[未启用 Sentry]", error, context);
    return;
  }
  // 部署后启用：Sentry.captureException(error, { extra: context });
}
