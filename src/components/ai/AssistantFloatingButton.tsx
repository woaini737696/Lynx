"use client";

export interface AssistantFloatingButtonProps {
  /** 当前抽屉是否打开（用于按钮态展示） */
  open?: boolean;
  /** 点击按钮回调，由父组件管理开合状态 */
  onToggle?: () => void;
  /** 未读消息数（右上角红点） */
  unreadCount?: number;
}

/**
 * Lynx AI 超级助理全局悬浮入口按钮
 * - 固定右下角，液态玻璃质感（1:1 还原 HTML lynx-fab）
 * - 显示聊天气泡图标（1:1 还原 HTML SVG path）
 * - hover 时左侧弹出快捷键提示
 * - 点击调用 onToggle
 * - 未读数字红点融合在右上角
 */
export function AssistantFloatingButton({ open, onToggle, unreadCount = 0 }: AssistantFloatingButtonProps) {
  return (
    <div className="group fixed bottom-8 right-8 z-40 flex items-center">
      {/* 快捷键提示标签：hover 时从左侧滑出 */}
      <div
        aria-hidden="true"
        className="pointer-events-none mr-3 translate-x-2 rounded-xl border border-border/60 bg-popover/90 px-3 py-1.5 text-xs font-medium text-popover-foreground opacity-0 shadow-xl backdrop-blur-xl transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
      >
        Lynx AI · Alt + J
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "收起 Lynx AI 超级助理" : "打开 Lynx AI 超级助理"}
        aria-pressed={open}
        className="glass-fab relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
