import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { cloudApi } from "@/lib/cloud-api";
import { toggleAssistantDrawer, openAssistantDrawer } from "@/lib/assistant-drawer";
import { cn } from "@/lib/utils";
import type { Idea } from "@/types/api";

/**
 * AI 助理悬浮入口 - 同步 Web 端 AssistantFloatingButton
 * 右下角圆形液态玻璃按钮，点击打开右侧抽屉
 * 全局快捷键 Alt+J
 */
export function AssistantFloatingButton() {
  const [showHint, setShowHint] = useState(false);

  // 全局快捷键 Alt+J
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        toggleAssistantDrawer();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
            奇思 AI · Alt + J
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => openAssistantDrawer()}
        aria-label="打开奇思 AI 助理"
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
 * 灵感通知 - 同步 Web 端 ReminderManager + AssistantGlobalEntry 已读机制
 * 位于 AI 悬浮按钮正上方，显示 Inbox 未读灵感数量（相对已读基线）
 * 三态展示：icon（默认）→ hint（自动展开 2.5s）→ list（点击展开列表）
 * 点击「打开 Inbox」会标记当前数量为已读，红点消除
 */
const INBOX_LAST_READ_KEY = "lynnhub:inbox-last-read-count";

export function IdeaReminder() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"icon" | "hint" | "list">("icon");
  const [entering, setEntering] = useState(false);
  const prevUnreadRef = useRef(0);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 已读基线（localStorage 持久化，跨刷新保留）
  const [lastRead, setLastRead] = useState<number>(() => {
    if (typeof localStorage === "undefined") return 0;
    return parseInt(localStorage.getItem(INBOX_LAST_READ_KEY) || "0", 10) || 0;
  });

  // 查询 Inbox 总数（30s 刷新）
  const { data: inboxTotal = 0 } = useQuery<number>({
    queryKey: ["inbox-total-count"],
    queryFn: async () => {
      const res = await cloudApi.get<{ data?: Idea[]; total?: number }>("/api/ideas?limit=1");
      return typeof res.total === "number" ? res.total : (res.data?.length || 0);
    },
    refetchInterval: 30000,
  });

  // 未读数 = max(0, 当前总数 - 已读基线)
  const count = Math.max(0, inboxTotal - lastRead);

  // 数量从 0 → N 时自动展开 hint 态（2.5s 后收回 icon）
  useEffect(() => {
    if (count > 0 && prevUnreadRef.current === 0 && mode === "icon") {
      setMode("hint");
      setEntering(true);
      setTimeout(() => setEntering(false), 450);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => {
        setMode("icon");
      }, 2500);
    }
    prevUnreadRef.current = count;
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [count, mode]);

  // list 态点击外部自动收回
  useEffect(() => {
    if (mode !== "list") return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMode("icon");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mode]);

  // 在 Inbox 页面不显示（在 Inbox 页面内会自动标记已读）
  useEffect(() => {
    if (location.pathname.startsWith("/inbox") && inboxTotal > 0) {
      try {
        localStorage.setItem(INBOX_LAST_READ_KEY, String(inboxTotal));
        setLastRead(inboxTotal);
      } catch {
        // ignore
      }
    }
  }, [location.pathname, inboxTotal]);

  if (location.pathname.startsWith("/inbox")) return null;
  if (count === 0) return null;

  const expandToList = () => {
    setMode("list");
    setEntering(false);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  };

  const collapseToIcon = () => {
    setMode("icon");
    setEntering(false);
  };

  const gotoInbox = () => {
    // 标记当前总数为已读，消除红点
    try {
      localStorage.setItem(INBOX_LAST_READ_KEY, String(inboxTotal));
    } catch {
      // ignore
    }
    setLastRead(inboxTotal);
    collapseToIcon();
    navigate("/inbox");
  };

  return (
    <div
      ref={containerRef}
      onClick={(e) => {
        // 点击非按钮区域展开列表
        if (mode !== "list" && !(e.target as HTMLElement).closest("button")) {
          expandToList();
        }
      }}
      className={cn(
        "ios-glass fixed bottom-28 right-[39px] z-50 flex items-center rounded-full overflow-visible",
        mode === "icon" && "h-8 w-8 justify-center p-0",
        mode === "hint" && "px-3 py-1.5",
        mode === "list" && "flex-col items-stretch p-2",
        entering && "entering"
      )}
      style={mode === "list" ? { width: "240px", borderRadius: "16px" } : undefined}
    >
      {/* 图标态 / 提示态共用：闪电图标 + 红点 */}
      {(mode === "icon" || mode === "hint") && (
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
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
            {/* 红点：使用 ring + shadow 确保不被父容器裁切，z-index 提升避免被遮挡 */}
            <span
              className="absolute -right-1 -top-1 z-10 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background shadow-md"
              style={{ boxSizing: "border-box" }}
            >
              {count > 9 ? "9+" : count}
            </span>
          </div>
          {mode === "hint" && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="whitespace-nowrap text-xs font-medium text-foreground"
            >
              {count} 条灵感待处理
            </motion.div>
          )}
        </div>
      )}

      {/* 列表态 */}
      {mode === "list" && (
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-start gap-3 px-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
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
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground">
                未读灵感 <span>{count}</span> 条
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                点击下方按钮去处理
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                collapseToIcon();
              }}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="收起"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              gotoInbox();
            }}
            className="w-full rounded-lg bg-primary/10 px-3 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            打开 Inbox 处理 →
          </button>
        </div>
      )}
    </div>
  );
}
