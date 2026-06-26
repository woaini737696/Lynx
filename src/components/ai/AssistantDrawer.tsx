"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, Bot } from "lucide-react";

export interface AssistantDrawerProps {
  /** 抽屉是否打开 */
  open: boolean;
  /** 关闭抽屉回调 */
  onClose: () => void;
}

/**
 * AI 助理抽屉面板
 * - 右侧滑入/滑出（transition-transform duration-300）
 * - 桌面端 40% 宽度（min 400 / max 600），移动端全屏
 * - 内嵌 iframe 加载 /ai/assistant，避免功能重复
 * - 桌面端不显示遮罩，移动端显示半透明遮罩并可点击关闭
 *
 * 实现细节：
 * - 抽屉外壳始终挂载（保证滑入/滑出动画），iframe 仅在首次打开后渲染，
 *   避免首屏多余请求；后续保持挂载，二次打开无需重新加载。
 */
export function AssistantDrawer({ open, onClose }: AssistantDrawerProps) {
  // 是否曾经打开过 —— 用于延迟挂载 iframe，关闭后保持挂载以避免重复加载
  const [hasOpened, setHasOpened] = useState(false);
  // iframe 是否加载完成
  const [iframeLoading, setIframeLoading] = useState(false);
  // Esc 键关闭抽屉
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // 首次打开后标记，之后保持 iframe 挂载
  useEffect(() => {
    if (open && !hasOpened) setHasOpened(true);
  }, [open, hasOpened]);

  // 每次打开时重置 loading 态（iframe 已挂载时 onLoad 不会再触发）
  useEffect(() => {
    if (open) setIframeLoading(true);
  }, [open]);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <>
      {/* 移动端遮罩：仅在小屏显示，点击关闭 */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* 抽屉面板 */}
      <aside
        role="dialog"
        aria-label="AI 助理"
        aria-modal="false"
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out md:w-[40%] md:min-w-[400px] md:max-w-[600px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">AI 助理</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* 内容区：iframe 加载 /ai/assistant */}
        <div className="relative flex-1 overflow-hidden bg-background">
          {hasOpened && (
            <iframe
              ref={iframeRef}
              src="/ai/assistant"
              title="AI 助理"
              onLoad={() => setIframeLoading(false)}
              className="h-full w-full border-0"
            />
          )}

          {/* Loading 覆盖层 */}
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">正在加载 AI 助理…</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
