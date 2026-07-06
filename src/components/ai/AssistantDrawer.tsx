"use client";

import { useEffect } from "react";
import { AssistantChat } from "./AssistantChat";

export interface AssistantDrawerProps {
  /** 抽屉是否打开 */
  open: boolean;
  /** 关闭抽屉回调 */
  onClose: () => void;
}

/**
 * 奇思 AI 超级助理抽屉面板
 * - 右侧滑入/滑出（transition-transform duration-200 ease-out）
 * - 桌面端 40% 宽度（min 400 / max 600），移动端全屏
 * - 内容区使用增强版 AssistantChat 组件（自带 header / 模型切换 / 语音通话 / 快捷技能）
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

      {/* 抽屉面板：AssistantChat 自带 header（头像+名称+ModelSwitcher+语音按钮+关闭） */}
      <aside
        role="dialog"
        aria-label="奇思 AI 超级助理"
        aria-modal="false"
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-background shadow-2xl transition-transform duration-200 ease-out md:w-[40%] md:min-w-[400px] md:max-w-[600px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 内容区：AssistantChat 占满高度，自带 header + 消息区 + 快捷技能 + 输入区 */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <AssistantChat onClose={onClose} open={open} />
        </div>
      </aside>
    </>
  );
}
