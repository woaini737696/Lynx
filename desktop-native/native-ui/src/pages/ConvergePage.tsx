import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Trash2,
  Sparkles,
  Search,
  Loader2,
  Clock,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, formatRelativeTime } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import type { Idea } from "@/types/api";

const COLUMNS = [
  { key: "northstar", label: "北极星", color: "text-northstar", bg: "bg-northstar/10", border: "border-northstar/30" },
  { key: "campaign", label: "战役", color: "text-campaign", bg: "bg-campaign/10", border: "border-campaign/30" },
  { key: "task", label: "任务", color: "text-task", bg: "bg-task/10", border: "border-task/30" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const TIME_FILTERS = [
  { key: "all", label: "全部" },
  { key: "today", label: "今天" },
  { key: "7days", label: "近7天" },
] as const;

type TimeFilterKey = (typeof TIME_FILTERS)[number]["key"];

export function ConvergePage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTime, setFilterTime] = useState<TimeFilterKey>("all");
  const [abandonTarget, setAbandonTarget] = useState<Idea | null>(null);
  const [abandonReason, setAbandonReason] = useState("");
  const [removeIds, setRemoveIds] = useState<Set<string>>(new Set());

  // 加载灵感列表
  const { data: ideas = [], isLoading } = useQuery<Idea[]>({
    queryKey: ["converge-ideas"],
    queryFn: async () => {
      const res = await cloudApi.get<{ data?: Idea[]; ideas?: Idea[] }>("/api/ideas");
      return res.data || res.ideas || [];
    },
  });

  // 本地移除已处理的灵感，给个短暂动画过渡
  useEffect(() => {
    if (removeIds.size === 0) return;
    const timer = setTimeout(() => {
      setRemoveIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["converge-ideas"] });
    }, 400);
    return () => clearTimeout(timer);
  }, [removeIds, queryClient]);

  // 拖入看板
  const boardMutation = useMutation({
    mutationFn: async ({ id, column }: { id: string; column: ColumnKey }) => {
      return cloudApi.patch(`/api/ideas/${id}`, { action: "board", column });
    },
    onSuccess: (_data, { id, column }) => {
      setRemoveIds((prev) => new Set(prev).add(id));
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      const label = COLUMNS.find((c) => c.key === column)?.label || column;
      toast.success(`已收敛到「${label}」`);
    },
    onError: (e: Error) => toast.error(e.message || "收敛失败"),
  });

  // 放弃
  const abandonMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return cloudApi.patch(`/api/ideas/${id}`, { action: "abandon", reason });
    },
    onSuccess: (_data, { id }) => {
      setRemoveIds((prev) => new Set(prev).add(id));
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["graveyard"] });
      setAbandonTarget(null);
      setAbandonReason("");
      toast.success("已放弃该灵感");
    },
    onError: (e: Error) => toast.error(e.message || "放弃失败"),
  });

  // 过滤 + 搜索
  const filtered = useMemo(() => {
    return ideas.filter((idea) => {
      if (removeIds.has(idea.id)) return false;
      const q = searchQuery.trim().toLowerCase();
      if (q && !idea.content.toLowerCase().includes(q)) return false;
      if (filterTime !== "all") {
        const created = new Date(idea.createdAt).getTime();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (filterTime === "today" && now - created > dayMs) return false;
        if (filterTime === "7days" && now - created > 7 * dayMs) return false;
      }
      return true;
    });
  }, [ideas, searchQuery, filterTime, removeIds]);

  const submitAbandon = () => {
    if (!abandonTarget) return;
    if (!abandonReason.trim()) {
      toast.error("请填写放弃原因");
      return;
    }
    abandonMutation.mutate({
      id: abandonTarget.id,
      reason: abandonReason.trim(),
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* 页头 */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Sparkles className="h-6 w-6 text-cognition" />
            灵感收敛
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            快速将灵感分流到 北极星 · 战役 · 任务 三列 · 或直接放弃
          </p>
        </div>
        <HelpButton module="converge" />
      </div>

      {/* 统计 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="glass-card flex items-center gap-2 px-4 py-2">
          <span className="text-xs text-muted-foreground">待收敛</span>
          <span className="text-base font-bold text-foreground">{filtered.length}</span>
        </div>
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={cn("glass-card flex items-center gap-2 px-3 py-2", col.bg)}
          >
            <span className={cn("text-xs font-medium", col.color)}>{col.label}</span>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div className="glass-card mb-4 flex items-center justify-between gap-3 px-3 py-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索灵感内容..."
            className="w-full rounded-lg border-0 bg-transparent py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-cognition/20"
          />
        </div>
        <div className="flex items-center gap-1">
          {TIME_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterTime(f.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                filterTime === f.key
                  ? "bg-cognition/15 text-cognition"
                  : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-cognition" />
          <p className="mt-3 text-sm text-muted-foreground">加载灵感列表...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="h-12 w-12 text-cognition/40" />
          <p className="mt-4 text-sm font-medium text-foreground">
            {ideas.length === 0 ? "暂无待收敛灵感" : "无匹配结果"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ideas.length === 0
              ? "新灵感进入 Inbox 后会出现在这里供你快速分流"
              : "尝试更换关键词或时间过滤"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((idea, i) => (
              <motion.div
                key={idea.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="glass-card group p-4 transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 hidden w-6 shrink-0 text-right text-[11px] text-muted-foreground/60 sm:block">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {idea.content}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-1.5 py-0.5">
                        {idea.source === "lightning" ? "⚡" : idea.source === "conversation" ? "💬" : "📝"}
                        {idea.source === "lightning"
                          ? "闪电输入"
                          : idea.source === "conversation"
                            ? "对话提取"
                            : idea.source || "未知"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatRelativeTime(idea.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {COLUMNS.map((col) => (
                      <button
                        key={col.key}
                        onClick={() =>
                          boardMutation.mutate({ id: idea.id, column: col.key })
                        }
                        disabled={boardMutation.isPending}
                        className={cn(
                          "flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50",
                          col.border,
                          col.bg,
                          col.color
                        )}
                        title={`收敛到「${col.label}」`}
                      >
                        <ArrowRight className="h-3 w-3" />
                        {col.label}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setAbandonTarget(idea);
                        setAbandonReason("");
                      }}
                      disabled={abandonMutation.isPending}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-graveyard transition-colors hover:bg-graveyard/10 disabled:opacity-50"
                      title="放弃该灵感"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 放弃原因弹窗 */}
      <Modal
        open={!!abandonTarget}
        onClose={() => {
          setAbandonTarget(null);
          setAbandonReason("");
        }}
        title="放弃灵感"
        size="sm"
      >
        <div className="space-y-4">
          {abandonTarget && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {abandonTarget.content}
              </p>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">
              放弃原因（必填 · 将送入灵感墓地）
            </label>
            <textarea
              value={abandonReason}
              onChange={(e) => setAbandonReason(e.target.value)}
              className="min-h-[80px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-graveyard"
              placeholder="为什么放弃这个想法..."
              autoFocus
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setAbandonTarget(null);
                setAbandonReason("");
              }}
              className="btn-glass flex h-8 items-center px-3 text-xs"
            >
              取消
            </button>
            <button
              onClick={submitAbandon}
              disabled={abandonMutation.isPending || !abandonReason.trim()}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-graveyard/10 px-3 text-xs font-medium text-graveyard transition-colors hover:bg-graveyard/20 disabled:opacity-50"
            >
              {abandonMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              确认放弃
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
