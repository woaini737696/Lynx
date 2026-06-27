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
            background-color: #f8fafc;
            color: #1e293b;
          }
          html.dark body {
            background-color: #0f172a;
            color: #e2e8f0;
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
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10"
        >
          <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold text-slate-800 dark:text-slate-200">
          应用发生严重错误
        </h2>
        <p className="mb-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          {error.message || "发生未知错误，请重试或返回首页。"}
        </p>
        {error.digest && (
          <p className="mb-6 font-mono text-[11px] text-slate-400/70 dark:text-slate-500/70">
            错误编号：{error.digest}
          </p>
        )}
        {/* 开发环境显示详细错误堆栈，便于调试 */}
        {process.env.NODE_ENV !== "production" && error.stack && (
          <pre
            className="mb-6 max-h-[40vh] w-full max-w-2xl overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-left font-mono text-[11px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {error.stack}
          </pre>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <RefreshCw className="h-4 w-4" /> 重试
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Home className="h-4 w-4" /> 返回首页
          </a>
        </div>
      </body>
    </html>
  );
}
