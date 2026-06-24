import { Loader2 } from "lucide-react";

/**
 * 全局 Loading UI（App Router 根级）。
 * 在路由段加载时自动展示，避免白屏。
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cognition/10">
        <Loader2 className="h-6 w-6 animate-spin text-cognition" />
      </div>
      <p className="text-sm text-muted-foreground">加载中...</p>
    </div>
  );
}
