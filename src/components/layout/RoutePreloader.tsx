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

// 预先 import 页面模块，触发 webpack/vite 编译并缓存 chunk，
// 在 dev 模式下能显著降低首次点击的延迟。
const PAGE_MODULES: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/app/page"),
  "/board": () => import("@/app/board/page"),
  "/inbox": () => import("@/app/inbox/page"),
  "/converge": () => import("@/app/converge/page"),
  "/graveyard": () => import("@/app/graveyard/page"),
  "/assets": () => import("@/app/assets/page"),
  "/cognition": () => import("@/app/cognition/page"),
  "/memory": () => import("@/app/memory/page"),
  "/settings": () => import("@/app/settings/page"),
  "/ai/workspace": () => import("@/app/ai/workspace/page"),
};

/**
 * 全局路由预加载
 * 应用启动后空闲时预热核心页面，减少首次点击时的 chunk 加载/编译时间
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
      // 同时 import 页面模块，进一步降低 dev/生产首次跳转延迟
      try {
        PAGE_MODULES[url]?.().catch(() => {});
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
