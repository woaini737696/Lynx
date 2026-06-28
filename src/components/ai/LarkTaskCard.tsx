"use client";

import { useState } from "react";
import { CheckSquare, ExternalLink, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** 飞书任务卡片数据（由 AI 工具 createLarkTask 返回） */
export interface LarkTaskCardData {
  summary: string;
  assignees?: string[];
  due?: string;
  description?: string;
}

type CardStatus = "pending" | "submitting" | "done" | "error";

interface LarkTaskCardProps extends LarkTaskCardData {
  /** 受控初始状态（默认 pending） */
  initialStatus?: CardStatus;
  /** 已下发时的任务链接（与 initialStatus=done 配合使用） */
  initialUrl?: string;
}

/** 将 ISO 字符串或相对时间词格式化为本地可读日期 */
function formatDue(due?: string): string | null {
  if (!due) return null;
  const s = due.trim();
  if (!s) return null;
  // 尝试解析为日期
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    // 仅显示日期部分（带时分如果非全天）
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hours = d.getHours();
    const minutes = d.getMinutes();
    if (hours === 0 && minutes === 0) return dateStr;
    return `${dateStr} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  // 无法解析（如"本周五"等相对词）原样返回
  return s;
}

/**
 * 飞书任务卡片组件（page.tsx 与 AssistantChat.tsx 共用）。
 * 状态：pending（待下发）/ submitting（下发中）/ done（已下发+链接）/ error（失败）。
 * 橙黑灰配色：橙色边框 + 黑色标题 + 灰色辅助信息。
 */
export function LarkTaskCard({
  summary,
  assignees,
  due,
  description,
  initialStatus = "pending",
  initialUrl,
}: LarkTaskCardProps) {
  const [status, setStatus] = useState<CardStatus>(initialStatus);
  const [taskUrl, setTaskUrl] = useState<string | undefined>(initialUrl);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dueText = formatDue(due);

  const handleSubmit = async () => {
    if (status === "submitting" || status === "done") return;
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/lark-tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, assignees, due, description }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        const err = data?.error || `请求失败（${res.status}）`;
        // lark-cli 不可用时优雅降级提示
        const friendly = /lark-cli|无法获取|飞书凭证|命令未找到|not found|ENOENT/i.test(err)
          ? "飞书未配置，无法下发"
          : err;
        setErrorMsg(friendly);
        setStatus("error");
        return;
      }
      setTaskUrl(data.url || undefined);
      setStatus("done");
    } catch (e) {
      setErrorMsg("网络错误：" + (e as Error).message);
      setStatus("error");
    }
  };

  return (
    <div
      className={cn(
        "mt-2 max-w-[85%] overflow-hidden rounded-xl border glass-card",
        status === "done"
          ? "border-task/40"
          : "border-primary/50"
      )}
    >
      {/* 卡片头部 */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          飞书任务
        </span>
        {status === "done" && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-task/15 px-2 py-0.5 text-[10px] font-medium text-task">
            <Check className="h-3 w-3" /> 已下发
          </span>
        )}
        {status === "error" && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
            <AlertCircle className="h-3 w-3" /> 失败
          </span>
        )}
      </div>

      {/* 卡片内容 */}
      <div className="px-3 py-2.5">
        <div className="text-sm font-medium leading-snug text-foreground">
          {summary}
        </div>

        {/* 元信息 */}
        <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
          {assignees && assignees.length > 0 && (
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 font-medium text-foreground/70">负责人</span>
              <span className="text-foreground/90">
                {assignees.join("、")}
              </span>
            </div>
          )}
          {dueText && (
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 font-medium text-foreground/70">截止</span>
              <span className="text-foreground/90">{dueText}</span>
            </div>
          )}
          {description && (
            <div className="mt-1 line-clamp-2 break-words text-foreground/70">
              {description}
            </div>
          )}
        </div>

        {/* 操作区 */}
        {status === "pending" && (
          <button
            type="button"
            onClick={handleSubmit}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            下发到飞书
          </button>
        )}

        {status === "submitting" && (
          <button
            type="button"
            disabled
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/70 px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            下发中...
          </button>
        )}

        {status === "done" && taskUrl && (
          <a
            href={taskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ios-glass-sm mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            查看飞书任务
          </a>
        )}

        {status === "error" && (
          <div className="mt-3 flex flex-col gap-1.5">
            {errorMsg && (
              <p className="text-[11px] text-destructive">{errorMsg}</p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              className="ios-glass-sm inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              重试下发
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
