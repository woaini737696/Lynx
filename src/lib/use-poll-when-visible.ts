"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * 基于页面可见性的轮询 Hook
 *
 * 行为：
 * - tab 可见时：按 intervalMs 间隔定时调用 fn
 * - tab 隐藏时：暂停轮询（节省 CPU/网络），重新可见时立即补一次 + 恢复轮询
 * - 卸载时：清理定时器
 *
 * 用法：
 *   usePollWhenVisible(() => loadStatus(), 30_000, { immediate: true });
 *
 * 适配场景：未读数、状态、会话列表、提醒检查等容忍延迟的轮询。
 * 不适合需要实时性的场景（如协作编辑、实时消息）。
 */
export function usePollWhenVisible(
  fn: () => void | Promise<void>,
  intervalMs: number,
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
      if (document.visibilityState === "visible") {
        fnRef.current();
      }
    }, intervalMs);
  }, [clear, intervalMs]);

  useEffect(() => {
    if (!enabled) return;

    // 首次立即执行（可选）
    if (immediate) {
      fnRef.current();
    }

    start();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // 重新可见时立即补一次（避免长时间隐藏后数据陈旧）
        fnRef.current();
        start();
      } else {
        // 隐藏时暂停
        clear();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clear();
    };
  }, [start, clear, immediate, enabled]);
}
