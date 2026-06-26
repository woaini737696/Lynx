"use client";

import { useEffect } from "react";
import { isDesktop, setUserToken, setCloudEndpoint } from "@/lib/desktop-client";

/**
 * 桌面端桥接组件
 *
 * 在 Tauri 桌面端环境中自动执行：
 * 1. 登录后将 NextAuth session token 同步到 Rust 端（用于 WS 鉴权）
 * 2. 设置云端 endpoint（用于 HermesAgent 调用云端 API）
 * 3. 标记 body 为桌面端环境（供 CSS 适配）
 *
 * 在 Web 环境中不执行任何操作。
 */
export function DesktopBridge() {
  useEffect(() => {
    if (!isDesktop()) return;

    // 标记桌面端环境（供 CSS 适配，如隐藏浏览器特有的 PWA 安装提示等）
    document.body.classList.add("desktop-mode");

    // 获取当前 session token 并同步到 Rust 端
    const syncToken = async () => {
      try {
        // 通过 /api/auth/session 获取 NextAuth session
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          if (session?.user?.id) {
            // 同步 token 到 Rust 端（格式：user:<userId>，WS 网关据此鉴权）
            await setUserToken(`user:${session.user.id}`);
            // 设置云端 endpoint（开发期用 localhost:5176，生产环境用实际域名）
            const endpoint = window.location.origin;
            await setCloudEndpoint(endpoint);
          }
        }
      } catch (e) {
        console.warn("[DesktopBridge] 同步 token 失败:", e);
      }
    };

    syncToken();

    // 监听路由变化时重新同步（登录/登出后）
    const observer = new MutationObserver(() => {
      syncToken();
    });

    // 观察 body 的 data 属性变化（Next.js 路由切换时会更新）
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-route"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
