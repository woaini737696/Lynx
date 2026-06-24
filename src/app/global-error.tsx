"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

/**
 * 根级 Error Boundary（global-error.tsx）
 * 当 root layout 自身抛错时由其接管，必须自带 <html>/<body>。
 * 注意：此组件不继承 root layout，需自包含样式。
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
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          background: "#f8fafc",
          color: "#1e293b",
        }}
      >
        <div
          style={{
            marginBottom: "1.5rem",
            display: "flex",
            height: "5rem",
            width: "5rem",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "1rem",
            background: "rgba(239, 68, 68, 0.1)",
          }}
        >
          <AlertCircle style={{ height: "2.5rem", width: "2.5rem", color: "#ef4444" }} />
        </div>
        <h2 style={{ marginBottom: "0.5rem", fontSize: "1.5rem", fontWeight: 600 }}>
          应用发生严重错误
        </h2>
        <p
          style={{
            marginBottom: "0.25rem",
            maxWidth: "28rem",
            fontSize: "0.875rem",
            color: "#64748b",
          }}
        >
          {error.message || "发生未知错误，请重试或返回首页。"}
        </p>
        {error.digest && (
          <p
            style={{
              marginBottom: "1.5rem",
              fontFamily: "monospace",
              fontSize: "0.6875rem",
              color: "rgba(100, 116, 139, 0.6)",
            }}
          >
            错误编号：{error.digest}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              borderRadius: "0.75rem",
              background: "#0f172a",
              color: "#fff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            <RefreshCw style={{ height: "1rem", width: "1rem" }} /> 重试
          </button>
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
              background: "#fff",
              color: "#1e293b",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <Home style={{ height: "1rem", width: "1rem" }} /> 返回首页
          </a>
        </div>
      </body>
    </html>
  );
}
