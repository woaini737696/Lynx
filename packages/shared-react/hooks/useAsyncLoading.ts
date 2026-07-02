"use client";

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
  createElement,
  type ReactNode,
} from "react";

// ============ 类型定义 ============

/** 单个异步任务记录 */
export interface AsyncTask {
  id: number;
  name: string;
  /** 是否已超过显示阈值，需要在 overlay 中展示 */
  visible: boolean;
}

/** Context 暴露给消费方的能力 */
export interface AsyncLoadingContextValue {
  /** 包装一个 promise，自动跟踪耗时并在超过阈值后标记为可见 */
  run: <T>(name: string, promise: Promise<T>) => Promise<T>;
  /** 是否有任务处于"已显形"状态 */
  loading: boolean;
  /** 最近一个显形任务的名称 */
  currentTask: string | null;
}

// ============ Context ============

export const AsyncLoadingContext =
  createContext<AsyncLoadingContextValue | null>(null);

/** 显示阈值：耗时超过此毫秒数才标记为可见，避免短操作闪烁 */
const SHOW_THRESHOLD_MS = 800;

// ============ Hook ============

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
export function useAsyncLoading(): AsyncLoadingContextValue {
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

// ============ Headless Provider ============

/**
 * 无 UI 的异步加载 Provider：管理任务状态并通过 Context 暴露能力。
 *
 * 各端在 App 根节点包裹此 Provider 后，通过 renderOverlay 回调实现
 * 平台特定的 loading overlay UI（Web 用 div+CSS，RN 用 View+StyleSheet）。
 *
 * 用法：
 *   <AsyncLoadingProvider renderOverlay={(tasks) => <MyOverlay tasks={tasks} />}>
 *     <App />
 *   </AsyncLoadingProvider>
 */
export function AsyncLoadingProvider({
  children,
  renderOverlay,
}: {
  children: ReactNode;
  /** 平台特定的 overlay 渲染回调，接收已显形的任务列表 */
  renderOverlay?: (tasks: AsyncTask[]) => ReactNode;
}) {
  const [tasks, setTasks] = useState<AsyncTask[]>([]);
  const idRef = useRef(0);

  const run = useCallback(
    async <T,>(name: string, promise: Promise<T>): Promise<T> => {
      const id = ++idRef.current;
      // 立即入队（visible=false），仅当超过阈值才显形
      setTasks((prev) => [...prev, { id, name, visible: false }]);
      const timer = setTimeout(() => {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, visible: true } : t))
        );
      }, SHOW_THRESHOLD_MS);
      try {
        return await promise;
      } finally {
        clearTimeout(timer);
        setTasks((prev) => prev.filter((t) => t.id !== id));
      }
    },
    []
  );

  // 仅统计已显形的任务，避免短操作造成 overlay 闪烁
  const visibleTasks = tasks.filter((t) => t.visible);
  const loading = visibleTasks.length > 0;
  const currentTask =
    visibleTasks.length > 0 ? visibleTasks[visibleTasks.length - 1].name : null;

  const overlay = renderOverlay ? renderOverlay(visibleTasks) : null;

  return createElement(
    AsyncLoadingContext.Provider,
    { value: { run, loading, currentTask } },
    children,
    overlay
  );
}
