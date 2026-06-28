"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

/**
 * 根级 Error Boundary（global-error.tsx）
 * 当 root layout 自身抛错时由其接管，必须自带 <html>/<body>。
 * 注意：此组件不继承 root layout，需自包含样式。
 * 通过内联脚本同步读取 next-themes 持久化的主题（localStorage.theme），
 * 并回退到系统偏好，为 <html> 添加 dark 类，使 Tailwind dark: 前缀生效。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <style>{`
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            background-color: hsl(220 20% 95%);
            color: hsl(222 47% 8%);
          }
          html.dark body {
            background-color: hsl(220 70% 4%);
            color: hsl(220 20% 96%);
          }
        `}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-graveyard/10"
        >
          <AlertCircle className="h-10 w-10 text-graveyard" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold text-foreground">
          应用发生严重错误
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
        {process.env.NODE_ENV !== "production" && error.stack && (
          <pre
            className="mb-6 max-h-[40vh] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-muted p-4 text-left font-mono text-[11px] leading-relaxed text-muted-foreground"
          >
            {error.stack}
          </pre>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="btn-doubao inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" /> 重试
          </button>
          <a
            href="/"
            className="glass-btn inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Home className="h-4 w-4" /> 返回首页
          </a>
        </div>
      </body>
    </html>
  );
}
