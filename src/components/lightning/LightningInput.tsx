"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Zap, X, Loader2, Check, Paperclip, FileText } from "lucide-react";
import { useLightningStore } from "@/store/lightning";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

/** 已上传的附件信息（与后端 /api/upload 返回一致） */
interface Attachment {
  url: string;
  name: string;
  size: number;
  type: "image" | "file";
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function LightningInput() {
  const { isOpen, close } = useLightningStore();
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [mounted, setMounted] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setAttachments([]);
    }
  }, [isOpen]);

  /** 上传单个文件到 /api/upload */
  const uploadFile = useCallback(async (file: File): Promise<Attachment | null> => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error || "文件上传失败", "error");
        return null;
      }
      const data = await res.json();
      return {
        url: data.url,
        name: data.name,
        size: data.size,
        type: data.type,
      };
    } catch {
      toast("上传网络错误", "error");
      return null;
    }
  }, []);

  /** 处理文件选择（支持多文件） */
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      if (fileArr.length === 0) return;

      setUploading(true);
      // 串行上传（避免并发触发限流）
      for (const file of fileArr) {
        const att = await uploadFile(file);
        if (att) {
          setAttachments((prev) => [...prev, att]);
        }
      }
      setUploading(false);
    },
    [uploadFile]
  );

  /** 点击上传按钮 */
  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  /** 文件输入 change */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // 清空 input 以便重复选择同一文件
    e.target.value = "";
  };

  /** 拖拽放置 */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  /** 拖拽悬停 */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  /** 拖拽离开 */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  /** 粘贴事件：检测图片 */
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFiles(imageFiles);
    }
  };

  /** 删除附件 */
  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!content.trim() && attachments.length === 0) {
      close();
      return;
    }
    if (!content.trim()) {
      toast("内容不能为空", "error");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachments }),
      });
      if (res.ok) {
        setStatus("saved");
        setContent("");
        setAttachments([]);
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
          "w-full max-w-xl rounded-3xl glass-card p-5 shadow-2xl transition-all animate-in zoom-in-95 duration-200 sm:p-6",
          statusMeta.border,
          statusMeta.shadow
        )}
        onClick={(e) => e.stopPropagation()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
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
          onPaste={handlePaste}
          disabled={status === "saving"}
          placeholder="想到什么就写什么，分类交给系统..."
          rows={4}
          className="min-h-[110px] w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none ring-offset-background transition-all placeholder:text-muted-foreground/60 focus:border-northstar focus:ring-2 focus:ring-northstar/20 disabled:opacity-50"
        />

        {/* 附件上传区域 */}
        <div className="mt-3">
          {/* 已选附件列表 */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="group relative flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2 py-1.5"
                >
                  {att.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.url}
                      alt={att.name}
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="max-w-[120px]">
                    <div className="truncate text-[10px] text-foreground/80">
                      {att.name}
                    </div>
                    <div className="text-[9px] text-muted-foreground/60">
                      {formatSize(att.size)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-graveyard/20 hover:text-graveyard"
                    aria-label="删除附件"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 上传按钮 + 拖拽提示 */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 transition-colors",
              dragOver
                ? "border-northstar bg-northstar/5"
                : "border-border/60 bg-muted/10"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.txt,.md,.doc,.docx"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <button
              onClick={handleFileInputClick}
              disabled={uploading || status === "saving"}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> 上传中...
                </>
              ) : (
                <>
                  <Paperclip className="h-3 w-3" /> 添加附件
                </>
              )}
            </button>
            <span className="text-[10px] text-muted-foreground/60">
              支持图片(jpg/png/gif/webp) · 文档(pdf/txt/md/doc/docx) · 可拖拽或粘贴图片 · 最大10MB
            </span>
          </div>
        </div>

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
              disabled={status === "saving" || (!content.trim() && attachments.length === 0)}
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
