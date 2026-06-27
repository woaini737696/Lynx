"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * 统一重试状态组件
 *
 * 在数据加载失败等场景下展示错误图标、错误信息与重试按钮。
 * 样式与项目 EmptyState / Card 体系保持一致。
 */
export function RetryState({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-graveyard/10">
        <AlertCircle className="h-6 w-6 text-graveyard" />
      </div>
      <p className="max-w-md text-sm font-medium text-foreground/80">
        {message}
      </p>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
        {retrying ? "重试中..." : "重试"}
      </button>
    </div>
  );
}
