import { useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { cloudApi } from "@/lib/cloud-api";
import type { Idea } from "@/types/api";
import { useState } from "react";

/**
 * AI 助理悬浮入口 - 同步 Web 端 AssistantFloatingButton
 * 右下角圆形液态玻璃按钮，点击跳转 AI 专属助理
 * 全局快捷键 Alt+J，在 /ai/assistant 页面隐藏
 */
export function AssistantFloatingButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showHint, setShowHint] = useState(false);

  // 在 AI 助理页面不显示
  if (location.pathname.startsWith("/ai/assistant")) return null;

  // 全局快捷键 Alt+J
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        navigate("/ai/assistant");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <div
      className="group fixed bottom-8 right-8 z-40 flex items-center"
      onMouseEnter={() => setShowHint(true)}
      onMouseLeave={() => setShowHint(false)}
    >
      {/* hover 时左侧滑出快捷键提示 */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.2 }}
            className="ios-glass mr-3 rounded-xl px-3 py-1.5 text-xs font-medium text-foreground"
          >
            Lynx AI · Alt + J
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => navigate("/ai/assistant")}
        aria-label="打开 Lynx AI 专属助理"
        className="glass-fab relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          background:
            "linear-gradient(135deg, hsl(217 99% 62%) 0%, hsl(189 100% 52%) 100%)",
          boxShadow:
            "inset 0 1px 1px hsl(0 0% 100% / 0.25), 0 8px 24px -6px hsl(217 99% 53% / 0.5)",
        }}
      >
        <svg
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </div>
  );
}

/**
 * 灵感通知 - 同步 Web 端 ReminderManager
 * 位于 AI 悬浮按钮正上方，显示 Inbox 未处理灵感数量
 * 点击跳转 /inbox
 */
export function IdeaReminder() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showHint, setShowHint] = useState(false);

  // 查询 Inbox 未处理数量（30s 刷新）
  const { data: count = 0 } = useQuery<number>({
    queryKey: ["inbox-unread-count"],
    queryFn: async () => {
      const res = await cloudApi.get<{ ideas?: Idea[] }>("/api/ideas");
      return res.ideas?.length || 0;
    },
    refetchInterval: 30000,
  });

  // 在 Inbox 页面不显示
  if (location.pathname.startsWith("/inbox")) return null;
  if (count === 0) return null;

  return (
    <div
      className="group fixed bottom-28 right-[39px] z-40 flex items-center"
      onMouseEnter={() => setShowHint(true)}
      onMouseLeave={() => setShowHint(false)}
    >
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.2 }}
            className="ios-glass mr-3 rounded-xl px-3 py-1.5 text-xs font-medium text-foreground"
          >
            {count} 条灵感待处理
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => navigate("/inbox")}
        aria-label={`${count} 条灵感待处理`}
        className="ios-glass relative flex h-8 w-8 items-center justify-center rounded-full text-primary transition-transform hover:scale-105 active:scale-95"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {count > 9 ? "9+" : count}
        </span>
      </button>
    </div>
  );
}
