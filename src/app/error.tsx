"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

/**
 * 全局 Error Boundary（App Router 根级）。
 * 捕获子树渲染错误，提供重试和返回首页操作。
 * 开发环境（NODE_ENV !== "production"）下额外展示错误堆栈，便于调试。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 上报到控制台（生产环境可替换为 Sentry/日志服务）
    console.error("[GlobalError]", error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-graveyard/10">
        <AlertCircle className="h-10 w-10 text-graveyard" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold text-foreground">
        页面出错了
      </h2>
      <p className="mb-1 max-w-md text-sm text-muted-foreground">
        {error.message || "发生未知错误，请重试或返回首页。"}
      </p>
      {error.digest && (
        <p className="mb-6 font-mono text-[11px] text-muted-foreground/60">
          错误编号：{error.digest}
        </p>
      )}
      {/* 开发环境显示详细错误堆栈，便于调试 */}
      {isDev && error.stack && (
        <pre className="glass-card mb-6 max-h-[40vh] w-full max-w-2xl overflow-auto rounded-xl border border-border p-4 text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
          {error.stack}
        </pre>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-primary-foreground transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> 重试
        </button>
        <a
          href="/"
          className="ios-glass-sm inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-foreground transition-colors"
        >
          <Home className="h-4 w-4" /> 返回首页
        </a>
      </div>
    </div>
  );
}
