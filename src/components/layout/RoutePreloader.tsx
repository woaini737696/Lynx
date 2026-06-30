"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * 全局路由预加载（轻量版）
 *
 * 改造目标：
 * 1. 不再启动 300ms 后预热 10 个页面（首屏掉帧 + 浪费带宽）
 * 2. 仅保留 top 3 高频路由的 router.prefetch（不强制 import 模块）
 * 3. 真正的按需预热：导航链接 hover/visible 时由 Navigation 组件各自 prefetch
 *
 * 保留：路由切换后空闲时 prefetch 下一个最可能的页面（首页 → board/inbox）
 */
const HIGH_PRIORITY_ROUTES = ["/", "/inbox", "/board"];

export function RoutePreloader() {
  const router = useRouter();
  const pathname = usePathname();

  // 应用启动后空闲时 prefetch top 3 路由（仅 router.prefetch，不强制 import 模块）
  useEffect(() => {
    if (typeof window === "undefined") return;

    const step = () => {
      for (const url of HIGH_PRIORITY_ROUTES) {
        try {
          router.prefetch(url);
        } catch {
          // ignore
        }
      }
    };

    // 使用 requestIdleCallback 在浏览器空闲时执行，不阻塞首屏
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(step, { timeout: 2000 });
    } else {
      const t = setTimeout(step, 1500);
      return () => clearTimeout(t);
    }
  }, [router]);

  // 路由切换后，预取相邻候选页面（基于当前路径）
  useEffect(() => {
    if (typeof window === "undefined") return;

    const candidates: string[] = [];
    if (pathname === "/") {
      candidates.push("/inbox", "/board");
    } else if (pathname === "/inbox") {
      candidates.push("/", "/board");
    } else if (pathname === "/board") {
      candidates.push("/inbox", "/");
    } else {
      // 其他页面：仅预取首页（最高频返回路径）
      candidates.push("/");
    }

    const idle = () => {
      for (const url of candidates) {
        try {
          router.prefetch(url);
        } catch {
          // ignore
        }
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(idle, { timeout: 2000 });
    } else {
      const t = setTimeout(idle, 800);
      return () => clearTimeout(t);
    }
  }, [pathname, router]);

  return null;
}
