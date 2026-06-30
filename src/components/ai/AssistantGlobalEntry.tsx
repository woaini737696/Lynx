"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AssistantFloatingButton } from "./AssistantFloatingButton";
import { usePollWhenVisible } from "@/lib/use-poll-when-visible";

// AssistantDrawer 含 AssistantChat（1577行）+ 语音模块，体积大
// 改为 dynamic 懒加载 + ssr:false，仅在 open=true 时下载并挂载
const AssistantDrawer = dynamic(
  () => import("./AssistantDrawer").then((m) => m.AssistantDrawer),
  { ssr: false, loading: () => null }
);

const LAST_READ_KEY = "lynnhub:assistant-last-read-count";

/**
 * AI 助理全局悬浮入口（组合组件）
 *
 * - 内部管理 open 状态
 * - 渲染悬浮按钮 + 右侧抽屉
 * - 在 /ai/assistant 页面不渲染（避免页面自身重复入口）
 * - 监听 Alt+J 全局快捷键，唤出/收起抽屉
 * - 未登录时点击悬浮按钮 / Alt+J 弹窗引导登录
 * - 未读消息红点：会话数 - lastReadCount > 0 时显示
 */
export function AssistantGlobalEntry() {
  const [open, setOpen] = useState(false);
  // 首次打开后才挂载 AssistantDrawer，避免初始即拉取 AssistantChat + 语音模块的大 chunk
  // 一旦挂载就保持挂载，保留 slide-out 动画与会话状态
  const [hasOpened, setHasOpened] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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

  // 未读消息数 = 当前会话总数 - 上次已读会话数
  // 使用 usePollWhenVisible：tab 不可见时暂停轮询，节省 CPU/网络
  const fetchUnread = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch("/api/ai/chat/sessions?limit=1");
      if (!res.ok) return;
      const data = await res.json();
      // 兼容两种响应结构：{ sessions: [...] } 或 { items: [...] } 或 [...]
      const sessions = data.sessions || data.items || data;
      const total = Array.isArray(sessions) ? sessions.length : 0;
      // 如果 API 返回了 total 字段，优先使用
      const currentTotal = typeof data.total === "number" ? data.total : total;

      let lastRead = 0;
      try {
        lastRead = parseInt(localStorage.getItem(LAST_READ_KEY) || "0", 10) || 0;
      } catch {
        // ignore
      }
      setUnreadCount(Math.max(0, currentTotal - lastRead));
    } catch {
      // 静默失败
    }
  }, [isLoggedIn]);

  usePollWhenVisible(fetchUnread, 30_000, { immediate: true, enabled: isLoggedIn });

  const toggle = useCallback(() => {
    // 登录态尚未确认时，忽略点击（避免误弹登录窗）
    if (!authChecked) return;
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setOpen((v) => {
      const next = !v;
      // 打开抽屉时，将 lastReadCount 重置为当前会话数（标记为已读）
      if (next) {
        setHasOpened(true);
        setUnreadCount(0);
        // 异步获取当前会话数并保存
        fetch("/api/ai/chat/sessions?limit=1")
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return;
            const sessions = data.sessions || data.items || data;
            const total = typeof data.total === "number" ? data.total : (Array.isArray(sessions) ? sessions.length : 0);
            try {
              localStorage.setItem(LAST_READ_KEY, String(total));
            } catch {
              // ignore
            }
          })
          .catch(() => {});
      }
      return next;
    });
  }, [authChecked, isLoggedIn]);

  const close = useCallback(() => setOpen(false), []);

  // 注意：不主动弹窗引导登录。
  // 仅在用户主动点击悬浮按钮 / Alt+J 时才弹窗。
  // 未登录状态下允许浏览页面，只有使用功能触发 API 时才由 SWRProvider 拦截 401 弹窗。

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
        setOpen((v) => {
          if (!v) setHasOpened(true);
          return !v;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [authChecked, isLoggedIn]);

  // 在 /ai/assistant 页面不渲染入口（避免重复）
  if (pathname === "/ai/assistant") return null;

  return (
    <>
      <AssistantFloatingButton open={open} onToggle={toggle} unreadCount={unreadCount} />
      {/* 首次打开后才挂载 AssistantDrawer，保留 slide-out 动画与会话状态；关闭时仅 translate-x 隐藏 */}
      {hasOpened && <AssistantDrawer open={open} onClose={close} />}

      {/* 未登录引导弹窗 */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="登录提示"
        >
          <div className="w-full max-w-sm rounded-xl bg-background p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">
              请先登录
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              使用 Lynx 超级助理需要先登录账号
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  window.location.href = "/?login=1";
                }}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
