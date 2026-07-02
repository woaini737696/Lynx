"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  loadReminderRules,
  saveReminderRules,
  loadReminderHistory,
  saveReminderHistory,
  runReminderCheck,
  sendNotification,
  requestNotificationPermission,
  type ReminderRule,
  type ReminderHistoryItem,
  type ReviveSuggestion,
  DEFAULT_RULES,
} from "@/lib/reminder-scheduler";

type NoticeItem = {
  id: string;
  title: string;
  source: string;
  time: string;
  type: "revive" | "reminder";
  detailId?: string;
};

// 全局挂载：在 layout.tsx 中使用，管理定时检查 + 通知
export function ReminderManager() {
  const router = useRouter();
  const [rules, setRules] = useState<ReminderRule[]>(DEFAULT_RULES);
  const [history, setHistory] = useState<ReminderHistoryItem[]>([]);
  const [reviveSuggestions, setReviveSuggestions] = useState<ReviveSuggestion[]>([]);
  const [mode, setMode] = useState<"icon" | "hint" | "list">("icon");
  const [entering, setEntering] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCountRef = useRef(0);
  const toastRef = useRef<HTMLDivElement>(null);

  // 登录态检查：未登录用户不启动任何通知检查（避免无意义 401 请求和浏览器通知权限申请）
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) setIsLoggedIn(Boolean(s?.user?.id));
      })
      .catch(() => {
        if (!cancelled) setIsLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 列表态点击外部自动收回图标态
  useEffect(() => {
    if (mode !== "list") return;
    const handleClickOutside = (e: MouseEvent) => {
      if (toastRef.current && !toastRef.current.contains(e.target as Node)) {
        collapseToIcon();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mode]);

  const notifications: NoticeItem[] = useMemo(() => {
    const items: NoticeItem[] = [];

    reviveSuggestions.forEach((s) => {
      items.push({
        id: `revive-${s.graveyardId}`,
        title: s.originalContent.length > 40 ? s.originalContent.slice(0, 40) + "…" : s.originalContent,
        source: "AI 复活建议",
        time: "刚刚",
        type: "revive",
        detailId: s.graveyardId,
      });
    });

    history.slice(0, 20).forEach((h) => {
      items.push({
        id: h.id,
        title: h.message,
        source: h.ruleLabel,
        time: formatTime(h.triggeredAt),
        type: "reminder",
      });
    });

    return items;
  }, [history, reviveSuggestions]);

  // 初始化（仅加载本地数据，不涉及鉴权/通知权限）
  useEffect(() => {
    const loadedRules = loadReminderRules();
    setRules(loadedRules);
    const loadedHistory = loadReminderHistory();
    setHistory(loadedHistory);

    const latestRevive = loadedHistory.find((h) => h.ruleId === "revive-check" && h.details?.length);
    if (latestRevive?.details) {
      setReviveSuggestions(latestRevive.details);
    }
  }, []);

  // 浏览器通知权限申请 —— 仅登录用户触发，避免未登录用户被弹出权限申请
  useEffect(() => {
    if (!isLoggedIn) return;
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        requestNotificationPermission();
      }
    }
  }, [isLoggedIn]);

  // 新通知自动弹出提示（icon -> hint）
  useEffect(() => {
    const count = notifications.length;
    if (count > 0 && prevCountRef.current === 0 && mode === "icon") {
      const t = setTimeout(() => {
        setMode("hint");
        setEntering(true);
        setTimeout(() => setEntering(false), 450);
      }, 1200);
      return () => clearTimeout(t);
    }
    prevCountRef.current = count;
  }, [notifications.length, mode]);

  // 定时检查（每分钟）—— 仅登录用户启动
  useEffect(() => {
    if (!isLoggedIn) return;
    const check = async () => {
      const currentRules = loadReminderRules();
      const { results, updatedRules } = await runReminderCheck(currentRules);

      if (results.length > 0) {
        saveReminderRules(updatedRules);
        setRules(updatedRules);

        const newHistory: ReminderHistoryItem[] = [];
        for (const result of results) {
          if (!result.triggered) continue;
          const rule = updatedRules.find((r) => r.id === result.ruleId);
          const item: ReminderHistoryItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ruleId: result.ruleId,
            ruleLabel: rule?.label || result.ruleId,
            message: result.message,
            triggeredAt: new Date().toISOString(),
            details: result.details,
          };
          newHistory.push(item);

          toast(result.message, "info");
          sendNotification("Lynx 灵感助理", result.message);

          if (result.ruleId === "revive-check" && result.details) {
            setReviveSuggestions(result.details);
          }
        }

        if (newHistory.length > 0) {
          const updatedHistory = [...newHistory, ...loadReminderHistory()].slice(0, 20);
          saveReminderHistory(updatedHistory);
          setHistory(updatedHistory);
        }
      }
    };

    check();
    checkIntervalRef.current = setInterval(check, 60_000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [isLoggedIn]);

  const expandToList = () => {
    setMode("list");
    setEntering(false);
  };

  const collapseToIcon = () => {
    setMode("icon");
    setEntering(false);
  };

  const clearNotification = (id: string) => {
    const item = notifications.find((n) => n.id === id);
    if (!item) return;

    if (item.type === "revive" && item.detailId) {
      setReviveSuggestions((prev) => prev.filter((s) => s.graveyardId !== item.detailId));
    } else {
      setHistory((prev) => prev.filter((h) => h.id !== id));
      saveReminderHistory(history.filter((h) => h.id !== id));
    }
  };

  const clearAll = () => {
    setReviveSuggestions([]);
    setHistory([]);
    saveReminderHistory([]);
  };

  const processNotification = (id: string) => {
    const item = notifications.find((n) => n.id === id);
    if (!item) return;

    clearNotification(id);

    if (item.type === "revive") {
      router.push("/graveyard");
    } else {
      toast("已处理该提醒", "success");
    }
  };

  const count = notifications.length;

  // 未登录用户不渲染任何通知 UI
  if (!isLoggedIn) return null;

  return (
    <>
      {/* 灵感通知 — 三态：图标 / 提示 / 列表 */}
      <div
        ref={toastRef}
        onClick={(e) => {
          // 点击非按钮区域展开列表
          if (mode !== "list" && !(e.target as HTMLElement).closest("button")) {
            expandToList();
          }
        }}
        className={cn(
          "idea-toast ios-glass fixed bottom-28 right-[39px] z-50 flex items-center justify-center",
          mode === "icon" && "collapsed",
          mode === "hint" && "hint",
          mode === "list" && "list",
          entering && "entering"
        )}
      >
        {/* 图标态 */}
        <div className="toast-icon-only relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
              {count}
            </span>
          )}
        </div>

        {/* 提示态 / 列表态 */}
        <div className="toast-content hidden w-full flex-col gap-2">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground">
                新灵感 <span>{count}</span> 条
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {count > 0 ? "来自飞书机器人 / Kimi" : "暂无新通知"}
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

          <div className="toast-list w-full space-y-1 border-t border-border/40 pt-2">
            {count === 0 ? (
              <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">暂无最新通知</div>
            ) : (
              <>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-primary/5"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        processNotification(n.id);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="text-[11px] font-medium text-foreground truncate">{n.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {n.source} · {n.time}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearNotification(n.id);
                      }}
                      className="ml-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/10 hover:text-primary"
                      aria-label="清除"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                  className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                  全部清除
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
