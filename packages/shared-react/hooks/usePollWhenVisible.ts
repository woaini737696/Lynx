"use client";

import { useEffect, useRef, useCallback } from "react";
import type { IVisibilityProvider } from "@lynnhub/shared";

/**
 * 基于可见性的轮询 Hook（跨端版本）
 *
 * 行为：
 * - 可见时：按 intervalMs 间隔定时调用 fn
 * - 不可见时：暂停轮询（节省 CPU/网络），重新可见时立即补一次 + 恢复轮询
 * - 卸载时：清理定时器
 *
 * 与原 Web 端实现的区别：
 * - 不依赖 document.visibilityState，通过注入的 IVisibilityProvider 获取可见性
 * - Web 端注入基于 document 的 provider，RN 端注入基于 AppState 的 provider
 *
 * 用法：
 *   usePollWhenVisible(() => loadStatus(), 30_000, visibilityProvider, { immediate: true });
 */
export function usePollWhenVisible(
  fn: () => void | Promise<void>,
  intervalMs: number,
  visibility: IVisibilityProvider,
  options: { immediate?: boolean; enabled?: boolean } = {}
) {
  const { immediate = false, enabled = true } = options;
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 始终保持 fnRef 指向最新的 fn，避免闭包陷阱
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    timerRef.current = setInterval(() => {
      if (visibility.isVisible) {
        fnRef.current();
      }
    }, intervalMs);
  }, [clear, intervalMs, visibility]);

  useEffect(() => {
    if (!enabled) return;

    // 首次立即执行（可选）
    if (immediate) {
      fnRef.current();
    }

    start();

    // 通过注入的 IVisibilityProvider 监听可见性变更
    const unsubscribe = visibility.onChange((state) => {
      if (state === "visible") {
        // 重新可见时立即补一次（避免长时间隐藏后数据陈旧）
        fnRef.current();
        start();
      } else {
        // 隐藏/后台时暂停
        clear();
      }
    });

    return () => {
      unsubscribe();
      clear();
    };
  }, [start, clear, immediate, enabled, visibility]);
}
