import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Sparkles,
  Trash2,
  Search as SearchIcon,
  Loader2,
  Lightbulb,
  MessageSquare,
  Plus,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, formatRelativeTime } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import type { Cognition } from "@/types/api";

// 认知类型元信息（与 Web 端 COGNITION_TYPES 对齐）
const COGNITION_TYPE_META = {
  method: { label: "方法论", color: "text-cognition", bg: "bg-cognition/10", border: "border-cognition/30" },
  experience: { label: "经验", color: "text-campaign", bg: "bg-campaign/10", border: "border-campaign/30" },
  prompt: { label: "提示词", color: "text-northstar", bg: "bg-northstar/10", border: "border-northstar/30" },
} as const;

type CognitionType = keyof typeof COGNITION_TYPE_META;

// 来源图标映射
const SOURCE_ICON: Record<string, typeof Lightbulb> = {
  idea: Lightbulb,
  conversation: MessageSquare,
  manual: Sparkles,
};

export function CognitionPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | CognitionType>("all");

  // AI 提取弹窗
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractContent, setExtractContent] = useState("");

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<Cognition | null>(null);

  // 详情查看
  const [selectedCognition, setSelectedCognition] = useState<Cognition | null>(null);

  // 加载认知列表
  const { data: cognitions = [], isLoading } = useQuery<Cognition[]>({
    queryKey: ["cognitions"],
    queryFn: async () => {
      const res = await cloudApi.get<{ cognitions?: Cognition[] }>("/api/cognitions");
      return res.cognitions || [];
    },
  });

  // 过滤 + 搜索
  const filtered = useMemo(() => {
    let list = cognitions;
    if (filterType !== "all") {
      list = list.filter((c) => c.type === filterType);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.content.toLowerCase().includes(q) ||
          (c.source || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [cognitions, filterType, searchQuery]);

  // AI 提取 mutation
  const extractMutation = useMutation({
    mutationFn: async (content: string) => {
      return cloudApi.post<{ count?: number; created?: unknown[]; success?: boolean }>(
        "/api/cognitions",
        { content, source: "manual" }
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cognitions"] });
      toast.success(`提取完成，新增 ${data.count ?? 0} 条认知`);
      setExtractOpen(false);
      setExtractContent("");
    },
    onError: (e: Error) => toast.error(e.message || "AI 提取失败"),
  });

  // 删除 mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return cloudApi.delete<{ success?: boolean; id?: string }>(`/api/cognitions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cognitions"] });
      toast.success("已删除认知");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "删除失败"),
  });

  // 类型计数
  const typeCounts = useMemo(() => {
    const counts = { method: 0, experience: 0, prompt: 0 };
    cognitions.forEach((c) => {
      if (c.type in counts) counts[c.type]++;
    });
    return counts;
  }, [cognitions]);

  const filterButtons: { key: "all" | CognitionType; label: string; count?: number }[] = [
    { key: "all", label: "全部", count: cognitions.length },
    { key: "method", label: "方法论", count: typeCounts.method },
    { key: "experience", label: "经验", count: typeCounts.experience },
    { key: "prompt", label: "提示词", count: typeCounts.prompt },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* 页头 */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">认知库</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            自动沉淀方法论、经验、提示词 · 共 {cognitions.length} 条
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExtractOpen(true)}
            className="btn-primary-glass flex h-8 items-center gap-1.5 px-3 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI 提取认知</span>
          </button>
          <HelpButton module="cognition" />
        </div>
      </div>

      {/* 工具栏 */}
      <div className="glass-card mb-4 flex items-center justify-between gap-3 px-3 py-2">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索认知内容或来源..."
            className="w-full rounded-lg border-0 bg-transparent py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-cognition/20"
          />
        </div>
        <div className="flex items-center gap-1">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setFilterType(btn.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                filterType === btn.key
                  ? "bg-cognition/15 text-cognition"
                  : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
              )}
            >
              {btn.label}
              {btn.count !== undefined && (
                <span className="ml-1 opacity-60">{btn.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-cognition" />
          <p className="mt-3 text-sm text-muted-foreground">加载认知库...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <Brain className="h-12 w-12 text-cognition/40" />
          <p className="mt-4 text-sm font-medium text-foreground">
            {cognitions.length === 0 ? "认知库为空" : "无匹配结果"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cognitions.length === 0
              ? "点击右上角「AI 提取认知」从灵感或对话中沉淀知识"
              : "尝试更换关键词或切换类型过滤"}
          </p>
          {cognitions.length === 0 && (
            <button
              onClick={() => setExtractOpen(true)}
              className="btn-primary-glass mt-4 flex h-8 items-center gap-1.5 px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              开始提取
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((c) => {
              const meta = COGNITION_TYPE_META[c.type] || COGNITION_TYPE_META.method;
              const SourceIcon = SOURCE_ICON[c.source] || Sparkles;
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => setSelectedCognition(c)}
                  className="glass-card group relative flex cursor-pointer flex-col p-4 transition-all hover:-translate-y-0.5"
                >
                  {/* 顶部：类型标签 + 来源 + 时间 */}
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          meta.bg,
                          meta.color,
                          meta.border
                        )}
                      >
                        {meta.label}
                      </span>
                      <span
                        className="flex items-center gap-1 text-[10px] text-muted-foreground/70"
                        title={`来源：${c.source}`}
                      >
                        <SourceIcon className="h-3 w-3" />
                        {c.source === "idea"
                          ? "灵感"
                          : c.source === "conversation"
                            ? "对话"
                            : "手动"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60">
                      {formatRelativeTime(c.createdAt)}
                    </span>
                  </div>

                  {/* 内容 */}
                  <p className="flex-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/85 line-clamp-6">
                    {c.content}
                  </p>

                  {/* 标签（如果有） */}
                  {Array.isArray(c.tags) && c.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.tags.slice(0, 4).map((tag, i) => (
                        <span
                          key={i}
                          className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          #{tag}
                        </span>
                      ))}
                      {c.tags.length > 4 && (
                        <span className="text-[10px] text-muted-foreground/60">
                          +{c.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 删除按钮（hover 显示） */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(c);
                    }}
                    title="删除认知"
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* AI 提取弹窗 */}
      <Modal
        open={extractOpen}
        onClose={() => {
          setExtractOpen(false);
          setExtractContent("");
        }}
        title="AI 提取认知"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-cognition/20 bg-cognition/5 p-3 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cognition" />
            <p>
              粘贴一段灵感、对话记录或工作总结，AI 会自动从中提取方法论、经验和提示词，分类入库到认知库。
            </p>
          </div>
          <textarea
            value={extractContent}
            onChange={(e) => setExtractContent(e.target.value)}
            placeholder="在此粘贴要提取的内容...（支持长文本，AI 会自动分类）"
            rows={8}
            className="w-full resize-none rounded-xl border border-border/60 bg-background/40 p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:ring-2 focus:ring-cognition/20"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {extractContent.length} / 10000 字符
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setExtractOpen(false);
                  setExtractContent("");
                }}
                className="btn-glass flex h-8 items-center px-3 text-xs"
              >
                取消
              </button>
              <button
                onClick={() => extractMutation.mutate(extractContent)}
                disabled={!extractContent.trim() || extractMutation.isPending}
                className="btn-primary-glass flex h-8 items-center gap-1.5 px-3 text-xs disabled:opacity-50"
              >
                {extractMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    提取中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    开始提取
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="删除认知"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground/80">
            确认删除这条认知？此操作不可撤销，关联的记忆图谱节点也会一并清理。
          </p>
          {deleteTarget && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    COGNITION_TYPE_META[deleteTarget.type]?.bg,
                    COGNITION_TYPE_META[deleteTarget.type]?.color,
                    COGNITION_TYPE_META[deleteTarget.type]?.border
                  )}
                >
                  {COGNITION_TYPE_META[deleteTarget.type]?.label || deleteTarget.type}
                </span>
              </div>
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {deleteTarget.content}
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="btn-glass flex h-8 items-center px-3 text-xs"
            >
              取消
            </button>
            <button
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              确认删除
            </button>
          </div>
        </div>
      </Modal>

      {/* 详情查看弹窗 */}
      <Modal
        open={!!selectedCognition}
        onClose={() => setSelectedCognition(null)}
        title="认知详情"
        size="lg"
      >
        {selectedCognition && (() => {
          const meta = COGNITION_TYPE_META[selectedCognition.type] || COGNITION_TYPE_META.method;
          const SourceIcon = SOURCE_ICON[selectedCognition.source] || Sparkles;
          return (
            <div className="space-y-4">
              {/* 头部：类型标签 + 来源 + 相对时间 */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                    meta.bg,
                    meta.color,
                    meta.border
                  )}
                >
                  {meta.label}
                </span>
                <span
                  className="flex items-center gap-1 text-[11px] text-muted-foreground"
                  title={`来源：${selectedCognition.source}`}
                >
                  <SourceIcon className="h-3 w-3" />
                  {selectedCognition.source === "idea"
                    ? "灵感"
                    : selectedCognition.source === "conversation"
                      ? "对话"
                      : "手动"}
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  {formatRelativeTime(selectedCognition.createdAt)}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground/60">
                  {new Date(selectedCognition.createdAt).toLocaleString("zh-CN")}
                </span>
              </div>

              {/* 正文：完整内容（可滚动） */}
              <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                  {selectedCognition.content}
                </p>
              </div>

              {/* 标签区（显示全部） */}
              {Array.isArray(selectedCognition.tags) && selectedCognition.tags.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                    标签（{selectedCognition.tags.length}）
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCognition.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 底部：关闭 + 删除 */}
              <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                <button
                  onClick={() => setSelectedCognition(null)}
                  className="btn-glass flex h-8 items-center px-3 text-xs"
                >
                  关闭
                </button>
                <button
                  onClick={() => {
                    setDeleteTarget(selectedCognition);
                    setSelectedCognition(null);
                  }}
                  disabled={deleteMutation.isPending}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  删除
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
