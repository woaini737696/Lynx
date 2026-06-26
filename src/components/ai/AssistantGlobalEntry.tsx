"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AssistantFloatingButton } from "./AssistantFloatingButton";
import { AssistantDrawer } from "./AssistantDrawer";

/**
 * AI 助理全局悬浮入口（组合组件）
 *
 * - 内部管理 open 状态
 * - 渲染悬浮按钮 + 右侧抽屉
 * - 在 /ai/assistant 页面不渲染（避免页面自身重复入口）
 * - 监听 Alt+J 全局快捷键，唤出/收起抽屉
 *
 * 挂载位置：src/app/layout.tsx 的 body 最外层（children 之后）。
 */
export function AssistantGlobalEntry() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  // Alt+J 唤出/收起
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // 在 /ai/assistant 页面不渲染入口（避免重复）
  if (pathname === "/ai/assistant") return null;

  return (
    <>
      <AssistantFloatingButton open={open} onToggle={toggle} />
      <AssistantDrawer open={open} onClose={close} />
    </>
  );
}
