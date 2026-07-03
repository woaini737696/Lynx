import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AIAssistantPage } from "@/pages/AIAssistantPage";
import { cloudApi, resolveAvatarUrl } from "@/lib/cloud-api";
import { useAuthStore } from "@/stores/authStore";

// AI 助理设置类型（与 AIAssistantPage 对齐）
interface AISettings {
  assistantName?: string;
  assistantAvatar?: string;
  avatarUrl?: string | null;
}

interface AssistantDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function AssistantDrawer({ open, onClose }: AssistantDrawerProps) {
  const isFirstOpen = useRef(false);
  const user = useAuthStore((s) => s.user);

  // 加载 AI 助理设置（与 AIAssistantPage 共享同一 react-query key，命中缓存无额外请求）
  const { data: aiSettings } = useQuery<AISettings>({
    queryKey: ["ai-settings"],
    queryFn: async () => {
      try {
        const resp = await cloudApi.get<{ settings: AISettings }>("/api/ai/settings");
        return resp.settings || {};
      } catch {
        return {};
      }
    },
  });

  const assistantName = aiSettings?.assistantName?.trim() || "Lynx";
  const assistantEmoji = aiSettings?.assistantAvatar?.trim() || "🦊";
  // 优先使用 AI 助理 avatarUrl，回退到用户头像
  const avatarUrl = resolveAvatarUrl(aiSettings?.avatarUrl) || resolveAvatarUrl(user?.avatarUrl);

  useEffect(() => {
    if (open) {
      isFirstOpen.current = true;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* 遮罩：仅 open 时显示，但 AIAssistantPage 始终挂载保留会话状态 */}
      <AnimatePresence>
        {open && (
          <div
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
        )}
      </AnimatePresence>

      {/* 抽屉：始终挂载，通过 transform + pointer-events 控制可见性，避免会话状态丢失 */}
      <motion.aside
        role="dialog"
        aria-label="Lynx AI 超级助理"
        aria-modal="false"
        initial={false}
        animate={{ x: open ? 0 : "100%" }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="fixed right-0 top-0 z-50 flex h-full w-[460px] min-w-0 flex-col border-l border-border/60 bg-background shadow-2xl"
        style={{ maxWidth: "100vw", pointerEvents: open ? "auto" : "none" }}
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 px-4">
          <div className="flex items-center gap-2">
            {/* 头像：avatarUrl > emoji > 默认 SVG */}
            {avatarUrl ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary to-accent">
                <img
                  src={avatarUrl}
                  alt={assistantName}
                  className="h-full w-full object-cover"
                  draggable={false}
                  onError={(e) => {
                    // 头像加载失败：回退到 emoji
                    const t = e.currentTarget as HTMLImageElement;
                    t.style.display = "none";
                    const parent = t.parentElement;
                    if (parent) {
                      parent.className =
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-sm";
                      parent.textContent = assistantEmoji;
                    }
                  }}
                />
              </div>
            ) : assistantEmoji ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-sm">
                {assistantEmoji}
              </div>
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            )}
            <span className="text-sm font-semibold text-foreground">{assistantName} · AI 助理</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <AIAssistantPage inDrawer />
        </div>
      </motion.aside>
    </>
  );
}
