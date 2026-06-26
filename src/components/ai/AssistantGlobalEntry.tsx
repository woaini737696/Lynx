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
 * - 未登录时点击悬浮按钮 / Alt+J 弹窗引导登录
 *
 * 挂载位置：src/app/layout.tsx 的 body 最外层（children 之后）。
 *
 * 登录检测：项目未使用 next-auth/react 的 SessionProvider，
 * 改用 fetch /api/auth/session（返回 JSON 含 user 字段则已登录）。
 */
export function AssistantGlobalEntry() {
  const [open, setOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const pathname = usePathname();

  // 页面加载时检查登录状态
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => {
        if (cancelled) return;
        setIsLoggedIn(!!session?.user);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoggedIn(false);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(() => {
    // 登录态尚未确认时，忽略点击（避免误弹登录窗）
    if (!authChecked) return;
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setOpen((v) => !v);
  }, [authChecked, isLoggedIn]);

  const close = useCallback(() => setOpen(false), []);

  // 检测到未登录时立即弹窗引导（排除登录/注册页，避免在登录页本身弹窗）
  useEffect(() => {
    if (
      authChecked &&
      !isLoggedIn &&
      pathname !== "/login" &&
      pathname !== "/register"
    ) {
      setShowLoginModal(true);
    }
  }, [authChecked, isLoggedIn, pathname]);

  // Alt+J 唤出/收起（也要检查登录状态）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        if (!authChecked) return;
        if (!isLoggedIn) {
          setShowLoginModal(true);
          return;
        }
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [authChecked, isLoggedIn]);

  // 在 /ai/assistant 页面不渲染入口（避免重复）
  if (pathname === "/ai/assistant") return null;

  return (
    <>
      <AssistantFloatingButton open={open} onToggle={toggle} />
      <AssistantDrawer open={open} onClose={close} />

      {/* 未登录引导弹窗 */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="登录提示"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground">
              登录已过期
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              登录已过期，请重新登录
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  window.location.href = "/login";
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                去登录
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
