"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Home, Compass } from "lucide-react";

/**
 * 404 页面 - 路由未匹配时显示
 * 客户端组件：在挂载时上报 404 事件到 /api/health/404s
 */
export default function NotFound() {
  const reportedRef = useRef(false);

  useEffect(() => {
    // 避免在严格模式下重复上报
    if (reportedRef.current) return;
    reportedRef.current = true;

    try {
      const path = window.location.pathname + window.location.search;
      const referer = document.referrer || null;
      const userAgent = navigator.userAgent || null;
      // 使用 keepalive 确保页面跳转时请求不会被取消
      fetch("/api/health/404s", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, referer, userAgent, method: "GET" }),
        keepalive: true,
      }).catch(() => {
        // 静默失败：上报失败不影响用户体验
      });
    } catch {
      // 忽略
    }
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-cognition/10">
        <Compass className="h-10 w-10 text-cognition" />
      </div>
      <h1 className="mb-2 text-6xl font-bold text-foreground">404</h1>
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        页面未找到
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        你访问的页面不存在或已被移动。请检查地址是否正确，或返回首页继续浏览。
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Home className="h-4 w-4" /> 返回首页
      </Link>
    </div>
  );
}
