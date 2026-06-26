"use client";

import { useEffect } from "react";
import { X, Bot } from "lucide-react";
import { AssistantChat } from "./AssistantChat";

export interface AssistantDrawerProps {
  /** 抽屉是否打开 */
  open: boolean;
  /** 关闭抽屉回调 */
  onClose: () => void;
}

/**
 * AI 助理抽屉面板
 * - 右侧滑入/滑出（transition-transform duration-200 ease-out）
 * - 桌面端 40% 宽度（min 400 / max 600），移动端全屏
 * - 内容区使用极简 AssistantChat 组件（无 iframe 加载延迟）
 * - 桌面端：透明点击层，点击空白处收回（不遮挡主内容操作）
 * - 移动端：半透明遮罩（bg-black/20）点击关闭
 * - Esc 键关闭
 */
export function AssistantDrawer({ open, onClose }: AssistantDrawerProps) {
  // Esc 键关闭抽屉
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* 桌面端透明点击层：仅 open 时启用 pointer-events，本身透明无视觉遮挡 */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-transparent md:block ${
          open ? "pointer-events-auto" : "pointer-events-none"
        } hidden`}
      />

      {/* 移动端遮罩：仅在小屏显示，点击关闭 */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity duration-200 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* 抽屉面板 */}
      <aside
        role="dialog"
        aria-label="AI 助理"
        aria-modal="false"
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-background shadow-2xl transition-transform duration-200 ease-out md:w-[40%] md:min-w-[400px] md:max-w-[600px] ${
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

        {/* 内容区：极简聊天组件 */}
        <div className="relative flex-1 overflow-hidden bg-background">
          <AssistantChat />
        </div>
      </aside>
    </>
  );
}
