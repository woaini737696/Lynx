import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Loader2, Check, X } from "lucide-react";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { openLoginModal } from "@/lib/login-modal";

/** 自定义事件名：外部按钮通过此事件唤起闪电输入 */
export const OPEN_LIGHTNING_INPUT_EVENT = "lynx-open-lightning-input";

/**
 * 灵感速记（闪电输入）- 同步 Web 端 LightningInput
 * 全局快捷键 Ctrl+J / Cmd+J 唤起，Enter 保存，Esc 关闭
 * 提交后自动入库 Inbox
 */
export function LightningInput() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const close = useCallback(() => {
    setOpen(false);
    setTimeout(() => {
      setContent("");
      setStatus("idle");
    }, 200);
  }, []);

  // 全局快捷键 Ctrl+J / Cmd+J + 自定义事件
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") close();
    };
    const openHandler = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener(OPEN_LIGHTNING_INPUT_EVENT, openHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(OPEN_LIGHTNING_INPUT_EVENT, openHandler);
    };
  }, [close]);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSave = async () => {
    if (!content.trim()) {
      close();
      return;
    }
    // 未登录时弹出登录弹窗
    if (!useAuthStore.getState().token) {
      close();
      openLoginModal();
      toast.info("请先登录后再使用");
      return;
    }
    setStatus("saving");
    try {
      await cloudApi.post("/api/ideas", { content: content.trim() });
      setStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      setTimeout(() => {
        close();
        toast.success("灵感已捕获 · 23 点收敛时分类");
      }, 600);
    } catch (err) {
      setStatus("idle");
      toast.error(err instanceof Error ? err.message : "保存失败");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const accentColor =
    status === "saving" ? "text-destructive" : status === "saved" ? "text-task" : "text-northstar";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center bg-black/30 p-4 pt-[16vh] backdrop-blur-xl"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="ios-glass w-full max-w-xl rounded-3xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {status === "saving" ? (
                  <Loader2 className={`h-4 w-4 animate-spin ${accentColor}`} />
                ) : status === "saved" ? (
                  <Check className={`h-4 w-4 ${accentColor}`} />
                ) : (
                  <Zap className={`h-4 w-4 ${accentColor}`} />
                )}
                <span className="text-sm font-semibold text-foreground">
                  {status === "saving" ? "保存中..." : status === "saved" ? "已捕获" : "闪电输入"}
                </span>
              </div>
              <button
                onClick={close}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 输入区 */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="想到什么就写什么，分类交给系统..."
              rows={4}
              className="min-h-[110px] w-full resize-none rounded-2xl border border-border/40 bg-background/40 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
            />

            {/* 底部 */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {content.length > 0 && `${content.length} 字 · `}
                自动入库 Inbox · Enter 保存
              </span>
              <button
                onClick={handleSave}
                disabled={!content.trim() || status === "saving"}
                className="btn-primary-glass flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs disabled:opacity-50"
              >
                {status === "saving" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : status === "saved" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                捕获
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
