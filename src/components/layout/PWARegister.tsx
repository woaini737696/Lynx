"use client";

import { useEffect } from "react";

/**
 * PWA Service Worker 注册器
 * - 仅在生产环境注册（避免开发模式下缓存干扰）
 * - 注册成功后监听更新，提示用户刷新
 */
export function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        // 监听新版本
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // 新版本已就绪，提示用户刷新（这里仅 console，避免侵入式 UI）
              console.log("[PWA] 新版本已就绪，刷新页面以更新");
            }
          });
        });
      } catch (e) {
        console.warn("[PWA] Service Worker 注册失败:", e);
      }
    };

    register();
  }, []);

  return null;
}
