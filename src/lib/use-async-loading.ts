"use client";

import { useContext } from "react";
import { AsyncLoadingContext } from "@/components/ui/AsyncLoading";

/**
 * 全局异步加载 hook：消费 AsyncLoadingProvider 提供的能力。
 *
 * 返回：
 * - run(name, promise)：包装 promise，超过 800ms 自动显示全局 loading overlay
 * - loading：当前是否有任务处于显形状态
 * - currentTask：最近一个显形任务的名称（无则 null）
 *
 * 若未包裹 Provider，run 会原样返回 promise，loading 恒为 false，
 * 保证在 SSR 或独立使用场景下安全。
 */
export function useAsyncLoading() {
  const ctx = useContext(AsyncLoadingContext);
  if (!ctx) {
    // 未包裹 Provider 时返回无操作 fallback
    return {
      run: <T,>(name: string, promise: Promise<T>): Promise<T> => promise,
      loading: false,
      currentTask: null as string | null,
    };
  }
  return ctx;
}
