"use client";

import { Sparkles } from "lucide-react";

export interface AssistantFloatingButtonProps {
  /** 当前抽屉是否打开（用于按钮态展示） */
  open?: boolean;
  /** 点击按钮回调，由父组件管理开合状态 */
  onToggle?: () => void;
}

/**
 * Lynx AI 超级助理全局悬浮入口按钮
 * - 固定右下角，圆形品牌蓝主题
 * - 显示 X 图标（Lynx 品牌标识）
 * - hover 时展示 "Alt+J" 快捷键提示
 * - 点击调用 onToggle
 *
 * 注意：Alt+J 全局快捷键由父组件 AssistantGlobalEntry 统一监听，
 * 这里不再重复监听，避免与父组件双重触发导致状态回弹。
 */
export function AssistantFloatingButton({ open, onToggle }: AssistantFloatingButtonProps) {
  return (
    <div className="group fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* 快捷键提示标签：hover 时显示 */}
      <div
        aria-hidden="true"
        className="pointer-events-none translate-y-1 rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
      >
        Lynx AI · Alt + J
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "收起 Lynx AI 超级助理" : "打开 Lynx AI 超级助理"}
        aria-pressed={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* Lynx 品牌 X 图标 */}
        <span className="text-lg font-bold">X</span>
      </button>
    </div>
  );
}
