"use client";

import { useEffect } from "react";

/**
 * PWA Service Worker 注册器
 * - 在所有环境注册 SW（开发环境也注册，以便调试 Web Push 等功能）
 * - 注册成功后监听更新，提示用户刷新
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // 开发环境提示
    if (process.env.NODE_ENV !== "production") {
      console.log("[PWA] 开发环境：Service Worker 将正常注册（用于调试 Web Push 等功能）");
    }

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
