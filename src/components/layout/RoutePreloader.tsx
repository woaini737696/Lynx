"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PRELOAD_ROUTES = [
  "/",
  "/board",
  "/inbox",
  "/converge",
  "/graveyard",
  "/assets",
  "/cognition",
  "/memory",
  "/settings",
  "/ai/workspace",
];

/**
 * 全局路由预加载
 * 应用启动后空闲时预热核心页面，减少首次点击时的 chunk 加载时间
 */
export function RoutePreloader() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let i = 0;
    const step = () => {
      if (i >= PRELOAD_ROUTES.length) return;
      const url = PRELOAD_ROUTES[i++];
      try {
        router.prefetch(url);
      } catch {
        // ignore
      }
      // 错开预加载，避免阻塞首屏渲染
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(step, { timeout: 500 });
      } else {
        setTimeout(step, 60);
      }
    };

    const timer = setTimeout(step, 300);
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
