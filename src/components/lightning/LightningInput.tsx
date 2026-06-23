"use client";

import { useEffect, useState, useRef } from "react";
import { Zap, X, Loader2, Check } from "lucide-react";
import { useLightningStore } from "@/store/lightning";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

export function LightningInput() {
  const { isOpen, close } = useLightningStore();
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 全局快捷键 Ctrl+J / Cmd+J
  useEffect(() => {
    if (!mounted) return;
    const handler = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.code === "KeyJ" || e.key === "j" || e.key === "J")
      ) {
        e.preventDefault();
        useLightningStore.getState().toggle();
      }
      if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close, mounted]);

  // 打开时聚焦
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } else {
      setContent("");
      setStatus("idle");
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!content.trim()) {
      close();
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setStatus("saved");
        setContent("");
        setTimeout(() => {
          setStatus("idle");
          close();
        }, 700);
      } else {
        setStatus("idle");
        toast("保存失败", "error");
      }
    } catch {
      setStatus("idle");
      toast("网络错误", "error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      close();
    }
  };

  if (!isOpen) return null;

  const statusMeta = {
    idle: {
      border: "border-northstar/30",
      shadow: "shadow-northstar/10",
      iconBg: "bg-northstar/10",
      iconColor: "text-northstar",
      Icon: Zap,
      title: "闪电输入",
    },
    saving: {
      border: "border-campaign/30",
      shadow: "shadow-campaign/10",
      iconBg: "bg-campaign/10",
      iconColor: "text-campaign",
      Icon: Loader2,
      title: "保存中...",
    },
    saved: {
      border: "border-task/30",
      shadow: "shadow-task/10",
      iconBg: "bg-task/10",
      iconColor: "text-task",
      Icon: Check,
      title: "已捕获",
    },
  }[status];

  const { Icon } = statusMeta;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={close}
    >
      <div
        className={cn(
          "w-full max-w-xl rounded-3xl border bg-card p-5 shadow-2xl transition-all animate-in zoom-in-95 duration-200 sm:p-6",
          statusMeta.border,
          statusMeta.shadow
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
              statusMeta.iconBg,
              statusMeta.iconColor
            )}
          >
            {status === "saving" ? (
              <Icon className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </div>
          <span className="text-sm font-semibold text-foreground">
            {statusMeta.title}
          </span>
          <button
            onClick={close}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={status === "saving"}
          placeholder="想到什么就写什么，分类交给系统..."
          rows={4}
          className="min-h-[110px] w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none ring-offset-background transition-all placeholder:text-muted-foreground/60 focus:border-northstar focus:ring-2 focus:ring-northstar/20 disabled:opacity-50"
        />

        <div className="mt-4 flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground/70">
            <span>自动入库 Inbox · 23 点收敛时分类</span>
            <span className="hidden sm:inline">Enter 保存 · Shift+Enter 换行 · Esc 关闭</span>
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
            <span
              className={cn(
                "text-[11px] tabular-nums text-muted-foreground/60",
                content.length > 500 && "text-graveyard"
              )}
            >
              {content.length}
            </span>
            <button
              onClick={handleSave}
              disabled={status === "saving" || !content.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {status === "saving" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 保存中...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" /> 捕获
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
