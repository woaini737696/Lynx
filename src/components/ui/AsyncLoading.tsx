"use client";

import {
  createContext,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

// 单个异步任务记录
type AsyncTask = {
  id: number;
  name: string;
  // 是否已超过显示阈值，需要在 overlay 中展示
  visible: boolean;
};

// Context 暴露给消费方的能力
type AsyncLoadingContextValue = {
  // 包装一个 promise，自动跟踪耗时并在超过阈值后显示 overlay
  run: <T>(name: string, promise: Promise<T>) => Promise<T>;
  // 是否有任务处于"已显形"状态
  loading: boolean;
  // 最近一个显形任务的名称
  currentTask: string | null;
};

export const AsyncLoadingContext =
  createContext<AsyncLoadingContextValue | null>(null);

// 显示阈值：耗时超过此毫秒数才弹出 overlay，避免短操作闪烁
const SHOW_THRESHOLD_MS = 800;

/**
 * 全局异步加载 Provider：包裹在应用根部，提供耗时操作的动画即时反馈。
 * 任何被 run() 包装的 promise 超过 800ms 未完成时，会显示带旋转动画的 overlay。
 */
export function AsyncLoadingProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<AsyncTask[]>([]);
  // 自增任务 id，用于唯一标识每个 run 调用
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

  return (
    <AsyncLoadingContext.Provider value={{ run, loading, currentTask }}>
      {children}
      <AsyncLoadingOverlay tasks={visibleTasks} />
    </AsyncLoadingContext.Provider>
  );
}

/**
 * 全局加载遮罩：半透明背景 + 居中卡片 + 旋转图标 + 操作名称 + 队列计数。
 */
function AsyncLoadingOverlay({ tasks }: { tasks: AsyncTask[] }) {
  if (tasks.length === 0) return null;
  const current = tasks[tasks.length - 1];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl animate-in fade-in"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "glass-modal flex flex-col items-center gap-3 rounded-2xl px-8 py-6",
          "animate-in zoom-in-95"
        )}
      >
        {/* 旋转图标 + 呼吸光晕 */}
        <div className="relative flex h-10 w-10 items-center justify-center">
          <span className="absolute inline-flex h-10 w-10 animate-ping rounded-full bg-cognition/25" />
          <Loader2 className="relative h-8 w-8 animate-spin text-cognition" />
        </div>

        {/* 当前操作名称 */}
        <div className="max-w-[260px] truncate text-sm font-medium text-foreground">
          {current.name}
        </div>

        {/* 多任务队列计数 */}
        {tasks.length > 1 && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ListChecks className="h-3 w-3" />
            队列中 {tasks.length} 个任务
          </div>
        )}

        {/* 进度条（不确定动画） */}
        <div className="ios-glass-sm h-1 w-44 overflow-hidden rounded-full">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-cognition" />
        </div>
      </div>
    </div>
  );
}
