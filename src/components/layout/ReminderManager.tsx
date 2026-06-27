"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Bell, Settings, X, Check, Trash2 } from "lucide-react";
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

// 全局挂载：在 layout.tsx 中使用，管理定时检查 + 通知
export function ReminderManager() {
  const [rules, setRules] = useState<ReminderRule[]>(DEFAULT_RULES);
  const [history, setHistory] = useState<ReminderHistoryItem[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [reviveSuggestions, setReviveSuggestions] = useState<ReviveSuggestion[]>([]);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 初始化
  useEffect(() => {
    const loadedRules = loadReminderRules();
    setRules(loadedRules);
    const loadedHistory = loadReminderHistory();
    setHistory(loadedHistory);

    // 检查浏览器通知权限
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    // 提取最近的复活建议
    const latestRevive = loadedHistory.find((h) => h.ruleId === "revive-check" && h.details?.length);
    if (latestRevive?.details) {
      setReviveSuggestions(latestRevive.details);
    }
  }, []);

  // 定时检查（每分钟）
  useEffect(() => {
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

          // 双通道通知
          toast(result.message, "info");
          sendNotification("Lynx 灵感助理", result.message);

          // 如果是复活建议，更新状态
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

    // 启动时立即检查一次
    check();
    // 每分钟检查
    checkIntervalRef.current = setInterval(check, 60_000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // 请求通知权限
  const handleRequestPermission = useCallback(async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      toast("已开启浏览器通知", "success");
    } else {
      toast("浏览器通知权限被拒绝", "error");
    }
  }, []);

  // 切换规则启用状态
  const toggleRule = useCallback((ruleId: string) => {
    setRules((prev) => {
      const updated = prev.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      );
      saveReminderRules(updated);
      return updated;
    });
  }, []);

  // 清空历史
  const clearHistory = useCallback(() => {
    saveReminderHistory([]);
    setHistory([]);
    setReviveSuggestions([]);
    toast("已清空提醒历史", "info");
  }, []);

  // 忽略复活建议
  const dismissReviveSuggestion = useCallback((id: string) => {
    setReviveSuggestions((prev) => prev.filter((s) => s.graveyardId !== id));
  }, []);

  return (
    <>
      {/* 浮动提醒图标 */}
      <button
        onClick={() => setShowPanel(true)}
        className="fixed bottom-5 left-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
        aria-label="灵感助理提醒"
      >
        <Bell className={cn("h-4.5 w-4.5", reviveSuggestions.length > 0 ? "text-cognition animate-pulse" : "text-muted-foreground")} />
        {(history.length > 0 || reviveSuggestions.length > 0) && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cognition text-[9px] text-white">
            {reviveSuggestions.length || history.length}
          </span>
        )}
      </button>

      {/* 提醒面板 */}
      {showPanel && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-start p-4 bg-black/30 backdrop-blur-sm"
          onClick={() => setShowPanel(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-cognition" />
                <span className="text-sm font-semibold">灵感助理</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="设置"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setShowPanel(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="关闭"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* 设置区域 */}
            {showSettings && (
              <div className="border-b border-border px-4 py-3">
                <div className="mb-3 text-xs font-medium text-muted-foreground">提醒规则</div>
                {rules.map((rule) => (
                  <div key={rule.id} className="mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium">{rule.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {rule.description} · {rule.time}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={cn(
                        "relative h-5 w-9 rounded-full transition-colors",
                        rule.enabled ? "bg-cognition" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          rule.enabled ? "left-[18px]" : "left-0.5"
                        )}
                      />
                    </button>
                  </div>
                ))}

                {/* 浏览器通知权限 */}
                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">浏览器通知</div>
                  {notificationPermission === "granted" ? (
                    <div className="flex items-center gap-1.5 text-xs text-task">
                      <Check className="h-3 w-3" /> 已开启
                    </div>
                  ) : (
                    <button
                      onClick={handleRequestPermission}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      开启浏览器通知
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 复活建议 */}
            {reviveSuggestions.length > 0 && (
              <div className="border-b border-border px-4 py-3">
                <div className="mb-2 text-xs font-medium text-cognition">AI 复活建议</div>
                {reviveSuggestions.map((s) => (
                  <div
                    key={s.graveyardId}
                    className="mb-2 rounded-xl border border-cognition/20 bg-cognition/5 p-2.5"
                  >
                    <div className="mb-1 text-[11px] font-medium text-foreground/90">
                      {s.originalContent.length > 40
                        ? s.originalContent.slice(0, 40) + "…"
                        : s.originalContent}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      复活条件：{s.reviveCondition}
                    </div>
                    <div className="mt-1 text-[10px] text-cognition">
                      命中：{s.reason}
                    </div>
                    <button
                      onClick={() => dismissReviveSuggestion(s.graveyardId)}
                      className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      忽略
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 提醒历史 */}
            <div className="max-h-[300px] overflow-y-auto px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">提醒历史</span>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-2.5 w-2.5" /> 清空
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">
                  暂无提醒记录
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-xl bg-muted/30 px-3 py-2 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground/80">{h.ruleLabel}</span>
                        <span className="text-[9px] text-muted-foreground">
                          {formatTime(h.triggeredAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground">{h.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
